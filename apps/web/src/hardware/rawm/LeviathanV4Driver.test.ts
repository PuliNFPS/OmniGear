import { describe, expect, it } from 'vitest';
import type { MouseSettings } from '@gearhub/shared';
import { createLeviathanV4Peripheral } from './leviathanV4';
import { leviathanV4QueryFixture } from './leviathanV4Fixture';
import { connectedDriver, fakeLeviathanV4 } from './leviathanV4Harness';

const settings = createLeviathanV4Peripheral(leviathanV4QueryFixture, 'real')
  .defaults as MouseSettings;

// Layout with the CRC envelope: [0] virtual channel, [1] chunk header, [2] cmd,
// [3] len, [4] 0x24, [5..6] crc, [7] inner cmd, [8] inner len, [9] inner type.
const innerCommand = (report: Uint8Array) => report[7];

describe('LeviathanV4Driver', () => {
  it('sends every step through the virtual mouse channel', async () => {
    const fake = fakeLeviathanV4();
    const driver = await connectedDriver(fake);
    await driver.applyToSession(settings);
    expect(fake.sent.length).toBeGreaterThan(0);
    expect(fake.sent.every((report) => report[0] === 0xc0)).toBe(true);
  });

  it('applies to the session without committing to flash', async () => {
    const fake = fakeLeviathanV4();
    const driver = await connectedDriver(fake);
    await driver.applyToSession(settings);
    // Action events carry command 0x06; a session apply sends none.
    expect(fake.sent.some((report) => innerCommand(report) === 0x06)).toBe(false);
  });

  it('brackets a profile write with the saves that commit it', async () => {
    const fake = fakeLeviathanV4();
    const driver = await connectedDriver(fake);
    await driver.writeProfile(4, 'Perfil 4', settings);
    const actions = fake.sent.filter((report) => innerCommand(report) === 0x06);
    expect(actions).toHaveLength(2);
    expect(actions[0][9]).toBe(0x34); // ACTION_SAVE_CONFIG_TO_FDS
    // The opening save names the slot: 1 | ((4 - 1) << 8) = 0x0301.
    expect(actions[0][10]).toBe(0x01);
    expect(actions[0][11]).toBe(0x03);
    expect(actions[1][10]).toBe(0x00);
    expect(actions[1][11]).toBe(0x00);
  });

  it('refuses a slot the shell cannot convert, without sending', async () => {
    const fake = fakeLeviathanV4();
    const driver = await connectedDriver(fake);
    await expect(driver.writeProfile(0, 'Perfil', settings)).rejects.toThrow(
      'Indice de perfil RAWM invalido.',
    );
    await expect(driver.writeProfile(1.5, 'Perfil', settings)).rejects.toThrow(
      'Indice de perfil RAWM invalido.',
    );
    await expect(driver.writeProfile(2 ** 32 + 1, 'Perfil', settings)).rejects.toThrow(
      'Indice de perfil RAWM invalido.',
    );
    expect(fake.sent).toHaveLength(0);
  });

  it('refuses a slot beyond the memories the mouse has, without sending', async () => {
    const fake = fakeLeviathanV4();
    const driver = await connectedDriver(fake);
    await expect(driver.writeProfile(5, 'Perfil', settings)).rejects.toThrow(
      'Indice de perfil RAWM invalido.',
    );
    expect(fake.sent).toHaveLength(0);
  });

  it('runs one operation after another', async () => {
    const second = { ...settings, pollingRate: 500 } satisfies MouseSettings;
    const sequential = fakeLeviathanV4();
    const reference = await connectedDriver(sequential);
    await reference.applyToSession(settings);
    await reference.applyToSession(second);

    const concurrent = fakeLeviathanV4();
    const driver = await connectedDriver(concurrent);
    await Promise.all([driver.applyToSession(settings), driver.applyToSession(second)]);

    expect(sequential.sent.length).toBeGreaterThan(0);
    expect(concurrent.sent).toEqual(sequential.sent);
  });
});
