# Ponte web do núcleo — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o app web rodar o Rust de verdade e apagar a ponte JavaScript escrita à mão, que hoje é o que realmente executa em produção.

**Architecture:** O crate Rust se divide em dois — `gearhub-core` puro, sem `wasm-bindgen`, e `gearhub-core-wasm` só com os bindings. O `wasm-pack` gera o pacote npm com `--no-pack`, para que o `package.json` fique versionado e estável. Os testes passam a inicializar o WASM gerado num `setupFile`, e o CI passa a construí-lo. Só então a ponte JS é removida.

**Tech Stack:** Rust 2024, wasm-bindgen 0.2, wasm-pack (target `web`), pnpm workspaces, turbo, vitest 4.

**Spec:** `docs/superpowers/specs/2026-09-07-nucleo-rust-ponte-design.md`

## Global Constraints

- O núcleo **não faz I/O**, **é síncrono**, e **não conhece `wasm-bindgen`** (Regras 1 a 3 do spec).
- **Nunca commitar o `.wasm` nem a glue gerada.** Só o `package.json` do pacote npm é versionado.
- `pnpm verify` é o gate: `format:check`, `lint`, `test`, `build`, `audit`.
- Nenhum teste unitário alcança o firmware. Este plano não muda o caminho de escrita, então **não exige confirmação em hardware** — mas a Task 5 muda o que executa em produção, e vale abrir o app uma vez ao final.
- Os sete símbolos exportados hoje, com as assinaturas exatas, são o contrato que não pode mudar neste plano:
  - `encode_mouse_param_snapshot(snapshot: &[u8]) -> Vec<u8>`
  - `encode_action(action: u8, value: u32) -> Vec<u8>`
  - `encode_config_reset() -> Vec<u8>`
  - `encode_mouse_key(key_ids: &[u8], modifier_one: u8, modifier_two: u8, key_type: u8, key_code: u8) -> Vec<u8>`
  - `encode_mouse_function(key_ids: &[u8], touch_type: u8, function_id: u8, value: u16, text: &[u8]) -> Vec<u8>`
  - `core_version() -> String`
  - `is_wasm_available() -> bool`

---

### Task 1: Separar o núcleo puro dos bindings

Hoje `packages/core/Cargo.toml` se chama `gearhub-core-wasm`, depende de `wasm-bindgen`, e `lib.rs` aplica `#[wasm_bindgen]` direto nas sete funções. Enquanto o núcleo eram cinco encoders isso não incomodava; com o protocolo inteiro lá dentro, amarra o desktop às limitações da web.

**Files:**

- Modify: `packages/core/Cargo.toml`
- Modify: `packages/core/src/lib.rs`
- Create: `packages/core-wasm/Cargo.toml`
- Create: `packages/core-wasm/src/lib.rs`
- Modify: `Cargo.toml` (workspace da raiz)
- Modify: `packages/core/package.json`

**Interfaces:**

- Consumes: nada.
- Produces: crate `gearhub-core` com os sete símbolos **sem** `wasm-bindgen`; crate `gearhub-core-wasm` reexportando os mesmos sete com `#[wasm_bindgen]`.

- [ ] **Step 1: Rodar os testes Rust antes de mexer, para ter a linha de base**

Run: `cargo test`
Expected: PASS. Anote o número de testes; ele não pode cair nas etapas seguintes.

- [ ] **Step 2: Tornar o crate do núcleo puro**

Em `packages/core/Cargo.toml`, trocar o nome e remover a dependência:

```toml
[package]
name = "gearhub-core"
version = "0.1.0"
edition = "2024"
description = "Protocol and device abstractions for Gearhub"

[lib]
crate-type = ["rlib"]
```

Em `packages/core/src/lib.rs`, apagar a linha `use wasm_bindgen::prelude::*;` e **todas** as sete ocorrências de `#[wasm_bindgen]`. Não mudar mais nada: nem assinaturas, nem corpo, nem os testes.

- [ ] **Step 3: Provar que o núcleo compila e testa sem wasm-bindgen**

Run: `cargo test -p gearhub-core`
Expected: PASS, com o mesmo número de testes do Step 1.

- [ ] **Step 4: Criar o crate de bindings**

`packages/core-wasm/Cargo.toml`:

