//! A configuração de um mouse como a casca a edita e o núcleo a aplica.
//!
//! Estes tipos são os donos de `MouseSettings` e de suas partes: o TypeScript
//! em `packages/shared/src/generated/` é gerado deles. `buttons` guarda a
//! ordem de inserção porque é a ordem em que os mapeamentos são enviados.

use indexmap::IndexMap;
use serde::{Deserialize, Serialize};

use super::MouseActionId;

/// Um estágio de DPI, com os dois eixos.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS))]
pub struct DpiStage {
    pub id: String,
    pub x: u32,
    pub y: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS))]
pub struct MouseParameters {
    pub motion_sync: bool,
    pub angle_snapping: bool,
    pub ripple_control: bool,
    pub wireless_turbo: bool,
    pub lift_off_distance: u32,
    pub sensor_rotation: i32,
    pub debounce: u32,
    pub sleep_timeout: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS))]
pub struct MouseRPlusSettings {
    pub activator_button_id: String,
    pub buttons: IndexMap<String, MouseActionId>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS))]
pub struct MouseSettings {
    /// Button id to assigned action.
    pub buttons: IndexMap<String, MouseActionId>,
    pub dpi_stages: Vec<DpiStage>,
    pub active_stage_id: String,
    pub independent_axes: bool,
    pub polling_rate: u32,
    /// Null for models without selectable sensor power modes.
    pub performance_mode: Option<String>,
    pub parameters: MouseParameters,
    /// Null for models without an R-Plus secondary layer.
    pub r_plus: Option<MouseRPlusSettings>,
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A casca manda o objeto como o editor o guarda; a ordem dos botões é a
    /// ordem de envio e não pode ser reordenada na travessia.
    #[test]
    fn round_trips_the_editor_shape_keeping_button_order() {
        let json = serde_json::json!({
            "buttons": { "dpi": "dpi-ciclo", "esquerdo": "clique-esquerdo" },
            "dpiStages": [{ "id": "estagio-1", "x": 400, "y": 800 }],
            "activeStageId": "estagio-1",
            "independentAxes": true,
            "pollingRate": 1000,
            "performanceMode": null,
            "parameters": {
                "motionSync": true, "angleSnapping": false, "rippleControl": false,
                "wirelessTurbo": true, "liftOffDistance": 2, "sensorRotation": -10,
                "debounce": 0, "sleepTimeout": 1
            },
            "rPlus": null
        });
        let settings: MouseSettings = serde_json::from_value(json.clone()).unwrap();
        assert_eq!(
            settings.buttons.keys().collect::<Vec<_>>(),
            ["dpi", "esquerdo"]
        );
        assert_eq!(settings.parameters.sensor_rotation, -10);
        assert_eq!(serde_json::to_value(&settings).unwrap(), json);
    }
}
