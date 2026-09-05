import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Sem `test.globals: true`, `afterEach` não existe em globalThis, então o
// registro automático de limpeza da Testing Library nunca dispara: o DOM de
// um teste continua montado quando o próximo começa. Registramos aqui, uma
// vez, para todo o pacote.
afterEach(() => cleanup());

// jsdom não implementa ResizeObserver. O Slider do Radix o exige (via
// useSize) mesmo sem medir nada de verdade em ambiente de teste.
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
