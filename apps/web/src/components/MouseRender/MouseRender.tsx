import type { MouseButton, MouseRenderId } from '@gearhub/shared';
import { SHELLS } from './shells';

export function MouseRender({
  renderId,
  buttons,
  activeButtonId,
  onSelectButton,
}: {
  renderId: MouseRenderId;
  buttons: MouseButton[];
  activeButtonId?: string;
  onSelectButton(buttonId: string): void;
}) {
  const shell = SHELLS[renderId];
  const [, , vbWidth, vbHeight] = shell.viewBox.split(/\s+/).map(Number);

  return (
    <div className="relative mx-auto w-[220px]" style={{ aspectRatio: `${vbWidth} / ${vbHeight}` }}>
      <svg viewBox={shell.viewBox} className="h-full w-full" aria-hidden>
        <path d={shell.outline} className="fill-bg-raised stroke-border-strong" strokeWidth={1.5} />
        <path d={shell.seam} className="stroke-border-subtle" fill="none" strokeWidth={1} />
      </svg>

      {buttons.map((button) => {
        const active = button.id === activeButtonId;
        return (
          <button
            key={button.id}
            type="button"
            aria-label={button.label}
            aria-pressed={active}
            disabled={!button.remappable}
            onClick={() => onSelectButton(button.id)}
            style={{
              left: `${button.hotspot.x * 100}%`,
              top: `${button.hotspot.y * 100}%`,
              transform: 'translate(-50%, -50%)',
            }}
            className={`absolute rounded-md border px-2 py-1 text-[11px] transition-colors ${
              active
                ? 'border-fill-solid bg-fill-solid font-semibold text-fill-solid-text'
                : 'border-border-strong bg-bg-raised text-text-secondary hover:text-text-primary'
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {button.label}
          </button>
        );
      })}
    </div>
  );
}
