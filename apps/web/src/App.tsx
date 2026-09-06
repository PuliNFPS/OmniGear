import { useEffect, useState } from 'react';
import { exitDemonstration } from './app/demo';
import { homeRoute } from './app/routes';
import { navigate, useRoute } from './app/useRoute';
import { useTheme } from './app/useTheme';
import { useDeviceReports } from './app/useDeviceReports';
import { AddDeviceDialog } from './components/AddDeviceDialog';
import { AppHeader } from './components/AppHeader';
import { DeviceWorkspace } from './components/DeviceWorkspace';
import { HomePage } from './components/HomePage';
import { ConfirmDialog } from './components/ConfirmDialog';
import { countChanges } from './domain/changes';
import { useEditorStore } from './store/editorStore';
import { onDeviceDisconnected } from './hardware/deviceDiscovery';
import { useDeviceStore } from './store/deviceStore';

export function App() {
  const { theme, toggleTheme } = useTheme();
  const route = useRoute();
  const devices = useDeviceStore((state) => state.devices);
  const loading = useDeviceStore((state) => state.loading);
  const demoMode = useDeviceStore((state) => state.demoMode);
  const restoreSession = useDeviceStore((state) => state.restoreSession);
  const entries = useEditorStore((state) => state.entries);
  const [exitOpen, setExitOpen] = useState(false);
  const hasPendingWork = Object.values(entries).some(
    (entry) => entry.status === 'gravando' || countChanges(entry.saved, entry.draft) > 0,
  );

  useEffect(() => {
    if (!hasPendingWork) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [hasPendingWork]);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  useDeviceReports(devices);

  useEffect(
    () => onDeviceDisconnected((deviceId) => useDeviceStore.getState().markDisconnected(deviceId)),
    [],
  );

  const device =
    route.name === 'device' ? devices.find((item) => item.id === route.deviceId) : undefined;

  useEffect(() => {
    if (route.name === 'device' && !loading && !device) navigate(homeRoute, { replace: true });
  }, [route, loading, device]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a
        href="#conteudo"
        className="skip-link"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('conteudo')?.focus();
        }}
      >
        Pular para o conteúdo
      </a>
      <AppHeader
        demo={demoMode}
        theme={theme}
        onToggleTheme={toggleTheme}
        onExitDemo={() => (hasPendingWork ? setExitOpen(true) : exitDemonstration())}
      />
      {device ? (
        <DeviceWorkspace
          key={device.id}
          device={device}
          sectionId={route.name === 'device' ? route.section : ''}
        />
      ) : (
        <HomePage />
      )}
      <AddDeviceDialog />
      <ConfirmDialog
        open={exitOpen}
        onOpenChange={setExitOpen}
        title="Sair da demonstração?"
        description="Os ajustes desta sessão serão perdidos. Exporte seus perfis se quiser guardá-los."
        actions={[
          { label: 'Continuar editando', onSelect: () => undefined },
          { label: 'Sair da demonstração', variant: 'destructive', onSelect: exitDemonstration },
        ]}
      />
    </div>
  );
}
