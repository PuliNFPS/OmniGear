//! Ponte wasm-bindgen. Nenhuma decisão vive aqui: a macro fica deste lado
//! para que o núcleo não seja moldado pelas restrições do navegador.

use gearhub_core::protocols::rawm;
use wasm_bindgen::prelude::*;

/// Converte o erro tipado do núcleo num erro de JavaScript que carrega o
/// código. A casca escolhe o texto; aqui não há tradução.
fn js_error(error: rawm::RawmError) -> JsError {
    JsError::new(error.code())
}

#[wasm_bindgen(js_name = withProtocolEnvelope)]
pub fn with_protocol_envelope(source: &[u8], use_crc: bool) -> Result<Vec<u8>, JsError> {
    rawm::with_protocol_envelope(source, use_crc).map_err(js_error)
}

#[wasm_bindgen(js_name = frameEvent)]
pub fn frame_event(event: &[u8], virtual_mouse: bool) -> js_sys::Array {
    rawm::frame_event(event, virtual_mouse)
        .into_iter()
        .map(|report| js_sys::Uint8Array::from(&report[..]))
        .collect()
}

#[wasm_bindgen(js_name = decodeReportChunk)]
pub fn decode_report_chunk(report: &[u8], virtual_mouse: bool) -> Result<Option<Vec<u8>>, JsError> {
    rawm::decode_report_chunk(report, virtual_mouse).map_err(js_error)
}

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
