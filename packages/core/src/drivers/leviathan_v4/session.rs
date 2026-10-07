//! A sessão do Leviathan V4: o que o mouse tem agora, e o que enviar a seguir.
//!
//! O núcleo não faz I/O e é síncrono: não envia nem espera nada. Ele decide o
//! próximo passo no instante em que a casca o pede (`next_step`), e a casca o
//! executa; o que chega do mouse entra por `feed_report`. Pedir um passo por
//! vez é o que deixa o núcleo ver, entre dois passos, o que o mouse anunciou —
//! ver `## A forma do passo 5` em
//! `docs/superpowers/specs/2026-09-07-nucleo-rust-ponte-design.md`.

use std::collections::VecDeque;

use serde::Serialize;
use serde_json::Value;

use super::description::{DpiAxes, onboard_slot_count};
use super::identity::is_device_name;
use crate::command::HidCommand;
use crate::protocols::rawm::json::integer;
use crate::protocols::rawm::{
    MouseParamSnapshot, OnboardConfigCollector, OnboardSlotConfig, RawEventAssembler, RawmError,
    RawmIdentity, RawmNotification, build_query_event, decode_report_chunk, dpi_axes, frame_event,
    is_query_result, parse_mouse_param_snapshot, parse_notification, parse_query_answer,
};

/// Quanto a casca espera a resposta de uma consulta, contando a abertura do dispositivo.
pub const QUERY_TIMEOUT_MS: u32 = 1000;

/// O canal em que o receptor entrega o mouse; os outros ids são tráfego dele.
const VENDOR_REPORT_ID: u8 = 0;

type Report = [u8; 64];

/// O que a casca faz a seguir.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(rename = "SessionStep"))]
pub enum Step {
    /// Enviar este relatório.
    Send(HidCommand),
    /// Esperar antes de pedir o próximo passo.
    Wait { ms: u32 },
}

/// O que um relatório que chegou significa.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
#[cfg_attr(test, derive(ts_rs::TS))]
pub enum SessionEvent {
    /// A resposta à consulta pendente.
    Queried(RawmIdentity),
    /// O mouse anunciou um DPI, com os dois eixos diferentes de zero.
    Dpi(DpiAxes),
    /// O mouse anunciou a memória ativa — mesmo a que já era.
    ActiveSlot { index: u8 },
    /// O dump das memórias terminou de chegar.
    OnboardSlots { slots: Vec<OnboardSlotConfig> },
}

/// O que a primeira resposta revelou do aparelho.
#[derive(Debug)]
struct Device {
    slot_count: u32,
    snapshot: MouseParamSnapshot,
    active_slot: u8,
}

#[derive(Debug)]
struct Query {
    reports: VecDeque<Report>,
}

#[derive(Debug)]
enum Operation {
    /// Enviando a consulta, ou esperando a resposta.
    Query(Query),
}

#[derive(Debug, Default)]
pub struct LeviathanV4Session {
    /// O único leitor do fluxo: consulta, notificações e dump passam por ele.
    assembler: RawEventAssembler,
    collector: OnboardConfigCollector,
    /// `None` até a primeira resposta.
    device: Option<Device>,
    /// `None` até o dump terminar de chegar.
    slots: Option<Vec<OnboardSlotConfig>>,
    operation: Option<Operation>,
}

impl LeviathanV4Session {
    pub fn new() -> Self {
        Self::default()
    }

    /// A memória que o mouse está usando, contando de 0; `None` antes da primeira resposta.
    pub fn active_slot(&self) -> Option<u8> {
        self.device.as_ref().map(|device| device.active_slot)
    }

    /// O DPI que o mouse está usando; `None` antes da primeira resposta.
    pub fn dpi(&self) -> Option<DpiAxes> {
        self.device
            .as_ref()
            .map(|device| axes(device.snapshot.resolution))
    }

    /// As memórias do último dump; `None` até ele terminar de chegar.
    pub fn slots(&self) -> Option<&[OnboardSlotConfig]> {
        self.slots.as_deref()
    }

