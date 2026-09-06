import { Button } from '@gearhub/ui/components/button';
import { cn } from '@gearhub/ui/lib/utils';
import { CircleAlert, CircleCheck, LoaderCircle, Unplug } from 'lucide-react';
import type { ReactNode } from 'react';
import { describeChangeCount } from '../domain/changes';
import type { EditorStatus } from '../store/editorStore';

interface ChangeBarProps {
  status: EditorStatus;
  changes: number;
  profileName: string;
  savedProfileName?: string;
  offline: boolean;
  /** Contextual guidance for the current screen, shown while editing. */
  hint?: string;
  onDiscard(): void;
  onSave(): void;
  onRetry(): void;
  onReconnect(): void;
}

interface BarContent {
  /** Identifies the visual state, so the bar replays its entrance when it changes. */
  key: string;
  icon: ReactNode;
  title: string;
  detail?: string;
  actions: ReactNode;
  destructive?: boolean;
  muted?: boolean;
}

const spinner = (
  <LoaderCircle className="size-4 shrink-0 motion-safe:animate-spin" aria-hidden="true" />
);

export function ChangeBar({
  status,
  changes,
  profileName,
  savedProfileName,
  offline,
  hint,
  onDiscard,
  onSave,
  onRetry,
  onReconnect,
}: ChangeBarProps) {
  const saveButton = (disabled: boolean) => (
    <Button key="save" onClick={onSave} disabled={disabled}>
      Salvar no perfil
    </Button>
  );

  const content = ((): BarContent => {
    if (offline) {
      return {
        key: 'offline',
        icon: <Unplug className="size-4" aria-hidden="true" />,
        title: 'Dispositivo desconectado',
        detail: 'Seu rascunho foi mantido. Reconecte para aplicar e salvar.',
        actions: (
          <>
            <Button variant="outline" onClick={onReconnect}>
              Reconectar
            </Button>
            {saveButton(true)}
          </>
        ),
      };
    }

    switch (status) {
      case 'aplicando':
        return {
          key: 'aplicando',
          icon: spinner,
          title: 'Aplicando ajustes…',
          detail:
            changes > 0
              ? 'A gravação no perfil ainda está pendente.'
              : 'Carregando os ajustes salvos.',
          actions: saveButton(true),
        };
      case 'gravando':
        return {
          key: 'gravando',
          icon: spinner,
          title: `Salvando no ${savedProfileName ?? profileName}…`,
          actions: saveButton(true),
        };
      case 'gravado':
        return {
          key: 'gravado',
          icon: <CircleCheck className="size-4" aria-hidden="true" />,
          title: `Alterações salvas no ${savedProfileName ?? profileName}`,
          detail:
            changes > 0
              ? `O ${profileName} ainda tem ${describeChangeCount(changes)}.`
              : 'Nenhuma alteração pendente.',
          actions: saveButton(changes === 0),
        };
      case 'falha-gravacao':
      case 'falha-aplicacao':
        return {
          key: status,
          destructive: true,
          icon: <CircleAlert className="size-4 text-destructive" aria-hidden="true" />,
          title:
            status === 'falha-gravacao'
              ? 'Não foi possível salvar.'
              : 'Não foi possível aplicar os ajustes.',
          detail: 'Suas alterações foram preservadas.',
          actions: (
            <>
              <Button onClick={onRetry}>Tentar novamente</Button>
              <Button variant="outline" onClick={onDiscard}>
                Descartar
              </Button>
            </>
          ),
        };
      default:
        if (changes === 0) {
          return {
            key: 'limpo',
            muted: true,
            icon: <span className="size-1.5 rounded-full bg-strong" aria-hidden="true" />,
            title: 'Nenhuma alteração pendente.',
            actions: saveButton(true),
          };
        }
        return {
          key: 'sujo',
          icon: <span className="size-1.5 rounded-full bg-foreground" aria-hidden="true" />,
          title: describeChangeCount(changes),
          actions: (
            <>
              <Button variant="ghost" onClick={onDiscard}>
                Descartar
              </Button>
              {saveButton(false)}
            </>
          ),
        };
    }
  })();

  return (
    <div
      className={cn(
        'sticky bottom-0 z-20 border-t bg-surface transition-colors',
        content.destructive ? 'border-destructive' : 'border-border',
      )}
    >
      {/* Keep the action area stable while status text changes. */}
      <div className="mx-auto flex min-h-[76px] w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-8">
        <div
          className="flex min-w-0 basis-full sm:basis-0 sm:flex-1 items-center gap-2.5"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {/* Keyed so a new state re-enters; the aria-live element above stays put. */}
          <div
            key={content.key}
            className="flex min-w-0 flex-1 items-center gap-2.5 motion-safe:animate-bar-in motion-reduce:animate-fade-in"
          >
            {content.icon}
            <div className="min-w-0">
              <p className={cn('text-sm', content.muted && 'text-muted-foreground')}>
                {content.title}
              </p>
              {content.detail && <p className="text-xs text-muted-foreground">{content.detail}</p>}
            </div>
          </div>
        </div>
        {hint && changes === 0 && (
          <p className="hidden text-sm text-muted-foreground lg:block">{hint}</p>
        )}
        {content.actions && (
          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
            {content.actions}
          </div>
        )}
      </div>
    </div>
  );
}
