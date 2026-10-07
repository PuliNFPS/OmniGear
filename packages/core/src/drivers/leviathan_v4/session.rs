//! A sessão do Leviathan V4: o que o mouse tem agora, e o que enviar a seguir.
//!
//! O núcleo não faz I/O e é síncrono: não envia nem espera nada. Ele decide o
//! próximo passo no instante em que a casca o pede (`next_step`), e a casca o
//! executa; o que chega do mouse entra por `feed_report`. Pedir um passo por
//! vez é o que deixa o núcleo ver, entre dois passos, uma troca de memória ou
//! um DPI que o mouse anunciou — ver `## A forma do passo 5` em
//! `docs/superpowers/specs/2026-09-07-nucleo-rust-ponte-design.md`.

use std::collections::VecDeque;

use serde::Serialize;
use serde_json::Value;

use super::apply::apply_settings;
use super::description::{DpiAxes, onboard_slot_count};
use super::identity::is_device_name;
use super::mappings::{
    Signature, intended_signature, mapping_events, preserved_events, reported_signature,
};
use crate::command::HidCommand;
use crate::device::MouseSettings;
use crate::protocols::rawm::json::integer;
use crate::protocols::rawm::{
    MouseParamSnapshot, OnboardConfigCollector, OnboardSlotConfig, RawEventAssembler, RawmError,
    RawmIdentity, RawmNotification, build_query_event, decode_report_chunk, dpi_axes,
    encode_mouse_param_body, frame_event, is_query_result, parse_mouse_param_snapshot,
    parse_notification, parse_query_answer, with_protocol_envelope,
};
use crate::{encode_action, encode_config_reset, encode_mouse_param_snapshot};

/// Quanto a casca espera a resposta de uma consulta, contando a abertura do dispositivo.
pub const QUERY_TIMEOUT_MS: u32 = 1000;

/// A pausa depois de cada evento escrito, a do driver confirmado em hardware.
const EVENT_PAUSE_MS: u32 = 8;

/// Abre (`1 | memória << 8`) e fecha (`0`) a gravação de uma memória na flash.
const ACTION_SAVE_CONFIG_TO_FDS: u8 = 0x34;

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
    crc_supported: bool,
    slot_count: u32,
    snapshot: MouseParamSnapshot,
    active_slot: u8,
}

#[derive(Debug)]
struct Query {
    reports: VecDeque<Report>,
}

/// Os blocos de uma escrita, na ordem do driver confirmado em hardware. Cada
/// um é decidido quando começa, não quando a escrita começa.
#[derive(Debug)]
enum Block {
    Reset,
    SaveOpen(u32),
    /// Do início do corpo até o fim, o mouse não guarda nem o conjunto velho nem o novo.
    ClearSignature,
    Parameters,
    Mappings,
    Preserved,
    CommitSignature,
    SaveClose,
}

/// Um evento a enviar. O de parâmetros leva o snapshot que escreve.
#[derive(Debug)]
struct Outgoing {
    event: Vec<u8>,
    writes: Option<MouseParamSnapshot>,
}

impl Outgoing {
    fn plain(event: Vec<u8>) -> Self {
        Self {
            event,
            writes: None,
        }
    }
}

#[derive(Debug)]
struct Write {
    settings: MouseSettings,
    intended: Signature,
    /// A memória cujas entradas sem nome são reenviadas.
    target_slot: u8,
    /// A revisão de memória do início. Só a aplicação à sessão a confere.
    guard: Option<u64>,
    blocks: VecDeque<Block>,
    events: VecDeque<Outgoing>,
    reports: VecDeque<Report>,
    pause_owed: bool,
    /// O snapshot que o evento no ar escreve, e a revisão de DPI de quando foi calculado.
    in_flight: Option<(MouseParamSnapshot, u64)>,
}

