use gearhub_core::device::{MouseActionId, MouseSettings};
use gearhub_core::drivers::leviathan_v4;
use gearhub_core::protocols::rawm::{
    RawmError, build_query_event, encode_mapping, encode_mouse_param_body,
    parse_mouse_param_snapshot, with_protocol_envelope,
};
use serde::Deserialize;

#[derive(Deserialize)]
struct EnvelopeVector {
    name: String,
    input: String,
    crc: bool,
    expected: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct QueryEventVector {
    name: String,
    epoch_seconds: u64,
    expected: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MappingVector {
    name: String,
    key_ids: String,
    action: String,
    expected: Option<String>,
}

#[derive(Deserialize)]
struct ShowPowerVector {
    name: String,
    expected: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LeviathanKeyVector {
    button_id: String,
    key_id: u8,
}

#[derive(Deserialize)]
struct ParamSnapshotVector {
    name: String,
    query: String,
    expected: String,
}

#[derive(Deserialize)]
struct ParamApplyVector {
    name: String,
    query: String,
    settings: MouseSettings,
    expected: String,
}

#[derive(Deserialize)]
struct InvalidSnapshotVector {
    name: String,
    query: String,
    patch: serde_json::Map<String, serde_json::Value>,
    field: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Vectors {
    version: u32,
    envelope: Vec<EnvelopeVector>,
    query_event: Vec<QueryEventVector>,
    mapping: Vec<MappingVector>,
    show_power: Vec<ShowPowerVector>,
    leviathan_keys: Vec<LeviathanKeyVector>,
    queries: std::collections::HashMap<String, serde_json::Value>,
    param_snapshot: Vec<ParamSnapshotVector>,
    invalid_snapshot: Vec<InvalidSnapshotVector>,
    param_apply: Vec<ParamApplyVector>,
}

fn from_hex(value: &str) -> Vec<u8> {
    (0..value.len())
        .step_by(2)
        .map(|index| u8::from_str_radix(&value[index..index + 2], 16).expect("hexadecimal"))
        .collect()
}

fn to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn query(vectors: &Vectors, name: &str) -> serde_json::Value {
    vectors
        .queries
        .get(name)
        .cloned()
        .unwrap_or_else(|| panic!("consulta desconhecida: {name}"))
}

/// `null` remove o campo; qualquer outro valor o substitui.
fn patched(
    mut base: serde_json::Value,
    patch: &serde_json::Map<String, serde_json::Value>,
) -> serde_json::Value {
    let object = base.as_object_mut().expect("consulta é objeto");
    for (key, value) in patch {
        if value.is_null() {
            object.remove(key);
        } else {
            object.insert(key.clone(), value.clone());
        }
    }
    base
}

fn vectors() -> Vectors {
    serde_json::from_str(include_str!("../vectors/rawm-protocol.json")).expect("vetores válidos")
}

/// Uma seção vazia (por remoção, ou por um rename que o serde não achou)
/// faria o `for` do teste iterar zero vezes e passar sem checar nada — o
/// mesmo "vetor decorativo" que motivou aposentar `crc16`. Cada teste de
/// vetor chama isto antes do laço.
fn require_non_empty<T>(cases: &[T], section: &str) {
    assert!(!cases.is_empty(), "sem vetores de {section}");
}

#[test]
fn envelope_matches_the_shared_vectors() {
    let vectors = vectors();
    assert_eq!(vectors.version, 1, "vetores de outra versão");
    require_non_empty(&vectors.envelope, "envelope");
    for vector in &vectors.envelope {
        let encoded = with_protocol_envelope(&from_hex(&vector.input), vector.crc)
            .unwrap_or_else(|error| panic!("{}: {error:?}", vector.name));
        assert_eq!(to_hex(&encoded), vector.expected, "{}", vector.name);
    }
}

#[test]
fn build_query_event_matches_the_shared_vectors() {
    let vectors = vectors();
    require_non_empty(&vectors.query_event, "queryEvent");
    for vector in &vectors.query_event {
        let encoded = build_query_event(vector.epoch_seconds)
            .unwrap_or_else(|error| panic!("{}: {error:?}", vector.name));
        assert_eq!(to_hex(&encoded), vector.expected, "{}", vector.name);
    }
}

#[test]
fn encode_mapping_matches_the_shared_vectors() {
    let vectors = vectors();
    require_non_empty(&vectors.mapping, "mapping");
    for vector in &vectors.mapping {
        let action = MouseActionId::parse(&vector.action)
            .unwrap_or_else(|| panic!("{}: ação desconhecida {}", vector.name, vector.action));
        let encoded = encode_mapping(&from_hex(&vector.key_ids), action);
        assert_eq!(
            encoded.map(|bytes| to_hex(&bytes)),
            vector.expected,
            "{}",
            vector.name
        );
    }
}

/// Uma ação nova no enum sem vetor passaria sem ser conferida byte a byte.
#[test]
fn every_action_has_a_mapping_vector() {
    let vectors = vectors();
    let covered: std::collections::BTreeSet<&str> = vectors
        .mapping
        .iter()
        .map(|vector| vector.action.as_str())
        .collect();
    for action in MouseActionId::ALL {
        assert!(
            covered.contains(action.as_str()),
            "sem vetor para {}",
            action.as_str()
        );
    }
}

#[test]
fn show_power_matches_the_shared_vectors() {
    let vectors = vectors();
    require_non_empty(&vectors.show_power, "showPower");
    for vector in &vectors.show_power {
        assert_eq!(
            to_hex(&leviathan_v4::encode_show_power()),
            vector.expected,
            "{}",
            vector.name
        );
    }
}

#[test]
fn leviathan_keys_match_the_shared_vectors() {
    let vectors = vectors();
    require_non_empty(&vectors.leviathan_keys, "leviathanKeys");
    for vector in &vectors.leviathan_keys {
        assert_eq!(
            leviathan_v4::key_id(&vector.button_id),
            Some(vector.key_id),
            "{}",
            vector.button_id
        );
        assert_eq!(
            leviathan_v4::button_id(vector.key_id),
            Some(vector.button_id.as_str())
        );
    }
}

#[test]
fn param_snapshot_matches_the_shared_vectors() {
    let vectors = vectors();
    require_non_empty(&vectors.param_snapshot, "paramSnapshot");
    for vector in &vectors.param_snapshot {
        let state = parse_mouse_param_snapshot(&query(&vectors, &vector.query))
            .unwrap_or_else(|error| panic!("{}: {error:?}", vector.name));
        assert_eq!(
            to_hex(&encode_mouse_param_body(&state)),
            vector.expected,
            "{}",
            vector.name
        );
    }
}

#[test]
fn invalid_snapshots_name_the_field_that_fails() {
    let vectors = vectors();
    require_non_empty(&vectors.invalid_snapshot, "invalidSnapshot");
    for vector in &vectors.invalid_snapshot {
        let raw = patched(query(&vectors, &vector.query), &vector.patch);
        match parse_mouse_param_snapshot(&raw) {
            Err(RawmError::InvalidSnapshotField { field }) => {
                assert_eq!(field, vector.field, "{}", vector.name)
            }
            other => panic!("{}: esperava campo inválido, veio {other:?}", vector.name),
        }
    }
}

#[test]
fn param_apply_matches_the_shared_vectors() {
    let vectors = vectors();
    require_non_empty(&vectors.param_apply, "paramApply");
    for vector in &vectors.param_apply {
        let snapshot = parse_mouse_param_snapshot(&query(&vectors, &vector.query))
            .unwrap_or_else(|error| panic!("{}: {error:?}", vector.name));
        let next = leviathan_v4::apply_settings(&snapshot, &vector.settings)
            .unwrap_or_else(|error| panic!("{}: {error:?}", vector.name));
        assert_eq!(
            to_hex(&encode_mouse_param_body(&next)),
            vector.expected,
            "{}",
            vector.name
        );
    }
}
