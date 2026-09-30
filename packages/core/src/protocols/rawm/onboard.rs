//! O dump de configuração onboard (`NOTIFY_TYPE_MOUSE_CONFIG`, 0x14).
//!
//! Depois de responder à consulta, o mouse transmite sem pedido os
//! mapeamentos que cada memória onboard guarda. O fluxo é delimitado: um
//! payload de um byte que não é 0xff abre uma memória e descarta o que havia
//! para ela; payloads maiores são as entradas; 0xff termina o dump. Cada
//! entrada tem o mesmo layout que o escritor usa, então o comprimento é o
//! mesmo campo de 12 bits que `event_length` lê.

use serde::{Deserialize, Serialize};

use super::actions::{action_for_function, action_for_key};
use super::envelope::event_length;
use crate::device::MouseActionId;

const CMD_CONFIG: u8 = 0x03;
const CONFIG_TYPE_MOUSE_KEY: u8 = 0x16;
const CONFIG_TYPE_MOUSE_FUNCTION: u8 = 0x18;
const END_OF_DUMP: u8 = 0xff;
/// O fabricante recusa uma entrada com mais que uma camada R-Plus de duas teclas.
const MAX_KEY_IDS: usize = 2;

/// Uma entrada de uma memória, como o mouse a relatou.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS))]
pub struct OnboardBinding {
    /// One id, or two for an R-Plus layer with the activator first.
    pub key_ids: Vec<u8>,
    /// Null when no MouseActionId describes these bytes.
    pub action: Option<MouseActionId>,
    /// The entry as the mouse reported it. Macros, keyboard keys and shell
    /// commands have no action in this app, and rebuilding a slot from actions
    /// alone would erase them from flash, so the bytes are kept to be resent.
    #[serde(with = "serde_bytes")]
    #[cfg_attr(test, ts(type = "Uint8Array"))]
    pub raw: Vec<u8>,
}

/// Uma memória onboard e o que ela guarda.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS))]
pub struct OnboardSlotConfig {
    pub index: u8,
    pub bindings: Vec<OnboardBinding>,
}

fn named_action(config_type: u8, payload: &[u8]) -> Option<MouseActionId> {
    match config_type {
        // [mod1, key_type, key_code, mod2]; um modificador não tem ação própria.
        CONFIG_TYPE_MOUSE_KEY if payload.len() >= 3 => {
            if payload[0] == 0 {
                action_for_key(payload[1], payload[2])
            } else {
                None
            }
        }
        // [touch_type, function, value_lo, value_hi]
        CONFIG_TYPE_MOUSE_FUNCTION if payload.len() >= 2 => action_for_function(payload[1]),
        _ => None,
    }
}

/// Decodifica uma entrada. `None` só para bytes que não são um evento de
/// configuração; uma entrada que o app não sabe nomear volta com `action`
/// vazia e `raw` intacto.
pub fn decode_onboard_entry(entry: &[u8]) -> Option<OnboardBinding> {
    if entry.len() < 4 || entry[0] & 0x0f != CMD_CONFIG || entry.len() < event_length(entry) {
        return None;
    }
    let count = usize::from(entry[3]);
    if count > MAX_KEY_IDS || 4 + count > entry.len() {
        return Some(OnboardBinding {
            key_ids: Vec::new(),
            action: None,
            raw: entry.to_vec(),
        });
    }
    Some(OnboardBinding {
        key_ids: entry[4..4 + count].to_vec(),
        action: named_action(entry[2], &entry[4 + count..]),
        raw: entry.to_vec(),
    })
}

/// Monta o dump delimitado. Recebe cada payload 0x14; devolve as memórias
/// quando o terminador chega, e `None` até lá.
#[derive(Debug, Default)]
pub struct OnboardConfigCollector {
    slots: std::collections::BTreeMap<u8, Vec<OnboardBinding>>,
    current: Option<u8>,
}

impl OnboardConfigCollector {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn push(&mut self, payload: &[u8]) -> Option<Vec<OnboardSlotConfig>> {
        match *payload {
            [] => None,
            [END_OF_DUMP] => Some(self.finish()),
            [index] => {
                // O marcador reinicia a memória: um novo dump substitui, nunca acumula.
                self.current = Some(index);
                self.slots.insert(index, Vec::new());
                None
            }
            _ => {
                let current = self.current?;
                if let Some(binding) = decode_onboard_entry(payload) {
                    self.slots.entry(current).or_default().push(binding);
                }
                None
            }
        }
    }

