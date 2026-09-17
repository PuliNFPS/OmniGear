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
        NOTIFY_MOUSE_CPI2 if payload.len() >= 4 => {
            Some(RawmNotification::DpiXy(u32::from_le_bytes([
                payload[0], payload[1], payload[2], payload[3],
            ])))
        }
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
        assert_eq!(
            parse_notification(&notify(0x00, &[0x20, 0x03])),
            Some(RawmNotification::Dpi(800))
        );
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
        assert_eq!(
            parse_notification(&notify(0x01, &[0xa0, 0x0f])),
            Some(RawmNotification::Polling(4000))
        );
    }

    #[test]
    fn reads_the_onboard_index_as_a_zero_based_byte() {
        assert_eq!(
            parse_notification(&notify(0x22, &[2])),
            Some(RawmNotification::OnboardIndex(2))
        );
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
