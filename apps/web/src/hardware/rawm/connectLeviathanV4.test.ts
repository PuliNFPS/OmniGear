import { describe, expect, it } from 'vitest';
import { driverFor, unregisterDeviceDriver } from '../deviceDriver';
import { deviceDefinitions } from '../deviceRegistry';
import type { BrowserHidDevice } from '../deviceDiscovery';
import type { HidInputReportEvent } from '../WebHidTransport';
import { frameEvent, withProtocolEnvelope } from './protocol';
import { connectLeviathanV4 } from './connectLeviathanV4';
import { leviathanV4QueryFixture, rawmReceiverQueryFixture } from './leviathanV4Fixture';

const receiver = { dn: 'RAWM HS Receiver', pi: 0x2346, vi: 0x1915, crc: 1 };
const mouse = {
  dn: 'Leviathan V4',
  pi: 0x9999,
  vi: 0x1915,
  crc: 1,
  cpi: 1600,
  polling: 1000,
  light: 0x30,
  cpi_l: [400, 800, 1600, 3200],
  cpi_l_c: [1, 2, 3, 4],
  ob: 0,
  pm: 1,
  lod: 2,
  kd: [8, 8, 8, 8, 8, 8, 8],
  ms: 1,
  at: 0,
  as: 1,
  rctrl: 1,
  top: 8,
  co: [100, 90],
  atp: 1,
  ocs: [0x80],
  gm: [0, 0],
  st: [0x80],
};

function queryReports(value: Record<string, unknown>, virtual: boolean): Uint8Array[] {
  const json = new TextEncoder().encode(`${JSON.stringify(value)}\0`);
  const event = withProtocolEnvelope([2, 0, ...json], false);
  return frameEvent(Uint8Array.from([0xff, 0xff, 0xff, 0xff, ...event]), virtual);
}

function fakeDevice(
  receiverRaw: Record<string, unknown> = receiver,
  mouseRaw: Record<string, unknown> = mouse,
): BrowserHidDevice {
  const listeners = new Set<(event: HidInputReportEvent) => void>();
  return {
    vendorId: 0x1915,
    productId: 0x2346,
    productName: 'RAWM HS Receiver',
    opened: false,
    collections: [
      {
        usagePage: 0xff00,
        usage: 1,
        inputReports: [{ reportId: 0 }],
        outputReports: [{ reportId: 0 }],
      },
    ],
    async open() {
      this.opened = true;
    },
    async sendReport(_reportId, data) {
      const sent = new Uint8Array(data as ArrayBuffer);
      const responses = queryReports(sent[0] === 0xc0 ? mouseRaw : receiverRaw, sent[0] === 0xc0);
      queueMicrotask(() =>
        responses.forEach((report) => {
          const copied = report.slice();
          const event = { reportId: 0, data: new DataView(copied.buffer) };
          listeners.forEach((listener) => listener(event));
        }),
      );
    },
    addEventListener(_type, listener) {
      listeners.add(listener);
    },
    removeEventListener(_type, listener) {
      listeners.delete(listener);
    },
  };
}

describe('connectLeviathanV4', () => {
  it('validates receiver and virtual mouse before registering the live driver', async () => {
    const peripheral = await connectLeviathanV4(fakeDevice(), deviceDefinitions[0]);
    try {
      expect(peripheral).toMatchObject({
        id: 'rawm-leviathan-v4:1915:2346',
        name: 'Leviathan V4',
        demo: false,
      });
      expect(driverFor(peripheral)).toBeDefined();
    } finally {
      unregisterDeviceDriver(peripheral.id);
    }
  });

  // End to end against the payloads a real receiver and mouse actually sent.
  it('connects using the captured firmware responses', async () => {
    const peripheral = await connectLeviathanV4(
      fakeDevice(rawmReceiverQueryFixture, leviathanV4QueryFixture),
      deviceDefinitions[0],
    );
    try {
      expect(peripheral).toMatchObject({ name: 'LEVIATHAN V4', manufacturer: 'RAWM' });
      expect(peripheral.capabilities.profileSlots).toBe(4);
      expect(peripheral.defaults.pollingRate).toBe(4000);
    } finally {
      unregisterDeviceDriver(peripheral.id);
    }
  });
});
