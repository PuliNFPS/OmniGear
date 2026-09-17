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
    let payload_bytes = if virtual_mouse {
        VIRTUAL_PAYLOAD_BYTES
    } else {
        PHYSICAL_PAYLOAD_BYTES
    };
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
    Ok(Some(
        report[header_index + 1..header_index + 1 + length].to_vec(),
    ))
}

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
        assert_eq!(
            decode_report_chunk(&report, true),
            Err(RawmError::WrongChannel)
        );
    }

    /// Só alcançável no canal virtual: o físico tem 63 bytes de carga e a
    /// máscara de 0x3f cabe exatamente neles, então nenhum comprimento
    /// declarado consegue exceder o que o relatório carrega.
    #[test]
    fn rejects_a_virtual_report_whose_declared_length_overruns_it() {
        let mut report = [0u8; 64];
        report[0] = VIRTUAL_MOUSE_CHANNEL;
        report[1] = DATA_MARKER | 0x3f; // declara 63 bytes; só 62 cabem.
        assert_eq!(
            decode_report_chunk(&report, true),
            Err(RawmError::TruncatedReport)
        );
    }
}
