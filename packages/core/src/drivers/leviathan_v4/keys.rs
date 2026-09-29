//! Os ids de tecla como o mouse os relata no próprio dump de configuração.
//!
//! 0x0a esquerdo, 0x0b direito, 0x0c central, 0x0e M4, 0x0f M5, 0x10 a tecla
//! de DPI. 0x0d é uma sétima tecla ligada a FUNCTION_SHOW_POWER, que a
//! interface oficial não rotula; as sete batem com os sete atrasos de
//! debounce em `kd`.
//!
//! Valores anteriores eram 1 a 7, que não são ids de tecla. Por isso todo
//! mapeamento escrito era aceito e ignorado.

use crate::protocols::rawm::{FUNCTION_SHOW_POWER, encode_function_press};

/// Os ids de botão da casca, pareados com o id de tecla do mouse.
const PHYSICAL_KEYS: [(&str, u8); 6] = [
    ("esquerdo", 0x0a),
    ("direito", 0x0b),
    ("central", 0x0c),
    ("lateral-traseiro", 0x0e),
    ("lateral-dianteiro", 0x0f),
    ("dpi", 0x10),
];

/// A sétima tecla não tem controle no editor, então nada nas configurações a
/// reconstruiria. O CONFIG_RESET a limpa como qualquer outra, e um conjunto
/// que a omite derruba em silêncio o indicador de bateria.
pub const SHOW_POWER_KEY_ID: u8 = 0x0d;

/// Os botões do aparelho, na ordem da tabela.
pub(super) fn button_ids() -> impl Iterator<Item = &'static str> {
    PHYSICAL_KEYS.iter().map(|&(button, _)| button)
}

pub fn key_id(button_id: &str) -> Option<u8> {
    PHYSICAL_KEYS
        .iter()
        .find(|(button, _)| *button == button_id)
        .map(|&(_, key)| key)
}

pub fn button_id(key_id: u8) -> Option<&'static str> {
    PHYSICAL_KEYS
        .iter()
        .find(|&&(_, key)| key == key_id)
        .map(|&(button, _)| button)
}

/// O evento que devolve à sétima tecla o que o CONFIG_RESET tirou.
pub fn encode_show_power() -> Vec<u8> {
    encode_function_press(&[SHOW_POWER_KEY_ID], FUNCTION_SHOW_POWER)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn button_and_key_ids_are_inverse() {
        for (button, key) in PHYSICAL_KEYS {
            assert_eq!(key_id(button), Some(key));
            assert_eq!(button_id(key), Some(button));
        }
    }

    #[test]
    fn the_seventh_key_belongs_to_no_button() {
        assert_eq!(button_id(SHOW_POWER_KEY_ID), None);
        assert_eq!(key_id("roda"), None);
    }

    #[test]
    fn show_power_is_a_press_of_function_0x0e_on_key_0x0d() {
        assert_eq!(
            encode_show_power(),
            vec![3, 0, 0x18, 1, 0x0d, 2, 0x0e, 0, 0, 0, 0, 0]
        );
    }

    #[test]
    fn every_physical_key_has_a_conformance_vector() {
        let vectors: serde_json::Value = serde_json::from_str(include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/vectors/rawm-protocol.json"
        )))
        .unwrap();
        let entries = vectors["leviathanKeys"].as_array().unwrap();
        assert_eq!(entries.len(), PHYSICAL_KEYS.len());
    }
}
