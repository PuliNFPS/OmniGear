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

O comprimento de 12 bits é o mesmo que `event_length` já decodifica no núcleo
(`packages/core/src/protocols/rawm/envelope.rs`), e o corpo é o inverso exato de
`encodeMouseKey`/`encodeMouseFunction`. Não há formato novo a implementar: só a direção de
leitura.

Na roda, o fabricante lê `key_code` e calcula `abs(code - 0x40)`; acima de `0x40` é para
cima, abaixo é para baixo.

## 4. O gatilho já existe no app

`send_event_query` monta `[CMD_QUERY, 0, OS_PC, 0, 0, ...8 bytes de timestamp]` — byte a
byte o que `buildQueryEvent()` já monta. Depois de enviar para um não-receptor, o
fabricante apenas marca `querying_more_result = true` e **espera**.

Consequência: **o mouse já despeja a config onboard a cada connect que o app faz hoje.**
`queryRawmDevice` resolve no primeiro `0x02` e dá `unsubscribe`, jogando o dump fora. Ler
os binds não exige comando novo — exige continuar ouvindo.

## 5. Trocar o perfil ativo: não encontrado no lado do mouse

**Terceira leitura, 2026-09-07.** A segunda dizia "não existe comando". Uma terceira tentou
derrubá-la apontando `IQ_SET_PROFILE_ID` (`0x40`) — e **estava errada, por um grep
descuidado**: `set_onboard_index` só aparece como substring de `hs_set_onboard_index`.

O que ficou **verificado**, e é o que importa para não repetir o erro:

- `hs_set_onboard_index` / `IQ_SET_PROFILE_ID = 0x40` é **teclado**, não mouse. As duas
  únicas ocorrências de `set_onboard_index` são `hs_`; o call site é
  `select(kbd_onboard-config)`; e `send_client_data` desvia para `hs_send_client_data`
  apenas quando `is_hs_keyboard(device)`, que é verdade só para dois `productName` de
  teclado HS. A família `IQ_*` com `HS_MAXIMUM_PACKET_SIZE = 0x20` é desse caminho.
- No lado do mouse existem **23** call sites de `send_event_mouse_param` (o bloco `0x15`),
  todos no mesmo formato: muta um campo de `device_info` e reenvia o bloco. Nenhum deles
  escreve o índice onboard ativo, e o grep por escrita em `device_info…onboard` volta vazio.
- Existe um handler de mouse `select(onboard-config)`, distinto do de teclado, mas ele é
  registrado através da tabela de strings ofuscada e **não foi lido**. É aí que uma quarta
  leitura deve começar.

Ou seja: **segue não encontrado, não provado impossível.** A diferença importa.

### Confirmado na UI do fabricante, 2026-09-07

Duas capturas do hub, alternando entre `Onboard config ①` e `Onboard config ②`, fecham a
questão pelo lado da observação:

- O marcador **`◀`** aparece no `①` enquanto se edita o `①`, e **desaparece** ao trocar o
  dropdown para o `②`. É o `<option>` recebendo `'◀'` quando bate com
  `get_onboard_index(client)`: o slot que o mouse **está rodando**. Trocar o dropdown não o
  move.
- Portanto **o dropdown do mouse é cursor de edição, não troca de slot.** Quem grava é o
  botão "Apply & onboard".
- O termo do fabricante na UI do mouse é **"Onboard config N"**, com numerais circulados —
  não "Onboard Memory".

Isso também confirma o `ocs` por observação, não só por leitura de código: o seletor
**`Light`** mostra cor diferente por slot (branco no `①`, verde no `②`), e o toggle
**`Switchable`** é o bit `0x80` — no JS, `valor | 0x80` ao marcar e `valor & ~0x80` ao
desmarcar. A captura `ocs = [0x81, 0x82, 0x86, 0x84]` tem `0x80` nos quatro.

O mapeamento exato de cor segue **em aberto**: se os bits baixos fossem flags RGB, `0x82`
→ verde casa com o `②`, mas `0x81` → vermelho contradiz o branco observado no `①`. Falta
saber que cor o `③` (`0x86`) e o `④` (`0x84`) mostram.

### Uma correção real que sobrou dessa investigação

O argumento da leitura anterior — "mandar um `0x15` com outro `onboard` carregaria o DPI e
os parâmetros do slot anterior, sobrescrevendo o destino com a origem" — **não se sustenta
como estava**. O padrão do próprio fabricante é exatamente esse, 23 vezes:

```js
set_onboard_status(client, index, valor) {
  if (client.device_info.onboardStatus[index] != valor) {
    client.device_info.onboardStatus[index] = valor;
    send_event_mouse_param(client);   // o bloco 0x15
    return true;
  }
}
```

Reenviar o snapshot **atual** com um campo alterado não escreve dado velho — escreve o que
está lá, mais a mudança. Este projeto já guarda o snapshot completo e opaco
(`encode_mouse_param_snapshot`), então tem o material para fazer o mesmo. O que falta é
saber **qual campo** carrega o índice ativo, e isso não foi estabelecido.

### O que `ocs` carrega

