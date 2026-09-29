//! O que a consulta diz sobre este Leviathan V4, e o que o modelo suporta.
//!
//! A casca compõe isto com o desenho (foto, posições, rótulos) para montar o
//! periférico. Tudo aqui é fato do aparelho: muda se o firmware mudar, não se
//! a casca mudar.

use indexmap::IndexMap;
use serde::Serialize;
use serde_json::Value;

use super::apply::PERFORMANCE_MODES;
use super::keys::button_ids;
use super::lod::{NumericRange, lod_range};
use crate::device::{DpiStage, MouseActionId, MouseParameters, MouseRPlusSettings, MouseSettings};
use crate::protocols::rawm::json::{integer, number};
use crate::protocols::rawm::{RawmError, dpi_axes};

/// Faixa do sensor, não do menor e maior estágio salvos. A RAWM especifica
/// 100–45000 para este modelo (rawmshop.com/products/leviathan-v4).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS))]
pub struct DpiLimits {
    pub min: u32,
    pub max: u32,
    pub step: u32,
    pub min_stages: u32,
    pub max_stages: u32,
    pub independent_axes: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
pub struct DpiAxes {
    pub x: u32,
    pub y: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS))]
pub struct LeviathanV4Description {
    pub name: String,
    pub firmware: Option<String>,
    pub battery: Option<f64>,
    pub dpi: DpiLimits,
    pub polling_rates: Vec<u32>,
    /// Ids dos modos de desempenho, na ordem do valor `pm`.
    pub performance_modes: Vec<String>,
    pub lift_off_distance: NumericRange,
    pub sensor_rotation: NumericRange,
    pub r_plus_activator_button_ids: Vec<String>,
    pub actions: Vec<MouseActionId>,
    pub profile_slots: u32,
    pub active_profile_slot: u32,
    pub live_dpi: DpiAxes,
    /// A configuração que o mouse tinha no momento da consulta.
    pub defaults: MouseSettings,
}

const DPI: DpiLimits = DpiLimits {
    min: 100,
    max: 45_000,
    step: 50,
    min_stages: 1,
    max_stages: 8,
    independent_axes: false,
};
const POLLING_RATES: [u32; 7] = [125, 250, 500, 1000, 2000, 4000, 8000];
const SENSOR_ROTATION: NumericRange = NumericRange {
    min: -30,
    max: 30,
    step: 1,
};
const R_PLUS_ACTIVATORS: [&str; 3] = ["lateral-traseiro", "lateral-dianteiro", "dpi"];
const R_PLUS_DEFAULT_ACTIVATOR: &str = "lateral-dianteiro";
/// O mapeamento de fábrica, na ordem em que os botões são enviados.
const FACTORY_BUTTONS: [(&str, MouseActionId); 6] = [
    ("esquerdo", MouseActionId::CliqueEsquerdo),
    ("direito", MouseActionId::CliqueDireito),
    ("central", MouseActionId::CliqueCentral),
    ("lateral-traseiro", MouseActionId::Voltar),
    ("lateral-dianteiro", MouseActionId::Avancar),
    ("dpi", MouseActionId::DpiCiclo),
];
const MAX_ONBOARD_SLOTS: u32 = 16;
const DEFAULT_NAME: &str = "Leviathan V4";
const WIRELESS_TURBO_ON: f64 = 8.0;

fn incomplete(field: &'static str) -> RawmError {
    RawmError::IncompleteQuery { field }
}

fn finite(raw: &Value, field: &'static str) -> Result<f64, RawmError> {
    raw.get(field).and_then(number).ok_or(incomplete(field))
}

fn numbers(raw: &Value, field: &'static str) -> Result<Vec<f64>, RawmError> {
    let items = raw
        .get(field)
        .and_then(Value::as_array)
        .ok_or(incomplete(field))?;
    let values: Option<Vec<f64>> = items.iter().map(number).collect();
    values
        .filter(|values| !values.is_empty())
        .ok_or(incomplete(field))
}

fn is_one(raw: &Value, field: &str) -> bool {
    raw.get(field).and_then(number) == Some(1.0)
}

/// `String(x)` do JS para um número: inteiros sem `.0`.
fn js_number_text(value: f64) -> String {
    if value.fract() == 0.0 && value.abs() < 1e21 {
        format!("{}", value as i64)
    } else {
        format!("{value}")
    }
}