```toml
[package]
name = "gearhub-core-wasm"
version = "0.1.0"
edition = "2024"
description = "wasm-bindgen bridge for gearhub-core"

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
gearhub-core = { path = "../core" }
wasm-bindgen = "0.2"
```

`packages/core-wasm/src/lib.rs` — só reexporta, sem lógica própria:

```rust
//! Ponte wasm-bindgen. Nenhuma decisão vive aqui: a macro fica deste lado
//! para que o núcleo não seja moldado pelas restrições do navegador.

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn encode_mouse_param_snapshot(snapshot: &[u8]) -> Vec<u8> {
    gearhub_core::encode_mouse_param_snapshot(snapshot)
}

#[wasm_bindgen]
pub fn encode_action(action: u8, value: u32) -> Vec<u8> {
    gearhub_core::encode_action(action, value)
}

#[wasm_bindgen]
pub fn encode_config_reset() -> Vec<u8> {
    gearhub_core::encode_config_reset()
}

#[wasm_bindgen]
pub fn encode_mouse_key(
    key_ids: &[u8],
    modifier_one: u8,
    modifier_two: u8,
    key_type: u8,
    key_code: u8,
) -> Vec<u8> {
    gearhub_core::encode_mouse_key(key_ids, modifier_one, modifier_two, key_type, key_code)
}

#[wasm_bindgen]
pub fn encode_mouse_function(
    key_ids: &[u8],
    touch_type: u8,
    function_id: u8,
    value: u16,
    text: &[u8],
) -> Vec<u8> {
    gearhub_core::encode_mouse_function(key_ids, touch_type, function_id, value, text)
}

#[wasm_bindgen]
pub fn core_version() -> String {
    gearhub_core::core_version()
}

#[wasm_bindgen]
pub fn is_wasm_available() -> bool {
    gearhub_core::is_wasm_available()
}
```

- [ ] **Step 5: Registrar o crate novo no workspace**

`Cargo.toml` da raiz:

```toml
[workspace]
members = ["packages/core", "packages/core-wasm"]
resolver = "3"
```

- [ ] **Step 6: Apontar o script de build para o crate de bindings**

Em `packages/core/package.json`, remover o script `build:wasm` (ele passa a viver no pacote npm da Task 2):

```json
{
  "name": "@gearhub/core",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "lint": "node ../../scripts/run-rust-tool.mjs lint",
    "format": "node ../../scripts/run-rust-tool.mjs format",
    "test": "node ../../scripts/run-rust-tool.mjs test"
  }
}
```

- [ ] **Step 7: Provar que os dois crates compilam e o gerador funciona**

Run: `cargo test`
Expected: PASS, mesmo número de testes do Step 1 (o crate de bindings não adiciona testes).

Run: `cargo clippy --all-targets -- -D warnings`
Expected: sem avisos.

Run: `wasm-pack build packages/core-wasm --target web --out-dir pkg --out-name index --no-pack`
Expected: termina com `Your wasm pkg is ready`. Confirme que `packages/core-wasm/pkg/index_bg.wasm` existe e que **não** foi criado um `package.json` ali.

- [ ] **Step 8: Commit**

```bash
git add Cargo.toml packages/core packages/core-wasm
git commit -m "refactor: separar o núcleo puro dos bindings wasm

A macro wasm-bindgen restringe assinaturas — nada de Result com erro rico,
nada de enums com dados. Com o protocolo inteiro migrando para o núcleo, isso
amarraria o desktop às limitações do navegador. gearhub-core passa a ser Rust
puro e gearhub-core-wasm só reexporta."
```

---

### Task 2: Estabilizar o pacote npm gerado

O `pnpm-workspace.yaml` lista `packages/core/pkg` como pacote, e o `apps/web` depende de `gearhub-core-wasm`. Como o `wasm-pack` reescreve o `package.json`, o diretório gerado e o pacote npm brigam: sem o `package.json` versionado o `pnpm install` falha num clone limpo; com ele versionado, o build o suja toda vez. O `--no-pack` desfaz o nó.

**Files:**

- Create: `packages/core-wasm/pkg/package.json`
- Create: `packages/core-wasm/pkg/.gitignore`
- Modify: `pnpm-workspace.yaml`
- Modify: `package.json` (raiz)
- Delete: `packages/core/pkg/` (todo o diretório)

**Interfaces:**

- Consumes: o crate `gearhub-core-wasm` da Task 1.
- Produces: pacote npm `gearhub-core-wasm` em `packages/core-wasm/pkg`, com script `build`, resolvido pelo `apps/web` sem mudança no import.

