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
