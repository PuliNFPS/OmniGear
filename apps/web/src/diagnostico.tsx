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
 * immediately. Keeping the page out of that tree means nothing here writes to
 * the mouse unless the user asks for it: it only queries until the user ticks
 * "Entendo que isto escreve no mouse", and after that each write probe is an
 * explicit click. `probeProfileWrite` does reach the flash.
 *
 * Like the main entry, it waits for the core: every probe stage goes through
 * it. A core that fails to load still renders, and the first stage reports why.
 */
void ensureCoreReady()
  .catch(() => undefined)
  .then(mount);