    fn finish(&mut self) -> Vec<OnboardSlotConfig> {
        self.current = None;
        std::mem::take(&mut self.slots)
            .into_iter()
            .map(|(index, bindings)| OnboardSlotConfig { index, bindings })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocols::rawm::{encode_mapping, with_protocol_envelope};

    fn entry(key_ids: &[u8], action: MouseActionId) -> Vec<u8> {
        with_protocol_envelope(&encode_mapping(key_ids, action).unwrap(), false).unwrap()
    }

    #[test]
    fn reads_every_written_action_back_as_itself() {
        let mut exercised = 0;
        for action in MouseActionId::ALL {
            let Some(inner) = encode_mapping(&[0x0a], action) else {
                continue;
            };
            let bytes = with_protocol_envelope(&inner, false).unwrap();
            let decoded = decode_onboard_entry(&bytes).unwrap();
            assert_eq!(decoded.action, Some(action), "{}", action.as_str());
            assert_eq!(decoded.raw, bytes);
            exercised += 1;
        }
        // Só `Desativado` não escreve; o `continue` não pode pular o resto em silêncio.
        assert_eq!(exercised, MouseActionId::ALL.len() - 1);
    }

    #[test]
    fn reads_an_r_plus_layer_activator_first() {
        let decoded = decode_onboard_entry(&entry(&[0x10, 0x0c], MouseActionId::DpiCiclo)).unwrap();
        assert_eq!(decoded.key_ids, [0x10, 0x0c]);
    }

    #[test]
    fn a_marker_clears_what_was_held_for_that_slot() {
        let mut collector = OnboardConfigCollector::new();
        collector.push(&[1]);
        collector.push(&entry(&[0x0a], MouseActionId::CliqueEsquerdo));
        collector.push(&[1]);
        collector.push(&entry(&[0x0b], MouseActionId::CliqueDireito));
        let slots = collector.push(&[END_OF_DUMP]).unwrap();
        assert_eq!(slots.len(), 1);
        assert_eq!(slots[0].bindings.len(), 1);
        assert_eq!(
            slots[0].bindings[0].action,
            Some(MouseActionId::CliqueDireito)
        );
    }

    #[test]
    fn an_empty_payload_is_ignored_and_leaves_the_state_alone() {
        let mut collector = OnboardConfigCollector::new();
        collector.push(&[2]);
        collector.push(&entry(&[0x0a], MouseActionId::CliqueEsquerdo));
        assert_eq!(collector.push(&[]), None);
        collector.push(&entry(&[0x0b], MouseActionId::CliqueDireito));
        let slots = collector.push(&[END_OF_DUMP]).unwrap();
        assert_eq!(slots.len(), 1);
        assert_eq!(slots[0].index, 2);
        let actions: Vec<_> = slots[0].bindings.iter().map(|b| b.action).collect();
        assert_eq!(
            actions,
            [
                Some(MouseActionId::CliqueEsquerdo),
                Some(MouseActionId::CliqueDireito)
            ]
        );
    }

    #[test]
    fn finishing_resets_the_collector_for_the_next_dump() {
        let mut collector = OnboardConfigCollector::new();
        collector.push(&[0]);
        collector.push(&entry(&[0x0a], MouseActionId::CliqueEsquerdo));
        assert_eq!(collector.push(&[END_OF_DUMP]).unwrap().len(), 1);
        collector.push(&entry(&[0x0a], MouseActionId::CliqueEsquerdo));
        assert_eq!(collector.push(&[END_OF_DUMP]), Some(Vec::new()));
    }

    #[test]
    fn serde_uses_camel_case_and_round_trips() {
        // A prova de que `raw` vira `Uint8Array` fica na ponte (Task 4).
        let binding = decode_onboard_entry(&entry(&[0x0a], MouseActionId::CliqueEsquerdo)).unwrap();
        let json = serde_json::to_value(&binding).unwrap();
        assert_eq!(json["keyIds"], serde_json::json!([10]));
        assert_eq!(json["action"], "clique-esquerdo");
        let back: OnboardBinding = serde_json::from_value(json).unwrap();
        assert_eq!(back, binding);
    }
}
