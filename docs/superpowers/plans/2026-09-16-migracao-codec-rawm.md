# Migração do codec RAWM para o núcleo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mover o codec do protocolo RAWM — CRC16, enquadramento, montador de eventos, decodificação de notificações — de `apps/web/src/hardware/rawm/` para `packages/core`, deixando o TypeScript apenas chamando o núcleo.

**Architecture:** O núcleo Rust (`gearhub-core`) recebe bytes e devolve bytes ou erros tipados, sem I/O e sem conhecer `wasm-bindgen`. A ponte (`gearhub-core-wasm`) achata os tipos para o que a web aceita. A casca (`apps/web`) chama a ponte por `coreBridge.ts` e continua dona do WebHID. Cada função migra sozinha: a implementação sai do `.ts`, que vira reexportação do `coreBridge`, e só a última tarefa apaga o arquivo.

**Tech Stack:** Rust 2024 (workspace com `gearhub-core` e `gearhub-core-wasm`), `wasm-bindgen` 0.2, `js-sys` 0.3, `serde_json` (dev-only), TypeScript, Vitest, pnpm + Turborepo.

**Spec:** `docs/superpowers/specs/2026-09-07-nucleo-rust-ponte-design.md` — em particular a seção `# Escopo corrigido em 2026-09-16`, passos 0 e 1 da `## Ordem corrigida`.

## Global Constraints

Copiados do spec. Valem para toda tarefa deste plano.

- **O núcleo não faz I/O.** `gearhub-core` recebe bytes e devolve bytes ou decisões. Quem fala com o dispositivo é a casca.
- **O núcleo é síncrono.** Nenhum encoder pode exigir `await`. Inicializar a ponte é trabalho da casca, uma vez, antes de usar.
- **O núcleo não conhece `wasm-bindgen`.** Nenhum `#[wasm_bindgen]`, nenhum `use wasm_bindgen::…` dentro de `packages/core`. A macro vive só em `packages/core-wasm`.
- **Migrar é apagar.** Um passo só está pronto quando o TypeScript **removeu** sua implementação. Manter as duas cria uma terceira cópia.
- **Sem strings de interface no núcleo.** O núcleo devolve erro tipado; o texto em português é montado na casca.
- **Nunca commitar `packages/core-wasm/pkg`.** É gerado pelo `wasm-pack` e ignorado pelo git.
- **Formato:** `pnpm format` antes de cada commit (`prettier --write` + `cargo fmt --all`). O `pnpm verify` roda `format:check` e reprova diferença.
- **Sem atribuição de IA em commits.** Nada de `Co-Authored-By`, `Generated with`, `Claude-Session`.
- **Gate final:** `pnpm verify` = `format:check`, `lint`, `test`, `build`, `audit` (knip, dependency-cruiser, cargo-machete).

## Notas de ambiente que já custaram caro neste repositório

Leia antes da Tarefa 1. Cada uma corresponde a um bug que já aconteceu aqui.

1. **`pnpm core:build` antes de testar.** Os testes exercitam o `.wasm` real. Depois de mudar Rust, rode `pnpm core:build` se for chamar `pnpm --filter @gearhub/web test` direto; via `turbo` o build já acontece antes.
2. **Caminho por `process.cwd()`, nunca por `import.meta.url`.** Em teste com `@vitest-environment jsdom` o módulo não tem URL `file:`. `apps/web/src/test/setupCore.ts` documenta isso; o leitor de vetores tem o mesmo problema.
3. **`cargo machete` roda no `pnpm audit:rust`.** Uma dependência usada só sob `#[cfg(test)]` pode ser sinalizada como não usada.
4. **`turbo.json` tem duas coisas que não podem sair:** `cache: false` no build do `gearhub-core-wasm`, e o devDependency `@gearhub/core` em `packages/core-wasm/package.json`. Sem a segunda, editar Rust deixa `@gearhub/web:test` em cache hit contra um `.wasm` velho.

---

## Estrutura de arquivos

**Criados:**

| arquivo                                         | responsabilidade                                            |
| ----------------------------------------------- | ----------------------------------------------------------- |
| `packages/core/vectors/rawm-protocol.json`      | Vetores de conformidade: entrada e saída em hexadecimal     |
| `packages/core/src/protocols/rawm/mod.rs`       | Reexporta o módulo do protocolo RAWM                        |
| `packages/core/src/protocols/rawm/crc.rs`       | CRC16 do fabricante, privado ao crate                       |
| `packages/core/src/protocols/rawm/envelope.rs`  | Comprimento de 12 bits e envelope de CRC                    |
| `packages/core/src/protocols/rawm/framing.rs`   | Relatórios de 64 bytes: montar e decodificar                |
| `packages/core/src/protocols/rawm/assembler.rs` | Montador de eventos do fluxo de entrada                     |
| `packages/core/src/protocols/rawm/query.rs`     | Evento de consulta e leitura do JSON de resposta            |
| `packages/core/src/protocols/rawm/notify.rs`    | Decodificação de notificações e eixos de DPI                |
| `packages/core/src/protocols/rawm/error.rs`     | `RawmError`, o vocabulário de falha do protocolo            |
| `packages/core/tests/vectors.rs`                | Lê os vetores e confere contra o núcleo                     |
| `apps/web/src/test/vectors.ts`                  | Lê os mesmos vetores para o Vitest                          |
| `apps/web/src/core/rawmError.ts`                | Traduz o código de erro do núcleo para o texto em português |

**Modificados:**

| arquivo                                            | mudança                                                    |
| -------------------------------------------------- | ---------------------------------------------------------- |
| `packages/core/src/lib.rs`                         | Passa a declarar o módulo `protocols::rawm`                |
| `packages/core/Cargo.toml`                         | `serde_json` como dev-dependency                           |
| `packages/core-wasm/Cargo.toml`                    | `js-sys` como dependency                                   |
| `packages/core-wasm/src/lib.rs`                    | Ponte para cada função migrada                             |
| `apps/web/src/core/coreBridge.ts`                  | Invólucros tipados sobre a ponte                           |
| `apps/web/src/hardware/rawm/protocol.ts`           | Implementação sai, vira reexportação, e some na Tarefa 7   |
| `apps/web/src/hardware/rawm/notifications.ts`      | `parseNotification` sai; `subscribeToNotifications` fica   |
| `apps/web/src/hardware/rawm/dpiValue.ts`           | Some na Tarefa 6; consumidores passam a usar o núcleo      |
| `apps/web/src/hardware/rawm/diagnostics.ts`        | Reaponta imports (Tarefas 3, 4, 5, 7)                      |
| `apps/web/src/hardware/rawm/writeProbe.ts`         | Reaponta imports (Tarefas 2, 7)                            |
| `apps/web/src/hardware/rawm/session.ts`            | Reaponta imports (Tarefa 7)                                |
| `apps/web/src/hardware/rawm/LeviathanV4Driver.ts`  | Reaponta imports (Tarefa 7)                                |
| `apps/web/src/hardware/rawm/protocol.test.ts`      | Casos migram para Rust conforme cada função sai            |
| `apps/web/src/hardware/rawm/notifications.test.ts` | Bloco `parseNotification` migra; bloco `subscribeTo…` fica |

**Decisões de fronteira tomadas neste plano:**

- **`crc16` deixa de ser público.** Hoje é exportado e testado direto. Vira `pub(crate)` no Rust: só `with_protocol_envelope` atravessa a ponte. O caso de conformidade CCITT (`"123456789"` → `0x29b1`) passa a viver no arquivo de vetores, que é onde ele defende as duas implementações em vez de uma.
- **Erros são tipados no núcleo e traduzidos na casca.** `RawmError` atravessa a ponte como um código estável (`missing-preamble`, `invalid-length`, …). `apps/web/src/core/rawmError.ts` transforma o código no mesmo texto em português de hoje, preservando `toThrow('preâmbulo')` e o `catch { assembler.reset() }` de `subscribeToNotifications`.
- **A ponte achata, o núcleo não.** `Vec<Vec<u8>>` e enums com dados não atravessam `wasm-bindgen`. O núcleo mantém as formas idiomáticas; `packages/core-wasm` converte usando `js-sys`. É a Regra 3 em uso concreto.

---

### Task 1: Vetores de conformidade

Estabelece o arquivo de vetores e prova que ele descreve o comportamento de hoje. Nada migra ainda: esta tarefa cria a régua que as tarefas seguintes usam. Sem ela, cada migração é promessa em vez de demonstração.

**Files:**

- Create: `packages/core/vectors/rawm-protocol.json`
- Create: `apps/web/src/test/vectors.ts`
- Test: `apps/web/src/hardware/rawm/vectors.test.ts`

**Interfaces:**

- Consumes: nada.
- Produces: `readProtocolVectors(): ProtocolVectors` em `apps/web/src/test/vectors.ts`, e o arquivo `packages/core/vectors/rawm-protocol.json` com o formato abaixo. As Tarefas 2 a 6 leem ambos.

- [ ] **Step 1: Criar o arquivo de vetores**

Hexadecimal sem separador, minúsculo. `crc` diz se o envelope leva CRC. Os valores vêm dos testes que já existem em `apps/web/src/hardware/rawm/protocol.test.ts`.

```json
{
  "version": 1,
  "crc16": [
    {
      "name": "valor de verificação CCITT",
      "input": "313233343536373839",
      "expected": "29b1"
    }
  ],
  "envelope": [
    {
      "name": "comprimento de 12 bits no cabeçalho",
      "input": "030015",
      "crc": false,
      "expected": "030315"
    },
    {
      "name": "CRC little-endian em volta do evento já medido",
      "input": "06003400000000",
      "crc": true,
      "expected": "030c24421d06073400000000"
    }
  ],
  "queryEvent": [
    {
      "name": "consulta PC com timestamp de oito bytes",
      "epochSeconds": 305419896,
      "expected": "010d0300007856341200000000"
    }
  ]
}
```

