import type { MouseCapabilities } from './capabilities';
import type { MouseProfile } from './profile';
import type { ProfileSlot } from './session';
import type { MouseTelemetry } from './telemetry';

/** Distingue "a escrita falhou" de "o mouse sumiu". A UI reage diferente a cada uma. */
export class DeviceDisconnectedError extends Error {
  constructor(message = 'O mouse foi desconectado') {
    super(message);
    this.name = 'DeviceDisconnectedError';
  }
}

export interface MouseIdentity {
  id: string;
  name: string;
  manufacturer: string;
}

export interface MouseDriver {
  /** Nome e fabricante vêm do driver: não são configuração nem telemetria. */
  readIdentity(): Promise<MouseIdentity>;
  readCapabilities(): Promise<MouseCapabilities>;
  readTelemetry(): Promise<MouseTelemetry>;
  readSlots(): Promise<ProfileSlot[]>;
  /**
   * Recebe o perfil inteiro de propósito: o adapter faz o diff contra o último
   * perfil aplicado e decide o que enviar. A UI nunca sabe o que é um report.
   */
  applyLive(profile: MouseProfile): Promise<void>;
  writeSlot(index: number, profile: MouseProfile): Promise<void>;
  factoryReset(): Promise<void>;
  /** Devolve a função de cancelamento da subscrição. */
  onDisconnect(listener: () => void): () => void;
}
