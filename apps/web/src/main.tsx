import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ensureCoreReady } from './core/coreBridge';
import './styles.css';

function mount() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

/**
 * The core encoders are synchronous, so nothing can be written to a device
 * before the module is ready. Waiting here is what makes the generated wasm
 * build usable at all — every encoder throws until `init()` resolves.
 *
 * A core that fails to load still renders: the app stays usable for everything
 * that does not touch hardware, and the general section reports the failure.
 */
void ensureCoreReady()
  .catch(() => undefined)
  .then(mount);
