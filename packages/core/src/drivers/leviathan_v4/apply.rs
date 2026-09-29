//! A configuração do editor aplicada sobre o bloco que o mouse relatou.
//!
//! Só os campos que o editor controla mudam; o resto do bloco volta como o
//! mouse o mandou, inclusive o que esta versão do app não entende.

use crate::device::MouseSettings;
use crate::protocols::rawm::{MouseParamSnapshot, RawmError, pack_dpi};

/// Os modos de desempenho, na ordem do valor `pm` que o firmware usa.
pub(super) const PERFORMANCE_MODES: [&str; 4] = ["office", "lp", "hp", "gaming-plus"];

/// O valor de `top` quando o turbo sem fio está ligado.
pub(super) const WIRELESS_TURBO_ON: u32 = 0x08;

/// Devolve a largura que o aparelho relatou. `cpi_l` tem largura fixa com os
/// estágios sem uso zerados, e o editor só carrega os preenchidos: escrever só
/// eles estreitaria o array sob o firmware e o deixaria incoerente com o
/// `cpi_l_c` de mesma largura.
fn pad_to_width(mut values: Vec<u32>, width: usize) -> Vec<u32> {
    if values.len() < width {
        values.resize(width, 0);
    }
    values
}

pub fn apply_settings(
    snapshot: &MouseParamSnapshot,
    settings: &MouseSettings,
) -> Result<MouseParamSnapshot, RawmError> {
    let mode = settings
        .performance_mode
        .as_deref()
        .and_then(|id| PERFORMANCE_MODES.iter().position(|&mode| mode == id))
        .ok_or(RawmError::InvalidPerformanceMode)?;
    let active = settings
        .dpi_stages
        .iter()
        .find(|stage| stage.id == settings.active_stage_id)
        .filter(|_| !settings.dpi_stages.is_empty() && settings.dpi_stages.len() <= 255)
        .ok_or(RawmError::InvalidDpiStages)?;
    let independent = settings.independent_axes;
    let parameters = &settings.parameters;

    Ok(MouseParamSnapshot {
        resolution: pack_dpi(active.x, active.y, independent),
        polling_rate: settings.polling_rate,
        cpi_levels: pad_to_width(
            settings
                .dpi_stages
                .iter()
                .map(|stage| pack_dpi(stage.x, stage.y, independent))
                .collect(),
            snapshot.cpi_levels.len(),
        ),
        power_mode: mode as u32,
        lift_off_distance: parameters.lift_off_distance,
        motion_sync: u32::from(parameters.motion_sync),
        angle_tuning: parameters.sensor_rotation,
        angle_snapping: u32::from(parameters.angle_snapping),
        ripple_control: u32::from(parameters.ripple_control),
        tx_output_power: if parameters.wireless_turbo {
            WIRELESS_TURBO_ON
        } else {
            0
        },
        ..snapshot.clone()
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocols::rawm::parse_mouse_param_snapshot;
    use serde_json::json;

    fn snapshot() -> MouseParamSnapshot {
        parse_mouse_param_snapshot(&json!({
            "cpi": 800, "polling": 4000, "light": 48, "cpi_l": [400, 800, 1600, 3200, 0, 0, 0, 0],
            "cpi_l_c": [1, 2, 6, 4, 0, 0, 0, 0], "ob": 0, "pm": 3, "lod": 2,
            "kd": [0, 0, 0, 0, 0, 0, 0], "ms": 1, "at": 0, "as": 0, "rctrl": 0, "top": 8,
            "co": "", "atp": 1, "ocs": [129, 130, 134, 132], "gm": [0, 0]
        }))
        .unwrap()
    }

    fn settings() -> MouseSettings {
        serde_json::from_value(json!({
            "buttons": {}, "dpiStages": [
                { "id": "estagio-1", "x": 400, "y": 400 }, { "id": "estagio-2", "x": 800, "y": 800 }
            ],
            "activeStageId": "estagio-2", "independentAxes": false, "pollingRate": 1000,
            "performanceMode": "lp",
            "parameters": {
                "motionSync": false, "angleSnapping": true, "rippleControl": true,
                "wirelessTurbo": false, "liftOffDistance": 3, "sensorRotation": -10,
                "debounce": 0, "sleepTimeout": 1
            },
            "rPlus": null
        }))
        .unwrap()
    }

    #[test]
    fn changes_only_the_fields_the_editor_controls() {
        let before = snapshot();
        let next = apply_settings(&before, &settings()).unwrap();
        assert_eq!(next.polling_rate, 1000);
        assert_eq!(next.power_mode, 1);
        assert_eq!(next.tx_output_power, 0);
        assert_eq!(next.angle_tuning, -10);
        assert_eq!(next.key_delay, before.key_delay);
        assert_eq!(next.onboard_status, before.onboard_status);
        assert_eq!(next.cpi_level_colors, before.cpi_level_colors);
    }

    #[test]
    fn pads_the_stages_back_to_the_width_the_mouse_reported() {
        let next = apply_settings(&snapshot(), &settings()).unwrap();
        assert_eq!(next.cpi_levels, [400, 800, 0, 0, 0, 0, 0, 0]);
    }

    #[test]
    fn rejects_an_unknown_or_missing_performance_mode() {
        let mut unknown = settings();
        unknown.performance_mode = Some("turbo".into());
        assert_eq!(
            apply_settings(&snapshot(), &unknown),
            Err(RawmError::InvalidPerformanceMode)
        );
        let mut missing = settings();
        missing.performance_mode = None;
        assert_eq!(
            apply_settings(&snapshot(), &missing),
            Err(RawmError::InvalidPerformanceMode)
        );
    }

    #[test]
    fn rejects_an_active_stage_that_is_not_among_the_stages() {
        let mut orphan = settings();
        orphan.active_stage_id = "estagio-9".into();
        assert_eq!(
            apply_settings(&snapshot(), &orphan),
            Err(RawmError::InvalidDpiStages)
        );
    }
}
