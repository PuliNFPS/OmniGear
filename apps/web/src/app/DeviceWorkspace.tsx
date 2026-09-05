import { useState } from 'react';
import { sectionRegistry } from '../features/registry';
import { useMouseStore } from '../store/mouseStore';
import { DirtyBar } from './DirtyBar';

export function DeviceWorkspace() {
  const session = useMouseStore((state) => state.session)!;
  const applying = useMouseStore((state) => state.applying);
  const disconnected = useMouseStore((state) => state.disconnected);
  const closeMouse = useMouseStore((state) => state.closeMouse);
  const reconnect = useMouseStore((state) => state.reconnect);
  const [sectionId, setSectionId] = useState(sectionRegistry[0]!.id);

  const section = sectionRegistry.find((entry) => entry.id === sectionId) ?? sectionRegistry[0]!;

  return (
    <div className="grid min-h-screen grid-cols-[220px_1fr]">
      <aside className="border-r border-border-subtle bg-bg-surface">
        <button
          type="button"
          onClick={closeMouse}
          className="flex h-14 w-full items-center px-5 text-sm text-text-muted hover:text-text-primary"
        >
          ← Dispositivos
        </button>
        <nav aria-label="Seções" className="p-2">
          {sectionRegistry.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setSectionId(entry.id)}
              aria-current={entry.id === sectionId ? 'page' : undefined}
              className={
                entry.id === sectionId
                  ? 'flex w-full items-center gap-2 rounded-md bg-fill-solid px-3 py-2 text-left text-sm font-semibold text-fill-solid-text'
                  : 'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-text-muted hover:bg-bg-hover hover:text-text-primary'
              }
            >
              <span aria-hidden className="shrink-0">
                <entry.icon className="size-4" />
              </span>
              {entry.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex min-h-screen flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-border-subtle px-6 text-sm">
          <span
            aria-hidden
            className={`size-1.5 rounded-full ${disconnected ? 'bg-transparent ring-1 ring-text-muted' : 'bg-text-primary'}`}
          />
          <span className="font-medium text-text-primary">{session.name}</span>
          <span className="tnum text-xs text-text-muted">
            {session.telemetry.connection}
            {session.telemetry.batteryPercent !== undefined &&
              ` · ${session.telemetry.batteryPercent}%`}
          </span>
          {applying && <span className="ml-auto text-xs text-text-muted">aplicando…</span>}
        </header>

        {disconnected && (
          <div className="flex items-center justify-between bg-bg-raised px-6 py-3 text-[13px]">
            <span className="text-text-secondary">
              O mouse desconectou. Suas alterações foram preservadas.
            </span>
            <button
              type="button"
              onClick={() => void reconnect()}
              className="text-text-primary underline"
            >
              Reaplicar
            </button>
          </div>
        )}

        <div className="flex-1">
          <section.Component />
        </div>
        <DirtyBar />
      </main>
    </div>
  );
}