- [ ] **Step 1: Criar o `package.json` estável, agora mantido à mão**

`packages/core-wasm/pkg/package.json`:

```json
{
  "name": "gearhub-core-wasm",
  "version": "0.1.0-dev",
  "private": true,
  "type": "module",
  "main": "index.js",
  "types": "index.d.ts",
  "scripts": {
    "build": "wasm-pack build .. --target web --out-dir pkg --out-name index --no-pack"
  }
}
```

- [ ] **Step 2: Ignorar tudo que o wasm-pack gera**

`packages/core-wasm/pkg/.gitignore`:

```gitignore
*
!.gitignore
!package.json
```

- [ ] **Step 3: Apontar o workspace para o novo lugar**

`pnpm-workspace.yaml`:

```yaml
packages:
  - apps/*
  - packages/*
  - packages/core-wasm/pkg
```

No `package.json` da raiz, `core:build` passa a delegar ao pacote:

```json
"core:build": "pnpm --filter gearhub-core-wasm build",
```

- [ ] **Step 4: Remover o diretório antigo**

```bash
git rm -r --cached packages/core/pkg
rm -rf packages/core/pkg
```

- [ ] **Step 5: Reinstalar e provar que a resolução funciona num estado limpo**

Run: `pnpm install`
Expected: instala sem erro. `apps/web/node_modules/gearhub-core-wasm` aponta para `packages/core-wasm/pkg`.

Run: `pnpm core:build`
Expected: gera `index.js`, `index.d.ts` e `index_bg.wasm` em `packages/core-wasm/pkg`.

Run: `git status --short packages/core-wasm/pkg`
Expected: **nada**. O `.gitignore` cobre o que foi gerado e o `package.json` não foi tocado.

- [ ] **Step 6: Commit**

```bash
git add pnpm-workspace.yaml package.json packages/core-wasm/pkg pnpm-lock.yaml
git commit -m "build: dar ao pacote npm do núcleo um package.json estável

wasm-pack reescrevia o package.json que o pnpm-workspace precisa existir antes
do install. Com --no-pack ele passa a ser mantido à mão, e todo o resto do
diretório é gerado e ignorado."
```

---

### Task 3: Fazer os testes rodarem contra o WASM real

Hoje os testes exercitam a ponte JavaScript escrita à mão, não o Rust. Isso é a origem da divergência: `cargo test` e `vitest` verificam implementações diferentes com os mesmos vetores duplicados à mão. O `init` gerado aceita `BufferSource`, então o Node consegue inicializar lendo o `.wasm` do disco — verificado: a suíte inteira passa assim.

**Files:**

- Create: `apps/web/src/test/setupCore.ts`
- Modify: `apps/web/vite.config.ts`

**Interfaces:**

- Consumes: `packages/core-wasm/pkg/index_bg.wasm` da Task 2.
- Produces: toda a suíte do `apps/web` rodando contra o WASM gerado.

- [ ] **Step 1: Escrever o setup que inicializa o núcleo antes dos testes**

`apps/web/src/test/setupCore.ts`:

```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import init from 'gearhub-core-wasm';

/**
 * Os encoders são síncronos e a glue gerada recusa qualquer chamada antes de
 * `init()`. No navegador quem espera é o `main.tsx`; aqui é este arquivo.
 *
 * O alvo `web` busca o `.wasm` por fetch, que não existe no Node — mas o mesmo
 * `init` aceita os bytes direto, então basta lê-los do disco.
 */
const wasm = readFileSync(
  fileURLToPath(new URL('../../../../packages/core-wasm/pkg/index_bg.wasm', import.meta.url)),
);

await init({ module_or_path: wasm });
```

- [ ] **Step 2: Registrar o setup no vitest**

Em `apps/web/vite.config.ts`, acrescentar a chave `test` logo depois de `server`:

```ts
  server: { port: 5173 },
  test: { setupFiles: ['./src/test/setupCore.ts'] },
```

- [ ] **Step 3: Provar que a suíte passa contra o WASM real**

Run: `pnpm core:build && pnpm --filter @gearhub/web test`
Expected: PASS — 221 testes em 29 arquivos, o mesmo total de antes. Se algum encoder divergir entre o Rust e a ponte JS, é aqui que aparece.

- [ ] **Step 4: Provar que o setup é o que faz a diferença**

