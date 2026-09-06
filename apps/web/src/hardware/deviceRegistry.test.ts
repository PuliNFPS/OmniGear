import { describe, expect, it } from 'vitest';
import { deviceRequestFilters, matchDeviceDefinition } from './deviceRegistry';

const leviathanReceiver = {
  vendorId: 0x1915,
  productId: 0x2346,
  productName: 'RAWM HS Receiver',
  collections: [
    {
      usagePage: 0xff00,
      usage: 0x0001,
      inputReports: [{ reportId: 0 }],
      outputReports: [{ reportId: 0 }],
    },
  ],
};

describe('device registry', () => {
  // A 2.4 GHz receiver exposes several HID interfaces under one product name,
  // so a vendor-only filter fills the picker with rows the user cannot tell
  // apart. Only the configuration collection can answer a query.
  it('narrows the picker to the vendor configuration collection', () => {
    expect(deviceRequestFilters()).toContainEqual({
      vendorId: 0x1915,
      usagePage: 0xff00,
      usage: 0x0001,
    });
  });

  it('rejects a sibling interface of the same receiver', () => {
    const consumerControl = {
      ...leviathanReceiver,
      collections: [{ usagePage: 0x000c, usage: 0x0001, inputReports: [{ reportId: 0 }] }],
    };
    expect(matchDeviceDefinition(consumerControl)).toBeNull();
  });

  it('matches the Leviathan V4 receiver and required vendor collection', () => {
    expect(matchDeviceDefinition(leviathanReceiver)?.id).toBe('rawm-leviathan-v4');
  });

  it('rejects the same product when the bidirectional vendor collection is absent', () => {
    expect(matchDeviceDefinition({ ...leviathanReceiver, collections: [] })).toBeNull();
  });

  it('does not guess support for an unknown product from the same vendor', () => {
    expect(matchDeviceDefinition({ ...leviathanReceiver, productId: 0xffff })).toBeNull();
  });
});
