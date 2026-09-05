import { Panel, PanelRaised, SectionHeading } from '@gearhub/ui/components/panel';
import { Slider } from '@gearhub/ui/components/slider';
import { Switch } from '@gearhub/ui/components/switch';
import { useMouseStore } from '../../store/mouseStore';
import { nextStageColor, stageColorClass } from './stageColors';

export function DpiSection() {
  const session = useMouseStore((state) => state.session);
  const patchDraft = useMouseStore((state) => state.patchDraft);
  if (!session) return null;

  const { capabilities, draft } = session;
  const { stages } = draft.dpi;
  const canAdd = stages.length < capabilities.dpi.maxStages;
  const canRemove = stages.length > 1;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <SectionHeading>
          Estágios · {stages.length} de {capabilities.dpi.maxStages}
        </SectionHeading>
        {canAdd && (
          <button
            type="button"
            onClick={() =>
              patchDraft((profile) => {
                const color = nextStageColor(profile.dpi.stages.map((stage) => stage.color));
                const last = profile.dpi.stages.at(-1)!;
                profile.dpi.stages.push({
                  id: `s${Date.now()}`,
                  x: last.x,
                  y: last.y,
                  color,
                });
              })
            }
            className="rounded-md border border-border-strong px-3 py-1.5 text-xs text-text-primary hover:bg-bg-hover"
          >
            Adicionar estágio
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {stages.map((stage, index) => {
          const active = stage.id === draft.dpi.activeStageId;
          const StageCard = active ? PanelRaised : Panel;
          return (
            <StageCard key={stage.id} className="p-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-text-secondary">
                  <span
                    aria-hidden
                    className={`size-2 rounded-full ${stageColorClass(stage.color)}`}
                  />
                  Estágio {index + 1}
                </span>
                <span className="tnum text-sm font-semibold text-text-primary">{stage.x}</span>
              </div>

              <div className="mt-3">
                <Slider
                  aria-label={`DPI do estágio ${index + 1}`}
                  min={capabilities.dpi.min}
                  max={capabilities.dpi.max}
                  step={capabilities.dpi.step}
                  value={[stage.x]}
                  onValueChange={([next]) =>
                    patchDraft((profile) => {
                      const target = profile.dpi.stages[index]!;
                      target.x = next!;
                      if (!profile.dpi.independentXY) target.y = next!;
                    })
                  }
                />
              </div>

              <div className="mt-3 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() =>
                    patchDraft((profile) => {
                      profile.dpi.activeStageId = stage.id;
                    })
                  }
                  className={
                    active ? 'text-text-primary' : 'text-text-muted hover:text-text-primary'
                  }
                >
                  {active ? 'Estágio ativo' : 'Tornar ativo'}
                </button>
                {canRemove && (
                  <button
                    type="button"
                    onClick={() =>
                      patchDraft((profile) => {
                        profile.dpi.stages = profile.dpi.stages.filter((s) => s.id !== stage.id);
                        if (profile.dpi.activeStageId === stage.id) {
                          profile.dpi.activeStageId = profile.dpi.stages[0]!.id;
                        }
                      })
                    }
                    className="text-text-muted hover:text-text-primary"
                  >
                    Remover
                  </button>
                )}
              </div>
            </StageCard>
          );
        })}
      </div>

      {capabilities.dpi.independentXY && (
        <Panel className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-text-secondary">Eixos X/Y independentes</span>
          <Switch
            aria-label="Eixos X/Y independentes"
            checked={draft.dpi.independentXY}
            onCheckedChange={(checked) =>
              patchDraft((profile) => {
                profile.dpi.independentXY = checked;
                if (!checked) for (const stage of profile.dpi.stages) stage.y = stage.x;
              })
            }
          />
        </Panel>
      )}
    </div>
  );
}