Comente a linha `await init(...)` no setup e rode de novo.
Expected: FAIL, com erros vindos de `packages/core-wasm/pkg/index.js`. Descomente antes de seguir.

Isso confirma que os testes passam a exercitar o WASM, e não a ponte antiga.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/test/setupCore.ts apps/web/vite.config.ts
git commit -m "test: exercitar o WASM gerado em vez da ponte escrita à mão

Os testes verificavam o espelho JavaScript enquanto o cargo test verificava o
Rust — duas implementações checadas por vetores duplicados. O init aceita os
bytes direto, então o Node lê o .wasm do disco e a suíte passa a cobrir o que
vai para produção."
```

---

### Task 4: Fazer o build e o CI produzirem o WASM

`turbo build` constrói `@gearhub/shared`, `@gearhub/ui` e `@gearhub/web` — nunca o núcleo. E o `verify.yml` instala Rust, clippy, rustfmt e cargo-machete, mas não o `wasm-pack`. Sem isto, migrar qualquer coisa para o Rust não muda o que executa.

**Files:**

- Modify: `turbo.json`
- Modify: `.github/workflows/verify.yml`

**Interfaces:**

- Consumes: o script `build` do pacote npm (Task 2) e o setup de testes (Task 3).
- Produces: `pnpm build` e `pnpm verify` gerando o `.wasm` antes de compilar e testar a web.

- [ ] **Step 1: Declarar a saída do build do núcleo no turbo**

Em `turbo.json`, dentro de `tasks`, a tarefa `build` já existe com `dependsOn: ["^build"]`. Como o `apps/web` depende de `gearhub-core-wasm`, e esse pacote agora tem script `build`, a cadeia se forma sozinha. Falta declarar a saída para o cache não descartá-la:

```json
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", "index.js", "index.d.ts", "index_bg.wasm"]
    },
