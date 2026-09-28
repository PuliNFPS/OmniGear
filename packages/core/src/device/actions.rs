//! O vocabulário de ações que um botão de mouse pode receber.
//!
//! Este enum é o único dono de `MouseActionId`. O tipo TypeScript em
//! `packages/shared/src/generated/MouseActionId.ts` é gerado a partir dele por
//! `ts-rs`, e um teste aqui reprova quando os dois divergem. Os ids são
//! identificadores salvos nas configurações do usuário, não texto de tela.

/// Uma ação atribuível a um botão físico.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(rename_all = "kebab-case"))]
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

    const GENERATED: &str = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../shared/src/generated/MouseActionId.ts"
    );

    fn generated() -> String {
        MouseActionId::export_to_string(&ts_rs::Config::default()).expect("ts-rs exporta")
    }

    /// O arquivo é versionado para que `@gearhub/shared` compile sem Rust.
    /// Esta guarda é o que o impede de divergir do enum: um variante novo, um
    /// rename, ou uma edição à mão no `.ts` reprovam aqui.
    ///
    /// Para regenerar: `UPDATE_BINDINGS=1 cargo test -p gearhub-core generated`.
    #[test]
    fn the_generated_typescript_matches_the_enum() {
        let expected = generated();
        if std::env::var_os("UPDATE_BINDINGS").is_some() {
            std::fs::write(GENERATED, &expected).expect("escreve o arquivo gerado");
        }
        let committed = std::fs::read_to_string(GENERATED)
            .expect("arquivo gerado presente")
            .replace("\r\n", "\n");
        assert_eq!(
            committed, expected,
            "MouseActionId.ts divergiu do enum; rode UPDATE_BINDINGS=1 cargo test -p gearhub-core generated"
        );
    }

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
}
