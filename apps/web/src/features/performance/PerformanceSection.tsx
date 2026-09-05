import { estimateRuntimeHours } from '@gearhub/shared';
import { Panel, SectionHeading } from '@gearhub/ui/components/panel';
import { Segmented } from '@gearhub/ui/components/segmented';
import { useMouseStore } from '../../store/mouseStore';

const formatRate = (rate: number) => (rate >= 1000 ? `${rate / 1000}K` : String(rate));

export function PerformanceSection() {
  const session = useMouseStore((state) => state.session);
  const patchDraft = useMouseStore((state) => state.patchDraft);
  if (!session) return null;

  const { capabilities, draft } = session;
  const runtime = estimateRuntimeHours(capabilities, draft.pollingRate);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 p-8">
      <section>
        <SectionHeading>Taxa de reporte</SectionHeading>
        <div className="mt-3">
          <Segmented
            label="Taxa de reporte"
            options={capabilities.pollingRate.supported}
            value={draft.pollingRate}
            format={formatRate}
            onChange={(rate) =>
              patchDraft((profile) => {
                profile.pollingRate = rate;
              })
            }
          />
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-text-muted">
          <span>Trabalho</span>
          <span>Competitivo</span>
        </div>
      </section>

      {runtime && (
        <Panel className="p-5">
          <SectionHeading>Autonomia estimada</SectionHeading>
          <p className="tnum mt-2 text-3xl tracking-tight text-text-primary">
            {runtime[0]}–{runtime[1]} h
          </p>
          <p className="mt-2 text-[13px] text-text-muted">
            Com a bateria cheia, na taxa de reporte selecionada.
          </p>
        </Panel>
      )}
    </div>
  );
}
