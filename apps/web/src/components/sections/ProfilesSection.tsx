import type { Peripheral, PeripheralSettings, ProfileSlot } from '@gearhub/shared';
import { Badge } from '@gearhub/ui/components/badge';
import { Button } from '@gearhub/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@gearhub/ui/components/dialog';
import { Input } from '@gearhub/ui/components/input';
import { cn } from '@gearhub/ui/lib/utils';
import { Download, FileText, Pencil, Upload } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { describeSettings } from '../../app/labels';
import { downloadJson } from '../../app/download';
import { findSection } from '../../app/sections';
import { useChangeCount, useEditorEntry, useProfileLoad } from '../../app/useEditor';
import { describeSlotOccupancy, validateProfileName } from '../../domain/profiles';
import { buildProfileFile, profileFileName, readProfileFile } from '../../domain/profileFile';
import { activeProfileName, profileSlots } from '../../domain/settings';
import { useEditorStore } from '../../store/editorStore';
import { ConfirmDialog } from '../ConfirmDialog';
import { ProfileLoadConfirm } from '../ProfileLoadConfirm';
import { SectionHeader } from './SectionHeader';

type NameDialogState = { slotIndex: number; mode: 'renomear' | 'gravar'; initial: string };
type ImportState =
  | { fileName: string; status: 'erro'; message: string }
  | { fileName: string; status: 'revisar'; settings: PeripheralSettings };

export function ProfilesSection({ device }: { device: Peripheral }) {
  const section = findSection(device.type, 'perfis');
  const entry = useEditorEntry(device);
  const changes = useChangeCount(device);
  const saveToSlot = useEditorStore((state) => state.saveToSlot);
  const renameProfile = useEditorStore((state) => state.renameProfile);
  const edit = useEditorStore((state) => state.edit);
  const { requestLoad, pendingSlot, clearPendingSlot } = useProfileLoad(device);

  const [nameDialog, setNameDialog] = useState<NameDialogState | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [importState, setImportState] = useState<ImportState | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const slots = profileSlots(device);

  async function handleFile(file: File) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setImportState({
        fileName: file.name,
        status: 'erro',
        message: 'O arquivo não é um perfil do OmniGear.',
      });
      return;
    }
    const result = readProfileFile(parsed, device);
    setImportState(
      result.ok
        ? { fileName: file.name, status: 'revisar', settings: result.file.ajustes }
        : { fileName: file.name, status: 'erro', message: result.message },
    );
  }

  return (
    <>
      <SectionHeader
        title={section?.title ?? 'Perfis'}
        description="Organize e salve suas configurações."
        actions={
          <>
            <Button variant="outline" onClick={() => fileInput.current?.click()}>
              <Upload className="size-4" aria-hidden="true" />
              Importar
            </Button>
            <Button variant="outline" onClick={() => setExportOpen(true)}>
              <Download className="size-4" aria-hidden="true" />
              Exportar
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void handleFile(file);
              }}
            />
          </>
        }
      />

      <ul className="grid gap-4 md:grid-cols-2">
        {slots.map((slot) => (
          <li key={slot.index}>
            <SlotCard
              device={device}
              slot={slot}
              active={slot.index === device.activeProfileSlot}
              onLoad={() => requestLoad(slot.index)}
              onRename={() =>
                setNameDialog({ slotIndex: slot.index, mode: 'renomear', initial: slot.name })
              }
              onWrite={() => setNameDialog({ slotIndex: slot.index, mode: 'gravar', initial: '' })}
            />
          </li>
        ))}
      </ul>

      <p className="mt-4 text-sm text-muted-foreground">{describeSlotOccupancy(slots)}</p>

      <ProfileLoadConfirm device={device} slotIndex={pendingSlot} onClose={clearPendingSlot} />

      <NameDialog
        key={nameDialog ? `${nameDialog.slotIndex}-${nameDialog.mode}` : 'sem-dialogo'}
        state={nameDialog}
        onClose={() => setNameDialog(null)}
        onConfirm={(name) => {
          if (!nameDialog) return;
          if (nameDialog.mode === 'renomear') renameProfile(device, nameDialog.slotIndex, name);
          else void saveToSlot(device, nameDialog.slotIndex, name);
        }}
      />

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        profileName={activeProfileName(device)}
        hasChanges={changes > 0}
        onExport={(source) => {
          const settings = source === 'atual' ? entry.draft : entry.saved;
          const profileName = activeProfileName(device);
          downloadJson(
            profileFileName(device, profileName),
            buildProfileFile(device, profileName, settings),
          );
        }}
      />

      {importState?.status === 'erro' && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setImportState(null);
          }}
          title="Não foi possível importar"
          description={
            <span className="flex flex-col gap-3">
              <span className="flex items-center gap-2 text-foreground">
                <FileText className="size-4" aria-hidden="true" />
                {importState.fileName}
              </span>
              <span>
                {importState.message}
                <br />
                As configurações atuais foram mantidas.
              </span>
            </span>
          }
          actions={[
            { label: 'Cancelar', onSelect: () => undefined },
            {
              label: 'Escolher outro arquivo',
              variant: 'default',
              onSelect: () => fileInput.current?.click(),
            },
          ]}
        />
      )}

      {importState?.status === 'revisar' && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setImportState(null);
          }}
          title="Importar configurações?"
          description={
            <span className="flex flex-col gap-2">
              <span className="flex items-center gap-2 text-foreground">
                <FileText className="size-4" aria-hidden="true" />
                {importState.fileName}
              </span>
              <span>Destino: {activeProfileName(device)}</span>
            </span>
          }
          note="O arquivo foi validado. Os ajustes serão carregados para revisão antes de salvar."
          actions={[
            { label: 'Cancelar', onSelect: () => undefined },
            {
              label: 'Importar',
              variant: 'default',
              onSelect: () => edit(device, () => structuredClone(importState.settings)),
            },
          ]}
        />
      )}
    </>
  );
}

