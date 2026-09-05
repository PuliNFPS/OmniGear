import '@testing-library/jest-dom/vitest';

// jsdom não implementa ResizeObserver. O Slider do Radix o exige (via
// useSize) mesmo sem medir nada de verdade em ambiente de teste.
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
