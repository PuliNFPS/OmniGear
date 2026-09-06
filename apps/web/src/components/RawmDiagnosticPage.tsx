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
import {
  probeButtonMapping,
  probeMappingSet,
  probePollingWrite,
  type MappingProbeReport,
  type MappingSetEntry,
  type MappingSetReport,
  type WriteProbeReport,
} from '../hardware/rawm/writeProbe';
import type { MouseActionId } from '@gearhub/shared';
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

// Offered targets; the one the mouse already holds is disabled, because
// writing it back reads clean whether or not the event was accepted.
const WRITE_TARGETS = [500, 1000, 2000, 4000];

/** Ids read from the official software, never confirmed against hardware. */
const KEY_IDS: { id: number; rotulo: string }[] = [
  { id: 7, rotulo: 'Botão de DPI (mais seguro)' },
  { id: 5, rotulo: 'Lateral traseiro' },
  { id: 6, rotulo: 'Lateral dianteiro' },
  { id: 2, rotulo: 'Clique central' },
  { id: 3, rotulo: 'Clique direito' },
  { id: 1, rotulo: 'Clique esquerdo (arriscado)' },
];

/**
 * Candidate complete sets. CONFIG_RESET clears every mapping, so only a full set
 * survives it; anything omitted stops working until a power cycle.
 *
 * `kd` carries seven debounce delays, so there are seven keys, ids 1 to 7. The
 * driver's table uses six and skips 4, and puts middle before right, against the
 * HID convention where 1 is left, 2 is right and 3 is middle.
 */
const MAPPING_SETS: { id: string; rotulo: string; entradas: MappingSetEntry[] }[] = [
  {
    id: 'hid-roda-4',
    rotulo: 'HID padrao, roda no id 4',
    entradas: [
      { keyIds: [1], acao: 'clique-esquerdo' },
      { keyIds: [2], acao: 'clique-direito' },
      { keyIds: [3], acao: 'clique-central' },
      { keyIds: [4], acao: 'rolagem-cima' },
      { keyIds: [5], acao: 'voltar' },
      { keyIds: [6], acao: 'avancar' },
      { keyIds: [7], acao: 'dpi-ciclo' },
    ],
  },
  {
    id: 'hid-roda-4-ambas',
    rotulo: 'HID padrao, roda no id 4 (cima e baixo)',
    entradas: [
      { keyIds: [1], acao: 'clique-esquerdo' },
      { keyIds: [2], acao: 'clique-direito' },
      { keyIds: [3], acao: 'clique-central' },
      { keyIds: [4], acao: 'rolagem-cima' },
      { keyIds: [4], acao: 'rolagem-baixo' },
      { keyIds: [5], acao: 'voltar' },
      { keyIds: [6], acao: 'avancar' },
      { keyIds: [7], acao: 'dpi-ciclo' },
    ],
  },
  {
    id: 'driver-atual',
    rotulo: 'Conjunto atual do driver (reproduz a falha)',
    entradas: [
      { keyIds: [1], acao: 'clique-esquerdo' },
      { keyIds: [2], acao: 'clique-central' },
      { keyIds: [3], acao: 'clique-direito' },
      { keyIds: [5], acao: 'voltar' },
      { keyIds: [6], acao: 'avancar' },
      { keyIds: [7], acao: 'dpi-ciclo' },
    ],
  },
  {
    id: 'hid-rplus',
    rotulo: 'HID padrao + R-Plus (dianteiro + direito = ciclar DPI)',
    entradas: [
      { keyIds: [1], acao: 'clique-esquerdo' },
      { keyIds: [2], acao: 'clique-direito' },
      { keyIds: [3], acao: 'clique-central' },
      { keyIds: [4], acao: 'rolagem-cima' },
      { keyIds: [5], acao: 'voltar' },
      { keyIds: [6], acao: 'avancar' },
      { keyIds: [7], acao: 'dpi-ciclo' },
      { keyIds: [6, 2], acao: 'dpi-ciclo' },
    ],
  },
];

