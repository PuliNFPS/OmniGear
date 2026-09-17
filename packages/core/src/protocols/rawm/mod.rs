mod assembler;
mod crc;
mod envelope;
mod error;
mod framing;

pub use assembler::RawEventAssembler;
pub use envelope::with_protocol_envelope;
pub use error::RawmError;
pub use framing::{decode_report_chunk, frame_event};
