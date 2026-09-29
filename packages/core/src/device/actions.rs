//! O vocabulário de ações que um botão de mouse pode receber.
//!
//! Este enum é o único dono de `MouseActionId`. O tipo TypeScript em
//! `packages/shared/src/generated/MouseActionId.ts` é gerado a partir dele por
//! `ts-rs`, e um teste aqui reprova quando os dois divergem. Os ids são
//! identificadores salvos nas configurações do usuário, não texto de tela.

/// Uma ação atribuível a um botão físico.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "kebab-case")]
#[cfg_attr(test, derive(ts_rs::TS))]
pub enum MouseActionId {
    CliqueEsquerdo,
    CliqueDireito,
    CliqueCentral,
    Voltar,
    Avancar,
    DpiCiclo,
    DpiAumentar,
    DpiDiminuir,
    RolagemCima,
    RolagemBaixo,
    Desativado,
}

impl MouseActionId {
    pub const ALL: [Self; 11] = [
        Self::CliqueEsquerdo,
        Self::CliqueDireito,
        Self::CliqueCentral,
        Self::Voltar,
        Self::Avancar,
        Self::DpiCiclo,
        Self::DpiAumentar,
        Self::DpiDiminuir,
        Self::RolagemCima,
        Self::RolagemBaixo,
        Self::Desativado,
    ];

    /// O id como a casca o guarda. Um teste abaixo o amarra ao nome que o
    /// `ts-rs` gera, para que os dois não possam divergir.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::CliqueEsquerdo => "clique-esquerdo",
            Self::CliqueDireito => "clique-direito",
            Self::CliqueCentral => "clique-central",
            Self::Voltar => "voltar",
            Self::Avancar => "avancar",
            Self::DpiCiclo => "dpi-ciclo",
            Self::DpiAumentar => "dpi-aumentar",
            Self::DpiDiminuir => "dpi-diminuir",
            Self::RolagemCima => "rolagem-cima",
            Self::RolagemBaixo => "rolagem-baixo",
            Self::Desativado => "desativado",
        }
    }

    pub fn parse(id: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|action| action.as_str() == id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeSet;
    use ts_rs::TS;

    /// `as_str` é escrito à mão; o `ts-rs` deriva os nomes das variantes. Os
    /// dois conjuntos precisam ser o mesmo, senão a ponte devolveria um id que
    /// o tipo TypeScript não conhece.
    #[test]
    fn as_str_names_exactly_the_generated_union() {
        let decl = MouseActionId::decl(&ts_rs::Config::default());
        let generated: BTreeSet<&str> = decl.split('"').skip(1).step_by(2).collect();
        let written: BTreeSet<&str> = MouseActionId::ALL.iter().map(|a| a.as_str()).collect();
        assert_eq!(generated, written);
    }

    #[test]
    fn parse_is_the_inverse_of_as_str() {
        for action in MouseActionId::ALL {
            assert_eq!(MouseActionId::parse(action.as_str()), Some(action));
        }
        assert_eq!(MouseActionId::parse("clique-lateral"), None);
        assert_eq!(MouseActionId::parse(""), None);
    }

    #[test]
    fn serde_uses_the_same_ids_as_as_str() {
        for action in MouseActionId::ALL {
            assert_eq!(serde_json::to_value(action).unwrap(), action.as_str());
        }
    }
}
