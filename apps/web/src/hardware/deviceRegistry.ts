import { leviathanV4Usb, matchesLeviathanV4 } from '../core/coreBridge';

interface HidReportInfo {
  reportId: number;
}

interface HidCollectionInfo {
  usagePage: number;
  usage: number;
  inputReports?: HidReportInfo[];
  outputReports?: HidReportInfo[];
}

export interface HidDeviceIdentity {
  vendorId: number;
  productId: number;
  productName?: string;
  collections: HidCollectionInfo[];
}

export interface DeviceRequestFilter {
  vendorId: number;
  productId?: number;
  usagePage?: number;
  usage?: number;
}

export interface DeviceDefinition {
  id: string;
  manufacturer: string;
  model: string;
  requestFilter: DeviceRequestFilter;
  matches(device: HidDeviceIdentity): boolean;
}

let definitions: DeviceDefinition[] | null = null;

/**
 * Built on first use, not at import: the numbers come from the core, which is
 * only callable after `init()` resolves.
 */
export function deviceDefinitions(): DeviceDefinition[] {
  if (definitions) return definitions;
  const usb = leviathanV4Usb();
  definitions = [
    {
      id: 'rawm-leviathan-v4',
      manufacturer: 'RAWM',
      model: 'Leviathan V4',
      requestFilter: {
        vendorId: usb.vendorId,
        usagePage: usb.configUsagePage,
        usage: usb.configUsage,
      },
      matches: (device) => matchesLeviathanV4(device),
    },
  ];
  return definitions;
}

/**
 * One entry per distinct filter. A receiver publishes several HID interfaces
 * under the same product name, so the filter has to name the configuration
 * collection: otherwise the picker lists rows the user cannot tell apart, and
 * choosing a sibling interface yields a device that cannot answer a query.
 */
export function deviceRequestFilters(): DeviceRequestFilter[] {
  const unique = new Map<string, DeviceRequestFilter>();
  for (const definition of deviceDefinitions()) {
    unique.set(JSON.stringify(definition.requestFilter), definition.requestFilter);
  }
  return [...unique.values()];
}

export function matchDeviceDefinition(device: HidDeviceIdentity): DeviceDefinition | null {
  return deviceDefinitions().find((definition) => definition.matches(device)) ?? null;
}