    /// Começa uma consulta. A primeira resposta liga a sessão; as seguintes a
    /// atualizam. A casca espera o `Queried` contra `QUERY_TIMEOUT_MS`.
    pub fn begin_query(&mut self, epoch_seconds: u64) -> Result<(), RawmError> {
        self.ensure_idle()?;
        let event = build_query_event(epoch_seconds)?;
        self.operation = Some(Operation::Query(Query {
            reports: frame_event(&event, true).into(),
        }));
        Ok(())
    }

    /// O próximo passo da operação em andamento; `None` quando não há o que fazer.
    pub fn next_step(&mut self) -> Result<Option<Step>, RawmError> {
        match self.operation.as_mut() {
            None => Ok(None),
            // A consulta continua pendente depois do último envio, até a resposta chegar.
            Some(Operation::Query(query)) => Ok(query.reports.pop_front().map(send)),
        }
    }

    /// Encerra a operação em andamento. Sem operação, nada.
    pub fn abort(&mut self) {
        self.operation = None;
    }

    /// Bytes que chegaram, e o que eles significam.
    ///
    /// Só falha com uma consulta pendente — e então a encerra. Sem consulta
    /// pendente, um relatório que não decodifica reinicia o montador e é
    /// pulado: o mesmo canal leva quadros do próprio receptor.
    pub fn feed_report(
        &mut self,
        report_id: u8,
        report: &[u8],
    ) -> Result<Vec<SessionEvent>, RawmError> {
        if report_id != VENDOR_REPORT_ID {
            return Ok(Vec::new());
        }
        let events = match self.assemble(report) {
            Ok(events) => events,
            Err(error) => {
                self.assembler.reset();
                if self.query_pending() {
                    self.operation = None;
                    return Err(error);
                }
                return Ok(Vec::new());
            }
        };
        let mut read = Vec::new();
        for event in events {
            if is_query_result(&event) {
                // Uma resposta que ninguém pediu é ignorada, como antes.
                if self.query_pending() {
                    self.operation = None;
                    read.push(self.answer(&event)?);
                }
                continue;
            }
            if let Some(notification) = parse_notification(&event) {
                read.extend(self.notify(notification));
            }
        }
        Ok(read)
    }

    fn ensure_idle(&self) -> Result<(), RawmError> {
        match self.operation {
            Some(_) => Err(RawmError::OperationInProgress),
            None => Ok(()),
        }
    }

    fn query_pending(&self) -> bool {
        matches!(self.operation, Some(Operation::Query(_)))
    }

    fn assemble(&mut self, report: &[u8]) -> Result<Vec<Vec<u8>>, RawmError> {
        match decode_report_chunk(report, true)? {
            Some(chunk) if !chunk.is_empty() => self.assembler.push(&chunk),
            _ => Ok(Vec::new()),
        }
    }

    /// A primeira resposta confere o nome e o snapshot e liga a sessão; as
    /// seguintes exigem `oci` e atualizam memória e snapshot.
    fn answer(&mut self, event: &[u8]) -> Result<SessionEvent, RawmError> {
        let identity = parse_query_answer(event)?;
        let raw = &identity.raw;
        match self.device.as_mut() {
            None => {
                if !is_device_name(&identity.device_name) {
                    return Err(RawmError::UnrecognizedMouse {
                        name: identity.device_name.clone(),
                    });
                }
                let snapshot = parse_mouse_param_snapshot(raw)?;
                let slot_count = onboard_slot_count(raw);
                // Na conexão, um `oci` ausente vale a memória 0, como o construtor do driver fazia.
                let oci = raw
                    .get("oci")
                    .filter(|value| !value.is_null())
                    .cloned()
                    .unwrap_or_else(|| Value::from(0));
                let active_slot = onboard_index(&oci, slot_count)?;
                self.device = Some(Device {
                    slot_count,
                    snapshot,
                    active_slot,
                });
            }
            Some(device) => {
                let active_slot =
                    onboard_index(raw.get("oci").unwrap_or(&Value::Null), device.slot_count)?;
                device.snapshot = parse_mouse_param_snapshot(raw)?;
                device.active_slot = active_slot;
            }
        }
        Ok(SessionEvent::Queried(identity))
    }

