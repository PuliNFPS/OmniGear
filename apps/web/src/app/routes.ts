import type { PeripheralType } from '@gearhub/shared';

export type Route = { name: 'home' } | { name: 'device'; deviceId: string; section: string };

const mouseSectionIds = ['botoes', 'dpi', 'desempenho', 'parametros', 'perfis', 'geral'] as const;

const keyboardSectionIds = ['teclas', 'iluminacao', 'perfis', 'geral'] as const;

function sectionIdsFor(type: PeripheralType): readonly string[] {
  return type === 'mouse' ? mouseSectionIds : keyboardSectionIds;
}

export function defaultSectionFor(type: PeripheralType): string {
  return sectionIdsFor(type)[0];
}

export const homeRoute: Route = { name: 'home' };

export function deviceRoute(deviceId: string, section: string): Route {
  return { name: 'device', deviceId, section };
}

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '').replace(/^\/+|\/+$/g, '');
  const [area, deviceId, section] = path.split('/');
  if (area === 'dispositivo' && deviceId) {
    return { name: 'device', deviceId: decodeURIComponent(deviceId), section: section ?? '' };
  }
  return homeRoute;
}

export function routeToHash(route: Route): string {
  if (route.name === 'home') return '#/';
  return `#/dispositivo/${encodeURIComponent(route.deviceId)}/${route.section}`;
}