function SlotCard({
  device,
  slot,
  active,
  onLoad,
  onRename,
  onWrite,
}: {
  device: Peripheral;
  slot: ProfileSlot<PeripheralSettings>;
  active: boolean;
  onLoad(): void;
  onRename(): void;
  onWrite(): void;
}) {
  const empty = slot.settings === null;

  return (
    <div
      className={cn(
        'flex h-full flex-col rounded-xl border bg-card p-4',
        active ? 'border-foreground' : 'border-border',
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Slot {slot.index}</span>
        {active && (
          <Badge variant="secondary" className="font-normal">
            Em uso
          </Badge>
        )}
      </div>

      {empty ? (
        <>
          <p className="mt-3 text-lg">Slot vazio</p>
          <p className="mt-1 text-sm text-muted-foreground">Salve as configurações atuais aqui.</p>
          <div className="mt-4 flex justify-end">
            <Button variant="outline" onClick={onWrite}>
              Gravar aqui
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-sm">{slot.name}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onRename}
              aria-label={`Renomear ${slot.name}`}
            >
              <Pencil className="size-4" aria-hidden="true" />
            </Button>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {slot.settings ? describeSettings(device, slot.settings) : ''}
          </p>
          <div className="mt-4 flex flex-1 items-end justify-end">
            {!active && (
              <Button variant="outline" onClick={onLoad}>
                Carregar
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function NameDialog({
  state,
  onClose,
  onConfirm,
}: {
  state: NameDialogState | null;
  onClose(): void;
  onConfirm(name: string): void;
}) {
  const fieldId = useId();
  const [name, setName] = useState(state?.initial ?? '');
  const [touched, setTouched] = useState(false);
  const validation = validateProfileName(name);
  const showError = touched && !validation.valid;

  return (
    <Dialog
      open={state !== null}
      onOpenChange={(open) => {
        if (open) return;
        onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {state?.mode === 'gravar' ? 'Nomear perfil' : 'Renomear perfil'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Informe o nome que identifica este perfil no dispositivo.
          </DialogDescription>
        </DialogHeader>

        <div>
          <label htmlFor={fieldId} className="text-sm text-muted-foreground">
            Nome do perfil
          </label>
          <Input
            id={fieldId}
            className="mt-1.5"
            value={name}
            maxLength={32}
            aria-invalid={showError ? true : undefined}
            aria-describedby={showError ? `${fieldId}-erro` : undefined}
            onChange={(event) => {
              setName(event.target.value);
              setTouched(true);
            }}
          />
          {showError && (
            <p id={`${fieldId}-erro`} role="alert" className="mt-1.5 text-sm text-destructive">
              {validation.valid ? '' : validation.message}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            disabled={!validation.valid}
            onClick={() => {
              if (!validation.valid) return;
              onConfirm(name.trim());
              onClose();
            }}
          >
            Salvar
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExportDialog({
  open,
  onOpenChange,
  profileName,
  hasChanges,
  onExport,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  profileName: string;
  hasChanges: boolean;
  onExport(source: 'atual' | 'salvo'): void;
}) {
  const [source, setSource] = useState<'atual' | 'salvo'>('atual');
  const name = useId();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar {profileName}</DialogTitle>
          <DialogDescription>
            {hasChanges
              ? 'O perfil tem alterações ainda não salvas.'
              : 'O perfil não tem alterações pendentes.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {(
            [
              { value: 'atual', label: 'Configurações atuais (inclui alterações)' },
              { value: 'salvo', label: 'Última versão salva' },
            ] as const
          ).map((option) => (
            <label key={option.value} className="flex items-center gap-3 text-sm">
              <input
                type="radio"
                name={name}
                className="size-4 accent-foreground"
                checked={source === option.value}
                onChange={() => setSource(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>

        <DialogFooter>
          <Button
            onClick={() => {
              onExport(source);
              onOpenChange(false);
            }}
          >
            Exportar arquivo
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
