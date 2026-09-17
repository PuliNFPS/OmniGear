use gearhub_core::protocols::rawm::{build_query_event, with_protocol_envelope};
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
struct Vectors {
    version: u32,
    envelope: Vec<EnvelopeVector>,
    query_event: Vec<QueryEventVector>,
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
