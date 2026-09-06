import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RawmDiagnosticPage } from './components/RawmDiagnosticPage';
import './styles.css';

/**
 * Separate entry on purpose. The main app restores authorized devices on mount
 * and registers a live driver, and any edit in the editor applies to hardware
 * immediately. Keeping the probe out of that tree is what makes "read-only" a
 * structural property instead of a promise.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RawmDiagnosticPage />
  </StrictMode>,
);
