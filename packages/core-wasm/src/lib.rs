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
