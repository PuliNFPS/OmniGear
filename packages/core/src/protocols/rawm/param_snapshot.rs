//! O bloco de parâmetros do mouse: lido do JSON de consulta, escrito em binário.
//!
//! O layout é do protocolo RAWM (`CONFIG_TYPE_MOUSE_PARAM`), não de um
//! aparelho. A leitura é estrita de propósito: um campo que falta não é
//! preenchido com um padrão, porque reescrever o bloco com um valor inventado
//! apagaria o que o mouse tinha.

use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::error::RawmError;
use super::json::integer;

/// O bloco como o firmware o descreve. Os nomes em TS são os que as sondas
/// comparam campo a campo.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(rename = "RawmMouseParamState"))]
pub struct MouseParamSnapshot {
    pub resolution: u32,
    pub polling_rate: u32,
    pub light: u32,
    pub cpi_levels: Vec<u32>,
    pub onboard: u32,
    pub power_mode: u32,
    pub lift_off_distance: u32,
    pub key_delay: Vec<u32>,
    pub motion_sync: u32,
    pub angle_tuning: i32,
    pub angle_snapping: u32,
    pub ripple_control: u32,
    pub cpi_level_colors: Vec<u32>,
    pub tx_output_power: u32,
    pub battery_levels: Vec<u32>,
    pub auto_tx_power: u32,
    pub onboard_status: Vec<u32>,
    pub glass_mode: u32,
}

fn invalid(field: &'static str) -> RawmError {
    RawmError::InvalidSnapshotField { field }
}

fn scalar(raw: &Value, field: &'static str, min: i64, max: i64) -> Result<i64, RawmError> {
    raw.get(field)
        .and_then(integer)
        .filter(|value| (min..=max).contains(value))
        .ok_or(invalid(field))
}

/// `allow_empty`: o firmware manda `""` em vez de `[]` para uma tabela de
/// calibração vazia.
fn list(
    raw: &Value,
    field: &'static str,
    min: i64,
    max: i64,
    allow_empty: bool,
) -> Result<Vec<u32>, RawmError> {
    let value = raw.get(field).ok_or(invalid(field))?;
    if allow_empty && value.as_str() == Some("") {
        return Ok(Vec::new());
    }
    let items = value.as_array().ok_or(invalid(field))?;
    if (!allow_empty && items.is_empty()) || items.len() > 255 {
        return Err(invalid(field));
    }
    items
        .iter()
        .map(|item| {
            integer(item)
                .filter(|value| (min..=max).contains(value))
                .map(|value| value as u32)
                .ok_or(invalid(field))
        })
        .collect()
}

/// `gm` chega como `[x, ligado]` nesta firmware, ou como escalar 0/1.
fn glass_mode(raw: &Value) -> Result<u32, RawmError> {
    if let Some(items) = raw.get("gm").and_then(Value::as_array) {
        let values: Option<Vec<i64>> = items.iter().map(integer).collect();
        return match values {
            Some(values) if values.len() >= 2 => Ok(u32::from(values[1] != 0)),
            _ => Err(invalid("gm")),
        };
    }
    scalar(raw, "gm", 0, 1).map(|value| value as u32)
}

/// Lê o bloco da resposta de consulta. Os campos são validados na ordem abaixo,
/// e o primeiro que falhar é o que o erro nomeia.
pub fn parse_mouse_param_snapshot(raw: &Value) -> Result<MouseParamSnapshot, RawmError> {
    Ok(MouseParamSnapshot {
        resolution: scalar(raw, "cpi", 1, 0xffff_ffff)? as u32,
        polling_rate: scalar(raw, "polling", 1, 0xffff)? as u32,
        light: scalar(raw, "light", 0, 0xff)? as u32,
        // Os estágios sem uso chegam como zeros; o array tem largura fixa.
        cpi_levels: list(raw, "cpi_l", 0, 0xffff_ffff, false)?,
        onboard: scalar(raw, "ob", 0, 0xff)? as u32,
        power_mode: scalar(raw, "pm", 0, 0xff)? as u32,
        lift_off_distance: scalar(raw, "lod", 0, 0xff)? as u32,
        key_delay: list(raw, "kd", 0, 0xff, false)?,
        motion_sync: scalar(raw, "ms", 0, 1)? as u32,
        angle_tuning: scalar(raw, "at", -128, 127)? as i32,
        angle_snapping: scalar(raw, "as", 0, 1)? as u32,
        ripple_control: scalar(raw, "rctrl", 0, 1)? as u32,
        cpi_level_colors: list(raw, "cpi_l_c", 0, 7, true)?,
        tx_output_power: scalar(raw, "top", 0, 0xff)? as u32,
        battery_levels: list(raw, "co", 0, 0xffff, true)?,
        auto_tx_power: scalar(raw, "atp", 0, 1)? as u32,
        onboard_status: list(raw, "ocs", 0, 0xff, false)?,
        glass_mode: glass_mode(raw)?,
    })
}

fn push_u16(output: &mut Vec<u8>, value: u32) {
    output.extend_from_slice(&[value as u8, (value >> 8) as u8]);
}

