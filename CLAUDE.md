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

## O núcleo é gerado, nunca versionado

`packages/core-wasm/pkg` é inteiramente gerado pelo `wasm-pack` e ignorado pelo git — nada ali
é versionado. O `package.json` do pacote npm fica um nível acima, em
`packages/core-wasm/package.json`, de propósito: o `wasm-pack`, mesmo com `--no-pack`, **apaga**
qualquer `package.json` que encontre no diretório de saída.

`pnpm build` e `pnpm test` constroem o núcleo antes de rodar, e o CI instala o `wasm-pack`.

- Se os testes falharem logo após um clone, rode `pnpm core:build`. Só é preciso no caminho
  direto `pnpm --filter @gearhub/web test`; via `turbo` o build já acontece antes.
- **Nunca commitar** o que o wasm-pack gera.
- Os testes exercitam o WASM real, então um encoder que divergir entre o Rust e o que o app
  espera falha aqui, não em produção.
- Duas coisas no `turbo` existem para que uma mudança no Rust nunca seja verificada por cache
  velho — **não remova nenhuma**: `cache: false` no build do `gearhub-core-wasm`, e o
  devDependency `@gearhub/core` que dá ao grafo do turbo a aresta até `packages/core/src`.
  Sem a segunda, editar o Rust deixa `@gearhub/web:test` em cache hit e a suíte verifica um
  `.wasm` velho.

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
