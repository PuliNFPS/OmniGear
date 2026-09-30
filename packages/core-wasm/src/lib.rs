//! Ponte wasm-bindgen. Nenhuma decisão vive aqui: a macro fica deste lado
//! para que o núcleo não seja moldado pelas restrições do navegador.

use gearhub_core::device::{MouseActionId, MouseSettings};
use gearhub_core::drivers::leviathan_v4;
use gearhub_core::protocols::rawm;
use wasm_bindgen::prelude::*;

/// Converte o erro tipado do núcleo num erro de JavaScript que carrega o
/// código — e, para as variantes com dado, `código:dado`. A casca escolhe o
/// texto; aqui não há tradução.
fn js_error(error: rawm::RawmError) -> JsError {
    match error.detail() {
        Some(detail) => JsError::new(&format!("{}:{detail}", error.code())),
        None => JsError::new(error.code()),
    }
}

/// Uma falha de conversão não é erro de protocolo: atravessa com o texto do
/// serde, e a casca a deixa passar intacta.
fn conversion_error(error: serde_wasm_bindgen::Error) -> JsError {
    JsError::new(&error.to_string())
}

/// Objetos comuns e `null` — o que os tipos gerados declaram. O serializador
/// padrão produziria `Map` para os botões e `undefined` para os opcionais.
///
/// O `json_compatible` também força bytes como array comum; desligado aqui, só
/// os campos marcados `#[serde(with = "serde_bytes")]` (hoje
/// `OnboardBinding.raw`) viram `Uint8Array`, como o tipo gerado declara. Um
/// `Vec<u8>` comum segue como array.
fn to_js<T: serde::Serialize>(value: &T) -> Result<JsValue, JsError> {
    value
        .serialize(
            &serde_wasm_bindgen::Serializer::json_compatible().serialize_bytes_as_arrays(false),
        )
        .map_err(conversion_error)
}

fn from_js<T: serde::de::DeserializeOwned>(value: JsValue) -> Result<T, JsError> {
    serde_wasm_bindgen::from_value(value).map_err(conversion_error)
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

#[wasm_bindgen(js_name = OnboardConfigCollector)]
pub struct WasmOnboardConfigCollector {
    inner: rawm::OnboardConfigCollector,
}

#[wasm_bindgen(js_class = OnboardConfigCollector)]
impl WasmOnboardConfigCollector {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            inner: rawm::OnboardConfigCollector::new(),
        }
    }

    /// As memórias quando o terminador chega; `null` até lá.
    pub fn push(&mut self, payload: &[u8]) -> Result<JsValue, JsError> {
        to_js(&self.inner.push(payload))
    }
}

impl Default for WasmOnboardConfigCollector {
    fn default() -> Self {
        Self::new()
    }
}

#[wasm_bindgen(js_name = decodeOnboardEntry)]
pub fn decode_onboard_entry(entry: &[u8]) -> Result<JsValue, JsError> {
    to_js(&rawm::decode_onboard_entry(entry))
}

#[wasm_bindgen(js_name = settingsFromSlot)]
pub fn settings_from_slot(base: JsValue, slot: JsValue) -> Result<JsValue, JsError> {
    let base: MouseSettings = from_js(base)?;
    let slot: rawm::OnboardSlotConfig = from_js(slot)?;
    to_js(&leviathan_v4::settings_from_slot(&base, &slot))
}

/// O enum com dados não atravessa `wasm-bindgen`; esta é a forma achatada:
/// um array de três posições fixas — `[kind, value, payload]` — em vez de um
/// `struct` com getters. Nenhuma notificação decodificada precisa de
/// identidade nem de estado mutável, então uma classe aqui só custaria uma
/// alocação por evento (com `free()`/`FinalizationRegistry` de brinde) sem
/// comprar nada; `frameEvent` e `RawEventAssembler.push`, ao lado, já
/// devolvem arrays pela mesma razão.
#[wasm_bindgen(js_name = parseNotification)]
pub fn parse_notification(event: &[u8]) -> Option<js_sys::Array> {
    use rawm::RawmNotification as N;
    rawm::parse_notification(event).map(|notification| {
        let (kind, value, payload): (&str, u32, Option<Vec<u8>>) = match notification {
            N::Dpi(value) => ("dpi", u32::from(value), None),
            N::DpiXy(value) => ("dpi-xy", value, None),
            N::Polling(value) => ("polling", u32::from(value), None),
            N::OnboardIndex(index) => ("onboard-index", u32::from(index), None),
            N::OnboardConfig(payload) => ("onboard-config", 0, Some(payload)),
        };

        let entry = js_sys::Array::new();
        entry.push(&JsValue::from_str(kind));
        entry.push(&JsValue::from_f64(f64::from(value)));
        entry.push(&match payload {
            Some(bytes) => JsValue::from(js_sys::Uint8Array::from(&bytes[..])),
            None => JsValue::UNDEFINED,
        });
        entry
    })
}

