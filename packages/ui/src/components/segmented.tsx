import { cn } from '../lib/utils';

export function Segmented<T extends number | string>({
  label,
  options,
  value,
  format = String,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  format?: (option: T) => string;
  onChange(option: T): void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1">
      {options.map((option) => {
        const selected = option === value;
        return (
          <button
            key={String(option)}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option)}
            className={cn(
              'tnum h-9 flex-1 rounded-md border text-sm transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fill-solid',
              selected
                ? 'border-fill-solid bg-fill-solid font-semibold text-fill-solid-text'
                : 'border-border-subtle bg-bg-surface text-text-muted hover:bg-bg-hover hover:text-text-primary',
            )}
          >
            {format(option)}
          </button>
        );
      })}
    </div>
  );
}