Conferência dos valores, que vêm dos testes de hoje: `epochSeconds` 305419896 é `0x12345678`; o evento de consulta tem 13 bytes (5 de cabeçalho e 8 de carimbo), e 13 é `0x0d` no segundo byte; o evento com CRC tem 12 bytes. Se um `expected` não tiver número par de caracteres, está errado.

- [ ] **Step 2: Escrever o leitor do lado TypeScript**

```ts
// apps/web/src/test/vectors.ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Os vetores defendem as duas implementações do protocolo enquanto elas
 * coexistirem: um encoder que divergir quebra o `cargo test` e o `vitest` no
 * mesmo commit.
 *
 * O caminho sai do cwd, e não de `import.meta.url`, pela mesma razão que
 * `setupCore.ts` documenta: num teste com `@vitest-environment jsdom` o módulo
 * não tem URL `file:`.
 */
const VECTORS = '../../packages/core/vectors/rawm-protocol.json';

export interface Crc16Vector {
  name: string;
  input: string;
  expected: string;
}

export interface EnvelopeVector {
  name: string;
  input: string;
  crc: boolean;
  expected: string;
}

export interface QueryEventVector {
  name: string;
  epochSeconds: number;
  expected: string;
}

export interface ProtocolVectors {
  version: number;
  crc16: Crc16Vector[];
  envelope: EnvelopeVector[];
  queryEvent: QueryEventVector[];
}

export function readProtocolVectors(): ProtocolVectors {
  return JSON.parse(readFileSync(resolve(process.cwd(), VECTORS), 'utf8')) as ProtocolVectors;
}

export function fromHex(value: string): Uint8Array {
  const bytes = value.match(/.{2}/g) ?? [];
  return Uint8Array.from(bytes.map((byte) => Number.parseInt(byte, 16)));
}

export function toHex(bytes: Uint8Array | number[]): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
```

- [ ] **Step 3: Escrever o teste que falha**

```ts
// apps/web/src/hardware/rawm/vectors.test.ts
import { describe, expect, it } from 'vitest';
import { fromHex, readProtocolVectors, toHex } from '../../test/vectors';
import { buildQueryEvent, crc16, withProtocolEnvelope } from './protocol';

const vectors = readProtocolVectors();

describe('vetores de conformidade do protocolo RAWM', () => {
  it('declara a versão que este teste entende', () => {
    expect(vectors.version).toBe(1);
  });

  it.each(vectors.crc16)('crc16: $name', ({ input, expected }) => {
    expect(crc16(fromHex(input)).toString(16).padStart(4, '0')).toBe(expected);
  });

  it.each(vectors.envelope)('envelope: $name', ({ input, crc, expected }) => {
    expect(toHex(withProtocolEnvelope(fromHex(input), crc))).toBe(expected);
  });

  it.each(vectors.queryEvent)('consulta: $name', ({ epochSeconds, expected }) => {
    expect(toHex(buildQueryEvent(epochSeconds))).toBe(expected);
  });
});
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `pnpm --filter @gearhub/web test -- vectors`
Expected: FAIL — `Cannot find module '../../test/vectors'` antes do Step 2, ou divergência de hexadecimal se algum valor do arquivo estiver errado. **Se falhar por divergência, o arquivo de vetores está errado, não o código** — o TypeScript de hoje é a definição do comportamento correto nesta tarefa. Corrija o JSON.

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm --filter @gearhub/web test -- vectors`
Expected: PASS, 5 testes.

- [ ] **Step 6: Verificar que knip não reclama do novo módulo**

Run: `pnpm audit:ts`
Expected: sem erro. `apps/web/src/test/vectors.ts` é importado por um teste; se o knip o marcar como não usado, adicione-o a `ignore` em `knip.jsonc` com o comentário de que é utilitário de teste.

- [ ] **Step 7: Commit**

```bash
pnpm format
git add packages/core/vectors/rawm-protocol.json apps/web/src/test/vectors.ts apps/web/src/hardware/rawm/vectors.test.ts knip.jsonc
git commit -m "test: descrever o codec RAWM em vetores de conformidade"
```

---

### Task 2: CRC16 e envelope no núcleo

Primeira migração de verdade. `crc16` fica privado ao crate; só `with_protocol_envelope` atravessa.

**Files:**

- Create: `packages/core/src/protocols/rawm/mod.rs`, `crc.rs`, `envelope.rs`, `error.rs`
- Create: `packages/core/tests/vectors.rs`
- Create: `apps/web/src/core/rawmError.ts`
- Modify: `packages/core/src/lib.rs`, `packages/core/Cargo.toml`
- Modify: `packages/core-wasm/src/lib.rs`
- Modify: `apps/web/src/core/coreBridge.ts`
- Modify: `apps/web/src/hardware/rawm/protocol.ts:1-50`
- Modify: `apps/web/src/hardware/rawm/writeProbe.ts:12`
- Modify: `apps/web/src/hardware/rawm/protocol.test.ts`, `vectors.test.ts`

**Interfaces:**

- Consumes: `readProtocolVectors`, `fromHex`, `toHex` da Tarefa 1.
- Produces:
  - Rust: `gearhub_core::protocols::rawm::with_protocol_envelope(source: &[u8], use_crc: bool) -> Result<Vec<u8>, RawmError>`; `RawmError` com `code(&self) -> &'static str`.
  - Ponte: `with_protocol_envelope(source: &[u8], use_crc: bool) -> Result<Vec<u8>, JsError>`.
  - TS: `withProtocolEnvelope(source: ArrayLike<number>, useCrc: boolean): Uint8Array` em `coreBridge.ts`; `rawmErrorMessage(code: string): string` em `rawmError.ts`.

- [ ] **Step 1: Escrever o teste Rust que falha**

```rust
// packages/core/tests/vectors.rs
use gearhub_core::protocols::rawm::with_protocol_envelope;
use serde::Deserialize;

#[derive(Deserialize)]
struct EnvelopeVector {
    name: String,
    input: String,
    crc: bool,
    expected: String,
}

#[derive(Deserialize)]
struct Vectors {
    version: u32,
    envelope: Vec<EnvelopeVector>,
}

fn from_hex(value: &str) -> Vec<u8> {
    (0..value.len())
        .step_by(2)
        .map(|index| u8::from_str_radix(&value[index..index + 2], 16).expect("hexadecimal"))
        .collect()
}

fn to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn vectors() -> Vectors {
    serde_json::from_str(include_str!("../vectors/rawm-protocol.json")).expect("vetores válidos")
}

#[test]
fn envelope_matches_the_shared_vectors() {
    let vectors = vectors();
    assert_eq!(vectors.version, 1, "vetores de outra versão");
    for vector in &vectors.envelope {
        let encoded = with_protocol_envelope(&from_hex(&vector.input), vector.crc)
            .unwrap_or_else(|error| panic!("{}: {error:?}", vector.name));
        assert_eq!(to_hex(&encoded), vector.expected, "{}", vector.name);
    }
}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cargo test --workspace --all-targets`
Expected: FAIL — `unresolved import gearhub_core::protocols::rawm` e `serde_json` não declarado.

- [ ] **Step 3: Declarar as dependências de teste**

Em `packages/core/Cargo.toml`, acrescente ao final:

```toml
[dev-dependencies]
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

- [ ] **Step 4: Escrever o vocabulário de erro**

```rust
// packages/core/src/protocols/rawm/error.rs

/// Falhas do protocolo RAWM.
///
/// O núcleo não monta texto de interface: cada variante carrega um código
/// estável, e a casca decide como dizê-lo ao usuário.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RawmError {
    /// Evento acima do que o campo de 12 bits endereça.
    EventTooLong,
    /// Evento sem os dois bytes de cabeçalho.
    EventTooShort,
    /// Resposta que não começa com os quatro bytes 0xff.
    MissingPreamble,
    /// Comprimento declarado menor que o próprio cabeçalho.
    InvalidLength,
    /// Relatório HID que não tem 64 bytes.
    ReportNotSixtyFour,
    /// Relatório fora do canal virtual do mouse.
    WrongChannel,
    /// Relatório cujo comprimento declarado excede o que ele carrega.
    TruncatedReport,
}

impl RawmError {
    /// Identificador estável, consumido pela casca para escolher a mensagem.
    pub fn code(&self) -> &'static str {
        match self {
            Self::EventTooLong => "event-too-long",
            Self::EventTooShort => "event-too-short",
            Self::MissingPreamble => "missing-preamble",
            Self::InvalidLength => "invalid-length",
            Self::ReportNotSixtyFour => "report-not-64",
            Self::WrongChannel => "wrong-channel",
            Self::TruncatedReport => "truncated-report",
        }
    }
}
```

- [ ] **Step 5: Escrever o CRC16**

```rust
// packages/core/src/protocols/rawm/crc.rs

/// CRC16 do fabricante, como a biblioteca oficial o calcula.
///
/// Privado ao crate de propósito: quem precisa dele é o envelope, e expor a
/// rotina convidaria a uma segunda chamada fora dele. O valor de verificação
/// CCITT vive nos vetores de conformidade.
pub(crate) fn crc16(data: &[u8]) -> u16 {
    let mut crc: u16 = 0xffff;
    for &value in data {
        crc = ((crc >> 8) & 0xff) | (crc << 8);
        crc ^= u16::from(value);
        crc ^= (crc & 0xff) >> 4;
        crc ^= crc << 12;
        crc ^= (crc & 0xff) << 5;
    }
    crc
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_the_ccitt_check_value() {
        assert_eq!(crc16(b"123456789"), 0x29b1);
    }
}
```

- [ ] **Step 6: Escrever o envelope**

```rust
// packages/core/src/protocols/rawm/envelope.rs
use super::crc::crc16;
use super::error::RawmError;

