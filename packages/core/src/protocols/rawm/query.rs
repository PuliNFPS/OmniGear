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
///
/// Estrito: uma carga que não é UTF-8 válido devolve `Err(RawmError::InvalidUtf8)`, ao
/// contrário do `parseQueryJson` em TypeScript que este código substituiu, que decodificava
/// com `new TextDecoder()` — não-fatal por padrão, substituindo o byte inválido por U+FFFD e
/// deixando o `JSON.parse` seguir. A troca foi deliberada, não um acidente de porte: conectar a
/// um dispositivo cuja identidade não pôde ser lida corretamente é pior do que recusar, porque
/// um `dn` corrompido alimentaria o nome do dispositivo, o casamento no registro e o perfil que
/// o usuário salva. Ver `# Mudanças de comportamento deliberadas` em
/// `docs/superpowers/specs/2026-09-07-nucleo-rust-ponte-design.md`.
pub fn query_json(event: &[u8]) -> Result<String, RawmError> {
    if event.len() < 2 || event.len() != event_length(event) {
        return Err(RawmError::InvalidLength);
    }
    if !is_query_result(event) {
        return Err(RawmError::NotAQueryResult);
    }
    let payload = &event[2..];
    let end = if payload.last() == Some(&0) {
        payload.len() - 1
    } else {
        payload.len()
    };
    core::str::from_utf8(&payload[..end])
        .map(str::to_owned)
        .map_err(|_| RawmError::InvalidUtf8)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocols::rawm::with_protocol_envelope;

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

    /// Pina a troca deliberada por um comportamento estrito: o `TextDecoder` que este código
    /// substituiu era não-fatal e substituía o byte inválido por U+FFFD. Mesmos bytes do teste
    /// de ponta a ponta em `apps/web/src/core/rawmError.test.ts`.
    #[test]
    fn rejects_a_payload_that_is_not_valid_utf8() {
        let event = with_protocol_envelope(&[0x02, 0, 0xff, 0xfe], false).expect("válido");
        assert_eq!(query_json(&event), Err(RawmError::InvalidUtf8));
    }
}
