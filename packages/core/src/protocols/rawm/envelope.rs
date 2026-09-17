use super::crc::crc16;
use super::error::RawmError;

const CMD_CONFIG: u8 = 0x03;
const CONFIG_TYPE_CRC: u8 = 0x24;
const MAX_EVENT_BYTES: usize = 0x0fff;

/// O comprimento declarado, lido dos dois bytes de cabeçalho.
///
/// Total: um evento mais curto que 2 bytes lê `0` no lugar do byte ausente,
/// em vez de estourar o índice. Isso não esconde um evento malformado — um
/// comprimento zerado falha a checagem `declared < HEADER_BYTES` do
/// montador, ou a checagem `event.len() != event_length(event)` de
/// `query_json`, do mesmo jeito que o TypeScript substituído falhava.
pub(crate) fn event_length(event: &[u8]) -> usize {
    let high = *event.first().unwrap_or(&0);
    let low = *event.get(1).unwrap_or(&0);
    (usize::from(high & 0xf0) << 4) | usize::from(low)
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
        assert_eq!(
            with_protocol_envelope(&[0x03, 0x00, 0x15], false),
            Ok(vec![0x03, 0x03, 0x15])
        );
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
        assert_eq!(
            with_protocol_envelope(&[0x03], false),
            Err(RawmError::EventTooShort)
        );
    }
}