impl Write {
    fn new(
        settings: &MouseSettings,
        intended: Signature,
        target_slot: u8,
        guard: Option<u64>,
        blocks: Vec<Block>,
    ) -> Self {
        Self {
            settings: settings.clone(),
            intended,
            target_slot,
            guard,
            blocks: blocks.into(),
            events: VecDeque::new(),
            reports: VecDeque::new(),
            pause_owed: false,
            in_flight: None,
        }
    }
}

#[derive(Debug)]
enum Operation {
    /// Enviando a consulta, ou esperando a resposta.
    Query(Query),
    Write(Box<Write>),
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
    /// O que o mouse guarda na memória ativa. `None` quando não se sabe — e
    /// então a próxima aplicação reescreve tudo.
    applied: Option<Signature>,
    /// Sobe a cada DPI anunciado; resolve a corrida com o bloco de parâmetros.
    dpi_revision: u64,
    /// Sobe quando o mouse anuncia outra memória; é o que a guarda confere.
    slot_revision: u64,
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

    /// Começa a aplicar `settings` à sessão, sem tocar a flash: desligar o
    /// mouse devolve o que está gravado. Os mapeamentos só sobrevivem dentro
    /// do bloco que o `CONFIG_RESET` abre, então vão inteiros sempre que
    /// mudam; quando só um parâmetro mudou, o bloco de parâmetros vai sozinho.
    pub fn begin_apply(&mut self, settings: &MouseSettings) -> Result<(), RawmError> {
        self.ensure_idle()?;
        let device = self.device()?;
        let target_slot = device.active_slot;
        let intended = match validate(device, settings) {
            Ok(intended) => intended,
            Err(error) => {
                // O driver zerava a assinatura em qualquer falha da aplicação.
                self.applied = None;
                return Err(error);
            }
        };
        let blocks = if self.applied.as_ref() == Some(&intended) {
            vec![Block::Parameters]
        } else {
            vec![
                Block::Reset,
                Block::ClearSignature,
                Block::Parameters,
                Block::Mappings,
                Block::Preserved,
                Block::CommitSignature,
            ]
        };
        let write = Write::new(
            settings,
            intended,
            target_slot,
            Some(self.slot_revision),
            blocks,
        );
        self.operation = Some(Operation::Write(Box::new(write)));
        Ok(())
    }

    /// Começa a gravar `settings` na memória `slot`, contando de 0. Grava na
    /// flash: os `SAVE` em volta do corpo são o que confirma a gravação. O
    /// conjunto vai inteiro sempre — o reset dentro do colchete gravaria a
    /// memória sem mapeamentos.
    pub fn begin_write_profile(
        &mut self,
        slot: u32,
        settings: &MouseSettings,
    ) -> Result<(), RawmError> {
        self.ensure_idle()?;
        let device = self.device()?;
        if slot >= device.slot_count {
            return Err(RawmError::InvalidProfileSlot);
        }
        let intended = validate(device, settings)?;
        let blocks = vec![
            Block::Reset,
            Block::SaveOpen(slot),
            Block::ClearSignature,
            Block::Parameters,
            Block::Mappings,
            Block::Preserved,
            Block::CommitSignature,
            Block::SaveClose,
        ];
        // Sem guarda: a gravação escolhe a memória, em vez de escrever na ativa.
        let write = Write::new(settings, intended, slot as u8, None, blocks);
        self.operation = Some(Operation::Write(Box::new(write)));
        Ok(())
    }

    /// O próximo passo da operação em andamento; `None` quando não há o que
    /// fazer. Numa aplicação à sessão, falha com `ActiveSlotChanged` se o
    /// mouse trocou de memória desde o início — e a operação acaba.
    pub fn next_step(&mut self) -> Result<Option<Step>, RawmError> {
        match self.operation.take() {
            None => Ok(None),
            Some(Operation::Query(mut query)) => {
                let step = query.reports.pop_front().map(send);
                // Continua pendente depois do último envio, até a resposta chegar.
                self.operation = Some(Operation::Query(query));
                Ok(step)
            }
            Some(Operation::Write(mut write)) => match self.advance(&mut write) {
                Ok(Some(step)) => {
                    self.operation = Some(Operation::Write(write));
                    Ok(Some(step))
                }
                Ok(None) => Ok(None),
                Err(error) => {
                    // Uma escrita interrompida deixa o mouse sem o conjunto velho e sem o novo.
                    self.applied = None;
                    Err(error)
                }
            },
        }
    }

