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
import { probePollingWrite, type WriteProbeReport } from '../hardware/rawm/writeProbe';
import type { BrowserHidDevice } from '../hardware/deviceDiscovery';

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

const WRITE_TARGET_HZ = 1000;

export function RawmDiagnosticPage() {
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [device, setDevice] = useState<BrowserHidDevice | null>(null);
  const [write, setWrite] = useState<WriteProbeReport | null>(null);
  const [armed, setArmed] = useState(false);

  async function probe(allDevices: boolean) {
    const api = hidApi();
    if (!api) {
      setError('Este navegador não expõe WebHID. Use Chrome ou Edge.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const chosen = await requestDiagnosticDevice(api, allDevices);
      if (!chosen) {
        setError('Nenhum dispositivo foi selecionado.');
        return;
      }
      setDevice(chosen);
      setWrite(null);
      setArmed(false);
      setReport(await runReadOnlyDiagnostic(chosen));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Diagnóstico RAWM</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Consulta o receptor e o mouse e mostra a resposta crua. Não constrói driver e não abre o
        editor, então nada é aplicado por engano ao mexer num controle. A leitura só transmite
        eventos de consulta; a única escrita possível está no fim da página, atrás de uma
        confirmação, e é um evento só.
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

          {report.snapshot && device && (
            <section className="mt-8 rounded-md border border-amber-500/40 bg-amber-500/5 p-4">
              <h2 className="text-lg font-semibold">Teste de escrita</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Envia <strong>um único</strong> evento de parâmetros, com a taxa de reporte em{' '}
                {WRITE_TARGET_HZ} Hz e todo o resto igual ao que acabou de ser lido. Não manda
                CONFIG_RESET, não manda mapeamento de botão e não grava em flash — desligar e
                religar o mouse desfaz. Depois relê e compara campo a campo.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Atual: <strong>{report.snapshot.pollingRate} Hz</strong>.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={armed}
                    onChange={(event) => setArmed(event.target.checked)}
                  />
                  Entendo que isto escreve no mouse
                </label>
                <Button
                  disabled={!armed || busy}
                  onClick={() => {
                    setBusy(true);
                    setError(null);
                    probePollingWrite(device, WRITE_TARGET_HZ)
                      .then(setWrite)
                      .catch((cause: unknown) =>
                        setError(cause instanceof Error ? cause.message : String(cause)),
                      )
                      .finally(() => setBusy(false));
                  }}
                >
                  Escrever {WRITE_TARGET_HZ} Hz
                </Button>
              </div>

              {write && (
                <div className="mt-4">
                  <p className="text-sm">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${
                        write.confirmado ? statusStyles.ok : statusStyles.falha
                      }`}
                    >
                      {write.confirmado ? 'ROUND-TRIP CONFIRMADO' : 'NÃO CONFIRMADO'}
                    </span>{' '}
                    {write.alvo.de} Hz → {write.alvo.para} Hz
                  </p>
                  {write.erro && <p className="mt-2 text-sm text-destructive">{write.erro}</p>}
                  {write.divergencias.length > 0 && (
                    <ul className="mt-2 text-sm">
                      {write.divergencias.map((item) => (
                        <li key={item.campo} className="font-mono text-xs">
                          {item.campo}: esperado {JSON.stringify(item.esperado)}, obtido{' '}
                          {JSON.stringify(item.obtido)}
                        </li>
                      ))}
                    </ul>
                  )}
                  <Button
                    className="mt-3"
                    size="sm"
                    variant="outline"
                    onClick={() => downloadJson('escrita-rawm.json', write)}
                  >
                    Baixar relatório da escrita
                  </Button>
                </div>
              )}
            </section>
          )}

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