const CMD_CONFIG: u8 = 0x03;
const CONFIG_TYPE_CRC: u8 = 0x24;
const MAX_EVENT_BYTES: usize = 0x0fff;

/// O comprimento declarado, lido dos dois bytes de cabeçalho.
pub(crate) fn event_length(event: &[u8]) -> usize {
    ((usize::from(event[0] & 0xf0)) << 4) | usize::from(event[1])
}

/// Escreve o próprio comprimento no cabeçalho, em 12 bits repartidos.
fn encode_length(event: &[u8]) -> Result<Vec<u8>, RawmError> {
    if event.len() > MAX_EVENT_BYTES {
        return Err(RawmError::EventTooLong);
    }
    if event.len() < 2 {
        return Err(RawmError::EventTooShort);
    }
    let mut encoded = event.to_vec();
    let length = encoded.len();
    encoded[0] = (encoded[0] & 0x0f) | ((length >> 4) as u8 & 0xf0);
    encoded[1] = (length & 0xff) as u8;
    Ok(encoded)
}

/// Mede o evento e, quando o dispositivo pede CRC, o embrulha num evento de
/// checksum que também se mede.
pub fn with_protocol_envelope(source: &[u8], use_crc: bool) -> Result<Vec<u8>, RawmError> {
    let inner = encode_length(source)?;
    if !use_crc {
        return Ok(inner);
    }
    let checksum = crc16(&inner);
    let mut outer = Vec::with_capacity(5 + inner.len());
    outer.extend_from_slice(&[
        CMD_CONFIG,
        0,
        CONFIG_TYPE_CRC,
        (checksum & 0xff) as u8,
        (checksum >> 8) as u8,
    ]);
    outer.extend_from_slice(&inner);
    encode_length(&outer)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn writes_the_twelve_bit_length_into_the_header() {
        assert_eq!(with_protocol_envelope(&[0x03, 0x00, 0x15], false), Ok(vec![0x03, 0x03, 0x15]));
    }

    #[test]
    fn splits_a_long_length_across_both_header_bytes() {
        let mut long = vec![0u8; 0x123];
        long[0] = 0x03;
        let encoded = with_protocol_envelope(&long, false).expect("evento válido");
        assert_eq!(&encoded[0..2], &[0x13, 0x23]);
    }

    #[test]
    fn rejects_an_event_without_a_header() {
        assert_eq!(with_protocol_envelope(&[0x03], false), Err(RawmError::EventTooShort));
    }
}
```

- [ ] **Step 7: Declarar os módulos**

```rust
// packages/core/src/protocols/rawm/mod.rs
mod crc;
mod envelope;
mod error;

pub use envelope::with_protocol_envelope;
pub use error::RawmError;
```

`event_length` fica `pub(crate)` dentro de `envelope.rs` e é alcançada por `super::envelope::event_length` nas Tarefas 4 e 5. **Não a reexporte aqui:** uma reexportação sem uso vira aviso, e `pnpm lint` roda `clippy -D warnings`.

```rust
// packages/core/src/protocols/mod.rs — substitui o arquivo de uma linha
pub mod rawm;
```

- [ ] **Step 8: Rodar o teste Rust e ver passar**

Run: `cargo test --workspace --all-targets`
Expected: PASS. Os testes de `envelope.rs`, `crc.rs` e `tests/vectors.rs` passam.

- [ ] **Step 9: Verificar que o cargo-machete aceita as dev-dependencies**

Run: `pnpm audit:rust`
Expected: sem erro. Se `serde` ou `serde_json` forem sinalizados, acrescente a `packages/core/Cargo.toml`:

```toml
[package.metadata.cargo-machete]
ignored = ["serde", "serde_json"]
```

- [ ] **Step 10: Escrever a ponte**

Em `packages/core-wasm/src/lib.rs`, acrescente:

```rust
use gearhub_core::protocols::rawm;

/// Converte o erro tipado do núcleo num erro de JavaScript que carrega o
/// código. A casca escolhe o texto; aqui não há tradução.
fn js_error(error: rawm::RawmError) -> JsError {
    JsError::new(error.code())
}

#[wasm_bindgen(js_name = withProtocolEnvelope)]
pub fn with_protocol_envelope(source: &[u8], use_crc: bool) -> Result<Vec<u8>, JsError> {
    rawm::with_protocol_envelope(source, use_crc).map_err(js_error)
}
```

- [ ] **Step 11: Escrever o tradutor de erro na casca**

```ts
// apps/web/src/core/rawmError.ts

/**
 * O núcleo devolve um código estável; o texto é decisão da casca.
 *
 * As mensagens são as mesmas de antes da migração de propósito: o
 * `subscribeToNotifications` reconhece a falha pelo `catch` e o
 * `queryRawmDevice` a mostra ao usuário.
 */
const MESSAGES: Record<string, string> = {
  'event-too-long': 'Evento RAWM excede 4.095 bytes.',
  'event-too-short': 'Evento RAWM precisa de cabeçalho.',
  'missing-preamble': 'Resposta RAWM sem preâmbulo válido.',
  'invalid-length': 'Resposta RAWM declarou comprimento inválido.',
  'report-not-64': 'Relatório RAWM deve ter 64 bytes.',
  'wrong-channel': 'Relatório não pertence ao canal virtual do mouse.',
  'truncated-report': 'Relatório RAWM truncado.',
};

export function rawmErrorMessage(code: string): string {
  return MESSAGES[code] ?? `Falha de protocolo RAWM: ${code}.`;
}

/**
 * Reveste um erro vindo da ponte com o texto que a interface mostra, sem
 * perder o código.
 *
 * O código fica em `cause` de propósito: a mensagem é para o usuário, mas
 * `subscribeToNotifications` precisa distinguir uma falha do montador de uma
 * falha de decodificação, e o passo 5 vai precisar separar o erro da guarda de
 * memória ativa de um erro de transporte. Descartar o código aqui fecharia essa
 * porta em silêncio.
 */
export function asRawmError(error: unknown): Error {
  const code = error instanceof Error ? error.message : String(error);
  return new Error(rawmErrorMessage(code), { cause: code });
}
```

- [ ] **Step 12: Escrever o invólucro no coreBridge**

Em `apps/web/src/core/coreBridge.ts`, acrescente ao import de `gearhub-core-wasm` o nome `withProtocolEnvelope as wasmWithProtocolEnvelope`, e depois:

```ts
import { asRawmError } from './rawmError';

