import {
  DeviceDisconnectedError,
  type MouseCapabilities,
  type MouseDriver,
  type MouseProfile,
  type MouseTelemetry,
  type ProfileSlot,
} from '@gearhub/shared';
import { mockMice, type MockMouse } from '../mocks/mice';

export interface MouseSummary {
  id: string;
  name: string;
  manufacturer: string;
  batteryPercent?: number;
  connection: MouseTelemetry['connection'];
}

export interface MockMouseDriver extends MouseDriver {
  simulateDisconnect(): void;
  simulateReconnect(): void;
  failNextWrite(): void;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function listMockMice(): Promise<MouseSummary[]> {
  await wait(400);
  return mockMice.map((mouse) => ({
    id: mouse.id,
    name: mouse.name,
    manufacturer: mouse.manufacturer,
    batteryPercent: mouse.telemetry.batteryPercent,
    connection: mouse.telemetry.connection,
  }));
}

export function createMockDriver(mouseId: string): MockMouseDriver {
  const mouse: MockMouse | undefined = mockMice.find((candidate) => candidate.id === mouseId);
  if (!mouse) throw new Error(`Mouse mock desconhecido: ${mouseId}`);

  const state = structuredClone(mouse);
  const listeners = new Set<() => void>();
  let connected = true;
  let failNext = false;

  function guard(): void {
    if (!connected) throw new DeviceDisconnectedError();
    if (failNext) {
      failNext = false;
      throw new Error('A gravação falhou');
    }
  }

  return {
    async readIdentity() {
      await wait(40);
      return { id: state.id, name: state.name, manufacturer: state.manufacturer };
    },
    async readCapabilities(): Promise<MouseCapabilities> {
      await wait(120);
      return structuredClone(state.capabilities);
    },
    async readTelemetry(): Promise<MouseTelemetry> {
      await wait(80);
      return structuredClone(state.telemetry);
    },
    async readSlots(): Promise<ProfileSlot[]> {
      await wait(120);
      return state.slots.map((profile, index) => ({
        index: index + 1,
        profile: profile ? structuredClone(profile) : null,
      }));
    },
    async applyLive(profile: MouseProfile): Promise<void> {
      await wait(60);
      guard();
      void profile;
    },
    async writeSlot(index: number, profile: MouseProfile): Promise<void> {
      await wait(240);
      guard();
      state.slots[index - 1] = structuredClone(profile);
    },
    async factoryReset(): Promise<void> {
      await wait(400);
      guard();
      state.slots = state.slots.map(() => null);
    },
    onDisconnect(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    simulateDisconnect(): void {
      connected = false;
      for (const listener of listeners) listener();
    },
    simulateReconnect(): void {
      connected = true;
    },
    failNextWrite(): void {
      failNext = true;
    },
  };
}
