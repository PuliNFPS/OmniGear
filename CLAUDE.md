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

**Estado real (2026-09-17):** o **codec** migrou — envelope, CRC16, enquadramento de 64 bytes,
montador de eventos, consulta e decodificação de notificações vivem em
`packages/core/src/protocols/rawm/`, e `apps/web/src/hardware/rawm/protocol.ts` não existe
mais. Todo o caminho de leitura está confirmado em hardware.

Ainda em TypeScript, com passo marcado no spec: `leviathanV4Keys.ts` (passo 2),
`mouseParamSnapshot.ts` e a metade de `leviathanV4.ts` que descreve o dispositivo (passo 3),
`onboardConfig.ts` (passo 4), a sessão de `LeviathanV4Driver.ts` e a decodificação de
`session.ts` (passo 5).

Duas duplicatas de protocolo sobrevivem **de propósito e declaradas**: `packedDpi`
(`mouseParamSnapshot.ts`), inverso do `dpi_axes` do núcleo, fecha no passo 3; e
`declaredLength` (`onboardConfig.ts`), fecha no passo 4. Exceções devem ser declaradas assim
— nomeadas no spec, com data para sair —, nunca inferidas. Ver
`docs/superpowers/specs/2026-09-07-nucleo-rust-ponte-design.md`.

Três regras que o núcleo não quebra, porque o stack do desktop é desconhecido: **não faz
I/O**, **é síncrono**, **não conhece `wasm-bindgen`** (a macro fica num crate de ponte, senão
o núcleo é moldado pelo navegador e perde `Result` e enums com dados).

Duas convenções que já existem — use, não reinvente:

- **Erro novo que atravessa a ponte:** variante em `RawmError`, código estável em `code()`,
  texto em `apps/web/src/core/rawmError.ts`. A ponte converte com `js_error`, a casca com
  `asRawmError`, que preserva o código em `cause`. O núcleo nunca carrega string de interface.
- **Encoder ou decoder novo:** o vetor de conformidade vai em
  `packages/core/vectors/rawm-protocol.json`, lido pelo `cargo test` **e** pelo `vitest`. Os
  dois lados têm guarda contra uma seção vazia passar à toa; um vetor que só um lado lê não é
  fonte compartilhada.

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
- Três coisas no `turbo` existem para que uma mudança no Rust nunca seja verificada por cache
  velho — **não remova nenhuma**: `cache: false` no build do `gearhub-core-wasm`; o
  devDependency `@gearhub/core` que dá ao grafo do turbo a aresta até `packages/core/src`; e
  os `inputs` de `lint` e `test` em `packages/core/turbo.json`, que apontam para
  `packages/core-wasm/src`. Sem a segunda, editar o Rust deixa `@gearhub/web:test` em cache
  hit e a suíte verifica um `.wasm` velho. Sem a terceira, editar **só a ponte** deixa
  `@gearhub/core:lint` em cache hit e o clippy nunca vê o código novo — `@gearhub/core` roda
  `cargo clippy --workspace`, que cobre os dois crates, mas o turbo chaveia o cache pelos
  arquivos de `packages/core`, e a ponte está do lado errado da aresta.

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