export function withProtocolEnvelope(source: ArrayLike<number>, useCrc: boolean): Uint8Array {
  try {
    return wasmWithProtocolEnvelope(copyBytes(source), useCrc);
  } catch (error) {
    throw asRawmError(error);
  }
}
```

- [ ] **Step 13: Apagar a implementação TypeScript**

Em `apps/web/src/hardware/rawm/protocol.ts`, **remova** `crc16`, `encodeLength`, `withProtocolEnvelope` e as constantes `CONFIG_TYPE_CRC` e `CMD_CONFIG`, e acrescente no topo:

```ts
export { withProtocolEnvelope } from '../../core/coreBridge';
```

Mantenha `eventLength` — ainda é usada por `buildQueryEvent` e `RawEventAssembler`, que migram nas Tarefas 3 e 4.

- [ ] **Step 14: Ajustar os testes que exercitavam a implementação removida**

Em `apps/web/src/hardware/rawm/protocol.test.ts`, **remova** o teste `matches the vendor CRC16 routine` — ele agora vive em `crc.rs` e nos vetores — e remova `crc16` do import. Em `apps/web/src/hardware/rawm/vectors.test.ts`, remova o bloco `it.each(vectors.crc16)` e `crc16` do import, pela mesma razão: o CRC deixou de ser público.

Em `apps/web/src/hardware/rawm/writeProbe.ts:12`, troque o import de `withProtocolEnvelope`:

```ts
import {
  encodeAction,
  encodeConfigReset,
  encodeMouseParamSnapshot,
  withProtocolEnvelope,
} from '../../core/coreBridge';
```

e remova `withProtocolEnvelope` do import de `./protocol`.

- [ ] **Step 15: Rodar as duas suítes**

Run: `pnpm core:build && pnpm --filter @gearhub/web test`
Expected: PASS. Nenhum teste de `protocol.test.ts` deve falhar: o envelope agora vem do Rust e produz os mesmos bytes.

Run: `cargo test --workspace --all-targets`
Expected: PASS.

- [ ] **Step 16: Commit**

```bash
pnpm format
git add packages/core packages/core-wasm apps/web/src/core apps/web/src/hardware/rawm
git commit -m "feat: mover o envelope e o CRC do RAWM para o núcleo"
```

---

### Task 3: Enquadramento de relatórios no núcleo

`frameEvent` e `decodeReportChunk`: partir um evento em relatórios de 64 bytes e ler um de volta.

**Files:**

- Create: `packages/core/src/protocols/rawm/framing.rs`
- Modify: `packages/core/src/protocols/rawm/mod.rs`
- Modify: `packages/core-wasm/src/lib.rs`, `packages/core-wasm/Cargo.toml`
- Modify: `apps/web/src/core/coreBridge.ts`
- Modify: `apps/web/src/hardware/rawm/protocol.ts`
- Modify: `apps/web/src/hardware/rawm/diagnostics.ts:11-18`, `writeProbe.ts:12`

**Interfaces:**

- Consumes: `RawmError` e `with_protocol_envelope` da Tarefa 2.
- Produces:
  - Rust: `frame_event(event: &[u8], virtual_mouse: bool) -> Vec<[u8; 64]>`; `decode_report_chunk(report: &[u8], virtual_mouse: bool) -> Result<Option<Vec<u8>>, RawmError>`.
  - TS: `frameEvent(event: ArrayLike<number>, virtualMouse: boolean): Uint8Array[]`; `decodeReportChunk(report: ArrayLike<number>, virtualMouse: boolean): Uint8Array | null`.

**Por que só um dos dois invólucros tem `try`:** `frame_event` é infalível — ele recebe um evento que `with_protocol_envelope` já mediu e validou, e partir bytes em pedaços de tamanho fixo não tem caso de falha. `decode_report_chunk` recebe bytes de fora, então falha. Os chamadores (`writeProbe.ts`, `LeviathanV4Driver.ts`) usam os dois em par, e só o primeiro da dupla lança.

- [ ] **Step 1: Escrever o teste Rust que falha**

```rust
// packages/core/src/protocols/rawm/framing.rs — bloco de testes ao final
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn uses_sixty_three_byte_physical_chunks_and_pads_each_report() {
        let event: Vec<u8> = (0..70).map(|index| index as u8).collect();
        let reports = frame_event(&event, false);

        assert_eq!(reports.len(), 2);
        assert_eq!(reports[0].len(), 64);
        assert_eq!(reports[0][0], 0xbf);
        assert_eq!(reports[1][0], 0x87);
        assert_eq!(
            decode_report_chunk(&reports[0], false),
            Ok(Some((0..63).map(|index| index as u8).collect()))
        );
    }

    #[test]
    fn reserves_the_first_byte_for_the_virtual_mouse_channel() {
        let event: Vec<u8> = (0..63).map(|index| index as u8).collect();
        let reports = frame_event(&event, true);

        assert_eq!(reports.len(), 2);
        assert_eq!(&reports[0][0..3], &[0xc0, 0xbe, 0]);
        assert_eq!(
            decode_report_chunk(&reports[0], true),
            Ok(Some((0..62).map(|index| index as u8).collect()))
        );
    }

    #[test]
    fn returns_none_for_a_report_without_the_data_marker() {
        let mut report = [0u8; 64];
        report[0] = 0xc0;
        report[1] = 0x52;

        assert_eq!(decode_report_chunk(&report, true), Ok(None));
    }

    #[test]
    fn rejects_a_report_that_is_not_sixty_four_bytes() {
        assert_eq!(
            decode_report_chunk(&[0x80, 0x01, 0x02], false),
            Err(RawmError::ReportNotSixtyFour)
        );
    }

    #[test]
    fn rejects_a_report_from_the_wrong_channel() {
        let mut report = [0u8; 64];
        report[0] = 0x00;
        assert_eq!(decode_report_chunk(&report, true), Err(RawmError::WrongChannel));
    }
}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cargo test --workspace --all-targets`
Expected: FAIL — `cannot find function frame_event`.

- [ ] **Step 3: Implementar o enquadramento**

```rust
// packages/core/src/protocols/rawm/framing.rs — topo do arquivo
use super::error::RawmError;

const REPORT_BYTES: usize = 64;
const PHYSICAL_PAYLOAD_BYTES: usize = 63;
const VIRTUAL_PAYLOAD_BYTES: usize = 62;
const VIRTUAL_MOUSE_CHANNEL: u8 = 0xc0;
const DATA_MARKER: u8 = 0x80;

/// Parte o evento em relatórios de 64 bytes, cada um marcado com o tamanho do
/// pedaço que carrega. O canal virtual gasta o primeiro byte, e por isso leva
/// um byte a menos de carga.
pub fn frame_event(event: &[u8], virtual_mouse: bool) -> Vec<[u8; REPORT_BYTES]> {
    let payload_bytes = if virtual_mouse { VIRTUAL_PAYLOAD_BYTES } else { PHYSICAL_PAYLOAD_BYTES };
    let header_index = usize::from(virtual_mouse);

    event
        .chunks(payload_bytes)
        .map(|chunk| {
            let mut report = [0u8; REPORT_BYTES];
            if virtual_mouse {
                report[0] = VIRTUAL_MOUSE_CHANNEL;
            }
            report[header_index] = DATA_MARKER | chunk.len() as u8;
            report[header_index + 1..header_index + 1 + chunk.len()].copy_from_slice(chunk);
            report
        })
        .collect()
}

/// Lê um relatório de volta.
///
/// Devolve `None` para os quadros que o receptor intercala sem o marcador de
/// dados: são tráfego dele, não corrupção, e falhar neles encerraria a troca.
pub fn decode_report_chunk(
    report: &[u8],
    virtual_mouse: bool,
) -> Result<Option<Vec<u8>>, RawmError> {
    if report.len() != REPORT_BYTES {
        return Err(RawmError::ReportNotSixtyFour);
    }
    let header_index = usize::from(virtual_mouse);
    if virtual_mouse && report[0] != VIRTUAL_MOUSE_CHANNEL {
        return Err(RawmError::WrongChannel);
    }
    let header = report[header_index];
    if header & DATA_MARKER == 0 {
        return Ok(None);
    }
    let length = usize::from(header & 0x3f);
    if length > report.len() - header_index - 1 {
        return Err(RawmError::TruncatedReport);
    }
    Ok(Some(report[header_index + 1..header_index + 1 + length].to_vec()))
}
```

Acrescente `mod framing;` e `pub use framing::{decode_report_chunk, frame_event};` a `mod.rs`.

- [ ] **Step 4: Rodar e ver passar**

Run: `cargo test --workspace --all-targets`
Expected: PASS, 5 testes novos.

- [ ] **Step 5: Declarar `js-sys` na ponte**

`Vec<[u8; 64]>` não atravessa `wasm-bindgen`. A ponte achata; o núcleo não muda de forma.

Em `packages/core-wasm/Cargo.toml`, na seção `[dependencies]`:

```toml
js-sys = "0.3"
```

- [ ] **Step 6: Escrever a ponte**

```rust
// packages/core-wasm/src/lib.rs
#[wasm_bindgen(js_name = frameEvent)]
pub fn frame_event(event: &[u8], virtual_mouse: bool) -> js_sys::Array {
    rawm::frame_event(event, virtual_mouse)
        .into_iter()
        .map(|report| js_sys::Uint8Array::from(&report[..]))
        .collect()
}

#[wasm_bindgen(js_name = decodeReportChunk)]
pub fn decode_report_chunk(
    report: &[u8],
    virtual_mouse: bool,
) -> Result<Option<Vec<u8>>, JsError> {
    rawm::decode_report_chunk(report, virtual_mouse).map_err(js_error)
}
```

- [ ] **Step 7: Escrever os invólucros no coreBridge**

```ts
export function frameEvent(event: ArrayLike<number>, virtualMouse: boolean): Uint8Array[] {
  return wasmFrameEvent(copyBytes(event), virtualMouse) as Uint8Array[];
}

export function decodeReportChunk(
  report: ArrayLike<number>,
  virtualMouse: boolean,
): Uint8Array | null {
  try {
    return wasmDecodeReportChunk(copyBytes(report), virtualMouse) ?? null;
  } catch (error) {
    throw asRawmError(error);
  }
}
```

- [ ] **Step 8: Apagar a implementação TypeScript e reapontar**

Em `protocol.ts`, remova `frameEvent`, `decodeReportChunk` e as constantes `REPORT_BYTES`, `PHYSICAL_PAYLOAD_BYTES`, `VIRTUAL_PAYLOAD_BYTES`, `VIRTUAL_MOUSE_CHANNEL`. Acrescente à linha de reexportação:

```ts
export { decodeReportChunk, frameEvent, withProtocolEnvelope } from '../../core/coreBridge';
```

Em `diagnostics.ts` e `writeProbe.ts`, mova `frameEvent` e `decodeReportChunk` do import de `./protocol` para o import de `../../core/coreBridge`.

- [ ] **Step 9: Rodar as duas suítes**

Run: `pnpm core:build && pnpm --filter @gearhub/web test`
Expected: PASS. Os testes de enquadramento em `protocol.test.ts` continuam válidos e agora exercitam o Rust.

Run: `cargo test --workspace --all-targets`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
pnpm format
git add packages/core packages/core-wasm apps/web/src
git commit -m "feat: mover o enquadramento de relatórios RAWM para o núcleo"
```

---

### Task 4: Montador de eventos no núcleo

`RawEventAssembler` é a peça mais difícil do passo: tem estado, muta um buffer e falha de duas maneiras que a casca trata diferente.

**Files:**

- Create: `packages/core/src/protocols/rawm/assembler.rs`
- Modify: `packages/core/src/protocols/rawm/mod.rs`
- Modify: `packages/core-wasm/src/lib.rs`
- Modify: `apps/web/src/core/coreBridge.ts`
- Modify: `apps/web/src/hardware/rawm/protocol.ts`
- Modify: `apps/web/src/hardware/rawm/session.ts:5-12`, `notifications.ts:2`, `diagnostics.ts:11-18`

**Interfaces:**

- Consumes: `RawmError` da Tarefa 2, `event_length` da Tarefa 2.
- Produces:
  - Rust: `RawEventAssembler::new()`, `push(&mut self, chunk: &[u8]) -> Result<Vec<Vec<u8>>, RawmError>`, `reset(&mut self)`.
  - TS: classe `RawEventAssembler` em `coreBridge.ts` com `push(chunk: Uint8Array): Uint8Array[]` e `reset(): void`, com a mesma forma de hoje para que `session.ts` e `notifications.ts` não mudem de lógica.

