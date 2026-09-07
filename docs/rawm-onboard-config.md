# RAWM — config onboard e binds reais (`0x14`)

Como o mouse relata os próprios mapeamentos e os perfis onboard, e o que disso o app já
tem pronto. Levantado em 2026-09-06 a partir da biblioteca do fabricante, sem hardware.

Isto corrige uma afirmação de `smoke-test-leviathan-v4.md`, que dava o `0x14` como
"um formato de relato mais compacto". Ele não é.

## Como reproduzir o levantamento

`rawmtech.com/hub.html` carrega `hub.miracletek.net/hub/js/library.min.js`, ofuscado com
string-array (obfuscator.io). Para desofuscar:

1. Baixe com `curl --compressed` — sem isso vem gzip cru.
2. Extraia por chaveamento as funções `_0x1d36` (o array) e `_0x70bc` (o decodificador),
   mais a IIFE inicial, que **rotaciona o array** e precisa rodar antes.
3. `_0x70bc(i)` devolve `array[i - 0x139]`.
4. Substitua todo `_0xNNN(0xHEX)` cujo índice resolva para string.

Na versão `v=202606012357` isso rende 9062 substituições sem nenhuma falha, e o resultado
é legível o suficiente para ler os handlers.

## 1. O `0x14` é notificação, não configuração

```
NOTIFY_TYPE_MOUSE_CONFIG        = 0x14
NOTIFY_TYPE_MOUSE_ONBOARD_INDEX = 0x22
```

Chega como evento `CMD_NOTIFY` (`0x0b`), com o tipo no índice 2 e o payload a partir do 3 —
exatamente a forma que `notifications.ts` já decodifica. Hoje esses tipos caem no `default`
e são descartados.

Como _CONFIG_ type, `0x14` é `CONFIG_TYPE_MOUSE_QUICK_DROP`, outra coisa. A confusão entre
os dois espaços de constantes é o que gerou a descrição errada no doc anterior.

## 2. O dump é um stream delimitado, um bloco por slot

Do handler do fabricante:

| payload           | significado                                                               |
| ----------------- | ------------------------------------------------------------------------- |
| 1 byte, `!= 0xff` | abre o dump do slot de índice `payload[0]`; **zera** a lista daquele slot |
| multi-byte        | uma entrada de tecla do slot corrente                                     |
| 1 byte, `== 0xff` | fecha o dump                                                              |

Entre entradas o fabricante tolera 2000 ms antes de declarar erro.

O destino é `device_info.allKeyConfigs[onboard_index]`, e esse array é alocado assim:

```js
let arr = [];
while (arr.length < client.onboardConfigNum) arr.push([]); // onboardConfigNum = ocn
```

Ou seja: **uma lista por slot onboard**, endereçada pelo marcador de índice. O modelo de
dados do fabricante prevê ler todos os slots sem trocar o perfil ativo.

## 3. O layout de cada entrada é o mesmo da escrita

```
[0]     cmd    (&0x0f == CMD_CONFIG 0x03)
[1]     len    (12 bits: payload[0] << 4 & 0xf00 | payload[1] & 0xff)
[2]     tipo   0x16 MOUSE_KEY | 0x18 MOUSE_FUNCTION | 0x05 MACRO | 0x2b MACRO_APPEND
[3]     count de key ids (<= 2; dois = camada R-Plus, ativador primeiro)
[4..]   os key ids
MOUSE_KEY:      mod1, key_type, key_code, [mod2]
MOUSE_FUNCTION: touch_type, function, function_data, [data_hi]
```

O comprimento de 12 bits é o mesmo que `eventLength()` em `protocol.ts` já decodifica, e o
corpo é o inverso exato de `encodeMouseKey`/`encodeMouseFunction`. Não há formato novo a
implementar: só a direção de leitura.

Na roda, o fabricante lê `key_code` e calcula `abs(code - 0x40)`; acima de `0x40` é para
cima, abaixo é para baixo.

## 4. O gatilho já existe no app

`send_event_query` monta `[CMD_QUERY, 0, OS_PC, 0, 0, ...8 bytes de timestamp]` — byte a
byte o que `buildQueryEvent()` já monta. Depois de enviar para um não-receptor, o
fabricante apenas marca `querying_more_result = true` e **espera**.

Consequência: **o mouse já despeja a config onboard a cada connect que o app faz hoje.**
`queryRawmDevice` resolve no primeiro `0x02` e dá `unsubscribe`, jogando o dump fora. Ler
os binds não exige comando novo — exige continuar ouvindo.

## 5. Trocar o perfil ativo

Não existe `CONFIG_TYPE_ONBOARD`. `send_event_mouse_param` empacota `device_info.onboard`
dentro do bloco `0x15`, logo depois de `cpiLevels` e antes de `powerMode` — a mesma posição
em que `mouseParamSnapshot.ts:116` já escreve `state.onboard`.

Trocar de perfil é enviar `0x15` com outro `onboard`. O encoder já está pronto.

## 6. O que o app ainda não sabe representar

O decodificador do fabricante também lê `CONFIG_TYPE_MACRO`, `MACRO_APPEND`,
`MOUSE_KEY_TYPE_KBD`, `MEDIA`, `AC_PAN` e `FUNCTION_SHELL_CMD`. A tabela `actions` de
`LeviathanV4Driver.ts` tem 11 entradas e não cobre nada disso.

Isso importa por um motivo destrutivo: se um slot com macro for lido e depois regravado,
`writeProfile` manda `CONFIG_RESET` e reconstrói só o que `mappingEvents` conhece — o macro
some da flash. Quem for implementar a leitura precisa **guardar os bytes crus** das
entradas não reconhecidas e reenviá-los na regravação.

## 7. O que ainda depende do hardware

- Se o firmware despeja os quatro slots num dump só ou apenas o ativo. O modelo de dados do
  fabricante prevê os quatro, mas isso é inferência sobre o app dele, não sobre o firmware.
- Se um `0x15` enviado fora do bloco aberto por `CONFIG_RESET` realmente pega.
