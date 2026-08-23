import type { DeviceSettings } from '@gearhub/shared';
import { Alert, AlertDescription, AlertTitle } from '@gearhub/ui/components/alert';
import { Button } from '@gearhub/ui/components/button';
import { Cable, CircleAlert, CircleCheck, Moon, Sun } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { DevicePanel } from './components/DevicePanel';
import { Sidebar } from './components/Sidebar';
import { loadCore, type CoreStatus } from './core/coreBridge';
import { useDeviceStore } from './store/deviceStore';

export function App() {
  const {
    devices,
    selectedId,
    discovering,
    saveState,
    feedback,
    selectDevice,
    connectDevices,
    updateSetting,
  } = useDeviceStore();
  const [dark, setDark] = useState(true);
  const [core, setCore] = useState<CoreStatus | null>(null);
  const selected = useMemo(
    () => devices.find((device) => device.id === selectedId),
    [devices, selectedId],
  );

  useEffect(() => {
    loadCore()
      .then(setCore)
      .catch(() => setCore({ version: 'unavailable', wasm: false }));
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  function update<K extends keyof DeviceSettings>(key: K, value: DeviceSettings[K]) {
    if (selected) void updateSetting(selected.id, key, value);
  }

  return (
    <div className="app-frame">
      <Sidebar
        devices={devices}
        selectedId={selectedId}
        discovering={discovering}
        onSelect={selectDevice}
        onConnect={() => void connectDevices()}
      />
      <main className="main-panel">
        <div className="topbar">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span
              className={`size-1.5 rounded-full ${core?.wasm ? 'bg-status' : 'bg-muted-foreground/50'}`}
            />
            <span>
              {core
                ? `Core ${core.version}${core.wasm ? ' · WASM' : ' · dev bridge'}`
                : 'Loading core…'}
            </span>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setDark((value) => !value)}
            aria-label={`Use ${dark ? 'light' : 'dark'} theme`}
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </div>
        <div className="main-scroll">
          {selected ? (
            <DevicePanel
              device={selected}
              pending={saveState?.deviceId === selected.id ? saveState.setting : null}
              onUpdate={update}
            />
          ) : (
            <EmptyState loading={discovering} onConnect={() => void connectDevices()} />
          )}
        </div>
        {feedback && (
          <div className="alert-stack" aria-live="polite">
            <Alert variant={feedback.type === 'error' ? 'destructive' : 'default'}>
              {feedback.type === 'error' ? <CircleAlert /> : <CircleCheck />}
              <AlertTitle>{feedback.title}</AlertTitle>
              <AlertDescription>{feedback.message}</AlertDescription>
            </Alert>
          </div>
        )}
      </main>
    </div>
  );
}

function EmptyState({ loading, onConnect }: { loading: boolean; onConnect(): void }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Cable className="size-6" />
      </div>
      <h1 className="mt-5 text-xl font-semibold tracking-tight">Bring your gear together</h1>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        Connect a compatible mouse or keyboard to manage its essential settings in one place.
      </p>
      <Button className="mt-6" onClick={onConnect} disabled={loading}>
        {loading ? 'Looking for devices…' : 'Connect device'}
      </Button>
      <p className="mt-4 text-xs text-muted-foreground">
        Two mock peripherals are available in this preview.
      </p>
    </div>
  );
}
