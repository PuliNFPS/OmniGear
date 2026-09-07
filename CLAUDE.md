# OmniGear

App de configuração de periféricos. Web hoje, desktop depois, sobre um mesmo núcleo.

## A arquitetura, em uma frase

**O Rust é o backend. O TypeScript é apenas front.**

`packages/core` (Rust) é dono do protocolo, do estado de dispositivo e das decisões sobre o
que enviar. Ele monta `HidCommand { report_id, data }`; quem envia é a casca. A web chega
nele por WASM, e um desktop chegaria por ligação nativa.

`apps/web` é casca: renderiza, reage a entrada do usuário, e executa a chamada HID — porque
`navigator.hid` só existe em JavaScript e a permissão exige gesto do usuário. Nenhuma decisão
sobre protocolo vive ali.

## Onde escrever código novo

O teste é uma pergunta: **isso mudaria se a casca mudasse?** Se sim, é casca.

| vai no Rust                                          | fica em TypeScript                        |
| ---------------------------------------------------- | ----------------------------------------- |
| protocolo, enquadramento, CRC, encoders              | componentes React e estado de tela        |
| decodificação de respostas do dispositivo            | debounce e outras reações a entrada       |
| o que o dispositivo tem, e o que precisa ser enviado | `WebHidTransport`, descoberta e permissão |
| capacidades e vocabulário de ações                   | tipos de UI que não descrevem dispositivo |

**Regra:** comportamento novo de dispositivo entra no Rust. Uma tarefa de dispositivo que só
produza `.ts` merece a pergunta — por que isto não está no núcleo?

**Estado real:** a migração ainda não aconteceu. O protocolo RAWM vive hoje em
`apps/web/src/hardware/`, e o núcleo tem só os encoders. Enquanto isso não fecha, existem
exceções — mas elas devem ser declaradas, não o padrão. Ver
`docs/superpowers/specs/2026-09-07-nucleo-rust-ponte-design.md`.

Três regras que o núcleo não quebra, porque o stack do desktop é desconhecido: **não faz
I/O**, **é síncrono**, **não conhece `wasm-bindgen`** (a macro fica num crate de ponte, senão
o núcleo é moldado pelo navegador e perde `Result` e enums com dados).

## A armadilha do `packages/core/pkg`

`pkg/index.js` versionado é uma **ponte em JavaScript escrita à mão** que espelha o `lib.rs`,
e é ela que roda em produção. `pnpm dev` chama `core:prepare`, que roda `core:build` quando
`wasm-pack` está no PATH e **substitui essa ponte pela glue gerada**.

- Se testes ou o app quebrarem de forma inexplicável, cheque `git status packages/core/pkg`
  antes de qualquer outra coisa. Restaurar: `git checkout -- packages/core/pkg`.
- **Nunca commitar o `pkg` gerado.** O CI não instala wasm-pack e lê a ponte do git, e o
  `index_bg.wasm` nem versionado é.
- Para subir sem sobrescrever: `pnpm --filter @gearhub/web dev`.
- Ao mexer em `coreBridge.ts`, rode `tsc -b` **também** com a ponte gerada: os tipos diferem
  entre as duas, e código que só compila contra uma quebra o build de quem tem wasm-pack.

## Verificação

`pnpm verify` é o gate: `format:check`, `lint`, `test`, `build` e `audit` (knip,
dependency-cruiser, cargo-machete). Rode antes de dizer que algo está pronto.

Nenhum teste unitário alcança o firmware. Mudança no caminho de escrita precisa de
confirmação no hardware — um encoder pode estar perfeito e o mouse ignorar o evento.

## Documentos

- `docs/rawm-onboard-config.md` — o protocolo RAWM: o dump `0x14`, os perfis onboard, como a
  biblioteca do fabricante foi desofuscada.
- `docs/smoke-test-leviathan-v4.md` — o que foi confirmado em hardware, e como.
- `docs/superpowers/specs/` — decisões de arquitetura.
