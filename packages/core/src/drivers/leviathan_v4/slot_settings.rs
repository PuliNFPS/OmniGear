//! Uma memória onboard lida como configuração do editor.
//!
//! Uma tecla que o dump não menciona não guarda nada, e por isso volta como
//! desativada — é a diferença entre mostrar o mouse e mostrar a suposição do
//! app. Entradas que o app não sabe nomear ficam como estavam: o driver
//! reenvia os bytes delas, e sobrescrever o botão com um palpite seria o mesmo
//! erro na direção contrária. DPI, polling e parâmetros não vêm no dump; só a
//! memória ativa os relata, pela consulta, então ficam como na base.

use super::keys::button_id;
use crate::device::{MouseActionId, MouseSettings};
use crate::protocols::rawm::OnboardSlotConfig;

pub fn settings_from_slot(base: &MouseSettings, slot: &OnboardSlotConfig) -> MouseSettings {
    let mut buttons = base.buttons.clone();
    buttons
        .values_mut()
        .for_each(|action| *action = MouseActionId::Desativado);
    let mut r_plus = base.r_plus.clone();
    if let Some(layer) = r_plus.as_mut() {
        layer
            .buttons
            .values_mut()
            .for_each(|action| *action = MouseActionId::Desativado);
    }

    for binding in &slot.bindings {
        let Some(action) = binding.action else {
            continue;
        };
        match *binding.key_ids.as_slice() {
            [key] => {
                if let Some(assigned) = button_id(key).and_then(|id| buttons.get_mut(id)) {
                    *assigned = action;
                }
            }
            [activator, target] => {
                let (Some(layer), Some(activator), Some(target)) =
                    (r_plus.as_mut(), button_id(activator), button_id(target))
                else {
                    continue;
                };
                if let Some(assigned) = layer.buttons.get_mut(target) {
                    layer.activator_button_id = activator.to_owned();
                    *assigned = action;
                }
            }
            _ => {}
        }
    }

    // Uma tecla que o app não nomeia ainda guarda algo; deixá-la desativada
    // diria que o botão está livre quando não está.
    for binding in &slot.bindings {
        if binding.action.is_some() {
            continue;
        }
        let [key] = *binding.key_ids.as_slice() else {
            continue;
        };
        let Some(id) = button_id(key) else { continue };
        if let (Some(assigned), Some(&original)) = (buttons.get_mut(id), base.buttons.get(id)) {
            *assigned = original;
        }
    }

    MouseSettings {
        buttons,
        r_plus,
        ..base.clone()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::drivers::leviathan_v4::describe;
    use crate::protocols::rawm::{
        OnboardBinding, decode_onboard_entry, encode_mapping, with_protocol_envelope,
    };

    fn base() -> MouseSettings {
        let vectors: serde_json::Value =
            serde_json::from_str(include_str!("../../../vectors/rawm-protocol.json")).unwrap();
        describe(&vectors["queries"]["leviathan-v4-captura"])
            .unwrap()
            .defaults
    }

    fn binding(key_ids: &[u8], action: MouseActionId) -> OnboardBinding {
        let bytes =
            with_protocol_envelope(&encode_mapping(key_ids, action).unwrap(), false).unwrap();
        decode_onboard_entry(&bytes).unwrap()
    }

    fn slot(bindings: Vec<OnboardBinding>) -> OnboardSlotConfig {
        OnboardSlotConfig { index: 0, bindings }
    }

    #[test]
    fn takes_the_action_the_mouse_reports_for_a_key() {
        let settings = settings_from_slot(
            &base(),
            &slot(vec![binding(&[0x0b], MouseActionId::CliqueCentral)]),
        );
        assert_eq!(settings.buttons["direito"], MouseActionId::CliqueCentral);
    }

    #[test]
    fn reads_a_key_the_dump_never_mentions_as_disabled() {
        let base = base();
        assert_eq!(base.buttons["esquerdo"], MouseActionId::CliqueEsquerdo);
        let settings = settings_from_slot(
            &base,
            &slot(vec![binding(&[0x0b], MouseActionId::CliqueDireito)]),
        );
        assert_eq!(settings.buttons["esquerdo"], MouseActionId::Desativado);
    }

    #[test]
    fn reads_an_r_plus_layer_as_its_activator_and_target() {
        let settings = settings_from_slot(
            &base(),
            &slot(vec![binding(&[0x10, 0x0c], MouseActionId::DpiAumentar)]),
        );
        let layer = settings.r_plus.unwrap();
        assert_eq!(layer.activator_button_id, "dpi");
        assert_eq!(layer.buttons["central"], MouseActionId::DpiAumentar);
    }

    #[test]
    fn leaves_a_button_whose_binding_it_cannot_name() {
        let macro_bytes =
            with_protocol_envelope(&[0x03, 0x00, 0x05, 0x01, 0x0a, 0x00, 0x01, 0x02], false)
                .unwrap();
        let unnamed = decode_onboard_entry(&macro_bytes).unwrap();
        assert_eq!(unnamed.action, None);
        let base = base();
        let settings = settings_from_slot(&base, &slot(vec![unnamed]));
        assert_eq!(settings.buttons["esquerdo"], base.buttons["esquerdo"]);
    }

    #[test]
    fn keeps_dpi_polling_and_button_order() {
        let base = base();
        let settings = settings_from_slot(
            &base,
            &slot(vec![binding(&[0x0a], MouseActionId::CliqueEsquerdo)]),
        );
        assert_eq!(settings.polling_rate, base.polling_rate);
        assert_eq!(settings.dpi_stages, base.dpi_stages);
        assert!(settings.buttons.keys().eq(base.buttons.keys()));
    }

    #[test]
    fn a_base_without_r_plus_stays_without_it() {
        let mut base = base();
        base.r_plus = None;
        let settings = settings_from_slot(
            &base,
            &slot(vec![binding(&[0x10, 0x0c], MouseActionId::DpiAumentar)]),
        );
        assert_eq!(settings.r_plus, None);
    }

    #[test]
    fn an_unnamed_entry_wins_over_a_named_one_on_the_same_key() {
        let macro_bytes =
            with_protocol_envelope(&[0x03, 0x00, 0x05, 0x01, 0x0a, 0x00, 0x01, 0x02], false)
                .unwrap();
        let unnamed = decode_onboard_entry(&macro_bytes).unwrap();
        let base = base();
        let settings = settings_from_slot(
            &base,
            &slot(vec![
                unnamed,
                binding(&[0x0a], MouseActionId::CliqueCentral),
            ]),
        );
        assert_eq!(settings.buttons["esquerdo"], base.buttons["esquerdo"]);
    }
}