    fn notify(&mut self, notification: RawmNotification) -> Option<SessionEvent> {
        match notification {
            RawmNotification::Dpi(value) => self.dpi_announced(u32::from(value)),
            RawmNotification::DpiXy(value) => self.dpi_announced(value),
            // O app não acompanha a taxa anunciada.
            RawmNotification::Polling(_) => None,
            RawmNotification::OnboardIndex(index) => {
                let device = self.device.as_mut()?;
                if u32::from(index) >= device.slot_count {
                    return None;
                }
                device.active_slot = index;
                Some(SessionEvent::ActiveSlot { index })
            }
            RawmNotification::OnboardConfig(payload) => {
                let slots = self.collector.push(&payload)?;
                self.slots = Some(slots.clone());
                Some(SessionEvent::OnboardSlots { slots })
            }
        }
    }

    /// O snapshot acompanha todo DPI anunciado; o evento só sai com os dois eixos.
    fn dpi_announced(&mut self, value: u32) -> Option<SessionEvent> {
        let device = self.device.as_mut()?;
        device.snapshot.resolution = value;
        let announced = axes(value);
        (announced.x != 0 && announced.y != 0).then_some(SessionEvent::Dpi(announced))
    }
}

fn send(report: Report) -> Step {
    Step::Send(HidCommand {
        report_id: VENDOR_REPORT_ID,
        data: report.to_vec(),
    })
}

/// A memória ativa que a resposta declara: inteira, de 0 ao número de memórias.
fn onboard_index(value: &Value, slot_count: u32) -> Result<u8, RawmError> {
    integer(value)
        .filter(|index| (0..i64::from(slot_count)).contains(index))
        .map(|index| index as u8)
        .ok_or(RawmError::InvalidOnboardIndex)
}

