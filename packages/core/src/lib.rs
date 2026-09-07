pub mod command;
pub mod device;
pub mod drivers;
pub mod protocols;

const CMD_CONFIG: u8 = 0x03;
const CMD_ACTION: u8 = 0x06;
const CONFIG_TYPE_RESET: u8 = 0x03;
const CONFIG_TYPE_MOUSE_PARAM: u8 = 0x15;
const CONFIG_TYPE_MOUSE_KEY: u8 = 0x16;
const CONFIG_TYPE_MOUSE_FUNCTION: u8 = 0x18;

fn config_event(config_type: u8, payload: &[u8]) -> Vec<u8> {
    let mut event = Vec::with_capacity(3 + payload.len());
    event.extend_from_slice(&[CMD_CONFIG, 0, config_type]);
    event.extend_from_slice(payload);
    event
}

fn append_u16_le(bytes: &mut Vec<u8>, value: u16) {
    bytes.extend_from_slice(&value.to_le_bytes());
}

/// Encodes the complete payload returned by a RAWM mouse-parameter query.
///
/// The core deliberately treats the snapshot as opaque bytes. This keeps
/// fields introduced by newer firmware intact when a snapshot is read and
/// written by an older app.
pub fn encode_mouse_param_snapshot(snapshot: &[u8]) -> Vec<u8> {
    config_event(CONFIG_TYPE_MOUSE_PARAM, snapshot)
}

/// Encodes a RAWM action event without length framing or CRC.
pub fn encode_action(action: u8, value: u32) -> Vec<u8> {
    let mut event = Vec::with_capacity(7);
    event.extend_from_slice(&[CMD_ACTION, 0, action]);
    event.extend_from_slice(&value.to_le_bytes());
    event
}

/// Encodes a RAWM configuration reset without length framing or CRC.
pub fn encode_config_reset() -> Vec<u8> {
    config_event(CONFIG_TYPE_RESET, &[])
}

/// Encodes a RAWM mouse-key mapping without length framing or CRC.
pub fn encode_mouse_key(
    key_ids: &[u8],
    modifier_one: u8,
    modifier_two: u8,
    key_type: u8,
    key_code: u8,
) -> Vec<u8> {
    let mut payload = Vec::with_capacity(7 + key_ids.len());
    payload.push(key_ids.len() as u8);
    payload.extend_from_slice(key_ids);
    payload.extend_from_slice(&[modifier_one, key_type, key_code, modifier_two, 0]);
    config_event(CONFIG_TYPE_MOUSE_KEY, &payload)
}

/// Encodes a RAWM mouse-function mapping without length framing or CRC.
pub fn encode_mouse_function(
    key_ids: &[u8],
    touch_type: u8,
    function_id: u8,
    value: u16,
    text: &[u8],
) -> Vec<u8> {
    let mut payload = Vec::with_capacity(10 + key_ids.len() + text.len());
    payload.push(key_ids.len() as u8);
    payload.extend_from_slice(key_ids);
    payload.extend_from_slice(&[touch_type, function_id]);
    append_u16_le(&mut payload, value);
    payload.push(0);
    append_u16_le(&mut payload, text.len() as u16);
    payload.extend_from_slice(text);
    config_event(CONFIG_TYPE_MOUSE_FUNCTION, &payload)
}

pub fn core_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

pub fn is_wasm_available() -> bool {
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encodes_a_complete_mouse_param_snapshot_unchanged() {
        assert_eq!(
            encode_mouse_param_snapshot(&[0x10, 0x20, 0x30, 0xfe, 0xed]),
            vec![0x03, 0x00, 0x15, 0x10, 0x20, 0x30, 0xfe, 0xed]
        );
    }

    #[test]
    fn encodes_action_as_little_endian_u32() {
        assert_eq!(
            encode_action(0x34, 0x01020304),
            vec![0x06, 0x00, 0x34, 0x04, 0x03, 0x02, 0x01]
        );
    }

    #[test]
    fn encodes_config_reset_without_transport_framing() {
        assert_eq!(encode_config_reset(), vec![0x03, 0x00, 0x03]);
    }

    #[test]
    fn encodes_mouse_key_in_rawm_field_order() {
        assert_eq!(
            encode_mouse_key(&[0x12, 0x34], 0x56, 0x78, 0x01, 0x9a),
            vec![
                0x03, 0x00, 0x16, 0x02, 0x12, 0x34, 0x56, 0x01, 0x9a, 0x78, 0x00
            ]
        );
    }

    #[test]
    fn encodes_mouse_function_with_little_endian_value_and_text() {
        assert_eq!(
            encode_mouse_function(&[0xaa], 0x02, 0x10, 0x1234, b"F"),
            vec![
                0x03, 0x00, 0x18, 0x01, 0xaa, 0x02, 0x10, 0x34, 0x12, 0x00, 0x01, 0x00, 0x46
            ]
        );
    }
}