- [ ] **Step 1: Escrever o teste Rust que falha**

```rust
// packages/core/src/protocols/rawm/assembler.rs — bloco de testes ao final
#[cfg(test)]
mod tests {
    use super::*;

    /// Um evento como o receptor o emite: preâmbulo, cabeçalho medido, corpo.
    fn event(cmd: u8, body: &[u8]) -> Vec<u8> {
        let length = body.len() + 2;
        let mut bytes = vec![0xff, 0xff, 0xff, 0xff];
        bytes.push((cmd & 0x0f) | ((length >> 4) as u8 & 0xf0));
        bytes.push((length & 0xff) as u8);
        bytes.extend_from_slice(body);
        bytes
    }

    #[test]
    fn emits_nothing_until_the_declared_length_arrives() {
        let stream = event(0x02, &[0x7b, 0x7d]);
        let mut assembler = RawEventAssembler::new();

        assert_eq!(assembler.push(&stream[0..3]), Ok(vec![]));
        assert_eq!(assembler.push(&stream[3..5]), Ok(vec![]));
        assert_eq!(assembler.push(&stream[5..]), Ok(vec![stream[4..].to_vec()]));
    }

    /// Os eventos chegam colados, então um pedaço termina no meio do próximo.
    /// Descartar essa sobra perde o evento seguinte.
    #[test]
    fn emits_both_events_when_one_chunk_spans_the_boundary() {
        let mut stream = event(0x02, &[1, 2, 3]);
        stream.extend_from_slice(&event(0x0b, &[4, 5]));
        let mut assembler = RawEventAssembler::new();

        let events = assembler.push(&stream).expect("fluxo válido");

        assert_eq!(events.len(), 2);
        assert_eq!(events[0][0] & 0x0f, 0x02);
        assert_eq!(&events[0][2..], &[1, 2, 3]);
        assert_eq!(events[1][0] & 0x0f, 0x0b);
    }

    #[test]
    fn rejects_a_response_without_the_four_byte_preamble() {
        let mut assembler = RawEventAssembler::new();
        assert_eq!(
            assembler.push(&[0, 0, 0, 0, 0x02, 0x02]),
            Err(RawmError::MissingPreamble)
        );
    }

    #[test]
    fn rejects_a_declared_length_below_the_header() {
        let mut assembler = RawEventAssembler::new();
        assert_eq!(
            assembler.push(&[0xff, 0xff, 0xff, 0xff, 0x02, 0x01]),
            Err(RawmError::InvalidLength)
        );
    }

    /// Uma falha limpa o buffer, senão o resto do fluxo corrompido seria lido
    /// como um evento novo.
    #[test]
    fn clears_the_buffer_when_it_fails() {
        let mut assembler = RawEventAssembler::new();
        let _ = assembler.push(&[0, 0, 0, 0, 0x02, 0x02]);

        let stream = event(0x02, &[7, 7]);
        assert_eq!(assembler.push(&stream), Ok(vec![stream[4..].to_vec()]));
    }
}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cargo test --workspace --all-targets`
Expected: FAIL — `cannot find type RawEventAssembler`.

- [ ] **Step 3: Implementar o montador**

```rust
// packages/core/src/protocols/rawm/assembler.rs — topo do arquivo
use super::envelope::event_length;
use super::error::RawmError;

const PREAMBLE: [u8; 4] = [0xff, 0xff, 0xff, 0xff];
const HEADER_BYTES: usize = 2;
const MINIMUM_FRAME: usize = PREAMBLE.len() + HEADER_BYTES;

/// Junta os pedaços que chegam num fluxo de eventos.
///
/// Os eventos vêm colados, então um pedaço rotineiramente termina no meio do
/// próximo: a sobra fica guardada para a chamada seguinte. Descartá-la perde o
/// evento e deixa o buffer no meio de uma carga, o que aparece depois como
/// preâmbulo ausente.
#[derive(Debug, Default)]
pub struct RawEventAssembler {
    bytes: Vec<u8>,
}

impl RawEventAssembler {
    pub fn new() -> Self {
        Self::default()
    }

    /// Todos os eventos que este pedaço completou.
    pub fn push(&mut self, chunk: &[u8]) -> Result<Vec<Vec<u8>>, RawmError> {
        self.bytes.extend_from_slice(chunk);
        let mut events = Vec::new();

        loop {
            if self.bytes.len() >= PREAMBLE.len() && self.bytes[..PREAMBLE.len()] != PREAMBLE {
                self.reset();
                return Err(RawmError::MissingPreamble);
            }
            if self.bytes.len() < MINIMUM_FRAME {
                break;
            }

            let declared = event_length(&self.bytes[PREAMBLE.len()..]);
            if declared < HEADER_BYTES {
                self.reset();
                return Err(RawmError::InvalidLength);
            }

            let total = declared + PREAMBLE.len();
            if self.bytes.len() < total {
                break;
            }
            events.push(self.bytes[PREAMBLE.len()..total].to_vec());
            self.bytes.drain(..total);
        }

        Ok(events)
    }

    pub fn reset(&mut self) {
        self.bytes.clear();
    }
}
```

Acrescente `mod assembler;` e `pub use assembler::RawEventAssembler;` a `mod.rs`.

- [ ] **Step 4: Rodar e ver passar**

Run: `cargo test --workspace --all-targets`
Expected: PASS, 5 testes novos.

- [ ] **Step 5: Escrever a ponte**

```rust
// packages/core-wasm/src/lib.rs
#[wasm_bindgen(js_name = RawEventAssembler)]
pub struct WasmRawEventAssembler {
    inner: rawm::RawEventAssembler,
}

#[wasm_bindgen(js_class = RawEventAssembler)]
impl WasmRawEventAssembler {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self { inner: rawm::RawEventAssembler::new() }
    }

    pub fn push(&mut self, chunk: &[u8]) -> Result<js_sys::Array, JsError> {
        let events = self.inner.push(chunk).map_err(js_error)?;
        Ok(events
            .into_iter()
            .map(|event| js_sys::Uint8Array::from(&event[..]))
            .collect())
    }

    pub fn reset(&mut self) {
        self.inner.reset();
    }
}
```

- [ ] **Step 6: Escrever o invólucro no coreBridge**

A classe da ponte já tem a forma certa; o invólucro existe só para traduzir o erro.

```ts
export class RawEventAssembler {
  private readonly inner = new WasmRawEventAssembler();

  push(chunk: Uint8Array): Uint8Array[] {
    try {
      return this.inner.push(chunk) as Uint8Array[];
    } catch (error) {
      throw asRawmError(error);
    }
  }

  reset(): void {
    this.inner.reset();
  }
}
```

- [ ] **Step 7: Apagar a implementação TypeScript e reapontar**

Em `protocol.ts`, remova a classe `RawEventAssembler` e acrescente-a à reexportação. **Mantenha a função privada `eventLength`**: `parseQueryJson` ainda depende dela, e ela sai junto com ele na Tarefa 5.

Em `session.ts`, `notifications.ts` e `diagnostics.ts`, mova `RawEventAssembler` do import de `./protocol` para `../../core/coreBridge`.

- [ ] **Step 8: Confirmar que o `catch` de notifications continua correto**

`subscribeToNotifications` faz `catch { assembler.reset() }` sem olhar o erro. Como o montador do núcleo **já limpa o próprio buffer** ao falhar, o `reset()` vira redundante — mas continua correto e não deve ser removido nesta tarefa: ele também cobre a falha de `decodeReportChunk`, que não limpa nada.

Nenhuma mudança de código neste passo. Rode o teste que prova isso:

Run: `pnpm --filter @gearhub/web test -- notifications`
Expected: PASS, incluindo `keeps listening after a report it cannot decode`.

- [ ] **Step 9: Rodar as duas suítes**

Run: `pnpm core:build && pnpm --filter @gearhub/web test`
Expected: PASS. Em `protocol.test.ts`, `rejects a response without the four-byte preamble` continua passando porque `rawmError.ts` traduz `missing-preamble` para a mensagem que contém "preâmbulo".

