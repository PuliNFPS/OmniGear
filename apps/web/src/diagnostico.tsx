import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RawmDiagnosticPage } from './components/RawmDiagnosticPage';
import { ensureCoreReady } from './core/coreBridge';
import './styles.css';

function mount() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <RawmDiagnosticPage />
    </StrictMode>,
  );
}

/**
 * Separate entry on purpose. The main app restores authorized devices on mount
 * and registers a live driver, and any edit in the editor applies to hardware
 * immediately. Keeping the probe out of that tree is what makes "read-only" a
 * structural property instead of a promise.
 *
 * Like the main entry, it waits for the core: every probe stage goes through
 * it. A core that fails to load still renders, and the first stage reports why.
 */
void ensureCoreReady()
  .catch(() => undefined)
  .then(mount);
