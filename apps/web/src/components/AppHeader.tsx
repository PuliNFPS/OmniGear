import { Badge } from '@gearhub/ui/components/badge';
import { Moon, Sun, X } from 'lucide-react';
import type { Theme } from '../app/useTheme';
import { BrandMark } from './BrandMark';

export function AppHeader({
  demo,
  theme,
  onToggleTheme,
  onExitDemo,
}: {
  demo: boolean;
  theme: Theme;
  onToggleTheme(): void;
  onExitDemo(): void;
}) {
  const dark = theme === 'escuro';
  const action = dark ? 'Ativar tema claro' : 'Ativar tema escuro';

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface">
      <div className="flex h-16 items-center justify-between gap-2 px-4 sm:gap-4 sm:px-8">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <a
            href="#/"
            className="rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none"
          >
            <BrandMark />
          </a>
          {demo && (
            <Badge
              asChild
              variant="secondary"
              className="px-3 py-1.5 font-normal transition-colors hover:border-strong hover:bg-secondary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              <button type="button" onClick={onExitDemo} title="Sair da demonstração">
                Demonstração
                <X className="size-3" aria-hidden="true" />
              </button>
            </Badge>
          )}
        </div>
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={action}
          title={action}
          className="grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none"
        >
          {dark ? <Moon className="size-5" /> : <Sun className="size-5" />}
        </button>
      </div>
    </header>
  );
}
