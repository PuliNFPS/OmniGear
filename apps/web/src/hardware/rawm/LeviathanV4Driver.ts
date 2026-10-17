import type {
  MouseSettings,
  OnboardSlotConfig,
  PeripheralSettings,
  RawmIdentity,
  SessionEvent,
} from '@gearhub/shared';
import { LeviathanV4Session, leviathanQueryTimeoutMs } from '../../core/coreBridge';
import { asRawmError } from '../../core/rawmError';
import { isMouseSettings } from '../../domain/settings';
import type { DeviceDriver, DeviceReport, DeviceState } from '../deviceDriver';
import type { HardwareTransport } from '../WebHidTransport';

function mouseSettings(settings: PeripheralSettings): MouseSettings {
  if (!isMouseSettings(settings))
    throw new TypeError('O Leviathan V4 requer configuracao de mouse.');
  return settings;
}

function pause(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * A casca do Leviathan V4: fila, bomba e ouvintes. Toda decisão — o que o
 * mouse tem, o que enviar, quando parar — é da sessão do núcleo; aqui só se
 * executa o passo que ela pede e se repassa o que o mouse anuncia.
 *
 * The vendor's Onboard config dropdown is an editing cursor, not a switch. No
 * mouse-side switch command has been verified: IQ_SET_PROFILE_ID (0x40) belongs
 * to HS keyboards; see docs/rawm-onboard-config.md §5. Notification 0x22 and
 * readState supply the active index independently.
 */
export class LeviathanV4Driver implements DeviceDriver {
  private readonly session = new LeviathanV4Session();
  private tail: Promise<void> = Promise.resolve();
  private readonly slotListeners = new Set<(slots: OnboardSlotConfig[]) => void>();
  private readonly reportListeners = new Set<(report: DeviceReport) => void>();
  /** Quem espera a resposta da consulta em andamento. */
  private answered: ((result: RawmIdentity | Error) => void) | null = null;
  /**
   * Sobe quando uma consulta estoura o tempo. Uma bomba de geração antiga — a
   * da consulta abandonada, ainda presa num envio — para sem tocar a sessão,
   * que a essa altura pode estar com outra operação.
   */
  private generation = 0;
  private readonly unsubscribe: () => void;

  /**
   * Ouve o transporte antes de qualquer consulta: o dump responde à mesma
   * consulta, e um único leitor desde o primeiro relatório é o que garante
   * pegá-lo.
   */
  constructor(
    private readonly transport: HardwareTransport,
    private readonly queryTimeoutMs = leviathanQueryTimeoutMs(),
  ) {
    this.unsubscribe = transport.onInputReport((reportId, report) =>
      this.receive(reportId, report),
    );
  }

  /** Para de ouvir o transporte. O `connect` chama quando a consulta falha. */
  close(): void {
    this.unsubscribe();
  }

  /** Consulta o mouse. A primeira resposta liga a sessão; as seguintes a atualizam. */
  query(epochSeconds?: number): Promise<RawmIdentity> {
    return this.enqueue(() => this.runQuery(epochSeconds));
  }

  readState(): Promise<DeviceState> {
    return this.enqueue(async () => {
      await this.runQuery();
      const slot = this.session.activeSlot();
      const dpi = this.session.dpi();
      if (slot === null || dpi === null) throw asRawmError(new Error('not-queried'));
      return { activeProfileSlot: slot + 1, dpi };
    });
  }

  /** The mouse announces a DPI cycled by its own button; the editor follows. */
  onDeviceReport(listener: (report: DeviceReport) => void): () => void {
    this.reportListeners.add(listener);
    const slot = this.session.activeSlot();
    const dpi = this.session.dpi();
    if (slot !== null) listener({ kind: 'active-profile', slotIndex: slot + 1 });
    if (dpi !== null) listener({ kind: 'dpi', value: dpi.x, y: dpi.y });
    return () => {
      this.reportListeners.delete(listener);
    };
  }

  /**
   * The mappings each onboard slot holds. A dump already collected is replayed
   * at once, so a subscriber that arrives late still gets it.
   */
  onOnboardProfiles(listener: (slots: OnboardSlotConfig[]) => void): () => void {
    this.slotListeners.add(listener);
    const slots = this.session.slots();
    if (slots) listener(slots);
    return () => {
      this.slotListeners.delete(listener);
    };
  }

  /** Applies to the session without touching flash; the core decides what goes. */
  applyToSession(settings: PeripheralSettings): Promise<void> {
    return this.enqueue(async () => {
      this.session.beginApply(mouseSettings(settings));
      await this.pump();
    });
  }

  /** Writes an onboard profile, which persists. `slotIndex` counts from 1. */
  writeProfile(slotIndex: number, _name: string, settings: PeripheralSettings): Promise<void> {
    // O TypeScript não tem tipo inteiro, e o núcleo recebe `u32`: o que passasse
    // disso daria a volta. O resto da faixa quem confere é o núcleo.
    if (!Number.isInteger(slotIndex) || slotIndex < 1 || slotIndex > 2 ** 32) {
      return Promise.reject(asRawmError(new Error('invalid-profile-slot')));
    }
    return this.enqueue(async () => {
      this.session.beginWriteProfile(slotIndex - 1, mouseSettings(settings));
      await this.pump();
    });
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const current = this.tail.then(operation, operation);
    this.tail = current.then(
      () => undefined,
      () => undefined,
    );
    return current;
  }

  private receive(reportId: number, report: Uint8Array): void {
    let events: SessionEvent[];
    try {
      events = this.session.feedReport(reportId, report);
    } catch (error) {
      // O núcleo só falha aqui com uma consulta pendente, e já a encerrou.
      this.answered?.(error instanceof Error ? error : new Error(String(error)));
      return;
    }
    for (const event of events) this.dispatch(event);
  }

  private dispatch(event: SessionEvent): void {
    switch (event.kind) {
      case 'queried':
        this.answered?.(event);
        return;
      case 'dpi':
        for (const listener of this.reportListeners) {
          listener({ kind: 'dpi', value: event.x, y: event.y });
        }
        return;
      case 'active-slot':
        for (const listener of this.reportListeners) {
          listener({ kind: 'active-profile', slotIndex: event.index + 1 });
        }
        return;
      case 'onboard-slots':
        for (const listener of this.slotListeners) listener(event.slots);
        return;
    }
  }

  private runQuery(epochSeconds?: number): Promise<RawmIdentity> {
    return new Promise<RawmIdentity>((resolve, reject) => {
      let settled = false;
      const finish = (result: RawmIdentity | Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.answered = null;
        if (result instanceof Error) reject(result);
        else resolve(result);
      };
      // O tempo conta desde antes de abrir o dispositivo.
      const timer = setTimeout(() => {
        this.generation += 1;
        this.session.abort();
        finish(new Error('A consulta RAWM excedeu o tempo limite.'));
      }, this.queryTimeoutMs);
      this.answered = finish;
      void (async () => {
        try {
          await this.transport.open();
          if (settled) return;
          this.session.beginQuery(epochSeconds);
          await this.pump();
        } catch (error) {
          finish(
            error instanceof Error ? error : new Error('Falha ao consultar o dispositivo RAWM.'),
          );
        }
      })();
    });
  }

  /** Executa os passos que a sessão pede, até ela não ter mais nenhum. */
  private async pump(): Promise<void> {
    const generation = this.generation;
    try {
      for (let step = this.session.nextStep(); step; step = this.session.nextStep()) {
        if (step.kind === 'send') {
          await this.transport.send({ reportId: step.reportId, data: step.data });
        } else {
          await pause(step.ms);
        }
        if (generation !== this.generation) return;
      }
    } catch (error) {
      if (generation === this.generation) this.session.abort();
      throw error;
    }
  }
}