fn axes(value: u32) -> DpiAxes {
    let (x, y) = dpi_axes(value);
    DpiAxes {
        x: u32::from(x),
        y: u32::from(y),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocols::rawm::with_protocol_envelope;
    use serde_json::json;

    const PREAMBLE: [u8; 4] = [0xff; 4];

    fn capture() -> Value {
        let vectors: Value =
            serde_json::from_str(include_str!("../../../vectors/rawm-protocol.json")).unwrap();
        vectors["queries"]["leviathan-v4-captura"].clone()
    }

    fn delivered(event: &[u8]) -> Vec<Report> {
        let mut chunk = PREAMBLE.to_vec();
        chunk.extend_from_slice(event);
        frame_event(&chunk, true)
    }

    fn answer_reports(raw: &Value) -> Vec<Report> {
        let mut body = vec![0x02, 0];
        body.extend(serde_json::to_vec(raw).unwrap());
        body.push(0);
        delivered(&with_protocol_envelope(&body, false).unwrap())
    }

    fn notify(kind: u8, payload: &[u8]) -> Report {
        let mut body = vec![0x0b, 0, kind];
        body.extend_from_slice(payload);
        delivered(&with_protocol_envelope(&body, false).unwrap())[0]
    }

    fn feed(
        session: &mut LeviathanV4Session,
        reports: &[Report],
    ) -> Result<Vec<SessionEvent>, RawmError> {
        let mut events = Vec::new();
        for report in reports {
            events.extend(session.feed_report(0, report)?);
        }
        Ok(events)
    }

    fn drain(session: &mut LeviathanV4Session) -> Result<Vec<Step>, RawmError> {
        let mut steps = Vec::new();
        while let Some(step) = session.next_step()? {
            steps.push(step);
        }
        Ok(steps)
    }

    fn query(
        session: &mut LeviathanV4Session,
        raw: &Value,
    ) -> Result<Vec<SessionEvent>, RawmError> {
        session.begin_query(0).unwrap();
        drain(session).unwrap();
        feed(session, &answer_reports(raw))
    }

    fn connected() -> LeviathanV4Session {
        let mut session = LeviathanV4Session::new();
        query(&mut session, &capture()).unwrap();
        session
    }

    #[test]
    fn the_first_answer_connects_the_session() {
        let mut session = LeviathanV4Session::new();
        assert_eq!(session.active_slot(), None);
        assert_eq!(session.dpi(), None);
        let events = query(&mut session, &capture()).unwrap();
        assert!(matches!(
            events.as_slice(),
            [SessionEvent::Queried(identity)] if identity.device_name == "LEVIATHAN V4"
        ));
        assert_eq!(session.active_slot(), Some(0));
        assert_eq!(session.dpi(), Some(DpiAxes { x: 800, y: 800 }));
    }

    #[test]
    fn the_query_sends_without_pauses_and_stays_pending_until_answered() {
        let mut session = LeviathanV4Session::new();
        session.begin_query(0x1234_5678).unwrap();
        let steps = drain(&mut session).unwrap();
        assert_eq!(steps.len(), 1);
        assert!(matches!(
            &steps[0],
            Step::Send(command) if command.report_id == 0 && command.data[0] == 0xc0
        ));
        assert_eq!(session.begin_query(0), Err(RawmError::OperationInProgress));
        feed(&mut session, &answer_reports(&capture())).unwrap();
        assert_eq!(session.begin_query(0), Ok(()));
    }

    #[test]
    fn a_mouse_that_is_not_a_leviathan_is_refused() {
        let mut raw = capture();
        raw["dn"] = json!("RAWM HS Receiver");
        let mut session = LeviathanV4Session::new();
        assert_eq!(
            query(&mut session, &raw),
            Err(RawmError::UnrecognizedMouse {
                name: "RAWM HS Receiver".into()
            })
        );
        assert_eq!(session.active_slot(), None);
        assert_eq!(session.begin_query(0), Ok(()));
    }

    #[test]
    fn connecting_without_oci_means_memory_zero_but_a_later_query_requires_it() {
        let mut raw = capture();
        raw.as_object_mut().unwrap().remove("oci");
        let mut session = LeviathanV4Session::new();
        query(&mut session, &raw).unwrap();
        assert_eq!(session.active_slot(), Some(0));
        assert_eq!(
            query(&mut session, &raw),
            Err(RawmError::InvalidOnboardIndex)
        );
    }

    #[test]
    fn a_later_query_updates_the_memory_and_the_dpi() {
        let mut session = connected();
        let mut raw = capture();
        raw["oci"] = json!(2);
        raw["cpi"] = json!(3200);
        query(&mut session, &raw).unwrap();
        assert_eq!(session.active_slot(), Some(2));
        assert_eq!(session.dpi(), Some(DpiAxes { x: 3200, y: 3200 }));
    }

    #[test]
    fn an_answer_nobody_asked_for_is_ignored() {
        let mut session = connected();
        let mut raw = capture();
        raw["oci"] = json!(3);
        assert_eq!(feed(&mut session, &answer_reports(&raw)), Ok(vec![]));
        assert_eq!(session.active_slot(), Some(0));
    }

    #[test]
    fn a_report_that_does_not_decode_fails_only_a_pending_query() {
        let foreign = [0x11; 64];
        let mut session = connected();
        assert_eq!(session.feed_report(0, &foreign), Ok(vec![]));
        assert_eq!(
            feed(&mut session, &[notify(0x00, &[0x40, 0x06])])
                .unwrap()
                .len(),
            1
        );

        session.begin_query(0).unwrap();
        drain(&mut session).unwrap();
        assert_eq!(
            session.feed_report(0, &foreign),
            Err(RawmError::WrongChannel)
        );
        // A consulta que falhou acabou: outra pode começar.
        assert_eq!(session.begin_query(0), Ok(()));
    }

    #[test]
    fn reports_outside_the_vendor_channel_are_ignored() {
        let mut session = connected();
        assert_eq!(session.feed_report(1, &notify(0x22, &[1])), Ok(vec![]));
        assert_eq!(session.active_slot(), Some(0));
    }

    #[test]
    fn notifications_before_the_first_answer_change_nothing() {
        let mut session = LeviathanV4Session::new();
        let read = feed(
            &mut session,
            &[notify(0x00, &[0x40, 0x06]), notify(0x22, &[1])],
        );
        assert_eq!(read, Ok(vec![]));
        assert_eq!(session.active_slot(), None);
    }

    #[test]
    fn abort_ends_a_pending_query() {
        let mut session = LeviathanV4Session::new();
        session.begin_query(0).unwrap();
        session.abort();
        assert_eq!(session.next_step(), Ok(None));
        assert_eq!(session.begin_query(0), Ok(()));
    }
}