/// Memórias onboard: `ocs` traz um byte de estado por memória e `ocn` diz
/// quantas. Os dois concordaram na firmware capturada; se discordarem, uma
/// memória só, em vez de dimensionar a tela num palpite. `st` já foi lido como
/// este array; na firmware real é o escalar 60.
pub fn onboard_slot_count(raw: &Value) -> u32 {
    let Some(statuses) = raw
        .get("ocs")
        .and_then(Value::as_array)
        .filter(|s| !s.is_empty())
    else {
        return 1;
    };
    let count = statuses.len() as u32;
    if let Some(declared) = raw.get("ocn").and_then(number)
        && declared != f64::from(count)
    {
        return 1;
    }
    count.min(MAX_ONBOARD_SLOTS)
}

fn performance_mode(raw_mode: f64) -> &'static str {
    let index = integer(&Value::from(raw_mode)).filter(|index| (0..4).contains(index));
    index.map_or(PERFORMANCE_MODES[0], |index| {
        PERFORMANCE_MODES[index as usize]
    })
}

fn axes(value: f64) -> DpiAxes {
    let (x, y) = dpi_axes(value as u32);
    DpiAxes {
        x: u32::from(x),
        y: u32::from(y),
    }
}

/// Lê a consulta. Os campos exigidos são validados na ordem abaixo, e o
/// primeiro que falhar é o que o erro nomeia.
pub fn describe(raw: &Value) -> Result<LeviathanV4Description, RawmError> {
    let name = raw
        .get("dn")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|name| !name.is_empty())
        .unwrap_or(DEFAULT_NAME)
        .to_owned();
    // Os estágios sem uso chegam como zeros num array de largura fixa; a tela
    // só mostra os preenchidos.
    let levels: Vec<f64> = numbers(raw, "cpi_l")?
        .into_iter()
        .filter(|&level| level > 0.0)
        .collect();
    let active_dpi = finite(raw, "cpi")?;
    let polling_rate = finite(raw, "polling")?;
    // `oci` é a memória em uso. `ob` vem no bloco de parâmetros e não é esse
    // seletor, embora os dois leiam 0 num mouse que nunca saiu da primeira.
    let onboard_index = match raw.get("oci").and_then(number) {
        Some(index) => index,
        None => finite(raw, "ob")?,
    };
    let raw_mode = finite(raw, "pm")?;
    let lod = finite(raw, "lod")?;
    let angle = finite(raw, "at")?;
    for field in ["ms", "as", "rctrl", "top"] {
        finite(raw, field)?;
    }

    let active_index = levels
        .iter()
        .position(|&level| level == active_dpi)
        .unwrap_or(0);
    let profile_slots = onboard_slot_count(raw);
    let active_profile_slot = (onboard_index + 1.0).max(1.0).min(f64::from(profile_slots)) as u32;

    let defaults = MouseSettings {
        buttons: FACTORY_BUTTONS
            .iter()
            .map(|&(id, action)| (id.to_owned(), action))
            .collect(),
        dpi_stages: levels
            .iter()
            .enumerate()
            .map(|(index, &level)| {
                let DpiAxes { x, y } = axes(level);
                DpiStage {
                    id: format!("estagio-{}", index + 1),
                    x,
                    y,
                }
            })
            .collect(),
        active_stage_id: format!("estagio-{}", active_index + 1),
        independent_axes: false,
        polling_rate: polling_rate as u32,
        performance_mode: Some(performance_mode(raw_mode).to_owned()),
        parameters: MouseParameters {
            motion_sync: is_one(raw, "ms"),
            angle_snapping: is_one(raw, "as"),
            ripple_control: is_one(raw, "rctrl"),
            wireless_turbo: raw.get("top").and_then(number) == Some(WIRELESS_TURBO_ON),
            lift_off_distance: lod as u32,
            sensor_rotation: angle as i32,
            debounce: 0,
            sleep_timeout: 1,
        },
        r_plus: Some(MouseRPlusSettings {
            activator_button_id: R_PLUS_DEFAULT_ACTIVATOR.to_owned(),
            buttons: button_ids()
                .map(|id| (id.to_owned(), MouseActionId::Desativado))
                .collect::<IndexMap<_, _>>(),
        }),
    };

    Ok(LeviathanV4Description {
        name,
        firmware: raw.get("r").and_then(|value| match value {
            Value::String(text) => Some(text.clone()),
            Value::Number(_) => number(value).map(js_number_text),
            _ => None,
        }),
        battery: raw
            .get("battery")
            .and_then(number)
            .filter(|level| (0.0..=100.0).contains(level)),
        dpi: DPI,
        polling_rates: POLLING_RATES.to_vec(),
        performance_modes: PERFORMANCE_MODES
            .iter()
            .map(|&mode| mode.to_owned())
            .collect(),
        lift_off_distance: lod_range(),
        sensor_rotation: SENSOR_ROTATION,
        r_plus_activator_button_ids: R_PLUS_ACTIVATORS.iter().map(|&id| id.to_owned()).collect(),
        actions: MouseActionId::ALL.to_vec(),
        profile_slots,
        active_profile_slot,
        live_dpi: axes(active_dpi),
        defaults,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn capture() -> Value {
        let vectors: Value =
            serde_json::from_str(include_str!("../../../vectors/rawm-protocol.json")).unwrap();
        vectors["queries"]["leviathan-v4-captura"].clone()
    }

    #[test]
    fn reads_the_model_firmware_and_battery_the_firmware_reports() {
        let description = describe(&capture()).unwrap();
        assert_eq!(description.name, "LEVIATHAN V4");
        assert_eq!(description.firmware.as_deref(), Some("G-1.2.3"));
        assert_eq!(description.battery, Some(31.0));
    }

    #[test]
    fn reflects_the_state_the_mouse_was_in() {
        let defaults = describe(&capture()).unwrap().defaults;
        assert_eq!(defaults.polling_rate, 4000);
        assert_eq!(defaults.performance_mode.as_deref(), Some("gaming-plus"));
        assert!(defaults.parameters.wireless_turbo);
        assert!(defaults.parameters.motion_sync);
        assert_eq!(defaults.active_stage_id, "estagio-2");
    }

    #[test]
    fn drops_the_zero_padding_from_the_stages() {
        let stages = describe(&capture()).unwrap().defaults.dpi_stages;
        assert_eq!(
            stages.iter().map(|stage| stage.x).collect::<Vec<_>>(),
            [400, 800, 1600, 3200]
        );
    }

    #[test]
    fn sizes_the_onboard_memories_from_ocs_and_ocn() {
        assert_eq!(describe(&capture()).unwrap().profile_slots, 4);
        assert_eq!(
            onboard_slot_count(&json!({ "ocs": [1, 2, 3, 4], "ocn": 3 })),
            1
        );
        assert_eq!(onboard_slot_count(&json!({ "ocs": [1, 2] })), 2);
        assert_eq!(onboard_slot_count(&json!({ "st": 60 })), 1);
        assert_eq!(onboard_slot_count(&json!({ "ocs": vec![0; 20] })), 16);
    }

    #[test]
    fn uses_the_sensor_range_not_the_saved_stages() {
        let mut raw = capture();
        raw["cpi_l"] = json!([400, 800, 0, 0, 0, 0, 0, 0]);
        let dpi = describe(&raw).unwrap().dpi;
        assert_eq!((dpi.min, dpi.max), (100, 45_000));
    }

    #[test]
    fn falls_back_to_the_model_name_and_the_first_memory() {
        let mut raw = capture();
        raw["dn"] = json!("   ");
        raw.as_object_mut().unwrap().remove("oci");
        let description = describe(&raw).unwrap();
        assert_eq!(description.name, "Leviathan V4");
        assert_eq!(description.active_profile_slot, 1);
    }

    #[test]
    fn names_the_first_missing_field_in_order() {
        assert_eq!(
            describe(&json!({ "dn": "L" })),
            Err(RawmError::IncompleteQuery { field: "cpi_l" })
        );
        let mut raw = capture();
        raw.as_object_mut().unwrap().remove("top");
        assert_eq!(
            describe(&raw),
            Err(RawmError::IncompleteQuery { field: "top" })
        );
        raw["cpi_l"] = json!([]);
        assert_eq!(
            describe(&raw),
            Err(RawmError::IncompleteQuery { field: "cpi_l" })
        );
    }

    #[test]
    fn an_unknown_mode_reads_as_office() {
        let mut raw = capture();
        raw["pm"] = json!(9);
        assert_eq!(
            describe(&raw).unwrap().defaults.performance_mode.as_deref(),
            Some("office")
        );
    }

    #[test]
    fn the_r_plus_layer_starts_disabled_on_every_button() {
        let r_plus = describe(&capture()).unwrap().defaults.r_plus.unwrap();
        assert_eq!(r_plus.activator_button_id, "lateral-dianteiro");
        assert_eq!(r_plus.buttons.len(), 6);
        assert!(
            r_plus
                .buttons
                .values()
                .all(|&action| action == MouseActionId::Desativado)
        );
    }

    #[test]
    fn a_numeric_firmware_prints_like_javascript() {
        assert_eq!(js_number_text(3.0), "3");
        assert_eq!(js_number_text(1.5), "1.5");
    }
}
