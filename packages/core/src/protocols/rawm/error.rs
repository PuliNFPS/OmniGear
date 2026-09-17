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
        }
    }
}
