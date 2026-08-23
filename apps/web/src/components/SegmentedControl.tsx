import { cn } from '@gearhub/ui/lib/utils';

export function SegmentedControl({
  label,
  options,
  value,
  suffix,
  disabled,
  onChange,
}: {
  label: string;
  options: number[];
  value?: number;
  suffix?: string;
  disabled?: boolean;
  onChange(value: number): void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          disabled={disabled}
          onClick={() => onChange(option)}
          className={cn(
            'h-11 rounded-lg border text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60',
            value === option
              ? 'border-primary/50 bg-primary/10 text-foreground shadow-[inset_0_0_0_1px_hsl(var(--primary)/.08)]'
              : 'border-border bg-surface text-muted-foreground hover:border-strong hover:text-foreground',
          )}
        >
          {option}
          {suffix && <span className="ml-1 text-xs font-normal opacity-65">{suffix}</span>}
        </button>
      ))}
    </div>
  );
}