Run: `cargo test --workspace --all-targets`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
pnpm format
git add packages/core packages/core-wasm apps/web/src
git commit -m "feat: mover o montador de eventos RAWM para o núcleo"
```

---

### Task 5: Consulta e leitura do JSON de resposta

`buildQueryEvent`, `isQueryResult` e `parseQueryJson` — o que resta de `protocol.ts`.

**Files:**

- Create: `packages/core/src/protocols/rawm/query.rs`
- Modify: `packages/core/src/protocols/rawm/mod.rs`
- Modify: `packages/core-wasm/src/lib.rs`
- Modify: `apps/web/src/core/coreBridge.ts`
- Modify: `apps/web/src/hardware/rawm/protocol.ts`
- Modify: `apps/web/src/hardware/rawm/session.ts:5-12`, `diagnostics.ts:11-18`

**Interfaces:**

- Consumes: `with_protocol_envelope` (Tarefa 2), `event_length` (Tarefa 2), `RawmError`.
- Produces:
  - Rust: `build_query_event(epoch_seconds: u64) -> Result<Vec<u8>, RawmError>`; `is_query_result(event: &[u8]) -> bool`; `query_json(event: &[u8]) -> Result<String, RawmError>`.
  - TS: `buildQueryEvent(epochSeconds?: number): Uint8Array`; `isQueryResult(event: Uint8Array): boolean`; `parseQueryJson(event: Uint8Array): Record<string, unknown>`.

**Nota de fronteira:** o núcleo devolve a **string** JSON, não um objeto. Desserializar para um mapa exigiria `serde` no núcleo e uma representação que atravesse a ponte, sem ganho nenhum: quem consome o resultado é TypeScript, que já tem `JSON.parse`. O núcleo é dono de **onde o JSON começa e termina** dentro do evento, que é a parte que o protocolo define.

- [ ] **Step 1: Escrever o teste Rust que falha**

```rust
// packages/core/src/protocols/rawm/query.rs — bloco de testes ao final
#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocols::rawm::with_protocol_envelope;

    #[test]
    fn builds_a_deterministic_pc_query_with_an_eight_byte_timestamp() {
        assert_eq!(
            build_query_event(0x12345678),
            Ok(vec![0x01, 0x0d, 0x03, 0x00, 0x00, 0x78, 0x56, 0x34, 0x12, 0, 0, 0, 0])
        );
    }

    #[test]
    fn recognises_only_the_query_result_command() {
        assert!(is_query_result(&[0x02, 0x02]));
        assert!(!is_query_result(&[0x0b, 0x02]));
    }

    #[test]
    fn extracts_json_from_a_complete_query_result() {
        let mut body = vec![0x02, 0];
        body.extend_from_slice(br#"{"dn":"Leviathan V4","pi":9026}"#);
        body.push(0);
        let event = with_protocol_envelope(&body, false).expect("evento válido");

        assert_eq!(
            query_json(&event).as_deref(),
            Ok(r#"{"dn":"Leviathan V4","pi":9026}"#)
        );
    }

    #[test]
    fn rejects_an_event_shorter_than_it_declares() {
        let mut event = with_protocol_envelope(&[0x02, 0, 0x7b, 0x7d], false).expect("válido");
        event.pop();
        assert_eq!(query_json(&event), Err(RawmError::InvalidLength));
    }

    #[test]
    fn rejects_an_event_that_is_not_a_query_result() {
        let event = with_protocol_envelope(&[0x0b, 0, 0x00], false).expect("válido");
        assert_eq!(query_json(&event), Err(RawmError::NotAQueryResult));
    }
}
```

- [ ] **Step 2: Acrescentar as variantes de erro que faltam**

Em `packages/core/src/protocols/rawm/error.rs`, acrescente ao enum e ao `code()`:

```rust
    /// Evento que não é resultado de consulta.
    NotAQueryResult,
    /// Carga que não é texto UTF-8.
    InvalidUtf8,
```

```rust
            Self::NotAQueryResult => "not-a-query-result",
            Self::InvalidUtf8 => "invalid-utf8",
```

E em `apps/web/src/core/rawmError.ts`, ao mapa:

```ts
  'not-a-query-result': 'Resposta RAWM não é resultado de consulta.',
  'invalid-utf8': 'Resposta RAWM não é texto válido.',
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cargo test --workspace --all-targets`
Expected: FAIL — `cannot find function build_query_event`.

- [ ] **Step 4: Implementar a consulta**

```rust
// packages/core/src/protocols/rawm/query.rs — topo do arquivo
use super::envelope::{event_length, with_protocol_envelope};
use super::error::RawmError;

const CMD_QUERY: u8 = 0x01;
const CMD_QUERY_RESULT: u8 = 0x02;
const OS_PC: u8 = 0x03;

/// A consulta que o app envia. O carimbo de tempo vai em oito bytes little
/// endian, como a biblioteca do fabricante o escreve.
pub fn build_query_event(epoch_seconds: u64) -> Result<Vec<u8>, RawmError> {
    let mut bytes = vec![CMD_QUERY, 0, OS_PC, 0, 0];
    bytes.extend_from_slice(&epoch_seconds.to_le_bytes());
    with_protocol_envelope(&bytes, false)
}

/// O fluxo também carrega outros eventos; só o comando 0x02 responde à consulta.
pub fn is_query_result(event: &[u8]) -> bool {
    !event.is_empty() && event[0] & 0x0f == CMD_QUERY_RESULT
}

/// O texto JSON que o evento carrega, sem o terminador nulo do firmware.
pub fn query_json(event: &[u8]) -> Result<String, RawmError> {
    if event.len() < 2 || event.len() != event_length(event) {
        return Err(RawmError::InvalidLength);
    }
    if !is_query_result(event) {
        return Err(RawmError::NotAQueryResult);
    }
    let payload = &event[2..];
    let end = if payload.last() == Some(&0) { payload.len() - 1 } else { payload.len() };
    core::str::from_utf8(&payload[..end])
        .map(str::to_owned)
        .map_err(|_| RawmError::InvalidUtf8)
}
```

Acrescente `mod query;` e `pub use query::{build_query_event, is_query_result, query_json};` a `mod.rs`.

- [ ] **Step 5: Rodar e ver passar**

Run: `cargo test --workspace --all-targets`
Expected: PASS, 5 testes novos.

- [ ] **Step 6: Escrever a ponte**

```rust
#[wasm_bindgen(js_name = buildQueryEvent)]
pub fn build_query_event(epoch_seconds: u64) -> Result<Vec<u8>, JsError> {
    rawm::build_query_event(epoch_seconds).map_err(js_error)
}

#[wasm_bindgen(js_name = isQueryResult)]
pub fn is_query_result(event: &[u8]) -> bool {
    rawm::is_query_result(event)
}

#[wasm_bindgen(js_name = queryJson)]
pub fn query_json(event: &[u8]) -> Result<String, JsError> {
    rawm::query_json(event).map_err(js_error)
}
```

- [ ] **Step 7: Escrever os invólucros no coreBridge**

O relógio é da casca: o núcleo é síncrono e não lê a hora. O valor padrão fica aqui.

```ts
export function buildQueryEvent(epochSeconds = Math.floor(Date.now() / 1000)): Uint8Array {
  try {
    return wasmBuildQueryEvent(BigInt(epochSeconds));
  } catch (error) {
    throw asRawmError(error);
  }
}

export function isQueryResult(event: Uint8Array): boolean {
  return wasmIsQueryResult(event);
}

export function parseQueryJson(event: Uint8Array): Record<string, unknown> {
  let text: string;
  try {
    text = wasmQueryJson(event);
  } catch (error) {
    throw asRawmError(error);
  }
  const parsed: unknown = JSON.parse(text);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Identificação RAWM inválida.');
  }
  return parsed as Record<string, unknown>;
}
```

- [ ] **Step 8: Apagar o que resta de protocol.ts e reapontar**

Em `protocol.ts`, remova `buildQueryEvent`, `isQueryResult`, `parseQueryJson`, `eventLength` e as constantes `CMD_QUERY` e `OS_PC`. O arquivo fica só com a linha de reexportação:

```ts
export {
  RawEventAssembler,
  buildQueryEvent,
  decodeReportChunk,
  frameEvent,
  isQueryResult,
  parseQueryJson,
  withProtocolEnvelope,
} from '../../core/coreBridge';
```

Em `session.ts` e `diagnostics.ts`, aponte esses nomes para `../../core/coreBridge`.

- [ ] **Step 9: Rodar as duas suítes**

Run: `pnpm core:build && pnpm --filter @gearhub/web test`
Expected: PASS. Em `vectors.test.ts`, o bloco `queryEvent` agora exercita o Rust pelos mesmos vetores.

Run: `cargo test --workspace --all-targets`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
pnpm format
git add packages/core packages/core-wasm apps/web/src
git commit -m "feat: mover a consulta RAWM e a leitura da resposta para o núcleo"
```

---

### Task 6: Notificações e eixos de DPI no núcleo

`parseNotification` é núcleo; `subscribeToNotifications` fica na casca, porque é um ouvinte de transporte. O arquivo de teste se divide junto.

**Files:**

- Create: `packages/core/src/protocols/rawm/notify.rs`
- Modify: `packages/core/src/protocols/rawm/mod.rs`
- Modify: `packages/core-wasm/src/lib.rs`
- Modify: `apps/web/src/core/coreBridge.ts`
- Modify: `apps/web/src/hardware/rawm/notifications.ts`
- Delete: `apps/web/src/hardware/rawm/dpiValue.ts`
- Modify: `apps/web/src/hardware/rawm/leviathanV4.ts:3`, `LeviathanV4Driver.ts:26`
- Modify: `apps/web/src/hardware/rawm/notifications.test.ts`

**Interfaces:**

- Consumes: `RawmError` e nada mais — a decodificação de notificação não usa o envelope.
- Produces:
  - Rust: `enum RawmNotification { Dpi(u16), DpiXy(u32), Polling(u16), OnboardIndex(u8), OnboardConfig(Vec<u8>) }`; `parse_notification(event: &[u8]) -> Option<RawmNotification>`; `dpi_axes(value: u32) -> (u16, u16)`.
  - TS: `parseNotification(event: Uint8Array): RawmNotification | null` e `dpiAxes(value: number): { x: number; y: number }` em `coreBridge.ts`. O tipo `RawmNotification` continua a união que `notifications.ts` já exporta, sem mudança de forma para os consumidores.

**Nota de fronteira:** o enum com dados é justamente o que a Regra 3 protege. Ele existe no núcleo; a ponte o achata num `struct` de campos opcionais, e o `coreBridge.ts` o remonta na união TypeScript. Nenhum consumidor percebe.

- [ ] **Step 1: Escrever o teste Rust que falha**