    /// Encerra a operação em andamento. Sem operação, nada. Uma escrita
    /// encerrada zera a assinatura. Uma consulta encerrada não mexe nela, mas
    /// descarta a resposta pela metade que o montador guarda: uma resposta
    /// cortada pelo tempo-limite não pode emendar bytes na próxima.
    pub fn abort(&mut self) {
        match self.operation.take() {
            Some(Operation::Write(_)) => self.applied = None,
            // Uma resposta cortada pelo tempo-limite não pode emendar bytes na próxima.
            Some(Operation::Query(_)) => self.assembler.reset(),
            None => {}
        }
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

    fn device(&self) -> Result<&Device, RawmError> {
        self.device.as_ref().ok_or(RawmError::NotQueried)
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
                    crc_supported: identity.crc_supported,
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
        self.applied = self.active_signature();
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
                // Só uma memória diferente conta como troca; o evento sai de qualquer jeito.
                if index != device.active_slot {
                    self.slot_revision += 1;
                }
                device.active_slot = index;
                self.applied = self.active_signature();
                Some(SessionEvent::ActiveSlot { index })
            }
            RawmNotification::OnboardConfig(payload) => {
                let slots = self.collector.push(&payload)?;
                self.slots = Some(slots.clone());
                self.applied = self.active_signature();
                Some(SessionEvent::OnboardSlots { slots })
            }
        }
    }

    /// O snapshot acompanha todo DPI anunciado; o evento só sai com os dois eixos.
    fn dpi_announced(&mut self, value: u32) -> Option<SessionEvent> {
        let device = self.device.as_mut()?;
        device.snapshot.resolution = value;
        self.dpi_revision += 1;
        let announced = axes(value);
        (announced.x != 0 && announced.y != 0).then_some(SessionEvent::Dpi(announced))
    }

    fn active_signature(&self) -> Option<Signature> {
        let active = self.device.as_ref()?.active_slot;
        self.slots
            .as_ref()?
            .iter()
            .find(|slot| slot.index == active)
            .map(reported_signature)
    }

    fn advance(&mut self, write: &mut Write) -> Result<Option<Step>, RawmError> {
        loop {
            // Antes de qualquer decisão: antes de cada relatório, depois de
            // cada pausa e antes do fim — o `checkSlot()` do driver.
            if write
                .guard
                .is_some_and(|revision| revision != self.slot_revision)
            {
                return Err(RawmError::ActiveSlotChanged);
            }
            if let Some(report) = write.reports.pop_front() {
                return Ok(Some(send(report)));
            }
            if write.pause_owed {
                write.pause_owed = false;
                return Ok(Some(Step::Wait { ms: EVENT_PAUSE_MS }));
            }
            // O evento no ar terminou, pausa incluída.
            if let Some((next, revision)) = write.in_flight.take() {
                self.commit_snapshot(next, revision);
            }
            if let Some(outgoing) = write.events.pop_front() {
                let event = with_protocol_envelope(&outgoing.event, self.device()?.crc_supported)?;
                write.reports = frame_event(&event, true).into();
                write.pause_owed = true;
                write.in_flight = outgoing
                    .writes
                    .map(|snapshot| (snapshot, self.dpi_revision));
                continue;
            }
            match write.blocks.pop_front() {
                Some(block) => self.open(block, write)?,
                None => return Ok(None),
            }
        }
    }

    fn open(&mut self, block: Block, write: &mut Write) -> Result<(), RawmError> {
        match block {
            Block::Reset => write
                .events
                .push_back(Outgoing::plain(encode_config_reset())),
            Block::SaveOpen(slot) => write.events.push_back(Outgoing::plain(encode_action(
                ACTION_SAVE_CONFIG_TO_FDS,
                1 | (slot << 8),
            ))),
            Block::SaveClose => write
                .events
                .push_back(Outgoing::plain(encode_action(ACTION_SAVE_CONFIG_TO_FDS, 0))),
            Block::ClearSignature => self.applied = None,
            Block::Parameters => {
                let next = apply_settings(&self.device()?.snapshot, &write.settings)?;
                let event = encode_mouse_param_snapshot(&encode_mouse_param_body(&next));
                write.events.push_back(Outgoing {
                    event,
                    writes: Some(next),
                });
            }
            Block::Mappings => write.events.extend(
                mapping_events(&write.settings)?
                    .into_iter()
                    .map(Outgoing::plain),
            ),
            Block::Preserved => {
                let slot = self
                    .slots
                    .as_ref()
                    .and_then(|slots| slots.iter().find(|slot| slot.index == write.target_slot));
                write.events.extend(
                    preserved_events(&write.settings, slot)?
                        .into_iter()
                        .map(Outgoing::plain),
                );
            }
            Block::CommitSignature => self.applied = Some(write.intended.clone()),
        }
        Ok(())
    }

    fn commit_snapshot(&mut self, next: MouseParamSnapshot, revision: u64) {
        let unchanged = revision == self.dpi_revision;
        if let Some(device) = self.device.as_mut() {
            device.snapshot = if unchanged {
                next
            } else {
                // Um DPI anunciado durante o envio é mais novo que o enviado.
                MouseParamSnapshot {
                    resolution: device.snapshot.resolution,
                    ..next
                }
            };
        }
    }
}

