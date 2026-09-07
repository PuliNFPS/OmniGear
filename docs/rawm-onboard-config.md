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

## 5. Trocar o perfil ativo: existe, em outra família de comandos

**Corrigido em 2026-09-07. As duas leituras anteriores estavam erradas**, e a segunda —
"não existe comando" — foi afirmada com confiança. O comando existe:

```js
set_onboard_index(client, index) {
  var buf = [];
  buf.push(IQ_SET_PROFILE_ID);   // 0x40
  buf.push(index);
  send_event(client, hs_format_data(client, buf));
}
```

- `IQ_SET_PROFILE_ID = 0x40`, e o par de leitura `IQ_GET_PROFILE_ID = 0x39`.
- `hs_format_data(client, buf)` apenas preenche com zeros até `HS_MAXIMUM_PACKET_SIZE = 0x20`
  (32 bytes). Não há CRC nem enquadramento de comprimento nesta família.
- Chamado com `show_waiting()`, ou seja: é operação de dispositivo, não de UI.

**Por que as leituras anteriores não acharam:** procuraram na família
`CMD_CONFIG` (`0x03`) / `CMD_ACTION` (`0x06`), que é a que este projeto implementa. A troca
vive na família `IQ_*` do **receptor HS** — o dispositivo se enumera como "RAWM HS Receiver".
Concluir "não existe" a partir de uma família só foi o erro; procurar por `set_onboard`
no `library.min.js` o desfaz em um grep.

Também existem as versões ligáveis a botão, que o firmware executa por conta própria:
`FUNCTION_TOGGLE_ONBOARD = 0x11`, `FUNCTION_NEXT_ONBOARD = 0x12`,
`FUNCTION_PREVIOUS_ONBOARD = 0x13`, `FUNCTION_CHOOSE_ONBOARD = 0x14`.

Aberto, e a confirmar em hardware antes de implementar:

- Se `index` é 0-based. É o mais provável: `oci` vale 0 num mouse rodando o slot 1, e este
  projeto já faz `oci + 1`.
- Qual report id esta família usa. O `send_event` do fabricante acumula em
  `client.send_event_buf` e chama `post_send_client_data`; não é o mesmo caminho que
  `WebHidTransport.send` monta hoje.
- Se `ONBOARD_REBOOT_NEEDED` entra no fluxo.

O que continua valendo da leitura anterior: mandar um `0x15` com outro `onboard` para forçar
a troca carregaria junto o DPI, o polling e os parâmetros do slot **anterior** — a consulta
só descreve o ativo — ou seja, sobrescreveria o destino com a origem. Esse caminho segue
errado; o certo é o `0x40`.

E o mouse continua anunciando a troca que ele mesmo faz:
`NOTIFY_TYPE_MOUSE_ONBOARD_INDEX` (`0x22`), com `NOTIFY_TYPE_MOUSE_ONBOARD_STATUS` (`0x23`)
ao lado. **Este app ainda não trata nenhum dos dois**, então hoje ele não segue o mouse
quando o slot muda pelo botão.

### O que `ocs` carrega

`set_onboard_status(client, index, valor)` escreve o byte de status de um slot, e os bits
baixos são cor de LED (`LED_R`, `LED_G`, …) com `0x80` ligado. A captura real é
`ocs = [0x81, 0x82, 0x86, 0x84]` — quatro slots, cores diferentes.

Não é um mapa de ocupado/vazio, e este projeto acerta ao não tratá-lo como tal: usa `ocs`
apenas para **contar** os slots (`onboardSlotCount`) e guarda os bytes opacos no snapshot
(`mouseParamSnapshot.ts`). Quem diz se um slot tem conteúdo é o dump `0x14`.

O fluxo de gravacao, esse sim, confere com o `writeProfile` deste projeto:

```
send_event_config_reset(client)
send_event_action(client, ACTION_SAVE_CONFIG_TO_FDS, 1 | (indice << 8))
...corpo...
send_event_action(client, ACTION_SAVE_CONFIG_TO_FDS, 0)
```

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