`set_onboard_status` é mouse-side (10 ocorrências, nenhuma `hs_`/`kbd_`) e escreve o byte de
status de um slot: os bits baixos são cor de LED (`LED_R`, `LED_G`, …) com `0x80` ligado. A
captura real é `ocs = [0x81, 0x82, 0x86, 0x84]` — quatro slots, cores diferentes.

Não é um mapa de ocupado/vazio, e este projeto acerta ao não tratá-lo como tal: usa `ocs`
apenas para **contar** os slots (`onboardSlotCount`) e guarda os bytes opacos no snapshot
(`mouseParamSnapshot.ts`). Quem diz se um slot tem conteúdo é o dump `0x14`.

**Consequência prática:** escolher uma memória no hub do fabricante pode escrever a cor de
LED daquele slot via `0x15`. O mouse reage visivelmente, o que é fácil de ler como "ele
trocou de slot" sem que troca alguma tenha acontecido.

### Notificações do mouse

`NOTIFY_TYPE_MOUSE_ONBOARD_INDEX` (`0x22`) e `NOTIFY_TYPE_MOUSE_ONBOARD_STATUS` (`0x23`): o
mouse anunciando o que ele mesmo mudou. O app agora consome `0x22`: seu primeiro byte é o
índice ativo, começando em zero. `0x23` ainda não é representado na interface.

Ligáveis a botão, executadas pelo firmware: `FUNCTION_TOGGLE_ONBOARD = 0x11`,
`FUNCTION_NEXT_ONBOARD = 0x12`, `FUNCTION_PREVIOUS_ONBOARD = 0x13`,
`FUNCTION_CHOOSE_ONBOARD = 0x14`.

O fluxo de gravacao, esse sim, confere com o `writeProfile` deste projeto:

```
send_event_config_reset(client)
send_event_action(client, ACTION_SAVE_CONFIG_TO_FDS, 1 | (indice << 8))
...corpo...
send_event_action(client, ACTION_SAVE_CONFIG_TO_FDS, 0)
```

### Separação no editor, 2026-09-09

O editor agora mantém `editingProfileSlot` separado de `activeProfileSlot`, que continua
sendo o último slot informado pelo dispositivo. Selecionar um perfil de mouse carrega
somente seu rascunho e sua versão salva, sem trocar o slot ativo nem enviar configurações.
O seletor e os cartões distinguem **Em edição** de **Ativo no mouse**; salvar, importar,
exportar e as confirmações usam o nome do perfil em edição.

No mouse, o botão **Aplicar no onboard · Slot N** aplica e persiste o rascunho no slot
indicado. É a ação explícita de gravação, equivalente ao fluxo “Apply & onboard”;
ela não confirma sozinha uma troca do slot ativo. O botão também funciona sem alterações
pendentes, permitindo aplicar uma memória já preenchida.

`save` grava no cursor de edição; `saveToSlot` e `renameProfile` usam seu destino explícito.
Uma tentativa após falha conserva o destino e o conteúdo da operação original. No driver,
as entradas opacas preservadas na gravação também são buscadas no slot de destino.

A prévia de ajustes permanece disponível ao editar o slot ativo. Em outro slot, os ajustes
ficam no rascunho até salvar. **Descartar e carregar** desfaz explicitamente a prévia do
slot ativo antes de carregar o destino; a seleção simples continua sem escrita. Durante
uma aplicação em andamento, a troca de cursor aguarda seu resultado. Dumps de perfis e
notificações de DPI não substituem o rascunho de outro slot.

Após gravar, uma consulta de leitura atualiza o indicador com `oci` e o DPI com `cpi`.
Não há atribuição otimista do destino ao slot ativo. Falha nessa consulta mantém a gravação
como concluída e informa que o slot ativo não foi confirmado. A notificação `0x22` também
atualiza o indicador; o parâmetro opaco `ob` continua preservado nos pacotes de parâmetros.

As quatro memórias vêm preenchidas com cópias independentes da configuração da conexão.
As que ainda não tiveram seus parâmetros lidos ou gravados são identificadas como
**Configuração inicial**, sem apresentá-las como uma leitura completa da flash. Os dumps
substituem os bindings conhecidos sem repor DPI e polling com valores antigos.

O DPI de sessão (`liveDpi`) é independente do rascunho. O botão físico é acompanhado mesmo
antes da primeira edição e enquanto outra memória está aberta. Reportes recebidos durante
uma operação são reconciliados ao seu término; ecos antigos não substituem uma nova edição
pendente. Uma troca física de memória interrompe os próximos eventos da prévia em andamento.

A faixa de DPI é a do sensor do modelo, 100–45.000, conforme a
[especificação oficial](https://www.rawmshop.com/pt/products/leviathan-v4), e não o mínimo/máximo
dos estágios salvos em `cpi_l`. As notificações `0x00` e `0x06` atualizam o DPI, com X/Y
decodificados separadamente quando empacotados.

A validação automatizada cobre store, UI, leitura de retorno e eventos enviados pelo
driver usando o WASM real; a alteração não foi validada por gravação em hardware nesta etapa.

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
