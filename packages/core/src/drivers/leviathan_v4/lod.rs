//! Distância de levantamento (LOD).
//!
//! O aparelho guarda um índice, não uma distância: relata `lod: 2` para um
//! mouse a 1,0 mm. Os milímetros foram confirmados no software oficial. Os
//! nomes dos níveis (Baixo, Médio, Alto) são texto de tela e ficam na casca.

use serde::Serialize;

/// Uma faixa inteira que um controle da casca deve respeitar.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
pub struct NumericRange {
    pub min: i32,
    pub max: i32,
    pub step: i32,
}

/// `raw` como o snapshot guarda, e a distância que ele significa.
const LEVELS: [(u32, f64); 3] = [(1, 0.7), (2, 1.0), (3, 2.0)];

pub fn lod_millimetres(raw: u32) -> Option<f64> {
    LEVELS
        .iter()
        .find(|&&(level, _)| level == raw)
        .map(|&(_, millimetres)| millimetres)
}

pub fn lod_range() -> NumericRange {
    NumericRange {
        min: LEVELS[0].0 as i32,
        max: LEVELS[LEVELS.len() - 1].0 as i32,
        step: 1,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn each_level_has_the_distance_the_official_software_shows() {
        assert_eq!(lod_millimetres(1), Some(0.7));
        assert_eq!(lod_millimetres(2), Some(1.0));
        assert_eq!(lod_millimetres(3), Some(2.0));
        assert_eq!(lod_millimetres(9), None);
    }

    #[test]
    fn the_range_spans_exactly_the_known_levels() {
        assert_eq!(
            lod_range(),
            NumericRange {
                min: 1,
                max: 3,
                step: 1
            }
        );
    }
}
