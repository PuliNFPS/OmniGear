/// Falhas do protocolo RAWM.
///
/// O núcleo não monta texto de interface: cada variante carrega um código
/// estável, e a casca decide como dizê-lo ao usuário.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RawmError {
    /// Evento acima do que o campo de 12 bits endereça.
    EventTooLong,
    /// Evento sem os dois bytes de cabeçalho.
    EventTooShort,
    /// Resposta que não começa com os quatro bytes 0xff.
    MissingPreamble,
    /// Comprimento declarado menor que o próprio cabeçalho.
    InvalidLength,
    /// Relatório HID que não tem 64 bytes.
    ReportNotSixtyFour,
    /// Relatório fora do canal virtual do mouse.
    WrongChannel,
    /// Relatório cujo comprimento declarado excede o que ele carrega.
    TruncatedReport,
    /// Evento que não é resultado de consulta.
    NotAQueryResult,
    /// Carga que não é texto UTF-8.
    InvalidUtf8,
}

impl RawmError {
    /// Identificador estável, consumido pela casca para escolher a mensagem.
    pub fn code(&self) -> &'static str {
        match self {
            Self::EventTooLong => "event-too-long",
            Self::EventTooShort => "event-too-short",
            Self::MissingPreamble => "missing-preamble",
            Self::InvalidLength => "invalid-length",
            Self::ReportNotSixtyFour => "report-not-64",
            Self::WrongChannel => "wrong-channel",
            Self::TruncatedReport => "truncated-report",
            Self::NotAQueryResult => "not-a-query-result",
            Self::InvalidUtf8 => "invalid-utf8",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Cada código atravessa o WASM e vira a chave que `rawmErrorMessage`
    /// procura em `apps/web/src/core/rawmError.ts`. Os literais aqui são
    /// escritos à mão, não recalculados a partir de uma tabela: o ponto do
    /// teste é travar a string, não reconferir a própria implementação.
    #[test]
    fn pins_the_stable_code_for_each_variant() {
        assert_eq!(RawmError::EventTooLong.code(), "event-too-long");
        assert_eq!(RawmError::EventTooShort.code(), "event-too-short");
        assert_eq!(RawmError::MissingPreamble.code(), "missing-preamble");
        assert_eq!(RawmError::InvalidLength.code(), "invalid-length");
        assert_eq!(RawmError::ReportNotSixtyFour.code(), "report-not-64");
        assert_eq!(RawmError::WrongChannel.code(), "wrong-channel");
        assert_eq!(RawmError::TruncatedReport.code(), "truncated-report");
        assert_eq!(RawmError::NotAQueryResult.code(), "not-a-query-result");
        assert_eq!(RawmError::InvalidUtf8.code(), "invalid-utf8");
    }
}
