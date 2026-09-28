use gearhub_core::device::MouseActionId;
use gearhub_core::drivers::leviathan_v4;
use gearhub_core::protocols::rawm::{build_query_event, encode_mapping, with_protocol_envelope};
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
#[serde(rename_all = "camelCase")]
struct Vectors {
    version: u32,
    envelope: Vec<EnvelopeVector>,
    query_event: Vec<QueryEventVector>,
    mapping: Vec<MappingVector>,
    show_power: Vec<ShowPowerVector>,
    leviathan_keys: Vec<LeviathanKeyVector>,
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
