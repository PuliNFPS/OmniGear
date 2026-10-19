use gearhub_core::device::{MouseActionId, MouseSettings};
use gearhub_core::drivers::leviathan_v4;
use gearhub_core::drivers::leviathan_v4::{LeviathanV4Session, SessionEvent, Step};
use gearhub_core::protocols::rawm::{
    OnboardConfigCollector, RawmError, build_query_event, decode_onboard_entry, encode_mapping,
    encode_mouse_param_body, frame_event, parse_identity, parse_mouse_param_snapshot,
    with_protocol_envelope,
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
struct ExpectedBinding {
    key_ids: Vec<u8>,
    action: Option<String>,
}

#[derive(Deserialize)]
struct OnboardEntryVector {
    name: String,
    entry: String,
    expected: Option<ExpectedBinding>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExpectedDumpBinding {
    key_ids: Vec<u8>,
    action: Option<String>,
    raw: String,
}

#[derive(Deserialize)]
struct ExpectedSlot {
    index: u8,
    bindings: Vec<ExpectedDumpBinding>,
}

#[derive(Deserialize)]
struct OnboardDumpVector {
    name: String,
    payloads: Vec<String>,
    expected: Option<Vec<ExpectedSlot>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExpectedIdentity {
    device_name: String,
    product_id: u32,
    vendor_id: Option<u32>,
    crc_supported: bool,
}

#[derive(Deserialize)]
struct IdentityVector {
    name: String,
    query: String,
    patch: serde_json::Map<String, serde_json::Value>,
    expected: Option<ExpectedIdentity>,
}

#[derive(Deserialize)]
struct SessionEventsVector {
    name: String,
    query: String,
    patch: serde_json::Map<String, serde_json::Value>,
    reports: Vec<String>,
    expected: Vec<serde_json::Value>,
}

#[derive(Deserialize)]
struct SessionApplyCase {
    settings: MouseSettings,
    expected: Vec<serde_json::Value>,
}

#[derive(Deserialize)]
struct SessionApplyVector {
    name: String,
    query: String,
    patch: serde_json::Map<String, serde_json::Value>,
    dump: Option<Vec<String>>,
    applies: Vec<SessionApplyCase>,
}

#[derive(Deserialize)]
struct SessionWriteProfileVector {
    name: String,
    query: String,
    patch: serde_json::Map<String, serde_json::Value>,
    dump: Option<Vec<String>>,
    slot: u32,
    settings: MouseSettings,
    expected: Vec<serde_json::Value>,
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
    onboard_entry: Vec<OnboardEntryVector>,
    onboard_dump: Vec<OnboardDumpVector>,
    identity: Vec<IdentityVector>,
    session_events: Vec<SessionEventsVector>,
    session_apply: Vec<SessionApplyVector>,
    session_write_profile: Vec<SessionWriteProfileVector>,
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

#[test]
fn onboard_entries_match_the_shared_vectors() {
    let vectors = vectors();
    require_non_empty(&vectors.onboard_entry, "onboardEntry");
    for vector in &vectors.onboard_entry {
        let decoded = decode_onboard_entry(&from_hex(&vector.entry));
        match (&vector.expected, decoded) {
            (None, None) => {}
            (Some(expected), Some(binding)) => {
                assert_eq!(binding.key_ids, expected.key_ids, "{}", vector.name);
                assert_eq!(
                    binding.action.map(|action| action.as_str()),
                    expected.action.as_deref(),
                    "{}",
                    vector.name
                );
                assert_eq!(
                    to_hex(&binding.raw),
                    vector.entry,
                    "{}: bytes crus",
                    vector.name
                );
            }
            (expected, decoded) => panic!(
                "{}: esperava {:?}, veio {decoded:?}",
                vector.name,
                expected.is_some()
            ),
        }
    }
}

#[test]
fn identities_match_the_shared_vectors() {
    let vectors = vectors();
    require_non_empty(&vectors.identity, "identity");
    for vector in &vectors.identity {
        let raw = patched(query(&vectors, &vector.query), &vector.patch);
        match (parse_identity(raw), &vector.expected) {
            (Ok(identity), Some(expected)) => {
                assert_eq!(
                    identity.device_name, expected.device_name,
                    "{}",
                    vector.name
                );
                assert_eq!(identity.product_id, expected.product_id, "{}", vector.name);
                assert_eq!(identity.vendor_id, expected.vendor_id, "{}", vector.name);
                assert_eq!(
                    identity.crc_supported, expected.crc_supported,
                    "{}",
                    vector.name
                );
            }
            (Err(RawmError::InvalidIdentity), None) => {}
            (result, _) => panic!("{}: veio {result:?}", vector.name),
        }
    }
}

/// (índice, [(ids, ação, bytes crus em hex)]) — o formato em que as duas pontas se comparam.
type ShapedSlots<'a> = Vec<(u8, Vec<(Vec<u8>, Option<&'a str>, String)>)>;

#[test]
fn onboard_dumps_match_the_shared_vectors() {
    let vectors = vectors();
    require_non_empty(&vectors.onboard_dump, "onboardDump");
    for vector in &vectors.onboard_dump {
        let mut collector = OnboardConfigCollector::new();
        let (last, earlier) = vector.payloads.split_last().expect("payloads");
        for payload in earlier {
            assert_eq!(
                collector.push(&from_hex(payload)),
                None,
                "{}: antes do fim",
                vector.name
            );
        }
        let result = collector.push(&from_hex(last));
        let shaped: Option<ShapedSlots<'_>> = result.as_ref().map(|slots| {
            slots
                .iter()
                .map(|slot| {
                    let bindings = slot
                        .bindings
                        .iter()
                        .map(|b| {
                            (
                                b.key_ids.clone(),
                                b.action.map(|a| a.as_str()),
                                to_hex(&b.raw),
                            )
                        })
                        .collect();
                    (slot.index, bindings)
                })
                .collect()
        });
        let expected: Option<ShapedSlots<'_>> = vector.expected.as_ref().map(|slots| {
            slots
                .iter()
                .map(|slot| {
                    let bindings = slot
                        .bindings
                        .iter()
                        .map(|b| (b.key_ids.clone(), b.action.as_deref(), b.raw.clone()))
                        .collect();
                    (slot.index, bindings)
                })
                .collect()
        });
        assert_eq!(shaped, expected, "{}", vector.name);
    }
}

