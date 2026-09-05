import { Button } from '@gearhub/ui/components/button';
import { Panel } from '@gearhub/ui/components/panel';
import { useEffect, useState } from 'react';
import { listMockMice, type MouseSummary } from '../../hardware/mockDriver';
import { useMouseStore } from '../../store/mouseStore';

export function DeviceGallery() {
  const [mice, setMice] = useState<MouseSummary[] | null>(null);
  const openMouse = useMouseStore((state) => state.openMouse);

  useEffect(() => {
    void listMockMice().then(setMice);
  }, []);

  if (!mice) {
    return <p className="p-12 text-center text-sm text-text-muted">Procurando dispositivos…</p>;
  }

  if (mice.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-xl font-semibold text-text-primary">Conecte um mouse</h1>
        <p className="max-w-sm text-sm text-text-muted">
          Ligue o receptor 2.4G ou o cabo. Conexões Bluetooth não são reconhecidas.
        </p>
        <Button onClick={() => window.location.reload()}>Procurar de novo</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-4 p-8 sm:grid-cols-2">
      {mice.map((mouse) => (
        <Panel key={mouse.id} className="p-0">
          <button
            type="button"
            onClick={() => void openMouse(mouse.id)}
            className="block w-full rounded-[inherit] p-5 text-left transition-colors hover:bg-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fill-solid"
          >
            <span className="block text-base font-semibold text-text-primary">{mouse.name}</span>
            <span className="tnum mt-1 block text-xs text-text-muted">
              {mouse.manufacturer} · {mouse.connection}
              {mouse.batteryPercent !== undefined && ` · ${mouse.batteryPercent}%`}
            </span>
          </button>
        </Panel>
      ))}
    </div>
  );
}
