import type { ComponentProps, ElementType, ReactNode } from 'react';
import { cn } from '../lib/utils';

/** Superfície que agrupa controles relacionados. Elevação vem de bg + borda, nunca de sombra. */
export function Panel({ className, ...props }: ComponentProps<'section'>) {
  return (
    <section
      className={cn('rounded-xl border border-border-subtle bg-bg-surface', className)}
      {...props}
    />
  );
}

/** Um degrau acima do Panel: card selecionado, ou card dentro de card. */
export function PanelRaised({ className, ...props }: ComponentProps<'section'>) {
  return (
    <section
      className={cn('rounded-xl border border-border-strong bg-bg-raised', className)}
      {...props}
    />
  );
}

export function SectionHeading({
  as: Tag = 'h2',
  children,
}: {
  as?: ElementType;
  children: ReactNode;
}) {
  return (
    <Tag className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
      {children}
    </Tag>
  );
}
