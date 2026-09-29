mod actions;
mod assembler;
mod crc;
mod envelope;
mod error;
mod framing;
pub(crate) mod json;
mod notify;
mod param_snapshot;
mod query;

pub use actions::{
    FUNCTION_SHOW_POWER, action_for_function, action_for_key, encode_function_press, encode_mapping,
};
pub use assembler::RawEventAssembler;
pub use envelope::with_protocol_envelope;
pub use error::RawmError;
pub use framing::{decode_report_chunk, frame_event};
pub use notify::{RawmNotification, dpi_axes, pack_dpi, parse_notification};
pub use param_snapshot::{MouseParamSnapshot, encode_mouse_param_body, parse_mouse_param_snapshot};
pub use query::{build_query_event, is_query_result, query_json};
