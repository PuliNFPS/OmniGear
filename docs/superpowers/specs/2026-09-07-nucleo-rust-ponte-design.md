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
- **Migrar a UI.** React, stores e componentes continuam onde estão.
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
| `deviceStore.ts`, `editorStore.ts` | estado de UI                                                 |
| componentes React                  | UI                                                           |

Note que a orquestração do driver — a fila, o `enqueue`, o debounce — é ambígua. A proposta é
mantê-la na casca por ora: ela depende do modelo assíncrono da plataforma, e mover isso é o
passo mais arriscado. Reavaliar quando o stack do desktop for conhecido.

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
- **O stack do desktop pode contradizer a fronteira.** Se ele exigir que a orquestração viva
  no núcleo, o passo 5 muda de forma. As regras 1 a 3 existem para que essa descoberta custe
  pouco.

## Questões em aberto

- **Qual será o stack do desktop.** Se for Tauri, a casca TypeScript é reaproveitada e a
  fronteira acima está certa como está. Se for uma UI nativa própria, a casca web é
  descartada e vale reavaliar se mais orquestração deveria descer para o núcleo.
- **Se o app web deve ter fallback.** Este spec propõe que não. Se a taxa de falha de
  carregamento do WASM em produção se mostrar relevante, a decisão volta à mesa — mas com
  dados, não por precaução.
