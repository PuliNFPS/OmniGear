//! Leitura numérica do JSON de consulta.
//!
//! O mesmo número chega de formas diferentes conforme o caminho: `800` lido
//! pelo `serde_json` é inteiro, mas vindo de um objeto JS pela ponte pode ser
//! `800.0`. Estes helpers aceitam os dois e reproduzem o que a casca fazia com
//! `Number.isInteger` e `typeof === 'number'`.

use serde_json::Value;

/// O maior inteiro que um `number` do JS representa sem perda.
const MAX_SAFE_INTEGER: f64 = 9_007_199_254_740_991.0;

/// `Some` quando o valor é um número inteiro, como `Number.isInteger`.
pub(crate) fn integer(value: &Value) -> Option<i64> {
    let number = value.as_number()?;
    if let Some(integer) = number.as_i64() {
        return Some(integer);
    }
    if let Some(unsigned) = number.as_u64() {
        return i64::try_from(unsigned).ok();
    }
    let float = number.as_f64()?;
    (float.fract() == 0.0 && float.abs() <= MAX_SAFE_INTEGER).then_some(float as i64)
}

/// `Some` quando o valor é um número finito, como `typeof === 'number'`.
pub(crate) fn number(value: &Value) -> Option<f64> {
    value.as_f64()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn integers_arrive_as_integers_or_as_whole_floats() {
        assert_eq!(integer(&json!(800)), Some(800));
        assert_eq!(integer(&json!(800.0)), Some(800));
        assert_eq!(integer(&json!(-3)), Some(-3));
        assert_eq!(integer(&json!(800.5)), None);
        assert_eq!(integer(&json!("800")), None);
        assert_eq!(integer(&Value::Null), None);
    }

    #[test]
    fn numbers_accept_fractions_but_not_text() {
        assert_eq!(number(&json!(0.5)), Some(0.5));
        assert_eq!(number(&json!("0.5")), None);
    }
}
