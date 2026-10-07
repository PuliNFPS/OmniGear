use serde::Serialize;

/// Um relatório HID pronto para enviar. O núcleo o monta; quem envia é a casca.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS))]
pub struct HidCommand {
    pub report_id: u8,
    #[serde(with = "serde_bytes")]
    #[cfg_attr(test, ts(type = "Uint8Array"))]
    pub data: Vec<u8>,
}
