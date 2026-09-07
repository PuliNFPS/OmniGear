import type { Peripheral } from '@gearhub/shared';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@gearhub/ui/components/select';
import { cn } from '@gearhub/ui/lib/utils';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { describeDevice } from '../app/labels';
import { defaultSectionFor, deviceRoute, routeToHash } from '../app/routes';
import { findSection, sectionsFor } from '../app/sections';
import { useChangeCount, useEditorEntry, useProfileLoad } from '../app/useEditor';
import { navigate } from '../app/useRoute';
import { activeProfileName, isKeyboard, isMouse, profileSlots } from '../domain/settings';
import { useDeviceStore } from '../store/deviceStore';
import { useEditorStore } from '../store/editorStore';
import { BatteryLevel } from './BatteryLevel';
import { ChangeBar } from './ChangeBar';
import { ConfirmDialog } from './ConfirmDialog';
import { ProfileLoadConfirm } from './ProfileLoadConfirm';
import { DpiSection } from './sections/DpiSection';
import { GeneralSection } from './sections/GeneralSection';
import { KeyboardKeysSection } from './sections/KeyboardKeysSection';
import { LightingSection } from './sections/LightingSection';
import { MouseButtonsSection } from './sections/MouseButtonsSection';
import { ParametersSection } from './sections/ParametersSection';
import { PerformanceSection } from './sections/PerformanceSection';
import { ProfilesSection } from './sections/ProfilesSection';

export function DeviceWorkspace({ device, sectionId }: { device: Peripheral; sectionId: string }) {
  const sections = sectionsFor(device.type);
  const section = findSection(device.type, sectionId);
  const entry = useEditorEntry(device);
  const changes = useChangeCount(device);
  const discard = useEditorStore((state) => state.discard);
  const save = useEditorStore((state) => state.save);
  const retry = useEditorStore((state) => state.retry);
  const reconnect = useDeviceStore((state) => state.reconnect);
  const { requestLoad, pendingSlot, clearPendingSlot } = useProfileLoad(device);
  const [discardOpen, setDiscardOpen] = useState(false);
  const contentRef = useRef<HTMLElement>(null);
  const saving = entry.status === 'gravando';

  useEffect(() => {
    contentRef.current?.focus({ preventScroll: true });
  }, [device.id, sectionId]);

  useEffect(() => {
    if (!section)
      navigate(deviceRoute(device.id, defaultSectionFor(device.type)), { replace: true });
  }, [section, device.id, device.type]);

  if (!section) return null;

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <aside className="border-b border-border bg-surface lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:w-64 lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-b-0">
        <div className="px-5 py-4 lg:py-6">
          <a
            href="#/"
            className="inline-flex items-center gap-2 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Dispositivos
          </a>

          <div className="mt-3 grid grid-cols-2 items-center gap-3 lg:mt-4 lg:block">
            {/* Below lg the name shares a wide row with the profile select, and
                spreading the two apart would strand the charge next to the select
                instead of the name. */}
            <div className="flex min-w-0 items-center gap-2 lg:justify-between">
              <h2 className="truncate text-[15px] font-medium">{device.name}</h2>
              <BatteryLevel device={device} className="shrink-0 text-sm" />
            </div>
            <p className="sr-only">{describeDevice(device)}</p>

            <div className="min-w-0 lg:mt-3">
              <label className="sr-only" htmlFor="perfil-ativo">
                Perfil em uso
              </label>
              <Select
                disabled={saving}
                value={String(device.activeProfileSlot)}
                onValueChange={(value) => requestLoad(Number(value))}
              >
                <SelectTrigger id="perfil-ativo" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/* Every onboard slot the device reports, occupied or not — the
                      vendor hub lists all four the same way. */}
                  {profileSlots(device).map((slot) => (
                    <SelectItem key={slot.index} value={String(slot.index)}>
                      {slot.name || `Slot ${slot.index}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <nav
            aria-label={`Configurações de ${device.name}`}
            className="mt-4 flex gap-1 overflow-x-auto border-t border-border pt-3 pb-1 lg:flex-col lg:gap-0.5"
          >
            {sections.map((item) => {
              const active = item.id === section.id;
              return (
                <a
                  key={item.id}
                  href={routeToHash(deviceRoute(device.id, item.id))}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                    active
                      ? 'bg-accent font-medium text-foreground'
                      : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                  )}
                >
                  <item.icon className="size-4 shrink-0" aria-hidden="true" />
                  {item.label}
                </a>
              );
            })}
          </nav>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <main
          ref={contentRef}
          id="conteudo"
          tabIndex={-1}
          aria-label={section.title}
          className="flex-1 focus:outline-none"
        >
          <fieldset
            disabled={saving}
            aria-busy={saving}
            className="mx-auto min-w-0 w-full max-w-5xl px-5 py-8 sm:px-8 sm:py-10"
          >
            <SectionContent device={device} sectionId={section.id} />
          </fieldset>
        </main>

        <ChangeBar
          status={entry.status}
          changes={changes}
          profileName={activeProfileName(device)}
          savedProfileName={entry.savedProfileName}
          offline={device.status === 'desconectado'}
          hint={section.hint}
          onDiscard={() => setDiscardOpen(true)}
          onSave={() => void save(device)}
          onRetry={() => retry(device)}
          onReconnect={() => {
            reconnect(device.id);
            retry(device);
          }}
        />
      </div>

      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Descartar alterações?"
        description="Os ajustes não salvos serão perdidos."
        actions={[
          { label: 'Continuar editando', onSelect: () => undefined },
          { label: 'Descartar', variant: 'default', onSelect: () => discard(device) },
        ]}
      />

      <ProfileLoadConfirm device={device} slotIndex={pendingSlot} onClose={clearPendingSlot} />
    </div>
  );
}

function SectionContent({ device, sectionId }: { device: Peripheral; sectionId: string }) {
  if (sectionId === 'perfis') return <ProfilesSection device={device} />;
  if (sectionId === 'geral') return <GeneralSection device={device} />;

  if (isMouse(device)) {
    switch (sectionId) {
      case 'botoes':
        return <MouseButtonsSection device={device} />;
      case 'dpi':
        return <DpiSection device={device} />;
      case 'desempenho':
        return <PerformanceSection device={device} />;
      case 'parametros':
        return <ParametersSection device={device} />;
      default:
        return null;
    }
  }

  if (isKeyboard(device)) {
    switch (sectionId) {
      case 'teclas':
        return <KeyboardKeysSection device={device} />;
      case 'iluminacao':
        return <LightingSection device={device} />;
      default:
        return null;
    }
  }

  return null;
}
