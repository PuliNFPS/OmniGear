//! Como reconhecer um Leviathan V4: o receptor USB e o nome que o mouse relata.

use serde::{Deserialize, Serialize};

const VENDOR_ID: u16 = 0x1915;
const RECEIVER_PRODUCT_ID: u16 = 0x2346;
/// A coleção vendor por onde o receptor fala o protocolo de configuração.
const CONFIG_USAGE_PAGE: u16 = 0xff00;
const CONFIG_USAGE: u16 = 0x0001;

/// Os números que a casca usa para montar o filtro do seletor WebHID.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS))]
pub struct LeviathanV4Usb {
    pub vendor_id: u16,
    pub receiver_product_id: u16,
    pub config_usage_page: u16,
    pub config_usage: u16,
}

pub fn usb() -> LeviathanV4Usb {
    LeviathanV4Usb {
        vendor_id: VENDOR_ID,
        receiver_product_id: RECEIVER_PRODUCT_ID,
        config_usage_page: CONFIG_USAGE_PAGE,
        config_usage: CONFIG_USAGE,
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HidReport {
    pub report_id: u8,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HidCollection {
    pub usage_page: u16,
    pub usage: u16,
    #[serde(default)]
    pub input_reports: Vec<HidReport>,
    #[serde(default)]
    pub output_reports: Vec<HidReport>,
}

/// O que a casca sabe de um dispositivo HID antes de abri-lo.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HidDevice {
    pub vendor_id: u16,
    pub product_id: u16,
    pub collections: Vec<HidCollection>,
}

/// A coleção de configuração tem de ler e escrever pelo relatório 0: uma
/// interface irmã do mesmo receptor não responde a uma consulta.
fn is_config_collection(collection: &HidCollection) -> bool {
    let has_report_zero =
        |reports: &[HidReport]| reports.iter().any(|report| report.report_id == 0);
    collection.usage_page == CONFIG_USAGE_PAGE
        && collection.usage == CONFIG_USAGE
        && has_report_zero(&collection.input_reports)
        && has_report_zero(&collection.output_reports)
}

pub fn matches(device: &HidDevice) -> bool {
    device.vendor_id == VENDOR_ID
        && device.product_id == RECEIVER_PRODUCT_ID
        && device.collections.iter().any(is_config_collection)
}

/// O nome que o mouse relata em `dn`: `Leviathan` em qualquer caixa, ou
/// `魔鲸 V4` como o firmware chinês o chama.
pub fn is_device_name(name: &str) -> bool {
    let lower = name.to_lowercase();
    lower.contains("leviathan")
        || lower
            .match_indices("魔鲸")
            .any(|(index, found)| lower[index + found.len()..].trim_start().starts_with("v4"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn receiver(collections: Vec<HidCollection>) -> HidDevice {
        HidDevice {
            vendor_id: 0x1915,
            product_id: 0x2346,
            collections,
        }
    }

    fn config_collection() -> HidCollection {
        HidCollection {
            usage_page: 0xff00,
            usage: 0x0001,
            input_reports: vec![HidReport { report_id: 0 }],
            output_reports: vec![HidReport { report_id: 0 }],
        }
    }

    #[test]
    fn matches_the_receiver_with_the_bidirectional_config_collection() {
        assert!(matches(&receiver(vec![config_collection()])));
    }

    #[test]
    fn rejects_a_sibling_interface_and_a_one_way_collection() {
        let consumer = HidCollection {
            usage_page: 0x000c,
            ..config_collection()
        };
        assert!(!matches(&receiver(vec![consumer])));
        let input_only = HidCollection {
            output_reports: vec![],
            ..config_collection()
        };
        assert!(!matches(&receiver(vec![input_only])));
        assert!(!matches(&receiver(vec![])));
    }

    #[test]
    fn does_not_guess_support_for_another_product_of_the_vendor() {
        let mut device = receiver(vec![config_collection()]);
        device.product_id = 0xffff;
        assert!(!matches(&device));
    }

    #[test]
    fn recognises_the_names_the_firmware_reports() {
        assert!(is_device_name("LEVIATHAN V4"));
        assert!(is_device_name("Leviathan V4"));
        assert!(is_device_name("魔鲸 V4"));
        assert!(is_device_name("魔鲸v4"));
        assert!(!is_device_name("RAWM HS Receiver"));
        assert!(!is_device_name("魔鲸 V3"));
        assert!(!is_device_name(""));
    }

    #[test]
    fn usb_numbers_are_the_receiver_s() {
        assert_eq!(
            usb(),
            LeviathanV4Usb {
                vendor_id: 0x1915,
                receiver_product_id: 0x2346,
                config_usage_page: 0xff00,
                config_usage: 0x0001
            }
        );
    }
}
