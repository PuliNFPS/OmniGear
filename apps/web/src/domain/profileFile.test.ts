import { describe, expect, it } from 'vitest';
import { createDemoKeyboard, createDemoMouse } from '../hardware/demoDevices';
import { buildProfileFile, profileFileName, readProfileFile } from './profileFile';

const mouse = createDemoMouse();
const keyboard = createDemoKeyboard();
const exported = buildProfileFile(mouse, 'Perfil 1', mouse.defaults);

describe('readProfileFile', () => {
  it.each([
    { dpiStages: null },
    { dpiStages: [null] },
    { parameters: undefined },
    { buttons: { ...mouse.defaults.buttons, esquerdo: 'unknown-action' } },
    { buttons: {} },
    { dpiStages: [{ id: 'a', x: 101, y: 101 }], activeStageId: 'a' },
    { dpiStages: Array(8).fill(mouse.defaults.dpiStages[0]) },
    { parameters: { ...mouse.defaults.parameters, motionSync: 'true' } },
    { parameters: { ...mouse.defaults.parameters, sensorRotation: 999 } },
  ])('rejects malformed mouse settings without throwing: %j', (patch) => {
    expect(
      readProfileFile({ ...exported, ajustes: { ...mouse.defaults, ...patch } }, mouse).ok,
    ).toBe(false);
  });

  it.each([
    { keymap: null },
    { keymap: { KeyA: 'unknown-action' } },
    { keymap: { Fn: 'KeyA' } },
    { lighting: { effectId: 'estatico' } },
    { lighting: { ...keyboard.defaults.lighting, color: 'invalid' } },
    { lighting: { ...keyboard.defaults.lighting, brightness: 101 } },
  ])('rejects malformed keyboard settings without throwing: %j', (patch) => {
    const file = buildProfileFile(keyboard, 'Perfil', keyboard.defaults);
    expect(
      readProfileFile({ ...file, ajustes: { ...keyboard.defaults, ...patch } }, keyboard).ok,
    ).toBe(false);
  });

  it('offers the original output for every remappable physical key', () => {
    const actions = new Set(keyboard.capabilities.actions.map((action) => action.id));
    const missing = keyboard.capabilities.keys.filter(
      (key) => key.remappable !== false && !actions.has(key.id),
    );
    expect(missing).toEqual([]);
  });

  it('accepts a file exported from the same device', () => {
    const result = readProfileFile(structuredClone(exported), mouse);
    expect(result.ok).toBe(true);
  });

  it('migrates mouse profiles created before performance, R-Plus and wireless turbo fields', () => {
    const legacy = structuredClone(exported) as unknown as {
      ajustes: Record<string, unknown> & { parameters: Record<string, unknown> };
    };
    delete legacy.ajustes.performanceMode;
    delete legacy.ajustes.rPlus;
    delete legacy.ajustes.parameters.wirelessTurbo;
    legacy.ajustes.parameters.extendedRange = true;

    const result = readProfileFile(legacy, mouse);

    expect(result.ok).toBe(true);
    if (result.ok && 'parameters' in result.file.ajustes) {
      expect(result.file.ajustes.performanceMode).toBeNull();
      expect(result.file.ajustes.rPlus).toBeNull();
      expect(result.file.ajustes.parameters.wirelessTurbo).toBe(false);
      expect(result.file.ajustes.parameters).not.toHaveProperty('extendedRange');
    }
  });

  it('rejects a file made for another kind of device', () => {
    const result = readProfileFile(structuredClone(exported), keyboard);
    expect(result).toEqual({
      ok: false,
      message: 'O arquivo não é compatível com este dispositivo.',
    });
  });

  it('rejects values the model does not support', () => {
    const file = structuredClone(exported);
    if ('pollingRate' in file.ajustes) file.ajustes.pollingRate = 3000;

    expect(readProfileFile(file, mouse)).toEqual({
      ok: false,
      message: 'O arquivo não é compatível com este dispositivo.',
    });
  });

  it('rejects optional mouse features the model does not declare', () => {
    const withMode = buildProfileFile(mouse, 'Perfil', {
      ...mouse.defaults,
      performanceMode: 'gaming-plus',
    });
    const withTurbo = buildProfileFile(mouse, 'Perfil', {
      ...mouse.defaults,
      parameters: { ...mouse.defaults.parameters, wirelessTurbo: true },
    });
    const withRPlus = buildProfileFile(mouse, 'Perfil', {
      ...mouse.defaults,
      rPlus: { activatorButtonId: 'lateral-dianteiro', buttons: mouse.defaults.buttons },
    });

    expect(readProfileFile(withMode, mouse).ok).toBe(false);
    expect(readProfileFile(withTurbo, mouse).ok).toBe(false);
    expect(readProfileFile(withRPlus, mouse).ok).toBe(false);
  });

  it('validates declared performance modes and R-Plus activators', () => {
    const device = structuredClone(mouse);
    device.capabilities.performanceModes = [
      { id: 'office', label: 'Office' },
      { id: 'gaming-plus', label: 'Gaming+' },
    ];
    device.capabilities.parameters.wirelessTurbo = true;
    device.capabilities.rPlus = { activatorButtonIds: ['lateral-dianteiro'] };
    device.defaults.performanceMode = 'office';
    device.defaults.rPlus = {
      activatorButtonId: 'lateral-dianteiro',
      buttons: Object.fromEntries(
        device.capabilities.buttons.map((button) => [button.id, 'desativado']),
      ),
    };
    const settings = structuredClone(device.defaults);

    expect(readProfileFile(buildProfileFile(device, 'Perfil', settings), device).ok).toBe(true);

    settings.performanceMode = 'desconhecido';
    settings.rPlus!.activatorButtonId = 'direito';
    expect(readProfileFile(buildProfileFile(device, 'Perfil', settings), device).ok).toBe(false);
  });

  it('rejects a DPI stage outside the sensor range', () => {
    const file = structuredClone(exported);
    if ('dpiStages' in file.ajustes) file.ajustes.dpiStages[0].x = 26_000;

    expect(readProfileFile(file, mouse).ok).toBe(false);
  });

  it('rejects a file from another version', () => {
    expect(readProfileFile({ ...structuredClone(exported), versao: 2 }, mouse)).toEqual({
      ok: false,
      message: 'O arquivo foi criado em outra versão do OmniGear.',
    });
  });

  it('rejects content that is not a profile', () => {
    expect(readProfileFile({ qualquer: 'coisa' }, mouse)).toEqual({
      ok: false,
      message: 'O arquivo não é um perfil do OmniGear.',
    });
  });

  it('accepts a keyboard profile with a remapped key', () => {
    const file = buildProfileFile(keyboard, 'Jogos', {
      keymap: { CapsLock: 'ControlLeft' },
      lighting: keyboard.defaults.lighting,
    });

    expect(readProfileFile(file, keyboard).ok).toBe(true);
  });
});

describe('profileFileName', () => {
  it('builds a file name without accents or spaces', () => {
    const device = { ...mouse, name: 'Mouse de demonstração' };
    expect(profileFileName(device, 'Perfil 1')).toBe(
      'omnigear-mouse-de-demonstracao-perfil-1.json',
    );
  });

  it('keeps the name of the model in the file', () => {
    expect(profileFileName(mouse, 'Perfil 1')).toBe('omnigear-viper-v4-pro-perfil-1.json');
  });
});
