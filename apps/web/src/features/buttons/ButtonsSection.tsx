import { SectionHeading } from '@gearhub/ui/components/panel';
import { useState } from 'react';
import { MouseRender } from '../../components/MouseRender/MouseRender';
import { useMouseStore } from '../../store/mouseStore';
import { ActionPicker } from './ActionPicker';
import { actionLabel } from './actionLabel';

export function ButtonsSection() {
  const session = useMouseStore((state) => state.session);
  const patchDraft = useMouseStore((state) => state.patchDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  if (!session) return null;

  const { capabilities, draft } = session;
  const editing = capabilities.buttons.find((button) => button.id === editingId);

  return (
    <div className="mx-auto w-full max-w-3xl p-8">
      <SectionHeading>Botões</SectionHeading>

      <div className="mt-3">
        <MouseRender
          renderId={capabilities.renderId}
          buttons={capabilities.buttons}
          activeButtonId={editingId ?? undefined}
          onSelectButton={setEditingId}
        />
      </div>

      <ul className="mx-auto mt-8 max-w-md space-y-1">
        {capabilities.buttons.map((button) => (
          <li
            key={button.id}
            className="flex items-center justify-between border-b border-border-subtle py-2 text-sm last:border-0"
          >
            <span className="text-text-muted">{button.label}</span>
            <span className="text-text-primary">
              {draft.bindings[button.id] ? actionLabel(draft.bindings[button.id]!) : '—'}
            </span>
          </li>
        ))}
      </ul>

      <ActionPicker
        open={editing !== undefined}
        buttonLabel={editing?.label ?? ''}
        onOpenChange={(open) => !open && setEditingId(null)}
        onPick={(action) =>
          patchDraft((profile) => {
            if (editing) profile.bindings[editing.id] = action;
          })
        }
      />
    </div>
  );
}
