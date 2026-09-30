# Núcleo Rust como backend da web e do desktop

Data: 2026-09-07

## Contexto

A intenção declarada do projeto é ter um núcleo em Rust que faça o trabalho pesado de
backend para as duas cascas — o app web hoje, um app desktop depois — através de uma ponte
por plataforma. O código foi na direção oposta.

Medido em 2026-09-07:

| onde                                 | linhas    |
| ------------------------------------ | --------- |
| núcleo Rust inteiro                  | **211**   |
| `packages/core/src/protocols/mod.rs` | **1**     |
| camada de protocolo em TypeScript    | **3.009** |

O núcleo tem cinco funções que colam três bytes na frente de um payload, mais andaime
vazio. O protocolo RAWM de verdade — enquadramento, CRC16, montador de eventos, snapshot de
parâmetros, decodificação do dump onboard `0x14` — está todo em `apps/web/src/hardware/`.

A ponte web também não está ligada:

- O CI (`.github/workflows/verify.yml`) instala Rust, clippy, rustfmt e cargo-machete, mas
  **não instala `wasm-pack`**, e `pnpm verify` nunca gera o `.wasm`.
- `packages/core/pkg/.gitignore` é `*` e só três arquivos são versionados. O
  `index_bg.wasm` **não está no git**, então publicar a glue gerada buscaria um arquivo
  inexistente.
- `packages/core/pkg/index.js` versionado é uma **ponte em JavaScript escrita à mão**, um
  espelho do `lib.rs`. É ela que roda em produção hoje.