const PREAMBLE: [u8; 4] = [0xff; 4];

/// Um evento como chega ao transporte: com o preâmbulo, no canal virtual.
fn delivered(event: &[u8]) -> Vec<[u8; 64]> {
    let mut chunk = PREAMBLE.to_vec();
    chunk.extend_from_slice(event);
    frame_event(&chunk, true)
}

/// Uma sessão ligada pela resposta que um mouse com `raw` mandaria.
fn connected(raw: &serde_json::Value) -> LeviathanV4Session {
    let mut session = LeviathanV4Session::new();
    session.begin_query(0).expect("consulta");
    while session.next_step().expect("passo").is_some() {}
    let mut body = vec![0x02, 0];
    body.extend(serde_json::to_vec(raw).expect("json"));
    body.push(0);
    let mut events = Vec::new();
    for report in delivered(&with_protocol_envelope(&body, false).expect("resposta")) {
        events.extend(session.feed_report(0, &report).expect("resposta lida"));
    }
    assert!(
        matches!(events.last(), Some(SessionEvent::Queried(_))),
        "a resposta não ligou a sessão"
    );
    session
}

/// O evento na forma dos vetores: bytes crus em hex.
fn shaped_event(event: &SessionEvent) -> serde_json::Value {
    use serde_json::json;
    match event {
        SessionEvent::Queried(identity) => {
            json!({ "kind": "queried", "deviceName": identity.device_name })
        }
        SessionEvent::Dpi(axes) => json!({ "kind": "dpi", "x": axes.x, "y": axes.y }),
        SessionEvent::ActiveSlot { index } => json!({ "kind": "active-slot", "index": index }),
        SessionEvent::OnboardSlots { slots } => json!({
            "kind": "onboard-slots",
            "slots": slots.iter().map(|slot| json!({
                "index": slot.index,
                "bindings": slot.bindings.iter().map(|binding| json!({
                    "keyIds": binding.key_ids,
                    "action": binding.action.map(|action| action.as_str()),
                    "raw": to_hex(&binding.raw),
                })).collect::<Vec<_>>(),
            })).collect::<Vec<_>>(),
        }),
    }
}

#[test]
fn session_events_match_the_shared_vectors() {
    let vectors = vectors();
    require_non_empty(&vectors.session_events, "sessionEvents");
    for vector in &vectors.session_events {
        let mut session = connected(&patched(query(&vectors, &vector.query), &vector.patch));
        let mut events = Vec::new();
        for report in &vector.reports {
            let read = session
                .feed_report(0, &from_hex(report))
                .unwrap_or_else(|error| panic!("{}: {error:?}", vector.name));
            events.extend(read.iter().map(shaped_event));
        }
        assert_eq!(events, vector.expected, "{}", vector.name);
    }
}

fn notify_report(kind: u8, payload: &[u8]) -> [u8; 64] {
    let mut body = vec![0x0b, 0, kind];
    body.extend_from_slice(payload);
    delivered(&with_protocol_envelope(&body, false).expect("notificação"))[0]
}

fn feed_dump(session: &mut LeviathanV4Session, dump: Option<&Vec<String>>) {
    for payload in dump.into_iter().flatten() {
        session
            .feed_report(0, &notify_report(0x14, &from_hex(payload)))
            .expect("dump");
    }
}

/// Os passos até o fim, na forma dos vetores.
fn drain(session: &mut LeviathanV4Session, name: &str) -> Vec<serde_json::Value> {
    let mut steps = Vec::new();
    while let Some(step) = session
        .next_step()
        .unwrap_or_else(|error| panic!("{name}: {error:?}"))
    {
        steps.push(match step {
            Step::Send(command) => serde_json::json!({ "send": to_hex(&command.data) }),
            Step::Wait { ms } => serde_json::json!({ "wait": ms }),
        });
    }
    steps
}

#[test]
fn session_applies_match_the_shared_vectors() {
    let vectors = vectors();
    require_non_empty(&vectors.session_apply, "sessionApply");
    for vector in &vectors.session_apply {
        let mut session = connected(&patched(query(&vectors, &vector.query), &vector.patch));
        feed_dump(&mut session, vector.dump.as_ref());
        for (index, apply) in vector.applies.iter().enumerate() {
            session
                .begin_apply(&apply.settings)
                .unwrap_or_else(|error| panic!("{}: {error:?}", vector.name));
            let name = format!("{} #{index}", vector.name);
            assert_eq!(drain(&mut session, &name), apply.expected, "{name}");
        }
    }
}

#[test]
fn session_profile_writes_match_the_shared_vectors() {
    let vectors = vectors();
    require_non_empty(&vectors.session_write_profile, "sessionWriteProfile");
    for vector in &vectors.session_write_profile {
        let mut session = connected(&patched(query(&vectors, &vector.query), &vector.patch));
        feed_dump(&mut session, vector.dump.as_ref());
        session
            .begin_write_profile(vector.slot, &vector.settings)
            .unwrap_or_else(|error| panic!("{}: {error:?}", vector.name));
        assert_eq!(
            drain(&mut session, &vector.name),
            vector.expected,
            "{}",
            vector.name
        );
    }
}
