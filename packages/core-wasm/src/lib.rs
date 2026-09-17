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

#[wasm_bindgen(js_name = buildQueryEvent)]
pub fn build_query_event(epoch_seconds: u64) -> Result<Vec<u8>, JsError> {
    rawm::build_query_event(epoch_seconds).map_err(js_error)
}

#[wasm_bindgen(js_name = isQueryResult)]
pub fn is_query_result(event: &[u8]) -> bool {
    rawm::is_query_result(event)
}

#[wasm_bindgen(js_name = queryJson)]
pub fn query_json(event: &[u8]) -> Result<String, JsError> {
    rawm::query_json(event).map_err(js_error)
}

#[wasm_bindgen(js_name = RawEventAssembler)]
pub struct WasmRawEventAssembler {
    inner: rawm::RawEventAssembler,
}

#[wasm_bindgen(js_class = RawEventAssembler)]
impl WasmRawEventAssembler {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            inner: rawm::RawEventAssembler::new(),
        }
    }

    pub fn push(&mut self, chunk: &[u8]) -> Result<js_sys::Array, JsError> {
        let events = self.inner.push(chunk).map_err(js_error)?;
        Ok(events
            .into_iter()
            .map(|event| js_sys::Uint8Array::from(&event[..]))
            .collect())
    }

    pub fn reset(&mut self) {
        self.inner.reset();
    }
}

impl Default for WasmRawEventAssembler {
    fn default() -> Self {
        Self::new()
    }
}

/// O enum com dados não atravessa `wasm-bindgen`; esta é a forma achatada.
/// `kind` vazio significa nenhuma notificação de interesse.
#[wasm_bindgen]
pub struct Notification {
    kind: String,
    value: u32,
    payload: Option<Vec<u8>>,
}

#[wasm_bindgen]
impl Notification {
    #[wasm_bindgen(getter)]
    pub fn kind(&self) -> String {
        self.kind.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn value(&self) -> u32 {
        self.value
    }

    #[wasm_bindgen(getter)]
    pub fn payload(&self) -> Option<Vec<u8>> {
        self.payload.clone()
    }
}

#[wasm_bindgen(js_name = parseNotification)]
pub fn parse_notification(event: &[u8]) -> Option<Notification> {
    use rawm::RawmNotification as N;
    rawm::parse_notification(event).map(|notification| match notification {
        N::Dpi(value) => Notification {
            kind: "dpi".into(),
            value: u32::from(value),
            payload: None,
        },
        N::DpiXy(value) => Notification {
            kind: "dpi-xy".into(),
            value,
            payload: None,
        },
        N::Polling(value) => Notification {
            kind: "polling".into(),
            value: u32::from(value),
            payload: None,
        },
        N::OnboardIndex(index) => Notification {
            kind: "onboard-index".into(),
            value: u32::from(index),
            payload: None,
        },
        N::OnboardConfig(payload) => Notification {
            kind: "onboard-config".into(),
            value: 0,
            payload: Some(payload),
        },
    })
}

#[wasm_bindgen(js_name = dpiAxes)]
pub fn dpi_axes(value: u32) -> Vec<u32> {
    let (x, y) = rawm::dpi_axes(value);
    vec![u32::from(x), u32::from(y)]
}

#[wasm_bindgen]
pub fn core_version() -> String {
    gearhub_core::core_version()
}

#[wasm_bindgen]
pub fn is_wasm_available() -> bool {
    gearhub_core::is_wasm_available()
}
