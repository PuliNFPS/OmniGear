import { DeviceDisconnectedError, type MouseProfile, type MouseSession } from '@gearhub/shared';
import { create } from 'zustand';
import { createMockDriver, type MockMouseDriver } from '../hardware/mockDriver';

type Feedback = { type: 'success' | 'error'; title: string; message: string };

/** Janela de agrupamento do arraste. Um gesto não pode virar quarenta escritas. */
const APPLY_THROTTLE_MS = 100;

interface MouseStore {
  session: MouseSession | null;
  driver: MockMouseDriver | null;
  loading: boolean;
  applying: boolean;
  disconnected: boolean;
  feedback: Feedback | null;
  openMouse(id: string): Promise<void>;
  closeMouse(): void;
  patchDraft(recipe: (draft: MouseProfile) => void): void;
  saveToSlot(index: number): Promise<void>;
  selectSlot(index: number): Promise<void>;
  reconnect(): Promise<void>;
  factoryReset(): Promise<void>;
  dismissFeedback(): void;
}

let applyTimer: ReturnType<typeof setTimeout> | null = null;
let lastConfirmed: MouseProfile | null = null;
/** `onDisconnect` devolve o cancelamento; sem guardá-lo, cada abertura vaza um closure. */
let unsubscribeDisconnect: (() => void) | null = null;

export const useMouseStore = create<MouseStore>((set, get) => {
  async function flushApply(): Promise<void> {
    const { session, driver } = get();
    if (!session || !driver) return;
    const attempted = structuredClone(session.draft);
    set({ applying: true });
    try {
      await driver.applyLive(attempted);
      lastConfirmed = attempted;
      set({ applying: false });
    } catch (error) {
      const revert = lastConfirmed ? structuredClone(lastConfirmed) : attempted;
      set((state) => ({
        applying: false,
        disconnected: error instanceof DeviceDisconnectedError ? true : state.disconnected,
        session: state.session ? { ...state.session, draft: revert } : null,
        feedback:
          error instanceof DeviceDisconnectedError
            ? null
            : {
                type: 'error',
                title: 'Não foi aplicado',
                message: 'A mudança voltou ao valor anterior.',
              },
      }));
    }
  }

  function scheduleApply(): void {
    if (applyTimer) clearTimeout(applyTimer);
    applyTimer = setTimeout(() => {
      applyTimer = null;
      void flushApply();
    }, APPLY_THROTTLE_MS);
  }

  return {
    session: null,
    driver: null,
    loading: false,
    applying: false,
    disconnected: false,
    feedback: null,

    openMouse: async (id) => {
      // Um mouse novo começa com a bancada limpa: sem apply pendente do
      // anterior e sem lastConfirmed que pertence a outro dispositivo.
      if (applyTimer) clearTimeout(applyTimer);
      applyTimer = null;
      lastConfirmed = null;
      set({ loading: true, feedback: null });
      const driver = createMockDriver(id);
      const [identity, capabilities, telemetry, slots] = await Promise.all([
        driver.readIdentity(),
        driver.readCapabilities(),
        driver.readTelemetry(),
        driver.readSlots(),
      ]);
      const activeSlot = slots.find((slot) => slot.profile) ?? slots[0]!;
      const draft = structuredClone(activeSlot.profile ?? emptyProfile());
      lastConfirmed = structuredClone(draft);
      unsubscribeDisconnect?.();
      unsubscribeDisconnect = driver.onDisconnect(() => set({ disconnected: true }));
      set({
        driver,
        loading: false,
        disconnected: false,
        session: {
          id: identity.id,
          name: identity.name,
          manufacturer: identity.manufacturer,
          capabilities,
          telemetry,
          slots,
          activeSlotIndex: activeSlot.index,
          draft,
        },
      });
    },

    closeMouse: () => {
      if (applyTimer) clearTimeout(applyTimer);
      applyTimer = null;
      lastConfirmed = null;
      unsubscribeDisconnect?.();
      unsubscribeDisconnect = null;
      set({ session: null, driver: null, disconnected: false, feedback: null });
    },

    patchDraft: (recipe) => {
      const { session } = get();
      if (!session) return;
      const draft = structuredClone(session.draft);
      recipe(draft);
      set({ session: { ...session, draft } });
      scheduleApply();
    },

    saveToSlot: async (index) => {
      const { session, driver } = get();
      if (!session || !driver) return;
      try {
        await driver.writeSlot(index, session.draft);
        set({
          session: {
            ...session,
            activeSlotIndex: index,
            slots: session.slots.map((slot) =>
              slot.index === index ? { ...slot, profile: structuredClone(session.draft) } : slot,
            ),
          },
          feedback: {
            type: 'success',
            title: 'Salvo',
            message: `Perfil gravado no slot ${index}.`,
          },
        });
      } catch {
        set({
          feedback: { type: 'error', title: 'Não foi salvo', message: 'Tente gravar novamente.' },
        });
      }
    },

    selectSlot: async (index) => {
      const { session } = get();
      if (!session) return;
      const profile = session.slots.find((slot) => slot.index === index)?.profile;
      if (!profile) return;
      const draft = structuredClone(profile);
      set({ session: { ...session, activeSlotIndex: index, draft } });
      scheduleApply();
    },

    reconnect: async () => {
      const { session, driver } = get();
      if (!session || !driver) return;
      set({ disconnected: false });
      await flushApply();
    },

    factoryReset: async () => {
      const { driver } = get();
      if (!driver) return;
      await driver.factoryReset();
      const { session } = get();
      if (!session) return;
      set({
        session: { ...session, slots: session.slots.map((slot) => ({ ...slot, profile: null })) },
        feedback: {
          type: 'success',
          title: 'Restaurado',
          message: 'Os slots do mouse foram limpos.',
        },
      });
    },

    dismissFeedback: () => set({ feedback: null }),
  };
});

function emptyProfile(): MouseProfile {
  return {
    name: 'Novo perfil',
    dpi: {
      stages: [{ id: 's1', x: 800, y: 800, color: 'green' }],
      activeStageId: 's1',
      independentXY: false,
    },
    pollingRate: 1000,
    bindings: {},
    parameters: {
      motionSync: false,
      straightLineCorrection: false,
      rippleCorrection: false,
      longRangeMode: false,
      debounceMs: 0,
      sleepMinutes: 5,
      lodMm: 1,
      sensorRotationDeg: 0,
    },
  };
}
