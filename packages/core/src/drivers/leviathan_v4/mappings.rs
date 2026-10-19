//! O conjunto de mapeamentos que o editor reconstrói, e o que o mouse diz guardar.
//!
//! `CONFIG_RESET` limpa todo mapeamento do mouse, então o que vai depois dele
//! é o conjunto inteiro: os botões do editor, a camada R-Plus e a sétima
//! tecla, que nenhum controle alcança. O que o mouse relatou e o app não sabe
//! nomear — macros, teclas de teclado — volta como chegou, fora das teclas que
//! o editor reconstrói.

use std::collections::BTreeSet;

use super::keys::{SHOW_POWER_KEY_ID, encode_show_power, key_id};
use crate::device::{MouseActionId, MouseSettings};
use crate::protocols::rawm::{OnboardSlotConfig, RawmError, encode_mapping};

/// Uma tecla, ou um par R-Plus com o ativador primeiro, e a ação do editor.
struct KeySet {
    key_ids: Vec<u8>,
    action: MouseActionId,
}

/// O que uma tecla guarda.
///
/// `Raw` só aparece hoje do lado relatado; é por ele que um botão do editor
/// com uma macro poderá ser escrito de volta, quando o editor souber mostrá-lo
/// (ver `### Escopo: migração com paridade` no desenho do passo 5).
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
enum Binding {
    Action(MouseActionId),
    Raw(Vec<u8>),
}

/// O que um conjunto de mapeamentos deixa no mouse, comparável.
///
/// Substitui a assinatura em texto do driver TypeScript (`teclas=valor`,
/// ordenada e unida por `|`). A igualdade é a mesma: aquela codificação era
/// injetiva — nenhum nome de ação começa com `raw:` — e o `join` guardava
/// repetições, como esta lista ordenada guarda.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct Signature(Vec<(Vec<u8>, Binding)>);

impl Signature {
    fn new(mut entries: Vec<(Vec<u8>, Binding)>) -> Self {
        entries.sort();
        Self(entries)
    }
}

fn is_show_power(key_ids: &[u8]) -> bool {
    key_ids == [SHOW_POWER_KEY_ID]
}

/// Toda tecla que o editor reconstrói, na ordem em que vai para o mouse.
fn editor_key_sets(settings: &MouseSettings) -> Result<Vec<KeySet>, RawmError> {
    let mut sets = Vec::new();
    for (button, &action) in &settings.buttons {
        let key = key_id(button).ok_or_else(|| RawmError::UnknownButton {
            button: button.clone(),
        })?;
        sets.push(KeySet {
            key_ids: vec![key],
            action,
        });
    }
    if let Some(r_plus) = &settings.r_plus {
        let activator =
            key_id(&r_plus.activator_button_id).ok_or(RawmError::InvalidRPlusActivator)?;
        for (button, &action) in &r_plus.buttons {
            if *button == r_plus.activator_button_id {
                continue;
            }
            let target = key_id(button).ok_or_else(|| RawmError::UnknownRPlusButton {
                button: button.clone(),
            })?;
            sets.push(KeySet {
                key_ids: vec![activator, target],
                action,
            });
        }
    }
    Ok(sets)
}

/// Os eventos de mapeamento. Depois de `CONFIG_RESET` tem de ser o conjunto
/// inteiro, não uma diferença: o que ficar de fora para de funcionar até
/// desligar o mouse — inclusive a sétima tecla.
pub(super) fn mapping_events(settings: &MouseSettings) -> Result<Vec<Vec<u8>>, RawmError> {
    let mut events: Vec<Vec<u8>> = editor_key_sets(settings)?
        .into_iter()
        .filter_map(|set| encode_mapping(&set.key_ids, set.action))
        .collect();
    events.push(encode_show_power());
    Ok(events)
}

/// O que as configurações deixariam no mouse. Uma tecla desativada não
/// escreve nada, então não fica.
pub(super) fn intended_signature(settings: &MouseSettings) -> Result<Signature, RawmError> {
    Ok(Signature::new(
        editor_key_sets(settings)?
            .into_iter()
            .filter(|set| encode_mapping(&set.key_ids, set.action).is_some())
            .map(|set| (set.key_ids, Binding::Action(set.action)))
            .collect(),
    ))
}

/// O que o mouse diz guardar numa memória, com nome onde o app tem um.
pub(super) fn reported_signature(slot: &OnboardSlotConfig) -> Signature {
    Signature::new(
        slot.bindings
            .iter()
            // A sétima tecla é reconstruída igual dos dois lados.
            .filter(|binding| !is_show_power(&binding.key_ids))
            .map(|binding| {
                let held = binding
                    .action
                    .map_or_else(|| Binding::Raw(binding.raw.clone()), Binding::Action);
                (binding.key_ids.clone(), held)
            })
            .collect(),
    )
}

