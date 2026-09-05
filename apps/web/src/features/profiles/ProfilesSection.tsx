import { useState } from 'react';
import { isDirty } from '@gearhub/shared';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@gearhub/ui/components/dialog';
import { Panel, PanelRaised, SectionHeading } from '@gearhub/ui/components/panel';
import { useMouseStore } from '../../store/mouseStore';

export function ProfilesSection() {
  const session = useMouseStore((state) => state.session);
  const saveToSlot = useMouseStore((state) => state.saveToSlot);
  const selectSlot = useMouseStore((state) => state.selectSlot);
  // Slot aguardando confirmação: carregar por cima de um draft sujo descarta
  // silenciosamente o que está no mouse e nunca foi gravado num slot.
  const [pendingLoadIndex, setPendingLoadIndex] = useState<number | null>(null);
  if (!session) return null;

  const dirty = isDirty(session);

  function requestLoad(index: number) {
    // Sem nada para perder, o gate só treinaria o usuário a clicar sem ler.
    if (dirty) {
      setPendingLoadIndex(index);
    } else {
      void selectSlot(index);
    }
  }

  function confirmLoad() {
    if (pendingLoadIndex !== null) void selectSlot(pendingLoadIndex);
    setPendingLoadIndex(null);
  }

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
                    onClick={() => requestLoad(slot.index)}
                    aria-label={`Carregar o slot ${slot.index}`}
                    className="rounded-md border border-border-strong px-3 py-1.5 text-xs text-text-primary hover:bg-bg-hover"
                  >
                    Carregar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void saveToSlot(slot.index)}
                    aria-label={
                      slot.profile
                        ? `Sobrescrever o slot ${slot.index}`
                        : `Gravar no slot ${slot.index}`
                    }
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

      <Dialog
        open={pendingLoadIndex !== null}
        onOpenChange={(open) => !open && setPendingLoadIndex(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Carregar o slot {pendingLoadIndex}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-text-muted">
            O que está no mouse agora nunca foi gravado num slot e será substituído pelo perfil do
            slot {pendingLoadIndex}. Cancelar não muda nada.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPendingLoadIndex(null)}
              className="rounded-md border border-border-strong px-3 py-1.5 text-xs text-text-primary hover:bg-bg-hover"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmLoad}
              className="rounded-md border border-border-strong px-3 py-1.5 text-xs text-text-primary hover:bg-bg-hover"
            >
              Carregar
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
