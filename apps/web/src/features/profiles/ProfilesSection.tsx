import { isDirty } from '@gearhub/shared';
import { Panel, PanelRaised, SectionHeading } from '@gearhub/ui/components/panel';
import { useMouseStore } from '../../store/mouseStore';

export function ProfilesSection() {
  const session = useMouseStore((state) => state.session);
  const saveToSlot = useMouseStore((state) => state.saveToSlot);
  const selectSlot = useMouseStore((state) => state.selectSlot);
  if (!session) return null;

  const dirty = isDirty(session);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-3 p-8">
      <SectionHeading>Slots do mouse · {session.slots.length}</SectionHeading>

      <ul className="space-y-2">
        {session.slots.map((slot) => {
          const active = slot.index === session.activeSlotIndex;
          const SlotCard = active ? PanelRaised : Panel;
          return (
            <li key={slot.index}>
              <SlotCard className="flex items-center justify-between px-4 py-3">
                <span className="flex items-center gap-3">
                  <span className="tnum text-xs text-text-muted">{slot.index}</span>
                  <span className="text-sm text-text-primary">
                    {slot.profile ? slot.profile.name : 'Slot vazio'}
                  </span>
                  {active && <span className="text-xs text-text-muted">em uso</span>}
                </span>

                {slot.profile && !active ? (
                  <button
                    type="button"
                    onClick={() => void selectSlot(slot.index)}
                    className="rounded-md border border-border-strong px-3 py-1.5 text-xs text-text-primary hover:bg-bg-hover"
                  >
                    Carregar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void saveToSlot(slot.index)}
                    className="rounded-md border border-border-strong px-3 py-1.5 text-xs text-text-primary hover:bg-bg-hover"
                  >
                    {slot.profile ? 'Sobrescrever' : 'Gravar aqui'}
                  </button>
                )}
              </SlotCard>
            </li>
          );
        })}
      </ul>

      {dirty && (
        <p className="text-[13px] text-text-muted">
          O que está no mouse agora não corresponde ao slot {session.activeSlotIndex}. Grave para
          que sobreviva a desligar o computador.
        </p>
      )}
    </div>
  );
}
