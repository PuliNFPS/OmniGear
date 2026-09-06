import { describe, expect, it } from 'vitest';
import { deviceRoute, parseHash, routeToHash } from './routes';

describe('parseHash', () => {
  it('reads the home route from an empty or unknown hash', () => {
    expect(parseHash('')).toEqual({ name: 'home' });
    expect(parseHash('#/')).toEqual({ name: 'home' });
    expect(parseHash('#/qualquer-coisa')).toEqual({ name: 'home' });
  });

  it('reads the device and its section', () => {
    expect(parseHash('#/dispositivo/demo-mouse/dpi')).toEqual({
      name: 'device',
      deviceId: 'demo-mouse',
      section: 'dpi',
    });
  });

  it('keeps the device when the section is missing', () => {
    expect(parseHash('#/dispositivo/demo-mouse')).toEqual({
      name: 'device',
      deviceId: 'demo-mouse',
      section: '',
    });
  });
});

describe('routeToHash', () => {
  it('round-trips a device route', () => {
    const route = deviceRoute('demo-keyboard', 'iluminacao');
    expect(parseHash(routeToHash(route))).toEqual(route);
  });
});