- `pnpm dev` chama `core:prepare`, que roda `core:build` quando `wasm-pack` está no PATH e
  substitui essa ponte pela glue gerada. Como os encoders são chamados de forma síncrona e
  `init()` não era aguardado, isso quebrava todo o app em silêncio (corrigido no PR #7).

**Atualizado em 2026-09-07:** esta lista descreve o estado que existia antes do plano
`docs/superpowers/plans/2026-09-07-ponte-web-do-nucleo.md`. Esse plano fechou este ponto — ver
a nota em `## A ponte JS escrita à mão`, mais abaixo.

Ou seja: a arquitetura está declarada, a ponte está desligada, e existem duas
implementações do mesmo protocolo defendidas apenas por vetores de bytes duplicados no
`cargo test` e no `coreBridge.test.ts`.

## Objetivo

Fazer o núcleo Rust ser de fato o backend do protocolo, consumido pela web via WASM e por um
desktop via ligação nativa, com uma casca fina e descartável por plataforma.

## Não-objetivos

- **Escolher o stack do desktop.** Ele é desconhecido, e o desenho não pode exigir que se
  saiba. Esta é a restrição que guia as decisões abaixo.
- **Migrar a UI.** React e componentes continuam onde estão. As stores continuam guardando
  estado de tela — rascunho, o que está salvo, o que a tela mostra —, mas a sessão de
  dispositivo que hoje mora dentro delas desce para o núcleo (ver Fronteira).
- **Ganhar desempenho.** Não é o motivo e não haveria ganho: os encoders produzem arrays de
  10 a 15 bytes. O motivo é ter **uma implementação só**.

## A restrição que decide tudo

Como não sabemos qual será a casca do desktop, o núcleo não pode assumir nenhuma. Disso saem
três regras, e elas são o coração deste spec.

### Regra 1 — o núcleo não faz I/O

O núcleo recebe bytes e devolve bytes ou decisões. Quem fala com o dispositivo é a casca.

Justificativa concreta: na web o transporte é WebHID, com `sendReport` assíncrono e
permissão concedida por gesto do usuário; num desktop seria `hidapi` ou equivalente, com
modelo de erro e de concorrência diferentes. Um núcleo que soubesse abrir dispositivos
precisaria escolher um desses modelos — e escolheria errado para a outra metade.

### Regra 2 — o núcleo é síncrono

Os encoders devem ser chamáveis sem `await`. Inicializar a ponte é trabalho da casca, uma
vez, antes de usar.

Justificativa concreta: o bug de 2026-09-07 foi exatamente isto. A glue gerada exige
`init()` e o driver chamava `encodeConfigReset()` de forma síncrona; toda escrita falhava
instantaneamente. Um núcleo assíncrono espalharia esse acoplamento por todo o driver.

### Regra 3 — o núcleo não conhece `wasm-bindgen`

Hoje `lib.rs` importa `wasm_bindgen::prelude::*` no topo do crate e aplica `#[wasm_bindgen]`
direto nas sete funções do núcleo. Isso faz o núcleo ser moldado pelo navegador.

`wasm-bindgen` restringe assinaturas: nada de `Result<T, E>` com erro rico, nada de tipos
emprestados complexos, nada de enums com dados. Enquanto o núcleo eram cinco funções de
bytes isso não incomodava. Com o protocolo inteiro lá dentro, incomoda muito — e amarraria o
desktop às limitações da web.

**Proposta:** separar em dois crates.

- `gearhub-core` — Rust puro, **sem dependência de wasm-bindgen**. API idiomática, com
  `Result` e erros tipados. É isto que o desktop consome.
- `gearhub-core-wasm` — casca fina que só reexporta com `#[wasm_bindgen]`, achatando tipos
  para o que a web aceita.

## Fronteira: o que é núcleo e o que é casca

**Atualizado em 2026-09-16:** as duas tabelas desta seção estão desatualizadas — faltam três
arquivos e uma medida ficou por baixo. O inventário válido está em
`# Escopo corrigido em 2026-09-16`, ao final. O princípio abaixo continua valendo; só a
contabilidade mudou.

**Decidido: o TypeScript é apenas front.** O Rust é o backend completo — protocolo, estado de
dispositivo e as decisões sobre o que enviar. Tudo que não for renderizar, reagir a entrada do
usuário ou executar a chamada HID que só o navegador expõe pertence ao núcleo.

Isso corrige a direção que o código tomou: as funcionalidades de dispositivo foram sendo
adicionadas em TypeScript e o núcleo ficou de fora, que é como se chegou a 211 linhas contra
3.009.

O teste é uma pergunta: **isso mudaria se a casca mudasse?** Se sim, é casca.

**Vai para o núcleo** (protocolo, idêntico nos dois alvos):

| arquivo hoje                    | linhas      | conteúdo                                                          |
| ------------------------------- | ----------- | ----------------------------------------------------------------- |
| `protocol.ts`                   | 147         | CRC16, enquadramento, comprimento de 12 bits, montador de eventos |
| `leviathanV4Keys.ts`            | 66          | key ids e tabela de ações                                         |
| `mouseParamSnapshot.ts`         | 188         | parse e encode do bloco de parâmetros                             |
| `onboardConfig.ts`              | 168         | decodificação do dump `0x14` e conversão em settings              |
| parte de `LeviathanV4Driver.ts` | ~150 de 303 | montagem de eventos, assinatura de mapeamentos                    |

**Fica na casca** (plataforma, descartável):

| arquivo                            | por quê                                                      |
| ---------------------------------- | ------------------------------------------------------------ |
| `WebHidTransport.ts`               | no desktop vira `hidapi`; timeouts e listeners são do WebHID |
| `deviceDiscovery.ts`               | seletor e permissão são do navegador                         |
| `deviceStore.ts`, `editorStore.ts` | **só** o estado de tela: rascunho, salvo, status visível     |
| componentes React                  | UI                                                           |

Duas ressalvas honestas sobre essa tabela.

**O transporte não pode subir, e isso não é preferência.** `navigator.hid` só é alcançável a
partir de JavaScript, e a permissão exige gesto do usuário no navegador. O `WebHidTransport`
fica sendo um braço mecânico: o núcleo decide o que enviar e devolve `HidCommand`, a casca
executa `sendReport` e devolve os bytes que chegaram. Nenhuma decisão vive ali.

**A orquestração se divide.** Com o TypeScript sendo apenas front, ela deixa de ser ambígua:

- **Núcleo:** serialização por dispositivo, a fila de aplicação, o que é "última escrita
  vence", saber que mapeamentos o dispositivo já tem, decidir se um apply precisa reescrever
  tudo ou só os parâmetros. Isso é sessão de dispositivo, não interface.
- **Casca:** o debounce de 180 ms. Ele existe porque arrastar um slider gera um evento por
  pixel — é uma decisão sobre entrada do usuário, e o desktop teria a sua própria.

O `editorStore` continua guardando rascunho e o que está salvo, porque isso é estado de tela.
Mas "o que o dispositivo de fato tem" passa a ser pergunta para o núcleo.

## Modelagem: enums, e o que muda com vários periféricos

O andaime já aponta para a forma certa. `MouseDriver` devolve
`HidCommand { report_id, data }` — o núcleo monta comandos e a casca envia — e nenhum dos
tipos de domínio carrega `#[wasm_bindgen]`. Só as funções livres do `lib.rs` carregam.

### O caso concreto que exige enum com dados

O vocabulário de ações do app hoje é uma união plana de onze strings em TypeScript. Ela **não
representa** macro, tecla de teclado, mídia ou pan horizontal — todos coisas que o mouse
reporta de verdade no dump `0x14`. O contorno atual, em `onboardConfig.ts`, é guardar os bytes
num campo paralelo e deixar `action: null`.

Em Rust isso é uma variante:

```rust
pub enum MouseAction {
    Button(MouseButton),
    Wheel(WheelDirection),
    Dpi(DpiAction),
    Keyboard { modifiers: Modifiers, key: KeyCode },
    Media(MediaKey),
    Macro(MacroId),
    Disabled,
    /// O que esta versão não sabe nomear, preservado byte a byte.
    Unknown(Vec<u8>),
}
```

`Unknown(Vec<u8>)` transforma num tipo aquilo que hoje é um remendo, e o compilador passa a
**exigir** que todo caminho trate o caso — em vez de depender de alguém lembrar. É também a
prova concreta da Regra 3: `wasm-bindgen` não atravessa enum com dados, então essa modelagem
só existe se o núcleo não conhecer a macro.

### Conjunto fechado ou aberto

São dois eixos diferentes, e tratá-los igual é o erro comum:

- **Registry de drivers: aberto.** `Box<dyn MouseDriver>` em vez do `RegisteredDriver` enum
  de hoje. A lista cresce a cada periférico e nada precisa casar exaustivamente sobre ela;
  um enum aqui vira um ponto central editado a cada dispositivo novo.
- **Vocabulário de ações e capacidades: fechado.** Enum, porque a exaustividade é justamente
  a proteção — adicionar uma ação deve quebrar o build onde ela não é tratada.

### O que ainda não decidir

Se as ações forem um enum **compartilhado**, um mouse simples ganha variantes que não suporta;
se forem **por periférico**, os tipos multiplicam e a UI genérica fica difícil. O padrão que
costuma segurar é vocabulário compartilhado mais `Capabilities` por dispositivo declarando o
subconjunto válido — que é o que `MouseCapabilities` já esboça.

Decidir isso agora, com uma amostra de um periférico, é como se erra. A recomendação é
esperar o segundo dispositivo real.

## Tipos do TypeScript: gerados, nunca espelhados

**Decidido.** Com o vocabulário morando no Rust, os tipos do TypeScript são **gerados** a
partir dele (`ts-rs`, `typeshare` ou equivalente), como artefato de build.

Espelhar à mão recria exatamente a divergência que esta migração existe para eliminar — e o
repositório já tem a prova de que ela acontece: a ponte JS escrita à mão ao lado do `lib.rs`,
defendida só por vetores de bytes duplicados, mais duas assinaturas de `init()` que já
divergiram e reprovaram um typecheck.

Consequência prática: `@gearhub/shared` deixa de ser a fonte da verdade do vocabulário de
dispositivos e passa a consumir o que o núcleo gera. Tipos de UI que não descrevem
dispositivo continuam onde estão.

## Ordem da migração

**Substituída em 2026-09-16** por `## Ordem corrigida`, ao final: ganhou um passo 0 (vetores
de conformidade) e os passos absorveram os arquivos que faltavam. A ordem abaixo fica como
registro. O critério de ordenação e a barra de verificação não mudaram.

Do mais portável e mais coberto por testes para o menos. Cada passo é independente, entrega
redução de duplicação, e pode parar no meio sem deixar o repositório inconsistente.

1. **`protocol.ts`** — CRC16, enquadramento, montador. Puro, sem dependência de plataforma,
   já bem testado. É o melhor primeiro passo porque é o mais fácil de provar byte a byte.
2. **`leviathanV4Keys.ts`** — só tabelas. Quase mecânico.
3. **`mouseParamSnapshot.ts`** — parse e encode do bloco de parâmetros.
4. **`onboardConfig.ts`** — decodificação do dump `0x14`.
5. **Codificação do `LeviathanV4Driver.ts`** — a montagem de eventos e a assinatura de
   mapeamentos, deixando fila e transporte na casca.

### Como verificar cada passo

Um passo só está pronto quando:

1. A lógica existe em Rust com os testes portados.
2. O TypeScript **apagou** sua implementação e passou a chamar a ponte — migrar sem apagar
   cria uma terceira cópia.
3. Suítes verdes dos dois lados: `cargo test` e `vitest run`.
4. **Paridade byte a byte** contra vetores compartilhados (ver abaixo).
5. Para os passos 3 a 5, **confirmação em hardware**: eles tocam o caminho de escrita que
   acabou de ser estabilizado, e nenhum teste unitário alcança o firmware.

### Vetores de conformidade

Enquanto as duas implementações coexistirem, a defesa contra divergência não pode ser
"lembrar de atualizar os dois". Propõe-se um arquivo de vetores versionado — entrada e saída
esperada em bytes — lido pelos testes Rust **e** pelos testes TypeScript. Um encoder que
divergir quebra os dois lados no mesmo commit.

Isso substitui a duplicação manual que existe hoje entre `lib.rs` e `coreBridge.test.ts`.

## A ponte JS escrita à mão

Ela é a fonte da divergência e deve **desaparecer** ao fim da migração.

Enquanto existir, ela é o que roda em produção, e um encoder migrado para o Rust não tem
efeito nenhum no app publicado até o CI passar a construir o WASM. Por isso a mudança de CI
abaixo não é opcional nem posterior: sem ela, a migração é trabalho sem entrega.

Alternativa considerada e rejeitada: manter a ponte JS como fallback permanente para quando o
WASM não carregar. Rejeitada porque recria exatamente a duplicação que a migração existe para
eliminar, e o fallback divergiria em silêncio — o pior modo de falha possível.

**Fechado em 2026-09-07** pelo plano `docs/superpowers/plans/2026-09-07-ponte-web-do-nucleo.md`:
a ponte foi removida, o build gera o WASM e os testes o exercitam.

## O que o CI precisa passar a fazer

1. Instalar `wasm-pack` no `verify.yml`.
2. Construir o núcleo como parte do build: tarefa `build` para `@gearhub/core` no
   `turbo.json`, com `outputs` apontando para `pkg/**`.
3. Publicar o `.wasm` como asset do deploy. Ele é ignorado pelo git de propósito
   (`pkg/.gitignore` é `*`), então precisa vir do build, nunca do repositório.
4. Servir com `Content-Type: application/wasm`.
5. Rodar `cargo test` como já roda, agora cobrindo o protocolo migrado.

## Política de falha do WASM

Com o núcleo em WASM, um `.wasm` que não carrega significa um cliente que não configura nada.
Isso precisa de decisão explícita, não de um `catch` vazio.

Proposta: o app **renderiza mesmo assim** — tudo que não toca hardware continua utilizável —
e a área de dispositivos mostra o motivo, com a mensagem vinda de `reportHardwareFailure`. É
o comportamento que o PR #7 já implementa no bootstrap.

## Riscos

- **A migração toca o caminho de escrita recém-estabilizado.** Os passos 3 a 5 mexem em
  código confirmado em hardware. Cada um precisa de nova confirmação; um erro aqui volta a
  quebrar a configuração do mouse.
- **Duas implementações coexistem durante a migração.** Os vetores de conformidade reduzem
  isso, mas não eliminam enquanto o último passo não fechar.
- **O `.wasm` não está no git.** Qualquer passo em falso no CI publica um app que não
  configura nada. Vale um smoke test de produção que carregue o núcleo e falhe o deploy se
  não carregar.
- **A fronteira ficou mais ambiciosa.** Com o TypeScript sendo apenas front, a sessão de
  dispositivo desce para o núcleo — e ela é justamente o código que acabou de ser
  estabilizado contra hardware (fila, última-escrita-vence, saber o que o mouse já tem). É o
  passo mais arriscado da migração e o que mais precisa de confirmação no mouse.
- **O stack do desktop pode contradizer a fronteira.** Se ele exigir mais ou menos do núcleo
  do que o previsto, o passo 5 muda de forma. As regras 1 a 3 existem para que essa
  descoberta custe pouco.

## Como isto não volta a acontecer

O núcleo não ficou para trás por decisão: funcionalidade de dispositivo foi sendo pedida e
entregue em TypeScript, que é onde o app já estava, e ninguém parou para perguntar de que lado
da fronteira aquilo caía. Sem uma regra escrita, o caminho de menor resistência sempre aponta
para a casca.

**Regra:** comportamento novo de dispositivo — protocolo, decodificação, decisão sobre o que
enviar, estado do que o dispositivo tem — entra no Rust. TypeScript recebe apenas o que
renderiza, o que reage a entrada do usuário, e a chamada HID que só o navegador expõe.

Na prática isso significa que uma tarefa de dispositivo que só produza `.ts` merece a
pergunta: por que isto não está no núcleo? Enquanto a migração não fechar haverá exceções
legítimas — mas devem ser exceções declaradas, não o padrão.

Vale replicar essa regra no `CLAUDE.md`, que é o que um agente lê antes de escolher onde
escrever.

## Questões em aberto

- **Qual será o stack do desktop.** Se for Tauri, a casca TypeScript é reaproveitada e a
  fronteira acima serve como está. Se for uma UI nativa própria, a casca web é descartada —
  o que reforça a decisão de manter em TypeScript só o que é descartável.
- **Se o app web deve ter fallback.** Este spec propõe que não. Se a taxa de falha de
  carregamento do WASM em produção se mostrar relevante, a decisão volta à mesa — mas com
  dados, não por precaução.
- **Enum de ações compartilhado ou por periférico.** Decidir com o segundo dispositivo real
  na mão, não agora.

---

# Escopo corrigido em 2026-09-16

Este spec foi aprovado em 2026-09-07. Desde então o TypeScript andou, e duas decisões de
fronteira que ele não previa foram tomadas. Esta seção substitui as tabelas de `## Fronteira`
e a lista de `## Ordem da migração` acima — elas ficam como registro do que se pensava então.

## O que já foi feito

Duas coisas que este spec pedia estão prontas e saem do plano:

- **Regra 3, os dois crates.** `258290b` separou `gearhub-core` (Rust puro) de
  `gearhub-core-wasm` (a casca com `#[wasm_bindgen]`). O núcleo não conhece mais a macro.
- **A ponte JS escrita à mão.** Removida no PR #9; o build gera o WASM e os testes o
  exercitam. O CI instala `wasm-pack` (`verify.yml:39`) e o `turbo.json` constrói `pkg/**`.

Dos cinco itens de `## O que o CI precisa passar a fazer`, os itens 1, 2 e 5 estão feitos. Os
itens 3 e 4 — publicar o `.wasm` e servi-lo com `Content-Type` — **não têm onde acontecer**:
só existe `verify.yml`, não há workflow de deploy. Saem do escopo até existir um.

## O que mudou no TypeScript depois da aprovação

Medido contra `1689f2c`, o commit que criou este spec:

| arquivo                | então | hoje    | o que entrou                                                    |
| ---------------------- | ----- | ------- | --------------------------------------------------------------- |
| `LeviathanV4Driver.ts` | 303   | **378** | índice onboard, guardas de revisão, `readState()`, eixos de DPI |
| `leviathanV4.ts`       | 208   | **216** | faixa do sensor, quatro memórias sempre semeadas, `liveDpi`     |
| `notifications.ts`     | 82    | **86**  | notificação `0x22`, o índice onboard que o mouse anuncia        |
| `dpiValue.ts`          | —     | **5**   | arquivo novo: CPI2 empacota X nos 16 bits baixos e Y nos altos  |

Mais a porta `deviceDriver.ts` (+10: `DeviceState`, `readState?()`, relatório
`active-profile`) e `@gearhub/shared` (+9: `initial`, `liveDpi`).

**A consequência importante é no passo mais arriscado.** O crescimento do driver é quase todo
estado de sessão de dispositivo — justamente o que este spec manda descer para o núcleo:

- `activeOnboardIndex` e `slotCount` — qual memória o mouse está rodando.
- `slotRevision` / `applyingSlotRevision` — aborta uma aplicação se a memória ativa mudar no
  meio dela. É decisão sobre o dispositivo, não sobre a tela.
- `dpiRevision` — impede que uma escrita sobrescreva um DPI que o mouse acabou de anunciar.
- `appliedMappings` — o que o mouse de fato tem, que este spec já nomeava.

A estimativa antiga do passo 5 era "~150 de 303". Hoje é da ordem de **250 de 378**. O passo
não mudou de natureza; ficou maior e mais claramente núcleo.

## Inventário corrigido

Três arquivos que este spec nunca mencionou, e um que ele mediu por baixo:

| arquivo                 | linhas | destino                                                      |
| ----------------------- | ------ | ------------------------------------------------------------ |
| `protocol.ts`           | 147    | núcleo                                                       |
| `notifications.ts`      | 86     | núcleo o `parseNotification`; casca o `subscribeTo…`         |
| `dpiValue.ts`           | 5      | núcleo                                                       |
| `leviathanV4Keys.ts`    | 64     | núcleo                                                       |
| `mouseParamSnapshot.ts` | 188    | núcleo                                                       |
| `leviathanV4.ts`        | 216    | **dividido** — ver decisão 2                                 |
| `leviathanV4Lod.ts`     | 29     | núcleo a tabela `raw`→mm; casca o `formatLiftOffDistance`    |
| `onboardConfig.ts`      | 168    | núcleo                                                       |
| `deviceRegistry.ts`     | 84     | núcleo a identidade USB e o casamento; casca o filtro WebHID |
| `LeviathanV4Driver.ts`  | 378    | núcleo a sessão; casca o transporte                          |
| `session.ts`            | 99     | núcleo a decodificação; casca o `await` e o timeout          |
| `connectLeviathanV4.ts` | 29     | casca; o regex do nome é fato do dispositivo e sobe          |
| `leviathanV4Fixture.ts` | 75     | fixture de teste; segue o lado que os testes dele migrarem   |
| `diagnostics.ts`        | 417    | **casca, exceção declarada** — ver decisão 1                 |
| `writeProbe.ts`         | 394    | **casca, exceção declarada** — ver decisão 1                 |
| `WebHidTransport.ts`    | 90     | casca                                                        |
| `deviceDiscovery.ts`    | 128    | casca                                                        |
| `hardwareFailure.ts`    | 16     | casca                                                        |

## Decisão 1 — as sondas ficam na casca, e ficam só na web

`diagnostics.ts` e `writeProbe.ts` não duplicam o protocolo: eles o **importam**. O
`writeProbe` já consome o núcleo Rust em três encoders, via `coreBridge`. Uma correção a uma
leitura anterior — eles são consumidores, não uma segunda implementação.

Isso significa que eles **não são escopo opcional**: quando `protocol.ts` e
`mouseParamSnapshot.ts` forem apagados, seus imports deixam de existir. Eles são tocados
pelos passos 1, 3 e 5, querendo ou não.

**Decidido:** os imports são reapontados para o núcleo a cada passo, e nada mais desce. A
comparação de campos, os estágios do relatório, o hexadecimal, os rótulos e a descoberta de
dispositivo permanecem em TypeScript.

O motivo não é economia. As sondas são **web-only por intenção declarada**: o diagnóstico
pode virar uma ferramenta do app principal para extrair os bytes do mouse do usuário, e essa
ferramenta é feita do navegador — WebHID, permissão por gesto, download do JSON. Não há
diagnóstico de desktop previsto, e descer o modelo de relatório levaria rótulos em português
para dentro do núcleo, que é exatamente o que este spec chama de casca.

Duas condições tornam essa exceção segura, e o plano precisa garantir as duas:

1. **A sonda monta a própria sequência.** Ela não chama o driver nem a orquestração do
   núcleo. É isso que a torna uma segunda opinião: o comentário do `probePollingWrite` diz
   que o apply do driver "não é um teste mínimo", e é verdade — o apply envia CONFIG_RESET, o
   corpo inteiro e todos os mapeamentos, enquanto a sonda envia um evento só.
2. **Mas envia os mesmos bytes.** Hoje `ACTION_SAVE_CONFIG_TO_FDS = 0x34` está declarado
   duas vezes — `LeviathanV4Driver.ts:31` e `writeProbe.ts:308` — e `probeProfileWrite`
   repete a sequência de save do driver. Isso não causa bug em produção, porque
   `diagnostico.html` é uma entrada de build separada que o app principal nunca alcança. Mas
   causa **conclusão errada**, que é pior aqui: confirma-se no mouse a sequência da sonda e
   publica-se a do driver, e o smoke test atesta algo que o app não faz. A constante e os
   encoders de save passam a vir do núcleo.

A distinção que sustenta a exceção: a sonda é independente **no que observa e decide**, não
**no que envia**. Uma sonda que envia bytes diferentes do driver não é uma segunda opinião; é
um segundo protocolo.

## Duplicata declarada no caminho de escrita — `packedDpi`

O núcleo tem `dpi_axes` (`packages/core/src/protocols/rawm/notify.rs`), que **desempacota**
CPI2: X nos 16 bits baixos, Y nos altos. O inverso exato — empacotar X e Y de volta em 32 bits
para escrever — continua em TypeScript, `packedDpi` em
`apps/web/src/hardware/rawm/mouseParamSnapshot.ts:141-143`.

Isso divide um formato de fio simétrico entre os dois lados da fronteira, no **caminho de
escrita**. Cada decisão foi localmente certa: `dpi_axes` migrou porque `dpiValue.ts` está
nomeado no passo 1; `packedDpi` mora num arquivo que pertence ao passo 3. Juntas, elas deixam
a mesma conta — empacotar/desempacotar CPI2 — feita por duas implementações, sem que nenhum
passo tenha declarado a divisão.

**Não migra agora.** Puxar `mouseParamSnapshot.ts` para o passo 1 faria parte do passo 3 por
antecipação, e o passo 1 está corretamente restrito a `protocol.ts`, `parseNotification` e
`dpiValue.ts` (ver `## Ordem corrigida`). Esta seção é a declaração que faltava, não uma
mudança de escopo: `packedDpi` fecha quando o passo 3 migrar `mouseParamSnapshot.ts` inteiro
(ver `## Inventário corrigido`). Até lá, as duas metades concordam só porque a mesma pessoa
escreveu as duas — nenhum teste ou vetor de conformidade cobre a direção de escrita de CPI2,
então uma delas pode divergir da outra sem que nada em `pnpm verify` note.

**Fechada em 2026-09-28:** `pack_dpi` mora ao lado de `dpi_axes` em `notify.rs`, um teste prova um pelo outro, e os vetores `paramApply` cobrem a direção de escrita com eixos independentes.

## Mudanças de comportamento deliberadas

### UTF-8 estrito em `query_json`

`packages/core/src/protocols/rawm/query.rs` usa `core::str::from_utf8`, que **rejeita** bytes
inválidos. O `parseQueryJson` apagado usava `new TextDecoder()`, que por padrão é não-fatal e
substitui o byte inválido por U+FFFD.

**Antes:** um byte não-UTF-8 perdido na JSON de identidade virava um caractere de substituição,
o `JSON.parse` seguia normalmente, e o dispositivo conectava com um `dn` levemente errado.
**Agora:** falha dura, `Resposta RAWM não é texto válido.`, e o dispositivo não conecta.

**Decisão:** manter o comportamento estrito. Conectar a um dispositivo cuja identidade não pôde
ser lida corretamente é pior do que recusar — um `dn` corrompido alimentaria o nome do
dispositivo, o casamento no registro e o perfil que o usuário salva. Mas ninguém escolheu isso
deliberadamente na migração: a mudança veio de trocar `TextDecoder` por `core::str::from_utf8`
sem que a diferença de comportamento fosse discutida, nenhum teste a fixava, e a carga da
identidade é texto escrito pelo firmware que este projeto só viu vindo de um único dispositivo.
Um teste em `query.rs` agora fixa o caso (`query_json` sobre uma carga com um byte inválido
devolve `Err(RawmError::InvalidUtf8)`), e o comentário de documentação de `query_json` registra
a escolha. É a única divergência de comportamento nesta etapa que firmware real pode expor e
que nenhuma suíte de vetores cobre — os vetores comparam bytes, não a leniência de decodificação
de texto.

### Contagem de memórias no driver

O driver passa a usar a regra `ocs`/`ocn` do núcleo (`onboard_slot_count`). Quando `ocn`
discorda de `ocs.length`, a contagem é 1, e então `readOnboardIndex(oci)` rejeita qualquer
`oci` maior que 0: a conexão falha onde antes tinha sucesso.

**Decisão:** manter. Uma identidade que se contradiz não é confiável para dimensionar as
memórias, pelo mesmo raciocínio do UTF-8 estrito. Não foi visto em nenhum firmware capturado.

## Decisão 2 — `leviathanV4.ts` é dividido agora

O arquivo mistura os dois lados da fronteira, e a costura é limpa.

**Sobe** (~120 linhas): o parse da resposta de query (`cpi`, `cpi_l`, `polling`, `oci`, `pm`,
`lod`, `at`, `ms`, `as`, `rctrl`, `top`), `onboardSlotCount` com a regra `ocs` contra `ocn`, a
tabela de modos de desempenho, os limites do sensor (100–45000, passo 50, até 8 estágios) e as
taxas de polling. São fatos do dispositivo: não mudam se a casca mudar.

**Fica** (~96 linhas): a foto e sua proporção 213/420, as coordenadas fracionárias de cada
botão, o lado do callout e os rótulos em português. São descrições do desenho na tela.

Isso não antecipa a questão que este spec deixou aberta — enum de ações compartilhado ou por
periférico segue esperando o segundo dispositivo. Dividir aqui separa dispositivo de desenho,
não fecha o vocabulário.

## A forma do passo 5: passos puxados, não uma lista pronta

Este spec disse que a fila de aplicação desce para o núcleo, e também que o núcleo é síncrono
e não faz I/O. Isso parece contraditório e não é — mas exige nomear a interface, porque é
contra ela que os passos 3 a 5 são escritos.

O driver de hoje é uma cadeia de promessas com `pause(8)` entre relatórios e um timeout no
`session.ts`. Um núcleo síncrono não pode possuir isso. A saída é o núcleo **decidir os
passos** e a casca **executá-los**:

```rust
pub enum Step {
    Send(HidCommand),
    Wait(Duration),
}

impl RawmSession {
    /// Bytes que chegaram. Devolve o que eles significam.
    pub fn feed_report(&mut self, report: &[u8]) -> Vec<CoreEvent>;
    pub fn begin_apply(&mut self, settings: &MouseSettings) -> Result<(), CoreError>;
    /// O próximo passo, decidido no instante em que é pedido.
    pub fn next_step(&mut self) -> Result<Option<Step>, CoreError>;
}
```

A casca vira uma bomba:

```ts
session.beginApply(settings);
for (;;) {
  const step = session.nextStep(); // pode lançar: a memória ativa mudou
  if (!step) break;
  if (step.kind === 'send') await transport.send(step.command);
  else await wait(step.ms);
}
```

**Puxado, não uma lista pronta.** Uma `Vec<Step>` calculada de uma vez não reproduziria o
`checkSlot()` de hoje, que roda _entre_ os relatórios e aborta a aplicação se a memória ativa
mudou no meio. Pedindo um passo por vez, o núcleo vê o estado no instante da decisão — e uma
notificação `0x22` entregue por `feed_report` durante a aplicação faz o `next_step` seguinte
falhar, que é exatamente o comportamento atual.

Todo `await` continua em TypeScript. Nenhuma decisão continua.

## Ordem corrigida

O passo 0 é novo, e os demais absorvem os arquivos que faltavam.

0. **Vetores de conformidade.** Um arquivo versionado de entrada e saída em bytes, lido pelo
   `cargo test` e pelo `vitest`. É o que torna "migrei e apaguei" demonstrável. Não é
   preocupação paralela: sem ele, cada passo seguinte é uma promessa.
1. **Codec:** `protocol.ts` + `parseNotification` + `dpiValue.ts`. Vão juntos porque
   `notifications.ts` e `protocol.ts` compartilham o `RawEventAssembler`. Sondas reapontadas.
   **Fechado em 2026-09-16** pelo plano `docs/superpowers/plans/2026-09-16-migracao-codec-rawm.md`:
   `protocol.ts` foi apagado, todo consumidor aponta direto para `coreBridge`, e os vetores
   compartilhados provam a paridade byte a byte.
2. **Tabelas:** `leviathanV4Keys.ts`. **A geração de tipos (`ts-rs`) entra aqui**, não ao
   final: no instante em que o vocabulário de ações vive no Rust, `MouseActionId` passa a ter
   dois donos, e espelhar à mão é a divergência que este spec existe para eliminar.
   **Fechado em 2026-09-28** pelo plano `docs/superpowers/plans/2026-09-28-migracao-tabelas-rawm.md`:
   `leviathanV4Keys.ts` foi apagado; `MouseActionId` é um enum do núcleo e o tipo TypeScript é
   gerado dele por `ts-rs`, versionado e conferido pelo `cargo test`.
3. **Leitura do dispositivo:** `mouseParamSnapshot.ts` + a metade de `leviathanV4.ts` que
   descreve o dispositivo + a tabela de LOD + a identidade do dispositivo (o casamento USB de
   `deviceRegistry.ts` e o regex de nome de `connectLeviathanV4.ts`). Juntos porque leem o
   mesmo JSON de query e descrevem o mesmo aparelho; separá-los deixaria dois leitores do
   mesmo payload. Sondas reapontadas. **Confirmação em hardware.**
   **Fechado em 2026-09-28** pelo plano `docs/superpowers/plans/2026-09-28-migracao-leitura-dispositivo.md`,
   confirmado em hardware pelo roteiro em `docs/smoke-test-leviathan-v4.md`:
   `mouseParamSnapshot.ts` foi apagado; `MouseSettings` é do núcleo; a duplicata de `packedDpi`
   fechou com `pack_dpi`.
4. **Dump onboard:** `onboardConfig.ts`, a decodificação do `0x14`. **Confirmação em
   hardware.**
   **Implementado em 2026-09-30** pelo plano `docs/superpowers/plans/2026-09-30-migracao-dump-onboard.md`,
   aguardando a confirmação em hardware do roteiro em `docs/smoke-test-leviathan-v4.md`:
   `onboardConfig.ts` foi apagado e a duplicata `declaredLength` fechou.
5. **Sessão:** `LeviathanV4Driver.ts` sob a interface de passos puxados acima, mais a
   decodificação de `session.ts`. O maior e o mais arriscado. Sondas reapontadas.
   **Confirmação em hardware.**

A barra de conclusão de cada passo continua a de `## Como verificar cada passo`: a lógica
existe em Rust com os testes portados, o TypeScript **apagou** a sua, as duas suítes passam,
há paridade byte a byte contra os vetores, e os passos 3 a 5 foram confirmados no mouse.

## Passo 3 — desenho (2026-09-28)

O passo 3 é o primeiro em que **estruturas**, e não só bytes e números, atravessam a ponte: o
snapshot de parâmetros (18 campos, guardado pelo driver e comparado campo a campo pelas
sondas), o `MouseSettings` que o apply consome, e a descrição do aparelho que sai do JSON de
consulta.

### Decisão 3 — estruturas atravessam por `serde`, com tipos gerados por `ts-rs`

Os tipos do núcleo derivam `Serialize`/`Deserialize`; a ponte converte com
`serde-wasm-bindgen` para objetos JS comuns; o tipo TypeScript de cada um é gerado por `ts-rs`
e guardado como o de `MouseActionId` (versionado, conferido pelo `cargo test`).

- Do lado TS, o snapshot continua um objeto simples: o `{ ...snapshot, resolution }` do driver
  e o `compareStates` das sondas não mudam.
- `serde` e `serde_json` viram dependência real de `gearhub-core`. Não quebra nenhuma das três
  regras — nada disso é I/O, assíncrono ou `wasm-bindgen` —, e o desktop ganha o mesmo leitor.
- **`MouseSettings` passa a ser do núcleo**, com `DpiStage`, `MouseParameters` e
  `MouseRPlusSettings`, gerados em `packages/shared/src/generated/`. O Rust passa a lê-lo aqui
  (apply) e a produzi-lo (configuração padrão), e o `begin_apply(&MouseSettings)` do passo 5
  precisaria dele de qualquer jeito.
- Todos os tipos gerados moram em `packages/shared/src/generated/`, inclusive `RawmMouseParamState`, que é
  interno do protocolo. O `ts-rs` escreve os `import` entre tipos gerados como caminhos relativos ao mesmo
  diretório (`./MouseSettings`), e a descrição do aparelho referencia `MouseSettings`: separar os diretórios
  quebraria esses imports.

Rejeitadas: texto JSON na ponte (serializa e parseia duas vezes por chamada, e os tipos TS
continuariam precisando de geração); arrays achatados como nas notificações (não escala para 18
campos).

### O que desce

| peça                                  | onde                                  |
| ------------------------------------- | ------------------------------------- |
| snapshot: struct, parse, encode       | `protocols/rawm/param_snapshot.rs`    |
| `pack_dpi`, inverso de `dpi_axes`     | `protocols/rawm/notify.rs`            |
| `MouseSettings` e partes              | `device/settings.rs`                  |
| apply + tabela de modos de desempenho | `drivers/leviathan_v4/apply.rs`       |
| descrição do aparelho                 | `drivers/leviathan_v4/description.rs` |
| LOD: `raw` → milímetros               | `drivers/leviathan_v4/lod.rs`         |
| identidade USB e nome                 | `drivers/leviathan_v4/identity.rs`    |

A **descrição** lê o JSON de consulta e devolve: nome, firmware, bateria, limites de DPI
(100–45000, passo 50, 1–8 estágios), taxas de polling, ids dos modos, faixas de LOD e de rotação
(−30 a 30), número de memórias (regra `ocs` contra `ocn`, teto 16), memória ativa, DPI atual e a
configuração padrão (mapeamento de fábrica, estágios, R-Plus com ativador `lateral-dianteiro`).

**Fica em TypeScript**, por ser desenho: a foto e sua proporção, as coordenadas e os rótulos dos
botões, os rótulos dos modos, os nomes "Memória N", os nomes Baixo/Médio/Alto e o
`formatLiftOffDistance`, o filtro WebHID (com as constantes vindas do núcleo). O
`createLeviathanV4Peripheral` passa a compor a descrição do núcleo com essa camada visual.
`mouseParamSnapshot.ts` é apagado.

**Um só leitor do número de memórias.** Hoje o construtor do driver usa `ocs.length` e
`leviathanV4.ts` usa a regra `ocs`/`ocn` com teto — dois leitores do mesmo payload discordando
na borda. Os dois passam a usar a regra do núcleo.

**As sondas** (Decisão 1) são reapontadas, e dois defeitos antigos delas fecham aqui: o
`KEY_IDS` 1–7 de `RawmDiagnosticPage.tsx`, que não são ids de tecla, passa a vir de
`leviathanKeyId`; e `probeMappingSet` passa a reconstruir a sétima tecla depois do
CONFIG_RESET, como o driver.

Fica para o passo 5: a leitura de `oci` e a sessão do driver.

**Pendências declaradas do passo 3** (nomeadas aqui, não inferidas):

- `MouseParameters.liftOffDistance` é `u32` e `sensorRotation` é `i32` no núcleo, enquanto o
  mouse de demonstração guarda milímetros fracionários em `liftOffDistance`. Nada do demo
  atravessa a ponte hoje; o passo 5 (`begin_apply(&MouseSettings)`) precisa resolver isso.
- Os sinalizadores de capacidade dos parâmetros (`motionSync`, `angleSnapping`,
  `rippleControl`, `wirelessTurbo`: `true`) ainda moram em `leviathanV4.ts` e sobem em um passo
  posterior.

### Erros

As mensagens ao usuário ficam **idênticas** às de hoje. Cada uma ganha código estável em
`RawmError`:

- `InvalidSnapshotField { field }` → `invalid-snapshot-field` ("Snapshot RAWM incompleto ou
  invalido: {campo}.")
- `IncompleteQuery { field }` → `incomplete-query` ("Consulta RAWM incompleta: {campo}.")
- `InvalidPerformanceMode` → `invalid-performance-mode`
- `InvalidDpiStages` → `invalid-dpi-stages`

Para variantes com dado, a ponte envia `código:campo`; `asRawmError` separa, monta o texto e
guarda só o código em `cause`. Uma falha do `serde` ao converter o que a casca mandou não é erro
de protocolo e atravessa intacta, como qualquer erro que não vem do núcleo.

### Vetores e testes

Capturados do TypeScript atual **antes** de qualquer mudança, como no passo 2:

- A consulta real capturada em 2026-09-06 passa a morar em `rawm-protocol.json`;
  `leviathanV4Fixture.ts` lê de lá, e a fonte fica sendo uma.
- `paramSnapshot`: consulta → snapshot → bytes do corpo.
- `paramApply`: consulta + `MouseSettings` → bytes do corpo, com um caso de **eixos
  independentes**. Fecha a lacuna que `## Duplicata declarada no caminho de escrita —
packedDpi` apontou: nada cobria a direção de escrita de CPI2.
- `invalidSnapshot`: consulta quebrada → campo que reprova.

Os testes TS de snapshot, LOD, identidade e descrição são portados para o Rust; os que ficam em
TS exercitam o WASM real.

### Confirmação em hardware

Obrigatória, antes do merge, registrada em `docs/smoke-test-leviathan-v4.md`:

1. Conectar: nome, estágios de DPI, polling, modo, LOD e as quatro memórias corretos na tela.
2. Aplicar mudanças de DPI, polling, LOD, modo, Motion Sync e rotação; reconectar; conferir que
   persistiram.
3. Rodar a página de diagnóstico.
4. Rodar a sonda de mapeamentos e conferir que o indicador de bateria sobrevive.

### Entrega

Um plano, um PR, nesta ordem: vetores → `serde` e `MouseSettings` gerado → snapshot e
`pack_dpi` → LOD e identidade → apply → descrição → ponte, `coreBridge` e erros → casca
reapontada e `mouseParamSnapshot.ts` apagado → defeitos das sondas, documentos e roteiro de
hardware.

## Passo 4 — desenho (2026-09-30)

O passo 4 leva o dump onboard (`NOTIFY_TYPE_MOUSE_CONFIG`, `0x14`) para o núcleo: a
decodificação de cada entrada, a montagem do fluxo delimitado e a leitura de uma memória como
configuração do editor. Segue as decisões dos passos anteriores; o que é novo está abaixo.

### O que desce

| peça                                                  | onde                                    |
| ----------------------------------------------------- | --------------------------------------- |
| `OnboardBinding`, `OnboardSlotConfig`                 | `protocols/rawm/onboard.rs`             |
| `decode_onboard_entry`                                | `protocols/rawm/onboard.rs`             |
| `OnboardConfigCollector` (marcador, entradas, `0xff`) | `protocols/rawm/onboard.rs`             |
| `settings_from_slot`                                  | `drivers/leviathan_v4/slot_settings.rs` |

`decode_onboard_entry` mede a entrada com o `event_length` de `envelope.rs`, e com isso **fecha a
duplicata declarada `declaredLength`** — a última que sobrava.

`onboardConfig.ts` é apagado. O `OnboardProfileReport` de `deviceDriver.ts`, que repete à mão a
forma de uma memória, passa a ser o tipo gerado.

**Fica em TypeScript até o passo 5:** `reportedMappings`, `preservedEvents` e `isShowPower` do
driver, que decidem o que reenviar; e `useDeviceReports`, que é reação de tela.

### Decisão 4 — o montador atravessa a ponte como classe

O montador guarda estado entre notificações. O `RawEventAssembler` já atravessa assim, e o
precedente se repete: uma classe `wasm-bindgen` na ponte envolve a do núcleo, e o que ela devolve
são objetos comuns via `serde`.

### Decisão 5 — os bytes crus continuam `Uint8Array`

Cada entrada guarda `raw`, os bytes exatos que o mouse mandou: macros, teclas de teclado e
comandos que o app não nomeia são reenviados a partir deles. Por padrão o `serde-wasm-bindgen`
entregaria `number[]`; com `#[serde(with = "serde_bytes")]` entrega `Uint8Array`, e o tipo gerado
declara `Uint8Array` (`#[ts(type = "Uint8Array")]`). O driver não muda.

O `json_compatible()` força bytes como array, e a ponte desliga isso
(`serialize_bytes_as_arrays(false)`) — descoberto na execução. Só o campo marcado com
`serde_bytes` vira `Uint8Array`; `Vec<u8>` comum continua array.

### Vetores e testes

Capturados do TypeScript atual antes de qualquer mudança:

- `onboardEntry`: entrada → ids de tecla e ação, ou `null` para o que não é evento de
  configuração. Os bytes crus têm de voltar idênticos à entrada.
- `onboardDump`: sequência de payloads → memórias montadas, ou `null` sem terminador.

`settings_from_slot` não é decodificador de bytes: fica coberto por testes portados para o Rust e
pelos testes TS que passam a exercitar a ponte.

### Confirmação em hardware

Obrigatória, antes do merge, registrada em `docs/smoke-test-leviathan-v4.md`:

1. Conectar: as quatro memórias aparecem com os mapeamentos que cada uma tem.
2. Aplicar numa memória que guarda algo que o app não nomeia (uma macro, por exemplo) e
   conferir que isso sobreviveu.
3. Trocar de memória pelo mouse: a tela acompanha.

### Entrega

Um plano, um PR: vetores → tipos e decodificação no núcleo → `settings_from_slot` → ponte e
`coreBridge` → casca reapontada e `onboardConfig.ts` apagado → documentos e roteiro de hardware.
