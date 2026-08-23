import init, { core_version, is_wasm_available } from 'gearhub-core-wasm';

export interface CoreStatus {
  version: string;
  wasm: boolean;
}

export async function loadCore(): Promise<CoreStatus> {
  await init();
  return { version: core_version(), wasm: is_wasm_available() };
}
