import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The encoders are called synchronously, from the driver, with no await in
 * sight. The wasm-bindgen glue that `pnpm core:build` generates throws on
 * every call made before `init()` resolves — that is what left the editor
 * saying "não foi possível aplicar os ajustes" on every change (the
 * 2026-09-07 bug fixed in PR #7).
 *
 * So readiness has to be something the app can await once, before it renders.
 */

const { init } = vi.hoisted(() => ({ init: vi.fn(async () => undefined) }));

vi.mock('gearhub-core-wasm', () => ({
  default: init,
  core_version: () => '0.0.0-test',
  is_wasm_available: () => true,
  encode_action: () => new Uint8Array(),
  encode_config_reset: () => new Uint8Array(),
  encode_mouse_function: () => new Uint8Array(),
  encode_mouse_key: () => new Uint8Array(),
  encode_mouse_param_snapshot: () => new Uint8Array(),
}));

beforeEach(() => {
  vi.resetModules();
  init.mockClear();
});

describe('ensureCoreReady', () => {
  it('initialises the module once however many callers ask at once', async () => {
    const { ensureCoreReady } = await import('./coreBridge');

    await Promise.all([ensureCoreReady(), ensureCoreReady(), ensureCoreReady()]);

    expect(init).toHaveBeenCalledTimes(1);
  });

  it('does not initialise again on a later call', async () => {
    const { ensureCoreReady } = await import('./coreBridge');

    await ensureCoreReady();
    await ensureCoreReady();

    expect(init).toHaveBeenCalledTimes(1);
  });

  /** The status panel must not start a second initialisation of its own. */
  it('is what loadCore waits on', async () => {
    const { ensureCoreReady, loadCore } = await import('./coreBridge');

    await ensureCoreReady();
    const status = await loadCore();

    expect(init).toHaveBeenCalledTimes(1);
    expect(status).toEqual({ version: '0.0.0-test', wasm: true });
  });

  /** A failed initialisation must not be cached as if it had succeeded. */
  it('tries again after a failed initialisation', async () => {
    init.mockRejectedValueOnce(new Error('wasm indisponível'));
    const { ensureCoreReady } = await import('./coreBridge');

    await expect(ensureCoreReady()).rejects.toThrow('wasm indisponível');
    await ensureCoreReady();

    expect(init).toHaveBeenCalledTimes(2);
  });
});
