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

            // `event_length` is total and never panics on a short slice, so
            // this call needs no precondition. `MINIMUM_FRAME` still matters
            // here: it is what lets the two bytes past the preamble be a
            // real header instead of a read past the end of a short frame.
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
