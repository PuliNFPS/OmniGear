import { cn } from '@gearhub/ui/lib/utils';
import { useId } from 'react';

export interface Option<T extends string | number> {
  value: T;
  label: string;
}

/**
 * Joined choices for a small set of supported values. Native radios keep
 * arrow-key navigation and screen reader semantics.
 */
export function OptionGroup<T extends string | number>({
  label,
  options,
  value,
  onChange,
  disabled,
  className,
}: {
  label: string;
  options: Option<T>[];
  value: T;
  onChange(value: T): void;
  disabled?: boolean;
  className?: string;
}) {
  const name = useId();

  return (
    <fieldset className={cn('min-w-0', className)} disabled={disabled}>
      <legend className="sr-only">{label}</legend>
      <div className="flex flex-wrap overflow-hidden rounded-lg border border-border">
        {options.map((option, index) => {
          const selected = option.value === value;
          return (
            <label
              key={String(option.value)}
              className={cn(
                'relative flex-1 cursor-pointer',
                index > 0 && 'border-l border-border',
                disabled && 'cursor-not-allowed opacity-60',
              )}
            >
              <input
                type="radio"
                className="peer sr-only"
                name={name}
                value={String(option.value)}
                checked={selected}
                disabled={disabled}
                onChange={() => onChange(option.value)}
              />
              <span
                className={cn(
                  'block min-w-16 px-3 py-2.5 text-center text-sm transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-inset',
                  selected
                    ? 'bg-accent font-medium text-foreground'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                )}
              >
                {option.label}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
