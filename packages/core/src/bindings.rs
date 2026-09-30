//! Guarda dos tipos TypeScript gerados em `packages/shared/src/generated/`.
//!
//! Os arquivos são versionados para que `@gearhub/shared` compile sem Rust.
//! Estes testes os impedem de divergir do núcleo: um campo novo, um rename, ou
//! uma edição à mão reprovam aqui, e um arquivo que nenhum tipo gera mais
//! também. Para regenerar: `UPDATE_BINDINGS=1 cargo test -p gearhub-core generated`.

use std::collections::BTreeSet;

use ts_rs::TS;

use crate::device::{DpiStage, MouseActionId, MouseParameters, MouseRPlusSettings, MouseSettings};
use crate::drivers::leviathan_v4::{
    DpiAxes, DpiLimits, LeviathanV4Description, LeviathanV4Usb, NumericRange,
};
use crate::protocols::rawm::{MouseParamSnapshot, OnboardBinding, OnboardSlotConfig};

const DIR: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/../shared/src/generated");

fn render<T: TS + 'static>() -> String {
    T::export_to_string(&ts_rs::Config::default()).expect("ts-rs exporta")
}

/// Cada tipo guardado, pelo nome do arquivo que o `ts-rs` gera para ele.
fn generated() -> Vec<(&'static str, String)> {
    vec![
        ("LeviathanV4Usb", render::<LeviathanV4Usb>()),
        ("DpiLimits", render::<DpiLimits>()),
        ("DpiAxes", render::<DpiAxes>()),
        ("LeviathanV4Description", render::<LeviathanV4Description>()),
        ("NumericRange", render::<NumericRange>()),
        ("MouseActionId", render::<MouseActionId>()),
        ("DpiStage", render::<DpiStage>()),
        ("MouseParameters", render::<MouseParameters>()),
        ("MouseRPlusSettings", render::<MouseRPlusSettings>()),
        ("MouseSettings", render::<MouseSettings>()),
        ("RawmMouseParamState", render::<MouseParamSnapshot>()),
        ("OnboardBinding", render::<OnboardBinding>()),
        ("OnboardSlotConfig", render::<OnboardSlotConfig>()),
    ]
}

#[test]
fn generated_typescript_matches_the_core() {
    let update = std::env::var_os("UPDATE_BINDINGS").is_some();
    let mut diverged = Vec::new();
    for (name, expected) in generated() {
        let path = format!("{DIR}/{name}.ts");
        if update {
            std::fs::write(&path, &expected).expect("escreve o arquivo gerado");
        }
        let committed = std::fs::read_to_string(&path)
            .unwrap_or_default()
            .replace("\r\n", "\n");
        if committed != expected {
            diverged.push(name);
        }
    }
    assert!(
        diverged.is_empty(),
        "tipos gerados divergiram do núcleo: {diverged:?}; rode UPDATE_BINDINGS=1 cargo test -p gearhub-core generated"
    );
}

#[test]
fn generated_directory_holds_only_what_the_core_generates() {
    // O outro teste reescreve o diretório neste modo; olhar agora seria uma corrida.
    if std::env::var_os("UPDATE_BINDINGS").is_some() {
        return;
    }
    let expected: BTreeSet<String> = generated()
        .into_iter()
        .map(|(name, _)| format!("{name}.ts"))
        .collect();
    let present: BTreeSet<String> = std::fs::read_dir(DIR)
        .expect("diretório gerado presente")
        .map(|entry| {
            entry
                .expect("entrada")
                .file_name()
                .to_string_lossy()
                .into_owned()
        })
        .collect();
    assert_eq!(
        present, expected,
        "arquivo órfão ou ausente em packages/shared/src/generated"
    );
}
