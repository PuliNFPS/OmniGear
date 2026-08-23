import type { ReactNode } from 'react';

export function SettingRow({
  title,
  description,
  indicator,
  children,
}: {
  title: string;
  description: string;
  indicator?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="setting-row">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
          {indicator}
        </div>
        <p className="mt-1 max-w-sm text-[13px] leading-5 text-muted-foreground">{description}</p>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </section>
  );
}
