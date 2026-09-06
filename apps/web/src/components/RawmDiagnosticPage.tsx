import { useState } from 'react';
import { Button } from '@gearhub/ui/components/button';
import { downloadJson } from '../app/download';
import type { BrowserHidApi } from '../hardware/deviceDiscovery';
import {
  CHANNEL_LABELS,
  requestDiagnosticDevice,
  runReadOnlyDiagnostic,
  type DiagnosticReport,
  type DiagnosticStage,
  type StageStatus,
} from '../hardware/rawm/diagnostics';

const statusStyles: Record<StageStatus, string> = {
  ok: 'bg-[hsl(var(--status))] text-white',
  aviso: 'bg-amber-500 text-black',
  falha: 'bg-destructive text-white',
};

const statusLabels: Record<StageStatus, string> = {
  ok: 'OK',
  aviso: 'Atenção',
  falha: 'Falha',
};

function hidApi(): BrowserHidApi | null {
  if (typeof navigator === 'undefined') return null;
  return (navigator as Navigator & { hid?: BrowserHidApi }).hid ?? null;
}

function StageRow({ stage }: { stage: DiagnosticStage }) {
  return (
    <li className="flex gap-3 border-b border-border py-3 last:border-b-0">
      <span
        className={`mt-0.5 h-fit shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${statusStyles[stage.status]}`}
      >
        {statusLabels[stage.status]}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium">{stage.label}</p>
        <p className="text-sm text-muted-foreground">{stage.detail}</p>
      </div>
    </li>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  const text = JSON.stringify(value, null, 2);
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Button
          size="xs"
          variant="outline"
          onClick={() => void navigator.clipboard?.writeText(text)}
        >
          Copiar
        </Button>
      </div>
      <textarea
        readOnly
        value={text}
        spellCheck={false}
        className="h-56 w-full rounded-md border border-border bg-card p-3 font-mono text-xs"
      />
    </section>
  );
}

export function RawmDiagnosticPage() {
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function probe(allDevices: boolean) {
    const api = hidApi();
    if (!api) {
      setError('Este navegador não expõe WebHID. Use Chrome ou Edge.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const device = await requestDiagnosticDevice(api, allDevices);
      if (!device) {
        setError('Nenhum dispositivo foi selecionado.');
        return;
      }
      setReport(await runReadOnlyDiagnostic(device));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Diagnóstico RAWM — somente leitura</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Esta página consulta o receptor e o mouse e mostra a resposta crua. Ela não constrói driver,
        não abre o editor e os únicos bytes que transmite são eventos de consulta. Nenhuma
        configuração é gravada no mouse.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button disabled={busy} onClick={() => void probe(false)}>
          {busy ? 'Consultando…' : 'Selecionar receptor RAWM'}
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => void probe(true)}>
          Mostrar todos os dispositivos
        </Button>
        {report && (
          <Button variant="outline" onClick={() => downloadJson('diagnostico-rawm.json', report)}>
            Baixar relatório
          </Button>
        )}
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        Mexa o mouse pouco antes de consultar: um mouse adormecido pode não responder a tempo.
      </p>

      {error && (
        <p className="mt-6 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          {error}
        </p>
      )}

      {report && (
        <>
          <section className="mt-8">
            <h2 className="text-lg font-semibold">Dispositivo</h2>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Nome</dt>
              <dd>{report.dispositivo.productName}</dd>
              <dt className="text-muted-foreground">VID / PID</dt>
              <dd className="font-mono">
                {report.dispositivo.vendorId} / {report.dispositivo.productId}
              </dd>
              <dt className="text-muted-foreground">Coleções</dt>
              <dd className="font-mono">
                {report.dispositivo.collections.map((item, index) => (
                  <span key={index} className="block">
                    {item.usagePage}/{item.usage} · entrada [{item.inputReportIds.join(', ')}] ·
                    saída [{item.outputReportIds.join(', ')}]
                  </span>
                ))}
              </dd>
              <dt className="text-muted-foreground">No registro</dt>
              <dd>{report.reconhecido ? 'sim' : 'não'}</dd>
            </dl>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-semibold">Etapas</h2>
            <ul className="mt-2">
              {report.etapas.map((stage) => (
                <StageRow key={stage.id} stage={stage} />
              ))}
            </ul>
          </section>

          {report.receptor && <JsonBlock title="Resposta do receptor" value={report.receptor} />}
          {report.mouse && <JsonBlock title="Resposta do mouse" value={report.mouse} />}
          {report.snapshot && <JsonBlock title="Snapshot interpretado" value={report.snapshot} />}

          <section className="mt-6">
            <h3 className="text-sm font-semibold">
              Relatórios HID recebidos ({report.relatorios.length})
            </h3>
            <div className="mt-2 max-h-64 overflow-auto rounded-md border border-border bg-card p-3">
              {report.relatorios.map((entry, index) => (
                <p key={index} className="font-mono text-xs whitespace-pre">
                  <span className="text-muted-foreground">
                    {CHANNEL_LABELS[entry.channel]} · id {entry.reportId} ·{' '}
                  </span>
                  {entry.hex}
                </p>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
