import type { ProfileSlot } from '@gearhub/shared';

export type NameValidation = { valid: true } | { valid: false; message: string };

export function validateProfileName(name: string): NameValidation {
  if (name.trim().length === 0) return { valid: false, message: 'Digite um nome para o perfil.' };
  if (name.trim().length > 24) return { valid: false, message: 'Use no máximo 24 caracteres.' };
  return { valid: true };
}

function occupiedSlots<T>(profiles: ProfileSlot<T>[]): number {
  return profiles.filter((slot) => slot.settings !== null).length;
}

export function describeSlotOccupancy<T>(profiles: ProfileSlot<T>[]): string {
  return `${occupiedSlots(profiles)} de ${profiles.length} slots ocupados`;
}
