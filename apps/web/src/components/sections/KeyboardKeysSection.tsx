import type { KeyboardPeripheral } from '@gearhub/shared';
import { Badge } from '@gearhub/ui/components/badge';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@gearhub/ui/components/select';
import { useId, useState } from 'react';
import { findSection } from '../../app/sections';
import { useKeyboardEditor } from '../../app/useEditor';
import { KeyboardPhoto } from '../devices/KeyboardPhoto';
import { SectionHeader } from './SectionHeader';

export function KeyboardKeysSection({ device }: { device: KeyboardPeripheral }) {
  const section = findSection('keyboard', 'teclas');
  const { draft, update } = useKeyboardEditor(device);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const fieldId = useId();

  const { keys, actions } = device.capabilities;
  const selectedKey = keys.find((key) => key.id === selectedId) ?? null;
  const remappedIds = Object.keys(draft.keymap);

  function assignmentOf(keyId: string): string {
    return draft.keymap[keyId] ?? keyId;
  }

  function labelOfAction(actionId: string): string {
    return actions.find((action) => action.id === actionId)?.label ?? actionId;
  }

  function assign(keyId: string, actionId: string) {
    update((current) => {
      const keymap = { ...current.keymap };
      if (actionId === keyId) delete keymap[keyId];
      else keymap[keyId] = actionId;
      return { ...current, keymap };
    });
  }

  const groups = [...new Set(actions.map((action) => action.group))];

  return (
    <>
      <SectionHeader
        title={section?.title ?? 'Teclas'}
        description="Selecione uma tecla e escolha sua função."
      />

      {/* Below the minimum width the keys are too small to hit, so the photo scrolls. */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card p-4 sm:p-6">
        <KeyboardPhoto
          photo={device.photo}
          className="max-w-3xl min-w-[520px]"
          keys={keys}
          selectedKeyId={selectedId}
          remappedKeyIds={remappedIds}
          onSelectKey={(keyId) => setSelectedId((current) => (current === keyId ? null : keyId))}
          describeKey={(key) => {
            const assignment = assignmentOf(key.id);
            if (key.remappable === false) return `Tecla ${key.label}, sem remapeamento`;
            return assignment === key.id
              ? `Tecla ${key.label}`
              : `Tecla ${key.label}, atribuída a ${labelOfAction(assignment)}`;
          }}
        />
      </div>

      {selectedKey ? (
        <div className="panel-shadow mt-5 max-w-sm rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{selectedKey.label}</p>
            <Badge variant="secondary" className="font-normal">
              Tecla selecionada
            </Badge>
          </div>

          <label htmlFor={fieldId} className="mt-3 block text-xs text-muted-foreground">
            Ação atribuída
          </label>
          <Select
            value={assignmentOf(selectedKey.id)}
            onValueChange={(value) => assign(selectedKey.id, value)}
          >
            <SelectTrigger id={fieldId} className="mt-1 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {groups.map((group) => (
                <SelectGroup key={group}>
                  <SelectLabel>{group}</SelectLabel>
                  {actions
                    .filter((action) => action.group === group)
                    .map((action) => (
                      <SelectItem key={action.id} value={action.id}>
                        {action.label}
                      </SelectItem>
                    ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>

          <p className="mt-2 text-sm text-muted-foreground">
            {assignmentOf(selectedKey.id) === 'desativado'
              ? 'A tecla não envia nenhuma função.'
              : `Funciona como ${labelOfAction(assignmentOf(selectedKey.id))}.`}
          </p>

          <button
            type="button"
            disabled={draft.keymap[selectedKey.id] === undefined}
            onClick={() => assign(selectedKey.id, selectedKey.id)}
            className="mt-3 rounded-md text-sm underline underline-offset-4 transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
          >
            Restaurar tecla
          </button>
        </div>
      ) : (
        <p className="mt-5 text-sm text-muted-foreground">
          {remappedIds.length === 0
            ? 'Nenhuma tecla remapeada neste perfil.'
            : `${remappedIds.length} ${remappedIds.length === 1 ? 'tecla remapeada' : 'teclas remapeadas'} neste perfil.`}
        </p>
      )}
    </>
  );
}
