import type { MouseRenderId } from '@gearhub/shared';

/**
 * Silhuetas genéricas. Quando chegar SVG por modelo, basta acrescentar entradas
 * aqui e um novo valor em `MouseRenderId` — nenhum componente muda.
 */
export const SHELLS: Record<MouseRenderId, { viewBox: string; outline: string; seam: string }> = {
  'generic-5button': {
    viewBox: '0 0 100 160',
    outline: 'M50 3C23 3 11 40 11 79c0 50 15 78 39 78s39-28 39-78C89 40 77 3 50 3Z',
    seam: 'M50 5v58',
  },
  'generic-7button': {
    viewBox: '0 0 100 160',
    outline: 'M50 3C21 3 9 42 9 82c0 48 17 75 41 75s41-27 41-75C91 42 79 3 50 3Z',
    seam: 'M50 5v62',
  },
};