```rust
// packages/core/src/protocols/rawm/notify.rs — bloco de testes ao final
#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocols::rawm::with_protocol_envelope;

    fn notify(kind: u8, payload: &[u8]) -> Vec<u8> {
        let mut body = vec![0x0b, 0, kind];
        body.extend_from_slice(payload);
        with_protocol_envelope(&body, false).expect("evento válido")
    }

    #[test]
    fn reads_a_dpi_change_as_a_little_endian_sixteen_bit_value() {
        assert_eq!(parse_notification(&notify(0x00, &[0x20, 0x03])), Some(RawmNotification::Dpi(800)));
    }

    #[test]
    fn reads_the_packed_thirty_two_bit_value_used_for_independent_axes() {
        assert_eq!(
            parse_notification(&notify(0x06, &[0x20, 0x03, 0x90, 0x01])),
            Some(RawmNotification::DpiXy(0x0190_0320))
        );
    }

    #[test]
    fn reads_a_polling_rate_change() {
        assert_eq!(parse_notification(&notify(0x01, &[0xa0, 0x0f])), Some(RawmNotification::Polling(4000)));
    }

    #[test]
    fn reads_the_onboard_index_as_a_zero_based_byte() {
        assert_eq!(parse_notification(&notify(0x22, &[2])), Some(RawmNotification::OnboardIndex(2)));
        assert_eq!(parse_notification(&notify(0x22, &[])), None);
    }

    #[test]
    fn passes_an_onboard_config_payload_through_for_the_collector() {
        assert_eq!(
            parse_notification(&notify(0x14, &[0x00])),
            Some(RawmNotification::OnboardConfig(vec![0x00]))
        );
    }

    #[test]
    fn ignores_what_this_app_has_no_use_for() {
        assert_eq!(parse_notification(&notify(0x17, &[50])), None);
        assert_eq!(parse_notification(&notify(0x00, &[0x20])), None);
        let query = with_protocol_envelope(&[0x02, 0, 0x7b, 0x7d], false).expect("válido");
        assert_eq!(parse_notification(&query), None);
    }

    /// CPI2 empacota X nos 16 bits baixos e Y nos altos. Um valor sem parte
    /// alta é um DPI simétrico, não um Y zerado.
    #[test]
    fn unpacks_dpi_axes() {
        assert_eq!(dpi_axes(0x0190_0320), (800, 400));
        assert_eq!(dpi_axes(800), (800, 800));
    }
}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cargo test --workspace --all-targets`
Expected: FAIL — `cannot find function parse_notification`.

- [ ] **Step 3: Implementar a decodificação**

```rust
// packages/core/src/protocols/rawm/notify.rs — topo do arquivo

const CMD_NOTIFY: u8 = 0x0b;
const NOTIFY_MOUSE_CPI: u8 = 0x00;
const NOTIFY_MOUSE_POLLING: u8 = 0x01;
/// Eixos independentes empacotam X e Y em 32 bits.
const NOTIFY_MOUSE_CPI2: u8 = 0x06;
/// Os mapeamentos de cada memória, transmitidos sem pedido após uma consulta.
const NOTIFY_MOUSE_CONFIG: u8 = 0x14;
const NOTIFY_MOUSE_ONBOARD_INDEX: u8 = 0x22;

/// O que o mouse anuncia por conta própria.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RawmNotification {
    Dpi(u16),
    DpiXy(u32),
    Polling(u16),
    OnboardIndex(u8),
    OnboardConfig(Vec<u8>),
}

/// `None` para as notificações que este app não usa — e para as truncadas,
/// porque relatar um valor pela metade é pior do que não relatar.
pub fn parse_notification(event: &[u8]) -> Option<RawmNotification> {
    if event.len() < 3 || event[0] & 0x0f != CMD_NOTIFY {
        return None;
    }
    let payload = &event[3..];
    let u16_at = || u16::from(payload[0]) | (u16::from(payload[1]) << 8);

    match event[2] {
        NOTIFY_MOUSE_CPI if payload.len() >= 2 => Some(RawmNotification::Dpi(u16_at())),
        NOTIFY_MOUSE_POLLING if payload.len() >= 2 => Some(RawmNotification::Polling(u16_at())),
        NOTIFY_MOUSE_CPI2 if payload.len() >= 4 => Some(RawmNotification::DpiXy(
            u32::from_le_bytes([payload[0], payload[1], payload[2], payload[3]]),
        )),
        NOTIFY_MOUSE_CONFIG if !payload.is_empty() => {
            Some(RawmNotification::OnboardConfig(payload.to_vec()))
        }
        NOTIFY_MOUSE_ONBOARD_INDEX if !payload.is_empty() => {
            Some(RawmNotification::OnboardIndex(payload[0]))
        }
        _ => None,
    }
}

/// CPI2 empacota X nos 16 bits baixos e Y nos altos. Sem parte alta, o DPI é
/// simétrico: devolver zero em Y faria a tela mostrar um eixo morto.
pub fn dpi_axes(value: u32) -> (u16, u16) {
    let x = (value & 0xffff) as u16;
    let y = (value >> 16) as u16;
    (x, if y == 0 { x } else { y })
}
```

Acrescente `mod notify;` e `pub use notify::{dpi_axes, parse_notification, RawmNotification};` a `mod.rs`.

- [ ] **Step 4: Rodar e ver passar**

Run: `cargo test --workspace --all-targets`
Expected: PASS, 7 testes novos.

- [ ] **Step 5: Escrever a ponte que achata o enum**

```rust
/// O enum com dados não atravessa `wasm-bindgen`; esta é a forma achatada.
/// `kind` vazio significa nenhuma notificação de interesse.
#[wasm_bindgen]
pub struct Notification {
    kind: String,
    value: u32,
    payload: Option<Vec<u8>>,
}

#[wasm_bindgen]
impl Notification {
    #[wasm_bindgen(getter)]
    pub fn kind(&self) -> String {
        self.kind.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn value(&self) -> u32 {
        self.value
    }

    #[wasm_bindgen(getter)]
    pub fn payload(&self) -> Option<Vec<u8>> {
        self.payload.clone()
    }
}

#[wasm_bindgen(js_name = parseNotification)]
pub fn parse_notification(event: &[u8]) -> Option<Notification> {
    use rawm::RawmNotification as N;
    rawm::parse_notification(event).map(|notification| match notification {
        N::Dpi(value) => Notification { kind: "dpi".into(), value: u32::from(value), payload: None },
        N::DpiXy(value) => Notification { kind: "dpi-xy".into(), value, payload: None },
        N::Polling(value) => {
            Notification { kind: "polling".into(), value: u32::from(value), payload: None }
        }
        N::OnboardIndex(index) => {
            Notification { kind: "onboard-index".into(), value: u32::from(index), payload: None }
        }
        N::OnboardConfig(payload) => {
            Notification { kind: "onboard-config".into(), value: 0, payload: Some(payload) }
        }
    })
}

#[wasm_bindgen(js_name = dpiAxes)]
pub fn dpi_axes(value: u32) -> Vec<u32> {
    let (x, y) = rawm::dpi_axes(value);
    vec![u32::from(x), u32::from(y)]
}
```

- [ ] **Step 6: Escrever os invólucros no coreBridge**

```ts
export type RawmNotification =
  | { kind: 'dpi'; value: number }
  | { kind: 'dpi-xy'; value: number }
  | { kind: 'polling'; value: number }
  | { kind: 'onboard-index'; index: number }
  | { kind: 'onboard-config'; payload: Uint8Array };

export function parseNotification(event: Uint8Array): RawmNotification | null {
  const decoded = wasmParseNotification(event);
  if (!decoded) return null;
  switch (decoded.kind) {
    case 'dpi':
      return { kind: 'dpi', value: decoded.value };
    case 'dpi-xy':
      return { kind: 'dpi-xy', value: decoded.value };
    case 'polling':
      return { kind: 'polling', value: decoded.value };
    case 'onboard-index':
      return { kind: 'onboard-index', index: decoded.value };
    case 'onboard-config':
      return { kind: 'onboard-config', payload: decoded.payload ?? new Uint8Array() };
    default:
      return null;
  }
}

export function dpiAxes(value: number): { x: number; y: number } {
  const [x, y] = wasmDpiAxes(value);
  return { x, y };
}
```

- [ ] **Step 7: Apagar as implementações TypeScript**

Em `notifications.ts`, remova `parseNotification`, o tipo `RawmNotification` e todas as constantes `NOTIFY_TYPE_*` e `CMD_NOTIFY`. Mantenha `subscribeToNotifications` inteiro e acrescente no topo:

```ts
import { RawEventAssembler, decodeReportChunk, parseNotification } from '../../core/coreBridge';
export type { RawmNotification } from '../../core/coreBridge';
```

Apague `apps/web/src/hardware/rawm/dpiValue.ts`. Em `leviathanV4.ts:3` e `LeviathanV4Driver.ts:26`, troque `import { dpiAxes } from './dpiValue';` por `import { dpiAxes } from '../../core/coreBridge';`.

- [ ] **Step 8: Dividir o arquivo de teste**

Em `apps/web/src/hardware/rawm/notifications.test.ts`, **remova o bloco `describe('parseNotification', …)` inteiro** — esses casos agora vivem em `notify.rs`. **Mantenha o bloco `describe('subscribeToNotifications', …)` sem alteração**: ele testa o ouvinte de transporte, que continua sendo casca, e agora o exercita contra o núcleo.

Ajuste o import do topo do arquivo:

```ts
import { describe, expect, it, vi } from 'vitest';
import type { HardwareTransport } from '../WebHidTransport';
import { frameEvent, withProtocolEnvelope } from '../../core/coreBridge';
import { subscribeToNotifications } from './notifications';
import type { RawmNotification } from '../../core/coreBridge';
```

- [ ] **Step 9: Rodar as duas suítes**

Run: `pnpm core:build && pnpm --filter @gearhub/web test`
Expected: PASS. Os três testes de `subscribeToNotifications` continuam verdes.