const MAPPING_ACTIONS: { id: MouseActionId; rotulo: string }[] = [
  { id: 'clique-central', rotulo: 'Clique central' },
  { id: 'clique-direito', rotulo: 'Clique direito' },
  { id: 'voltar', rotulo: 'Voltar' },
  { id: 'avancar', rotulo: 'Avançar' },
  { id: 'dpi-ciclo', rotulo: 'Ciclar DPI' },
];

export function RawmDiagnosticPage() {
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [device, setDevice] = useState<BrowserHidDevice | null>(null);
  const [write, setWrite] = useState<WriteProbeReport | null>(null);
  const [armed, setArmed] = useState(false);
  const [mapping, setMapping] = useState<MappingProbeReport | null>(null);
  const [keyId, setKeyId] = useState(KEY_IDS[0].id);
  const [withReset, setWithReset] = useState(true);
  const [setId, setSetId] = useState(MAPPING_SETS[0].id);
  const [conjunto, setConjunto] = useState<MappingSetReport | null>(null);
  const [action, setAction] = useState<MouseActionId>('clique-central');

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
      setMapping(null);
      setConjunto(null);
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
                Envia <strong>um único</strong> evento de parâmetros, com a taxa de reporte que você
                escolher e todo o resto igual ao que acabou de ser lido. Não manda CONFIG_RESET, não
                manda mapeamento de botão e não grava em flash — desligar e religar o mouse desfaz.
                Depois relê e compara campo a campo.
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
                {WRITE_TARGETS.map((hz) => (
                  <Button
                    key={hz}
                    size="sm"
                    disabled={!armed || busy || hz === report.snapshot?.pollingRate}
                    onClick={() => {
                      setBusy(true);
                      setError(null);
                      probePollingWrite(device, hz)
                        .then(setWrite)
                        .catch((cause: unknown) =>
                          setError(cause instanceof Error ? cause.message : String(cause)),
                        )
                        .finally(() => setBusy(false));
                    }}
                  >
                    {hz} Hz
                  </Button>
                ))}
              </div>

              {write && (
                <div className="mt-4">
                  <p className="text-sm">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${
                        !write.conclusivo
                          ? statusStyles.aviso
                          : write.confirmado
                            ? statusStyles.ok
                            : statusStyles.falha
                      }`}
                    >
                      {!write.conclusivo
                        ? 'INCONCLUSIVO'
                        : write.confirmado
                          ? 'ROUND-TRIP CONFIRMADO'
                          : 'NÃO CONFIRMADO'}
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

          {report.snapshot && device && (
            <section className="mt-8 rounded-md border border-destructive/40 bg-destructive/5 p-4">
              <h2 className="text-lg font-semibold">Teste de mapeamento de botão</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                <strong>Isto não se verifica sozinho.</strong> A consulta não devolve nenhum campo
                de mapeamento, então não há o que reler: a única verificação é você apertar o botão
                e ver o que acontece.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Os ids de botão foram lidos do software oficial e nunca confirmados. Se o id estiver
                errado, o botão remapeado será outro. Nada vai para a flash:{' '}
                <strong>desligue e religue o mouse para reverter</strong>. Comece pelo botão de DPI,
                que é o menos crítico.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <select
                  className="rounded-md border border-border bg-card px-2 py-1 text-sm"
                  value={keyId}
                  onChange={(event) => setKeyId(Number(event.target.value))}
                >
                  {KEY_IDS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.id} — {item.rotulo}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-md border border-border bg-card px-2 py-1 text-sm"
                  value={action}
                  onChange={(event) => setAction(event.target.value as MouseActionId)}
                >
                  {MAPPING_ACTIONS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.rotulo}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={withReset}
                    onChange={(event) => setWithReset(event.target.checked)}
                  />
                  CONFIG_RESET antes
                </label>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={!armed || busy}
                  onClick={() => {
                    setBusy(true);
                    setError(null);
                    probeButtonMapping(device, keyId, action, { comConfigReset: withReset })
                      .then(setMapping)
                      .catch((cause: unknown) =>
                        setError(cause instanceof Error ? cause.message : String(cause)),
                      )
                      .finally(() => setBusy(false));
                  }}
                >
                  Remapear
                </Button>
              </div>

              {mapping && (
                <div className="mt-4">
                  <p className="text-sm">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${
                        mapping.enviado ? statusStyles.aviso : statusStyles.falha
                      }`}
                    >
                      {mapping.enviado ? 'ENVIADO — VERIFIQUE APERTANDO' : 'NÃO ENVIADO'}
                    </span>{' '}
                    botão {mapping.keyId} → {mapping.acao}
                    {mapping.comConfigReset ? ' (com CONFIG_RESET)' : ' (evento isolado)'}
                  </p>
                  {mapping.erro && <p className="mt-2 text-sm text-destructive">{mapping.erro}</p>}
                  {mapping.enviado && (
                    <p className="mt-2 text-sm">
                      Aperte o botão. Se ele fizer <strong>{mapping.acao}</strong>, o id{' '}
                      {mapping.keyId} está correto. Se outro botão mudou, anote qual. Religue o
                      mouse para reverter.
                    </p>
                  )}
                  <Button
                    className="mt-3"
                    size="sm"
                    variant="outline"
                    onClick={() => downloadJson('mapeamento-rawm.json', mapping)}
                  >
                    Baixar relatório
                  </Button>
                </div>
              )}
            </section>
          )}

          {report.snapshot && device && (
            <section className="mt-8 rounded-md border border-destructive/40 bg-destructive/5 p-4">
              <h2 className="text-lg font-semibold">Conjunto completo de mapeamentos</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                O <code>CONFIG_RESET</code> apaga todos os mapeamentos, entao so um conjunto
                completo sobrevive a ele. O que ficar de fora para de funcionar ate voce religar o
                mouse: foi assim que a roda se perdeu.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Depois de enviar, teste <strong>tudo</strong>: os seis botoes e a rolagem nos dois
                sentidos. Nada e gravado na flash.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <select
                  className="rounded-md border border-border bg-card px-2 py-1 text-sm"
                  value={setId}
                  onChange={(event) => setSetId(event.target.value)}
                >
                  {MAPPING_SETS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.rotulo}
                    </option>
                  ))}
                </select>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={!armed || busy}
                  onClick={() => {
                    const chosen = MAPPING_SETS.find((item) => item.id === setId);
                    if (!chosen) return;
                    setBusy(true);
                    setError(null);
                    probeMappingSet(device, chosen.entradas)
                      .then(setConjunto)
                      .catch((cause: unknown) =>
                        setError(cause instanceof Error ? cause.message : String(cause)),
                      )
                      .finally(() => setBusy(false));
                  }}
                >
                  Enviar conjunto
                </Button>
              </div>

              {conjunto && (
                <div className="mt-4">
                  <p className="text-sm">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${
                        conjunto.enviado ? statusStyles.aviso : statusStyles.falha
                      }`}
                    >
                      {conjunto.enviado ? 'ENVIADO - TESTE TUDO' : 'NAO ENVIADO'}
                    </span>{' '}
                    {conjunto.eventos} eventos
                  </p>
                  {conjunto.erro && (
                    <p className="mt-2 text-sm text-destructive">{conjunto.erro}</p>
                  )}
                  <ul className="mt-2 font-mono text-xs">
                    {conjunto.entradas.map((entry, index) => (
                      <li key={index}>
                        [{entry.keyIds.join(' + ')}] to {entry.acao}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="mt-3"
                    size="sm"
                    variant="outline"
                    onClick={() => downloadJson('conjunto-rawm.json', setReport)}
                  >
                    Baixar relatorio
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