fn push_u32(output: &mut Vec<u8>, value: u32) {
    output.extend_from_slice(&value.to_le_bytes());
}

/// Um valor acima de 16 bits só cabe como CPI2, com os eixos empacotados.
fn is_packed_axes(value: u32) -> bool {
    value > 0xffff
}

/// O corpo binário do bloco. Com eixos independentes, a resolução e os
/// estágios vão nos campos de 32 bits e os de 16 bits ficam zerados.
pub fn encode_mouse_param_body(state: &MouseParamSnapshot) -> Vec<u8> {
    let independent =
        is_packed_axes(state.resolution) || state.cpi_levels.iter().copied().any(is_packed_axes);
    let mut output = Vec::with_capacity(64);

    push_u16(&mut output, if independent { 0 } else { state.resolution });
    push_u16(&mut output, state.polling_rate);
    output.push(state.light as u8);
    output.push(if independent {
        0
    } else {
        state.cpi_levels.len() as u8
    });
    if !independent {
        for &level in &state.cpi_levels {
            push_u16(&mut output, level);
        }
    }
    output.extend_from_slice(&[state.onboard as u8, state.power_mode as u8]);
    push_u32(&mut output, if independent { state.resolution } else { 0 });
    output.push(if independent {
        state.cpi_levels.len() as u8
    } else {
        0
    });
    if independent {
        for &level in &state.cpi_levels {
            push_u32(&mut output, level);
        }
    }
    output.extend_from_slice(&[state.lift_off_distance as u8, state.key_delay.len() as u8]);
    output.extend(state.key_delay.iter().map(|&delay| delay as u8));
    output.extend_from_slice(&[
        state.motion_sync as u8,
        (state.angle_tuning & 0xff) as u8,
        state.angle_snapping as u8,
        state.ripple_control as u8,
        state.cpi_level_colors.len() as u8,
    ]);
    output.extend(
        state
            .cpi_level_colors
            .iter()
            .map(|&color| (color & 0x07) as u8),
    );
    output.extend_from_slice(&[
        state.tx_output_power as u8,
        state.battery_levels.len() as u8,
    ]);
    for &level in &state.battery_levels {
        push_u16(&mut output, level);
    }
    output.extend_from_slice(&[state.auto_tx_power as u8, state.onboard_status.len() as u8]);
    output.extend(state.onboard_status.iter().map(|&status| status as u8));
    output.push(state.glass_mode as u8);
    output
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn synthetic() -> Value {
        json!({
            "dn": "Leviathan V4", "cpi": 1600, "polling": 1000, "light": 48,
            "cpi_l": [400, 800, 1600, 3200], "cpi_l_c": [1, 2, 3, 4], "ob": 2, "pm": 1, "lod": 2,
            "kd": [8, 8, 8, 8, 8, 8, 8], "ms": 1, "at": 0, "as": 1, "rctrl": 1, "top": 8,
            "co": [100, 90], "atp": 1, "ocs": [128, 129, 130, 131], "gm": [0, 0]
        })
    }

    #[test]
    fn recreates_the_confirmed_complete_body() {
        let body = encode_mouse_param_body(&parse_mouse_param_snapshot(&synthetic()).unwrap());
        assert_eq!(body.len(), 52);
        assert_eq!(&body[..4], &[0x40, 0x06, 0xe8, 0x03]);
    }

    #[test]
    fn rejects_a_missing_field_instead_of_filling_a_default() {
        let mut raw = synthetic();
        raw.as_object_mut().unwrap().remove("kd");
        assert_eq!(
            parse_mouse_param_snapshot(&raw),
            Err(RawmError::InvalidSnapshotField { field: "kd" })
        );
    }

    #[test]
    fn accepts_an_empty_string_for_the_calibration_tables() {
        let mut raw = synthetic();
        raw["co"] = json!("");
        raw["cpi_l_c"] = json!("");
        let state = parse_mouse_param_snapshot(&raw).unwrap();
        assert!(state.battery_levels.is_empty());
        assert!(state.cpi_level_colors.is_empty());
    }

    #[test]
    fn reads_the_glass_mode_from_the_second_slot_or_a_scalar() {
        let mut raw = synthetic();
        raw["gm"] = json!([0, 5]);
        assert_eq!(parse_mouse_param_snapshot(&raw).unwrap().glass_mode, 1);
        raw["gm"] = json!(1);
        assert_eq!(parse_mouse_param_snapshot(&raw).unwrap().glass_mode, 1);
    }

    #[test]
    fn accepts_whole_floats_the_bridge_may_deliver() {
        let mut raw = synthetic();
        raw["cpi"] = json!(1600.0);
        assert_eq!(parse_mouse_param_snapshot(&raw).unwrap().resolution, 1600);
    }

    #[test]
    fn packed_axes_move_resolution_and_stages_to_the_32_bit_fields() {
        let mut state = parse_mouse_param_snapshot(&synthetic()).unwrap();
        state.resolution = 0x0320_0190;
        let body = encode_mouse_param_body(&state);
        assert_eq!(&body[..2], &[0, 0], "campo de 16 bits zerado");
    }
}