/// Confere as configurações antes de qualquer byte: o que falharia no meio
/// da escrita falha aqui, sem deixar o mouse com o conjunto pela metade.
fn validate(device: &Device, settings: &MouseSettings) -> Result<Signature, RawmError> {
    let intended = intended_signature(settings)?;
    apply_settings(&device.snapshot, settings)?;
    Ok(intended)
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
    use crate::device::MouseActionId;
    use crate::drivers::leviathan_v4::describe;
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

    fn defaults() -> MouseSettings {
        describe(&capture()).unwrap().defaults
    }

    fn polling_500() -> MouseSettings {
        MouseSettings {
            polling_rate: 500,
            ..defaults()
        }
    }

    fn waits(steps: &[Step]) -> usize {
        steps
            .iter()
            .filter(|step| matches!(step, Step::Wait { .. }))
            .count()
    }

    /// Um dump em que cada memória de `slots` guarda o que `settings` escreveria.
    fn held_dump(session: &mut LeviathanV4Session, slots: &[u8], settings: &MouseSettings) {
        let mut reports = Vec::new();
        for &slot in slots {
            reports.push(notify(0x14, &[slot]));
            for event in mapping_events(settings).unwrap() {
                reports.push(notify(
                    0x14,
                    &with_protocol_envelope(&event, false).unwrap(),
                ));
            }
        }
        reports.push(notify(0x14, &[0xff]));
        feed(session, &reports).unwrap();
    }

    #[test]
    fn writing_before_the_first_answer_is_refused() {
        let mut session = LeviathanV4Session::new();
        assert_eq!(session.begin_apply(&defaults()), Err(RawmError::NotQueried));
        assert_eq!(
            session.begin_write_profile(0, &defaults()),
            Err(RawmError::NotQueried)
        );
    }

    #[test]
    fn one_operation_at_a_time() {
        let mut session = connected();
        session.begin_apply(&defaults()).unwrap();
        assert_eq!(
            session.begin_apply(&defaults()),
            Err(RawmError::OperationInProgress)
        );
        assert_eq!(session.begin_query(0), Err(RawmError::OperationInProgress));
    }

    #[test]
    fn every_event_ends_with_a_pause() {
        let mut session = connected();
        session.begin_apply(&defaults()).unwrap();
        let steps = drain(&mut session).unwrap();
        assert_eq!(steps.last(), Some(&Step::Wait { ms: 8 }));
        // Reset, parâmetros, os mapeamentos e a sétima tecla.
        assert!(waits(&steps) > 8);
    }

    #[test]
    fn a_held_mapping_set_lets_the_parameters_go_alone() {
        let mut session = connected();
        held_dump(&mut session, &[0], &defaults());
        session.begin_apply(&polling_500()).unwrap();
        assert_eq!(waits(&drain(&mut session).unwrap()), 1);
    }

    #[test]
    fn invalid_settings_fail_before_any_byte_and_force_a_full_rewrite() {
        let mut session = connected();
        held_dump(&mut session, &[0], &defaults());
        let mut broken = defaults();
        broken
            .buttons
            .insert("inexistente".into(), MouseActionId::CliqueEsquerdo);
        assert_eq!(
            session.begin_apply(&broken),
            Err(RawmError::UnknownButton {
                button: "inexistente".into()
            })
        );
        assert_eq!(session.next_step(), Ok(None));
        session.begin_apply(&polling_500()).unwrap();
        assert!(waits(&drain(&mut session).unwrap()) > 1);
    }

    #[test]
    fn a_memory_change_mid_apply_stops_it_and_forces_a_full_rewrite() {
        let mut session = connected();
        // As duas memórias guardam o mesmo: só a falha explica uma reescrita completa.
        held_dump(&mut session, &[0, 1], &defaults());
        session.begin_apply(&polling_500()).unwrap();
        assert!(matches!(session.next_step(), Ok(Some(Step::Send(_)))));
        feed(&mut session, &[notify(0x22, &[1])]).unwrap();
        assert_eq!(session.next_step(), Err(RawmError::ActiveSlotChanged));
        assert_eq!(session.next_step(), Ok(None));
        session.begin_apply(&polling_500()).unwrap();
        assert!(waits(&drain(&mut session).unwrap()) > 1);
    }

    #[test]
    fn the_guard_also_fires_during_the_last_pause() {
        let mut session = connected();
        held_dump(&mut session, &[0, 1], &defaults());
        session.begin_apply(&polling_500()).unwrap();
        let mut step = session.next_step().unwrap();
        while matches!(step, Some(Step::Send(_))) {
            step = session.next_step().unwrap();
        }
        assert_eq!(step, Some(Step::Wait { ms: 8 }));
        feed(&mut session, &[notify(0x22, &[1])]).unwrap();
        assert_eq!(session.next_step(), Err(RawmError::ActiveSlotChanged));
    }

    #[test]
    fn the_same_memory_announced_again_does_not_stop_an_apply() {
        let mut session = connected();
        session.begin_apply(&defaults()).unwrap();
        session.next_step().unwrap();
        feed(&mut session, &[notify(0x22, &[0])]).unwrap();
        assert!(drain(&mut session).is_ok());
    }

    #[test]
    fn a_profile_write_is_not_guarded() {
        let mut session = connected();
        session.begin_write_profile(2, &defaults()).unwrap();
        session.next_step().unwrap();
        feed(&mut session, &[notify(0x22, &[1])]).unwrap();
        assert!(drain(&mut session).is_ok());
    }

    #[test]
    fn a_profile_write_beyond_the_memories_is_refused() {
        let mut session = connected();
        assert_eq!(
            session.begin_write_profile(4, &defaults()),
            Err(RawmError::InvalidProfileSlot)
        );
        assert_eq!(session.next_step(), Ok(None));
    }

    #[test]
    fn the_written_dpi_becomes_the_session_dpi() {
        let mut session = connected();
        let mut settings = defaults();
        let last = settings.dpi_stages.last().unwrap().id.clone();
        settings.active_stage_id = last;
        let written = apply_settings(&parse_mouse_param_snapshot(&capture()).unwrap(), &settings)
            .unwrap()
            .resolution;
        session.begin_apply(&settings).unwrap();
        drain(&mut session).unwrap();
        assert_eq!(session.dpi(), Some(axes(written)));
    }

    #[test]
    fn a_dpi_announced_while_the_parameters_go_out_wins() {
        let mut session = connected();
        held_dump(&mut session, &[0], &defaults());
        session.begin_apply(&polling_500()).unwrap();
        assert!(matches!(session.next_step(), Ok(Some(Step::Send(_)))));
        // 1234 DPI: nenhum estágio tem esse valor.
        feed(&mut session, &[notify(0x00, &[0xd2, 0x04])]).unwrap();
        drain(&mut session).unwrap();
        assert_eq!(session.dpi(), Some(DpiAxes { x: 1234, y: 1234 }));
    }

    #[test]
    fn abort_ends_a_write_and_forces_a_full_rewrite() {
        let mut session = connected();
        held_dump(&mut session, &[0], &defaults());
        session.begin_apply(&polling_500()).unwrap();
        session.next_step().unwrap();
        session.abort();
        assert_eq!(session.next_step(), Ok(None));
        session.begin_apply(&polling_500()).unwrap();
        assert!(waits(&drain(&mut session).unwrap()) > 1);
    }

    #[test]
    fn abort_while_idle_or_querying_keeps_what_the_mouse_holds() {
        let mut session = connected();
        held_dump(&mut session, &[0], &defaults());
        session.abort();
        session.begin_query(0).unwrap();
        session.abort();
        session.begin_apply(&polling_500()).unwrap();
        assert_eq!(waits(&drain(&mut session).unwrap()), 1);
    }

    #[test]
    fn abort_of_a_query_drops_a_half_received_answer() {
        let mut session = connected();
        session.begin_query(0).unwrap();
        drain(&mut session).unwrap();
        let reports = answer_reports(&capture());
        feed(&mut session, &reports[..2]).unwrap();
        session.abort();
        session.begin_query(0).unwrap();
        drain(&mut session).unwrap();
        let events = feed(&mut session, &reports).unwrap();
        assert!(matches!(events.last(), Some(SessionEvent::Queried(_))));
    }

    #[test]
    fn notifications_move_the_state_not_only_the_events() {
        let mut session = connected();
        feed(&mut session, &[notify(0x22, &[2])]).unwrap();
        assert_eq!(session.active_slot(), Some(2));
        // Fora da faixa: são 4 memórias.
        feed(&mut session, &[notify(0x22, &[4])]).unwrap();
        assert_eq!(session.active_slot(), Some(2));
        // Eixo X zerado: sem evento, mas o snapshot acompanha.
        let events = feed(&mut session, &[notify(0x06, &[0, 0, 0x40, 0x06])]).unwrap();
        assert!(events.is_empty());
        assert_eq!(session.dpi(), Some(axes(0x0640_0000)));
        assert_eq!(session.slots(), None);
        feed(
            &mut session,
            &[
                notify(0x14, &[0]),
                notify(
                    0x14,
                    &[0x03, 0x0a, 0x16, 0x01, 0x0a, 0x00, 0x01, 0x01, 0x00, 0x00],
                ),
                notify(0x14, &[0xff]),
            ],
        )
        .unwrap();
        let slots = session.slots().expect("dump terminou");
        assert_eq!(slots.len(), 1);
        assert_eq!(slots[0].index, 0);
        assert_eq!(slots[0].bindings.len(), 1);
    }

    #[test]
    fn a_malformed_report_resets_a_half_assembled_event() {
        let mut session = connected();
        let reports = answer_reports(&capture());
        feed(&mut session, &reports[..2]).unwrap();
        assert_eq!(session.feed_report(0, &[0x11; 64]), Ok(vec![]));
        let events = feed(&mut session, &[notify(0x00, &[0x40, 0x06])]).unwrap();
        assert_eq!(events.len(), 1);
        assert!(matches!(events[0], SessionEvent::Dpi(_)));
    }
}