```

As saídas do turbo são relativas à raiz de **cada** pacote. Como
`packages/core-wasm/pkg` é ele próprio o pacote, os artefatos caem na raiz dele — daí
`index.js` e não `pkg/index.js`. O `dist/**` continua valendo para a web; o turbo
simplesmente não encontra as outras entradas nos pacotes onde elas não existem.

- [ ] **Step 2: Garantir que o teste também depende do build do núcleo**

Ainda em `turbo.json`, a tarefa `test` precisa do `.wasm` no disco por causa do setup da Task 3:

```json
    "test": {
      "dependsOn": ["^build"]
    },
```

- [ ] **Step 3: Provar a cadeia localmente, partindo do zero**

```bash
rm -f packages/core-wasm/pkg/index.js packages/core-wasm/pkg/index.d.ts packages/core-wasm/pkg/index_bg.wasm
pnpm build
```

Expected: o `turbo` constrói `gearhub-core-wasm` antes de `@gearhub/web`, e os três arquivos reaparecem.

Run: `pnpm test`
Expected: PASS, 221 testes.

- [ ] **Step 4: Instalar o wasm-pack no CI**

Em `.github/workflows/verify.yml`, logo depois do passo que instala o `cargo-machete`, acrescentar:

```yaml
- name: Install wasm-pack
  run: cargo install wasm-pack --version 0.13.1 --locked
```

Fixar a versão segue o padrão que o `cargo-machete` já usa neste workflow: um build reproduzível vale mais que a última versão.

- [ ] **Step 5: Provar que o gate inteiro passa**

Run: `pnpm verify`
Expected: PASS em `format:check`, `lint`, `test`, `build` e `audit`.

Se o `format:check` acusar centenas de arquivos intocados, é o CRLF do checkout local contra o `endOfLine: lf` — não é regressão. Confirme o conteúdo de um arquivo com
`cat "$f" | tr -d '\r' | ./node_modules/.bin/prettier --check --stdin-filepath "$f"`.

- [ ] **Step 6: Commit**

```bash
git add turbo.json .github/workflows/verify.yml
git commit -m "ci: construir o WASM antes de testar e empacotar a web

turbo nunca construía o núcleo e o CI não instalava wasm-pack, então o Rust
não chegava a executar em lugar nenhum. Com a cadeia ligada, migrar código
para o núcleo passa a mudar o que roda de verdade."
```

---

### Task 5: Apagar a ponte JavaScript escrita à mão

Ela é a fonte da divergência e o que hoje executa em produção. Só pode sair depois que o build a produz (Task 4) e os testes a cobrem (Task 3) — nesta ordem, senão um clone limpo fica sem núcleo nenhum.

**Files:**

- Delete: nada a mais (o arquivo já saiu do git na Task 2, Step 4)
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-09-07-nucleo-rust-ponte-design.md`

**Interfaces:**

- Consumes: Tasks 2, 3 e 4 completas.
- Produces: nenhuma implementação duplicada do protocolo no repositório.

- [ ] **Step 1: Provar que não sobrou referência à ponte antiga**

Run: `grep -rn "packages/core/pkg" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.yml" --include="*.mjs" --include="*.md" . | grep -v node_modules`
Expected: nenhuma linha fora de documentos históricos (`docs/smoke-test-leviathan-v4.md` pode citar o caminho antigo ao narrar o passado; não altere o histórico).

- [ ] **Step 2: Provar que um clone limpo funciona**

```bash
git clean -xdn packages/core-wasm/pkg
```

Expected: lista `index.js`, `index.d.ts` e `index_bg.wasm` como não rastreados — ou seja, gerados. O `package.json` e o `.gitignore` **não** aparecem.

- [ ] **Step 3: Atualizar o CLAUDE.md, que hoje descreve a armadilha que deixou de existir**

Substituir a seção `## A armadilha do packages/core/pkg` inteira por:

```markdown
## O núcleo é gerado, nunca versionado

`packages/core-wasm/pkg` guarda só `package.json` e `.gitignore`; o resto o
`wasm-pack` gera. `pnpm build` e `pnpm test` constroem antes de rodar, e o CI
instala o `wasm-pack` para isso.

- Se os testes falharem logo após um clone, rode `pnpm core:build`.
- **Nunca commitar** o que o wasm-pack gera.
- Os testes exercitam o WASM real, então um encoder que divergir entre o Rust
  e o que o app espera falha aqui, não em produção.
```

- [ ] **Step 4: Marcar no spec o que este plano fechou**

No spec, na seção `## A ponte JS escrita à mão`, acrescentar ao final:

```markdown
**Fechado em 2026-09-07** pelo plano `docs/superpowers/plans/2026-09-07-ponte-web-do-nucleo.md`:
a ponte foi removida, o build gera o WASM e os testes o exercitam.
```

- [ ] **Step 5: Provar o gate uma última vez**

Run: `pnpm verify`
Expected: PASS.

- [ ] **Step 6: Confirmar no app**

Suba o app e abra a seção geral, que chama `loadCore()`.

```bash
pnpm --filter @gearhub/web dev
```

Expected: a versão do núcleo aparece e `wasm` é verdadeiro. Se houver um mouse à mão, mude o DPI uma vez — este plano não altera o caminho de escrita, então o comportamento deve ser idêntico ao de antes.

- [ ] **Step 7: Commit**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-09-07-nucleo-rust-ponte-design.md
git commit -m "docs: registrar que a ponte escrita à mão deixou de existir

O protocolo passa a ter uma implementação só. Some com ela a duplicação que os
vetores duplicados entre cargo test e coreBridge.test.ts defendiam, e some a
armadilha de o pnpm dev trocar o que roda embaixo do app."
```

---

## O que este plano deliberadamente não faz

Migrar `protocol.ts`, `leviathanV4Keys.ts`, `mouseParamSnapshot.ts`, `onboardConfig.ts` ou a codificação do `LeviathanV4Driver.ts`. Esses são os cinco passos de migração do spec e merecem plano próprio — cada um mexe no caminho de escrita e precisa de confirmação em hardware, o que este plano não exige.

Este plano é a precondição de todos eles: enquanto o build não produzir o WASM, qualquer código movido para o Rust não roda em lugar nenhum.

Também ficam para depois os **vetores de conformidade** e a **geração dos tipos TypeScript** do spec. Ambos só fazem sentido quando houver tipos de domínio no núcleo — hoje são sete funções de bytes.

**Publicar o `.wasm` e servir com `Content-Type: application/wasm`**, que o spec pede, não tem
onde ser feito neste repositório: existe um único workflow, `verify.yml`, e nenhum de deploy.
Quando houver, o `.wasm` precisa sair do build e não do git, e o MIME precisa estar certo —
senão o cliente abre o app e não configura nada. Fica registrado como pendência do deploy, não
deste plano.