Run: `cargo test --workspace --all-targets`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
pnpm format
git add packages/core packages/core-wasm apps/web/src
git commit -m "feat: mover a decodificação de notificações RAWM para o núcleo"
```

---

### Task 7: Apagar a casca vazia e fechar o passo

`protocol.ts` virou só reexportação. Esta tarefa a remove, aponta cada consumidor direto ao núcleo, e prova o passo inteiro.

**Files:**

- Delete: `apps/web/src/hardware/rawm/protocol.ts`, `apps/web/src/hardware/rawm/protocol.test.ts`
- Modify, código de produção: `apps/web/src/hardware/rawm/session.ts`, `notifications.ts`, `diagnostics.ts`, `writeProbe.ts`, `LeviathanV4Driver.ts`
- Modify, testes que importam de `./protocol`: `connectLeviathanV4.test.ts`, `diagnostics.test.ts`, `LeviathanV4Driver.onboard.test.ts`, `LeviathanV4Driver.state.test.ts`, `onboardConfig.test.ts`, `onboardConfig.settings.test.ts`, `session.test.ts`, `writeProbe.test.ts`, `notifications.test.ts`, `vectors.test.ts`
- Modify: `docs/superpowers/specs/2026-09-07-nucleo-rust-ponte-design.md`

**Alcance medido em 2026-09-16:** são **15** arquivos importando de `./protocol`, não os 5 de produção. Os testes sobrevivem intactos às Tarefas 2 a 6 porque `protocol.ts` segue reexportando; só esta tarefa os obriga a mudar. O grep do Passo 2 é a fonte da verdade — se ele listar um arquivo que não está acima, reaponte-o do mesmo jeito.

**Interfaces:**

- Consumes: tudo que as Tarefas 2 a 6 publicaram em `coreBridge.ts`.
- Produces: nenhuma interface nova. O passo 1 do spec fecha aqui.

- [ ] **Step 1: Confirmar que protocol.ts não tem mais implementação**

Run: `cat apps/web/src/hardware/rawm/protocol.ts`
Expected: apenas a linha de reexportação da Tarefa 5. **Se houver qualquer função, pare** — uma tarefa anterior não terminou, e apagar agora perderia código.

- [ ] **Step 2: Apontar cada consumidor ao coreBridge**

Run: `grep -rn "from './protocol'" apps/web/src`
Expected: `session.ts`, `notifications.ts`, `diagnostics.ts`, `writeProbe.ts`.

Em cada um, troque `from './protocol'` por `from '../../core/coreBridge'`, unificando com o import que já existe de lá quando houver. Em `LeviathanV4Driver.ts:29`, faça o mesmo.

- [ ] **Step 3: Apagar o arquivo e o teste**

```bash
git rm apps/web/src/hardware/rawm/protocol.ts apps/web/src/hardware/rawm/protocol.test.ts
```

Os casos de `protocol.test.ts` já vivem em `envelope.rs`, `framing.rs`, `assembler.rs`, `query.rs` e nos vetores. **Antes de apagar**, confira um a um que cada `it(...)` do arquivo tem correspondente em Rust; se algum não tiver, porte-o antes.

- [ ] **Step 4: Provar que nada em TypeScript ainda implementa o codec**

Run: `grep -rn "0x29b1\|0xf0) << 4\|0x80 |\|>>> 16\|<< 16\|0xc0\|preâmbulo" apps/web/src/hardware/`
Cada padrão é uma assinatura de uma parte do codec — a constante do CRC, o deslocamento do comprimento de 12 bits, o marcador de dado do enquadramento, o empacotamento e o desempacotamento de CPI2, o canal virtual e a mensagem do montador.

**Corrigido em 2026-09-17:** este passo dizia "Expected: nenhum resultado", e isso era falso — o grep **não pode** dar vazio. A primeira correção trocou os nomes `VIRTUAL_MOUSE_CHANNEL`/`PHYSICAL_PAYLOAD` (que só existiam dentro do arquivo que esta tarefa apaga, e por isso nunca poderiam bater de novo) por valores, mas o valor escolhido para CPI2 foi `>>> 16` — o deslocamento à direita do split little-endian genérico — quando o empacotamento de CPI2 desloca à **esquerda** (`<< 16`). Com esse buraco a duplicata de `packedDpi` (ver `## Duplicata declarada no caminho de escrita` no spec) também não aparecia, do mesmo jeito que a duplicata de enquadramento em `LeviathanV4Driver.onboard.test.ts` não aparecia com os nomes antigos. Esta versão soma `0x80 |` (o marcador de dado que a duplicata de enquadramento reproduzia) e `<< 16` aos padrões.

Rodado ao final da onda de correções finais — com a duplicata de enquadramento removida e a de `writeProbe.test.ts` reduzida a um helper — o grep devolve dez ocorrências:

| ocorrência                      | o que é                                                                                                                                             |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `connectLeviathanV4.test.ts:66` | lê o primeiro byte de um relatório já produzido para escolher qual fixture responder — leitura, não reimplementação                                 |
| `connectLeviathanV4.test.ts:92` | assere que o relatório enviado usa o canal virtual — asserção sobre a saída da produção                                                             |
| `diagnostics.test.ts:68`        | a mesma leitura do byte de canal, para decidir como interpretar o cenário do teste                                                                  |
| `diagnostics.test.ts:182`       | a mesma leitura do byte de canal, para decidir o deslocamento do payload numa asserção                                                              |
| `diagnostics.test.ts:237`       | assere que a mensagem de erro contém "preâmbulo" — é o contrato da casca, e deve existir                                                            |
| `LeviathanV4Driver.test.ts:71`  | assere que todo relatório enviado usa o canal virtual — asserção sobre a saída da produção                                                          |
| `mouseParamSnapshot.ts:100`     | `pushU32`, split little-endian genérico usado por todo campo de 32 bits do snapshot — parte do mesmo arquivo que migra inteiro no passo 3           |
| `mouseParamSnapshot.ts:142`     | `packedDpi`, o inverso exato de `dpi_axes` — **duplicata declarada no caminho de escrita**, ver `## Duplicata declarada…` no spec; fecha no passo 3 |
| `onboardConfig.ts:53`           | `declaredLength()`, uma segunda implementação do comprimento de 12 bits em código de produção — **exceção declarada**, migra no passo 4 do spec     |
| `writeProbe.test.ts:27`         | o mesmo cálculo, agora num único helper de teste em vez de três cópias                                                                              |

A expectativa correta não é "zero", é: **toda ocorrência tem de ser nomeada e justificada**. Rode o grep, mostre a saída, e reconcilie cada linha. Uma etapa de verificação que não pode passar é pior que nenhuma, porque convida a ser pulada — foi o que aconteceu duas vezes seguidas aqui.

Run: `test ! -f apps/web/src/hardware/rawm/protocol.ts && echo removido`
Expected: `removido`.

- [ ] **Step 5: Rodar o gate completo**

Run: `pnpm verify`
Expected: PASS em `format:check`, `lint`, `test`, `build` e `audit`. Este é o único passo que roda tudo; os anteriores rodaram só as suítes.

- [ ] **Step 6: Marcar o passo como fechado no spec**

Em `docs/superpowers/specs/2026-09-07-nucleo-rust-ponte-design.md`, na `## Ordem corrigida`, acrescente ao final do item 1:

```markdown
**Fechado em AAAA-MM-DD** pelo plano `docs/superpowers/plans/2026-09-16-migracao-codec-rawm.md`.
```

Use a data em que este passo fechar, no formato que o documento já usa. É a mesma convenção das notas `**Fechado em 2026-09-07**` que já existem nele.

- [ ] **Step 7: Commit**

```bash
pnpm format
git add -A
git commit -m "refactor: apagar o codec RAWM em TypeScript"
```

---

## Verificação em hardware

O passo 1 **não** exige confirmação no mouse: ele move codificação e decodificação puras, e os vetores de conformidade provam paridade byte a byte. O spec reserva a confirmação em hardware para os passos 3 a 5, que tocam o caminho de escrita.

Ainda assim, vale uma passada no `diagnostico.html` com o mouse ligado antes de abrir o PR: conectar, capturar a consulta e ver a identidade chegar exercita envelope, enquadramento, montador e leitura de JSON de uma vez, contra firmware real. Se o dump onboard `0x14` aparecer no log, a decodificação de notificação também está de pé.

---

## Planos seguintes

Este plano cobre os passos 0 e 1 da `## Ordem corrigida`. Os demais ganham um plano cada, escrito quando o anterior fechar — a forma de cada um depende do que o anterior revelar, e o passo 5 depende de uma interface que ainda não foi validada por nada.

| plano | passo do spec | escopo                                                                                                                                                                          | portão                               |
| ----- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 2     | 2             | `leviathanV4Keys.ts` e a geração de tipos com `ts-rs`                                                                                                                           | `pnpm verify`                        |
| 3     | 3             | `mouseParamSnapshot.ts`, a metade de dispositivo de `leviathanV4.ts`, LOD, identidade USB                                                                                       | `pnpm verify` + confirmação no mouse |
| 4     | 4             | `onboardConfig.ts`, a decodificação do dump `0x14`                                                                                                                              | `pnpm verify` + confirmação no mouse |
| 5     | 5             | A sessão de `LeviathanV4Driver.ts` sob `next_step()`, a decodificação de `session.ts`, e a sequência de save — inclusive `ACTION_SAVE_CONFIG_TO_FDS`, hoje declarada duas vezes | `pnpm verify` + confirmação no mouse |

O plano 2 é o que carrega mais risco escondido, apesar de parecer o menor: é onde `MouseActionId` passa a ter dois donos, e onde a geração de tipos entra. Se `ts-rs` não couber, a alternativa é `typeshare` — e essa descoberta pertence ao plano 2, não a este.