/// As entradas sem nome que o mouse relatou, para reenviar intactas. As teclas
/// que o editor reconstrói ficam de fora: dois eventos para uma tecla brigariam.
pub(super) fn preserved_events(
    settings: &MouseSettings,
    slot: Option<&OnboardSlotConfig>,
) -> Result<Vec<Vec<u8>>, RawmError> {
    let Some(slot) = slot else {
        return Ok(Vec::new());
    };
    let mut rebuilt: BTreeSet<Vec<u8>> = editor_key_sets(settings)?
        .into_iter()
        .map(|set| set.key_ids)
        .collect();
    rebuilt.insert(vec![SHOW_POWER_KEY_ID]);
    Ok(slot
        .bindings
        .iter()
        .filter(|binding| binding.action.is_none() && !rebuilt.contains(&binding.key_ids))
        .map(|binding| binding.raw.clone())
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::device::MouseRPlusSettings;
    use crate::drivers::leviathan_v4::describe;
    use crate::protocols::rawm::{OnboardBinding, decode_onboard_entry, with_protocol_envelope};

    fn defaults() -> MouseSettings {
        let vectors: serde_json::Value =
            serde_json::from_str(include_str!("../../../vectors/rawm-protocol.json")).unwrap();
        describe(&vectors["queries"]["leviathan-v4-captura"])
            .unwrap()
            .defaults
    }

    fn binding(key_ids: &[u8], action: Option<MouseActionId>, raw: &[u8]) -> OnboardBinding {
        OnboardBinding {
            key_ids: key_ids.to_vec(),
            action,
            raw: raw.to_vec(),
        }
    }

    /// Uma memória como o mouse a relataria depois de receber `settings`.
    fn held(settings: &MouseSettings) -> OnboardSlotConfig {
        OnboardSlotConfig {
            index: 0,
            bindings: mapping_events(settings)
                .unwrap()
                .iter()
                .filter_map(|event| {
                    decode_onboard_entry(&with_protocol_envelope(event, false).unwrap())
                })
                .collect(),
        }
    }

    #[test]
    fn the_set_ends_with_the_seventh_key() {
        let events = mapping_events(&defaults()).unwrap();
        assert_eq!(events.last(), Some(&encode_show_power()));
    }

    #[test]
    fn a_disabled_key_writes_nothing_and_is_not_held() {
        let mut settings = defaults();
        let count = mapping_events(&settings).unwrap().len();
        settings
            .buttons
            .insert("central".into(), MouseActionId::Desativado);
        assert_eq!(mapping_events(&settings).unwrap().len(), count - 1);
        assert!(
            !intended_signature(&settings)
                .unwrap()
                .0
                .iter()
                .any(|(keys, _)| keys == &[0x0c])
        );
    }

    #[test]
    fn unknown_buttons_name_themselves() {
        let mut settings = defaults();
        settings
            .buttons
            .insert("inexistente".into(), MouseActionId::Voltar);
        assert_eq!(
            mapping_events(&settings).err(),
            Some(RawmError::UnknownButton {
                button: "inexistente".into()
            })
        );
    }

    #[test]
    fn the_r_plus_layer_pairs_the_activator_first_and_skips_it() {
        let mut settings = defaults();
        settings.r_plus = Some(MouseRPlusSettings {
            activator_button_id: "lateral-dianteiro".into(),
            buttons: [
                ("lateral-dianteiro".to_string(), MouseActionId::Voltar),
                ("central".to_string(), MouseActionId::DpiAumentar),
            ]
            .into_iter()
            .collect(),
        });
        let sets = editor_key_sets(&settings).unwrap();
        let layer: Vec<&KeySet> = sets.iter().filter(|set| set.key_ids.len() == 2).collect();
        assert_eq!(layer.len(), 1);
        assert_eq!(layer[0].key_ids, vec![0x0f, 0x0c]);
        assert_eq!(layer[0].action, MouseActionId::DpiAumentar);
    }

    #[test]
    fn a_bad_r_plus_activator_or_button_is_refused() {
        let mut settings = defaults();
        settings.r_plus = Some(MouseRPlusSettings {
            activator_button_id: "inexistente".into(),
            buttons: Default::default(),
        });
        assert_eq!(
            mapping_events(&settings).err(),
            Some(RawmError::InvalidRPlusActivator)
        );
        settings.r_plus = Some(MouseRPlusSettings {
            activator_button_id: "dpi".into(),
            buttons: [("inexistente".to_string(), MouseActionId::Voltar)]
                .into_iter()
                .collect(),
        });
        assert_eq!(
            mapping_events(&settings).err(),
            Some(RawmError::UnknownRPlusButton {
                button: "inexistente".into()
            })
        );
    }

    #[test]
    fn what_the_mouse_reports_matches_what_the_settings_would_leave() {
        let settings = defaults();
        assert_eq!(
            reported_signature(&held(&settings)),
            intended_signature(&settings).unwrap()
        );
    }

    /// O defeito do passo 4, portado como está: os bytes sem nome num botão do
    /// editor nunca batem com o que o editor pretende.
    #[test]
    fn a_macro_on_an_editor_button_never_matches() {
        let settings = defaults();
        let mut slot = held(&settings);
        slot.bindings.retain(|binding| binding.key_ids != [0x0a]);
        slot.bindings
            .push(binding(&[0x0a], None, &[3, 8, 0x05, 1, 0x0a, 1, 2, 3]));
        assert_ne!(
            reported_signature(&slot),
            intended_signature(&settings).unwrap()
        );
    }

    #[test]
    fn preserved_entries_are_the_unnamed_ones_outside_the_editor() {
        let settings = defaults();
        let slot = OnboardSlotConfig {
            index: 1,
            bindings: vec![
                // Fora do editor e sem nome: volta.
                binding(&[0x60], None, &[3, 8, 0x05, 1, 0x60, 1, 2, 3]),
                // Botão do editor: o editor reconstrói.
                binding(&[0x0a], None, &[3, 8, 0x05, 1, 0x0a, 1, 2, 3]),
                // A sétima tecla: reconstruída.
                binding(&[SHOW_POWER_KEY_ID], None, &[9]),
                // Tem nome: não é preservada.
                binding(&[0x61], Some(MouseActionId::Voltar), &[7]),
            ],
        };
        assert_eq!(
            preserved_events(&settings, Some(&slot)).unwrap(),
            vec![vec![3, 8, 0x05, 1, 0x60, 1, 2, 3]]
        );
        assert_eq!(
            preserved_events(&settings, None).unwrap(),
            Vec::<Vec<u8>>::new()
        );
    }
}
