use wasm_bindgen::prelude::*;

pub mod command;
pub mod device;
pub mod drivers;
pub mod protocols;

#[wasm_bindgen]
pub fn core_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[wasm_bindgen]
pub fn is_wasm_available() -> bool {
    true
}

