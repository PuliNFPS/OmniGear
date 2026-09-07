import { describe, expect, it } from 'vitest';
import { batteryLabel, batteryReading, batteryTier } from './battery';
import { createDemoKeyboard, createDemoMouse } from '../hardware/demoDevices';

describe('batteryTier', () => {
  it('reads a full charge above 60%', () => {
    expect(batteryTier(82)).toBe('cheia');
    expect(batteryTier(100)).toBe('cheia');
  });

  it('reads a middling charge above 30%', () => {
    expect(batteryTier(31)).toBe('media');
    expect(batteryTier(60)).toBe('media');
  });

  it('reads a low charge above 15%', () => {
    expect(batteryTier(16)).toBe('baixa');
    expect(batteryTier(30)).toBe('baixa');
  });

  it('reads the rest as critical', () => {
    expect(batteryTier(15)).toBe('critica');
    expect(batteryTier(0)).toBe('critica');
  });
});

describe('batteryReading', () => {
  it('reports the charge of a connected device that has one', () => {
    expect(batteryReading(createDemoMouse())).toBe(82);
  });

  it('reports nothing for a device without a battery', () => {
    expect(batteryReading(createDemoKeyboard())).toBeNull();
  });

  it('reports nothing while the device is disconnected, so no stale charge is shown', () => {
    const device = { ...createDemoMouse(), status: 'desconectado' as const };
    expect(batteryReading(device)).toBeNull();
  });
});

describe('batteryLabel', () => {
  it('names the charge the device reports', () => {
    expect(batteryLabel(82, false)).toBe('Bateria 82%');
  });

  it('marks a simulated charge as simulated', () => {
    expect(batteryLabel(82, true)).toBe('Bateria 82% (simulada)');
  });
});
