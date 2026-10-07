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
    /// Id de ação que o núcleo não conhece — uma configuração salva por outra
    /// versão do app, por exemplo.
    UnknownAction,
    /// Campo do snapshot de parâmetros ausente, do tipo errado ou fora da faixa.
    /// `field` é o nome como o firmware o envia (`cpi`, `lod`).
    InvalidSnapshotField { field: &'static str },
    /// Modo de desempenho que este aparelho não tem, ou nenhum.
    InvalidPerformanceMode,
    /// Estágios de DPI vazios, demais, ou sem o estágio ativo entre eles.
    InvalidDpiStages,
    /// Campo que a descrição do aparelho exige ausente ou do tipo errado.
    IncompleteQuery { field: &'static str },
    /// Resposta de consulta sem nome ou sem id de produto.
    InvalidIdentity,
    /// Resposta de consulta cujo texto não é um objeto JSON.
    InvalidQueryJson,
    /// O mouse que respondeu não é um Leviathan V4; `name` é o nome que ele declarou.
    UnrecognizedMouse { name: String },
    /// `oci` ausente, fracionário ou além das memórias que o mouse tem.
    InvalidOnboardIndex,
    /// Memória de destino além das que o mouse tem.
    InvalidProfileSlot,
    /// Botão do editor que este aparelho não tem.
    UnknownButton { button: String },
    /// Ativador da camada R-Plus que este aparelho não tem.
    InvalidRPlusActivator,
    /// Botão da camada R-Plus que este aparelho não tem.
    UnknownRPlusButton { button: String },
    /// O mouse trocou de memória no meio de uma aplicação à sessão.
    ActiveSlotChanged,
    /// Uma operação começou antes de a anterior terminar.
    OperationInProgress,
    /// Uma escrita antes de a primeira resposta ligar a sessão.
    NotQueried,
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
            Self::UnknownAction => "unknown-action",
            Self::InvalidSnapshotField { .. } => "invalid-snapshot-field",
            Self::InvalidPerformanceMode => "invalid-performance-mode",
            Self::InvalidDpiStages => "invalid-dpi-stages",
            Self::IncompleteQuery { .. } => "incomplete-query",
            Self::InvalidIdentity => "invalid-identity",
            Self::InvalidQueryJson => "invalid-query-json",
            Self::UnrecognizedMouse { .. } => "unrecognized-mouse",
            Self::InvalidOnboardIndex => "invalid-onboard-index",
            Self::InvalidProfileSlot => "invalid-profile-slot",
            Self::UnknownButton { .. } => "unknown-button",
            Self::InvalidRPlusActivator => "invalid-rplus-activator",
            Self::UnknownRPlusButton { .. } => "unknown-rplus-button",
            Self::ActiveSlotChanged => "active-slot-changed",
            Self::OperationInProgress => "operation-in-progress",
            Self::NotQueried => "not-queried",
        }
    }

    /// O dado que acompanha o código, quando há um. A ponte o envia junto
    /// (`código:dado`), e a casca o usa para montar a mensagem.
    pub fn detail(&self) -> Option<&str> {
        match self {
            Self::InvalidSnapshotField { field } | Self::IncompleteQuery { field } => Some(field),
            Self::UnrecognizedMouse { name } => Some(name),
            Self::UnknownButton { button } | Self::UnknownRPlusButton { button } => Some(button),
            _ => None,
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
        assert_eq!(RawmError::UnknownAction.code(), "unknown-action");
        assert_eq!(
            RawmError::InvalidSnapshotField { field: "cpi" }.code(),
            "invalid-snapshot-field"
        );
        assert_eq!(
            RawmError::InvalidPerformanceMode.code(),
            "invalid-performance-mode"
        );
        assert_eq!(RawmError::InvalidDpiStages.code(), "invalid-dpi-stages");
        assert_eq!(
            RawmError::IncompleteQuery { field: "top" }.code(),
            "incomplete-query"
        );
        assert_eq!(RawmError::InvalidIdentity.code(), "invalid-identity");
        assert_eq!(RawmError::InvalidQueryJson.code(), "invalid-query-json");
        assert_eq!(
            RawmError::UnrecognizedMouse { name: "X".into() }.code(),
            "unrecognized-mouse"
        );
        assert_eq!(
            RawmError::InvalidOnboardIndex.code(),
            "invalid-onboard-index"
        );
        assert_eq!(RawmError::InvalidProfileSlot.code(), "invalid-profile-slot");
        assert_eq!(
            RawmError::UnknownButton { button: "x".into() }.code(),
            "unknown-button"
        );
        assert_eq!(
            RawmError::InvalidRPlusActivator.code(),
            "invalid-rplus-activator"
        );
        assert_eq!(
            RawmError::UnknownRPlusButton { button: "x".into() }.code(),
            "unknown-rplus-button"
        );
        assert_eq!(RawmError::ActiveSlotChanged.code(), "active-slot-changed");
        assert_eq!(
            RawmError::OperationInProgress.code(),
            "operation-in-progress"
        );
        assert_eq!(RawmError::NotQueried.code(), "not-queried");
    }

    #[test]
    fn only_variants_with_data_carry_a_detail() {
        assert_eq!(
            RawmError::InvalidSnapshotField { field: "lod" }.detail(),
            Some("lod")
        );
        assert_eq!(RawmError::EventTooLong.detail(), None);
        assert_eq!(
            RawmError::UnrecognizedMouse {
                name: "RAWM HS Receiver".into()
            }
            .detail(),
            Some("RAWM HS Receiver")
        );
        assert_eq!(
            RawmError::UnknownButton {
                button: "central".into()
            }
            .detail(),
            Some("central")
        );
        assert_eq!(
            RawmError::UnknownRPlusButton {
                button: "dpi".into()
            }
            .detail(),
            Some("dpi")
        );
        assert_eq!(RawmError::ActiveSlotChanged.detail(), None);
    }
}
