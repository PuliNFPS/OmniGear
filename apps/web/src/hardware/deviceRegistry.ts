import {
  LEVIATHAN_V4_RECEIVER_PRODUCT_ID,
  RAWM_CONFIG_USAGE,
  RAWM_CONFIG_USAGE_PAGE,
  RAWM_VENDOR_ID,
} from './rawm/leviathanV4';

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

function hasRawConfigCollection(device: HidDeviceIdentity): boolean {
  return device.collections.some(
    (collection) =>
      collection.usagePage === RAWM_CONFIG_USAGE_PAGE &&
      collection.usage === RAWM_CONFIG_USAGE &&
      collection.inputReports?.some((report) => report.reportId === 0) === true &&
      collection.outputReports?.some((report) => report.reportId === 0) === true,
  );
}

export const deviceDefinitions: DeviceDefinition[] = [
  {
    id: 'rawm-leviathan-v4',
    manufacturer: 'RAWM',
    model: 'Leviathan V4',
    requestFilter: { vendorId: RAWM_VENDOR_ID },
    matches: (device) =>
      device.vendorId === RAWM_VENDOR_ID &&
      device.productId === LEVIATHAN_V4_RECEIVER_PRODUCT_ID &&
      hasRawConfigCollection(device),
  },
];

export function deviceRequestFilters(): DeviceRequestFilter[] {
  const byVendor = new Map<number, DeviceRequestFilter>();
  for (const definition of deviceDefinitions) {
    byVendor.set(definition.requestFilter.vendorId, definition.requestFilter);
  }
  return [...byVendor.values()];
}

export function matchDeviceDefinition(device: HidDeviceIdentity): DeviceDefinition | null {
  return deviceDefinitions.find((definition) => definition.matches(device)) ?? null;
}
