//! Como o RAWM codifica cada ação, e o caminho inverso para ler um dump.
//!
//! Os códigos são os da biblioteca do fabricante (`send_event_mouse_key` e
//! `send_event_mouse_function`). A tabela serve ao escritor e ao leitor: o
//! inverso é calculado dela, nunca escrito à parte.

use crate::device::MouseActionId;
use crate::{encode_mouse_function, encode_mouse_key};

const TOUCH_TYPE_PRESS: u8 = 0x02;
const MOUSE_KEY_TYPE_MKEY: u8 = 0x01;
const MOUSE_KEY_TYPE_WHEEL: u8 = 0x03;

/// A função que acende o indicador de bateria. Nenhuma ação do app a nomeia.
pub const FUNCTION_SHOW_POWER: u8 = 0x0e;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum EncodedAction {
    Key { key_type: u8, key_code: u8 },
    Function { function_id: u8 },
    Disabled,
}

fn encoded(action: MouseActionId) -> EncodedAction {
    use EncodedAction::{Disabled, Function, Key};
    use MouseActionId::*;
    match action {
        CliqueEsquerdo => Key {
            key_type: MOUSE_KEY_TYPE_MKEY,
            key_code: 1,
        },
        CliqueDireito => Key {
            key_type: MOUSE_KEY_TYPE_MKEY,
            key_code: 2,
        },
        CliqueCentral => Key {
            key_type: MOUSE_KEY_TYPE_MKEY,
            key_code: 3,
        },
        Voltar => Key {
            key_type: MOUSE_KEY_TYPE_MKEY,
            key_code: 4,
        },
        Avancar => Key {
            key_type: MOUSE_KEY_TYPE_MKEY,
            key_code: 5,
        },
        // MOUSE_KEY_WHEEL_UP e _DOWN na biblioteca do fabricante, não 0x41 e 0x3f.
        RolagemCima => Key {
            key_type: MOUSE_KEY_TYPE_WHEEL,
            key_code: 0x07,
        },
        RolagemBaixo => Key {
            key_type: MOUSE_KEY_TYPE_WHEEL,
            key_code: 0x08,
        },
        DpiCiclo => Function { function_id: 1 },
        DpiAumentar => Function { function_id: 2 },
        DpiDiminuir => Function { function_id: 3 },
        Desativado => Disabled,
    }
}

/// Um evento de função disparado ao pressionar, sem valor nem texto.
pub fn encode_function_press(key_ids: &[u8], function_id: u8) -> Vec<u8> {
    encode_mouse_function(key_ids, TOUCH_TYPE_PRESS, function_id, 0, &[])
}

/// O evento que atribui `action` às teclas `key_ids` — uma, ou duas para uma
/// camada R-Plus, com o ativador primeiro. `None` quando a ação não escreve
/// nada: desativar uma tecla é deixá-la fora do conjunto depois do
/// CONFIG_RESET.
pub fn encode_mapping(key_ids: &[u8], action: MouseActionId) -> Option<Vec<u8>> {
    match encoded(action) {
        EncodedAction::Key { key_type, key_code } => {
            Some(encode_mouse_key(key_ids, 0, 0, key_type, key_code))
        }
        EncodedAction::Function { function_id } => {
            Some(encode_function_press(key_ids, function_id))
        }
        EncodedAction::Disabled => None,
    }
}

/// A ação que um par tipo/código de tecla significa, sem modificador.
pub fn action_for_key(key_type: u8, key_code: u8) -> Option<MouseActionId> {
    MouseActionId::ALL
        .into_iter()
        .find(|&action| encoded(action) == EncodedAction::Key { key_type, key_code })
}

/// A ação que um id de função significa.
pub fn action_for_function(function_id: u8) -> Option<MouseActionId> {
    MouseActionId::ALL
        .into_iter()
        .find(|&action| encoded(action) == EncodedAction::Function { function_id })
}

#[cfg(test)]
mod tests {
    use super::*;

    // Byte a byte contra send_event_mouse_key e send_event_mouse_function na
    // biblioteca do fabricante, com os ids que o mouse relata para si.
    #[test]
    fn encodes_mouse_wheel_dpi_and_r_plus_as_the_vendor_does() {
        assert_eq!(
            encode_mapping(&[0x0a], MouseActionId::CliqueEsquerdo),
            Some(vec![3, 0, 0x16, 1, 0x0a, 0, 1, 1, 0, 0])
        );
        assert_eq!(
            encode_mapping(&[0x10], MouseActionId::DpiCiclo),
            Some(vec![3, 0, 0x18, 1, 0x10, 2, 1, 0, 0, 0, 0, 0])
        );
        assert_eq!(
            encode_mapping(&[0x0c], MouseActionId::RolagemCima),
            Some(vec![3, 0, 0x16, 1, 0x0c, 0, 3, 0x07, 0, 0])
        );
        assert_eq!(
            encode_mapping(&[0x10, 0x0c], MouseActionId::DpiCiclo),
            Some(vec![3, 0, 0x18, 2, 0x10, 0x0c, 2, 1, 0, 0, 0, 0, 0])
        );
        assert_eq!(encode_mapping(&[0x0a], MouseActionId::Desativado), None);
    }

    /// O leitor inverte a tabela do escritor. Se duas ações dividissem um
    /// código, o dump de uma voltaria como a outra.
    #[test]
    fn every_written_action_reads_back_as_itself() {
        for action in MouseActionId::ALL {
            let read = match encoded(action) {
                EncodedAction::Key { key_type, key_code } => action_for_key(key_type, key_code),
                EncodedAction::Function { function_id } => action_for_function(function_id),
                EncodedAction::Disabled => continue,
            };
            assert_eq!(read, Some(action), "{}", action.as_str());
        }
    }

    #[test]
    fn codes_the_app_has_no_action_for_read_as_none() {
        assert_eq!(action_for_key(MOUSE_KEY_TYPE_MKEY, 9), None);
        assert_eq!(action_for_key(0x02, 1), None);
        assert_eq!(action_for_function(FUNCTION_SHOW_POWER), None);
    }
}