#[wasm_bindgen(js_name = dpiAxes)]
pub fn dpi_axes(value: u32) -> Vec<u32> {
    let (x, y) = rawm::dpi_axes(value);
    vec![u32::from(x), u32::from(y)]
}

#[wasm_bindgen(js_name = encodeMapping)]
pub fn encode_mapping(key_ids: &[u8], action: &str) -> Result<Option<Vec<u8>>, JsError> {
    let action =
        MouseActionId::parse(action).ok_or_else(|| js_error(rawm::RawmError::UnknownAction))?;
    Ok(rawm::encode_mapping(key_ids, action))
}

#[wasm_bindgen(js_name = actionForKey)]
pub fn action_for_key(key_type: u8, key_code: u8) -> Option<String> {
    rawm::action_for_key(key_type, key_code).map(|action| action.as_str().to_owned())
}

#[wasm_bindgen(js_name = actionForFunction)]
pub fn action_for_function(function_id: u8) -> Option<String> {
    rawm::action_for_function(function_id).map(|action| action.as_str().to_owned())
}

#[wasm_bindgen(js_name = leviathanKeyId)]
pub fn leviathan_key_id(button_id: &str) -> Option<u8> {
    leviathan_v4::key_id(button_id)
}

#[wasm_bindgen(js_name = leviathanButtonId)]
pub fn leviathan_button_id(key_id: u8) -> Option<String> {
    leviathan_v4::button_id(key_id).map(str::to_owned)
}

#[wasm_bindgen(js_name = leviathanShowPowerKeyId)]
pub fn leviathan_show_power_key_id() -> u8 {
    leviathan_v4::SHOW_POWER_KEY_ID
}

#[wasm_bindgen(js_name = encodeLeviathanShowPower)]
pub fn encode_leviathan_show_power() -> Vec<u8> {
    leviathan_v4::encode_show_power()
}

#[wasm_bindgen(js_name = parseMouseParamState)]
pub fn parse_mouse_param_state(raw: JsValue) -> Result<JsValue, JsError> {
    let raw: serde_json::Value = from_js(raw)?;
    to_js(&rawm::parse_mouse_param_snapshot(&raw).map_err(js_error)?)
}

#[wasm_bindgen(js_name = encodeMouseParamBody)]
pub fn encode_mouse_param_body(state: JsValue) -> Result<Vec<u8>, JsError> {
    let state: rawm::MouseParamSnapshot = from_js(state)?;
    Ok(rawm::encode_mouse_param_body(&state))
}

#[wasm_bindgen(js_name = applySettingsToMouseParam)]
pub fn apply_settings_to_mouse_param(
    snapshot: JsValue,
    settings: JsValue,
) -> Result<JsValue, JsError> {
    let snapshot: rawm::MouseParamSnapshot = from_js(snapshot)?;
    let settings: MouseSettings = from_js(settings)?;
    to_js(&leviathan_v4::apply_settings(&snapshot, &settings).map_err(js_error)?)
}

#[wasm_bindgen(js_name = describeLeviathanV4)]
pub fn describe_leviathan_v4(raw: JsValue) -> Result<JsValue, JsError> {
    let raw: serde_json::Value = from_js(raw)?;
    to_js(&leviathan_v4::describe(&raw).map_err(js_error)?)
}

#[wasm_bindgen(js_name = leviathanOnboardSlotCount)]
pub fn leviathan_onboard_slot_count(raw: JsValue) -> Result<u32, JsError> {
    let raw: serde_json::Value = from_js(raw)?;
    Ok(leviathan_v4::onboard_slot_count(&raw))
}

#[wasm_bindgen(js_name = leviathanLodMillimetres)]
pub fn leviathan_lod_millimetres(raw: u32) -> Option<f64> {
    leviathan_v4::lod_millimetres(raw)
}

#[wasm_bindgen(js_name = leviathanV4Usb)]
pub fn leviathan_v4_usb() -> Result<JsValue, JsError> {
    to_js(&leviathan_v4::usb())
}

#[wasm_bindgen(js_name = matchesLeviathanV4)]
pub fn matches_leviathan_v4(device: JsValue) -> Result<bool, JsError> {
    let device: leviathan_v4::HidDevice = from_js(device)?;
    Ok(leviathan_v4::matches(&device))
}

#[wasm_bindgen(js_name = isLeviathanV4Name)]
pub fn is_leviathan_v4_name(name: &str) -> bool {
    leviathan_v4::is_device_name(name)
}

#[wasm_bindgen]
pub fn core_version() -> String {
    gearhub_core::core_version()
}

#[wasm_bindgen]
pub fn is_wasm_available() -> bool {
    gearhub_core::is_wasm_available()
}
