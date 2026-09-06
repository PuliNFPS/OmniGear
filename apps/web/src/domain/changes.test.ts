import { describe, expect, it } from 'vitest';
import { countChanges, describeChangeCount } from './changes';
import { createDemoMouse } from '../hardware/demoDevices';

describe('countChanges', () => {
  it('reports no change for an untouched draft', () => {
    const device = createDemoMouse();
    expect(countChanges(device.defaults, structuredClone(device.defaults))).toBe(0);
  });

  it('counts one change per edited value', () => {
    const device = createDemoMouse();
    const draft = structuredClone(device.defaults);
    draft.pollingRate = 500;
    draft.parameters.debounce = 8;

    expect(countChanges(device.defaults, draft)).toBe(2);
  });

  it('counts an added stage once', () => {
    const device = createDemoMouse();
    const draft = structuredClone(device.defaults);
    draft.dpiStages.push({ id: 'estagio-5', x: 6400, y: 6400 });

    expect(countChanges(device.defaults, draft)).toBe(1);
  });

  it('counts a removed stage once, without shifting the following ones', () => {
    const device = createDemoMouse();
    const draft = structuredClone(device.defaults);
    const removed = draft.dpiStages[1].id;
    draft.dpiStages = draft.dpiStages.filter((stage) => stage.id !== removed);

    expect(draft.dpiStages.length).toBeLessThan(device.defaults.dpiStages.length);
    expect(countChanges(device.defaults, draft)).toBe(1);
  });

  it('counts a remapped key once', () => {
    expect(countChanges({ keymap: {} }, { keymap: { CapsLock: 'ControlLeft' } })).toBe(1);
  });
});

describe('describeChangeCount', () => {
  it('agrees in number with the counted changes', () => {
    expect(describeChangeCount(1)).toBe('1 alteração não salva');
    expect(describeChangeCount(3)).toBe('3 alterações não salvas');
  });
});
