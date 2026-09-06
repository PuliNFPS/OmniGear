import { useCallback, useEffect, useState } from 'react';

export type Theme = 'claro' | 'escuro';

const STORAGE_KEY = 'omnigear:tema';

function storedTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'claro' || stored === 'escuro' ? stored : null;
  } catch {
    return null;
  }
}

function systemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro';
}

/** Keeps the chosen theme; falls back to the system preference on first visit. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => storedTheme() ?? systemTheme());

  useEffect(() => {
    const root = document.documentElement;
    // Transitions are suppressed while the class swaps so the whole interface
    // changes in one frame instead of the background leading and the rest following.
    root.setAttribute('data-theme-switching', '');
    root.classList.toggle('dark', theme === 'escuro');

    // One frame for the new class to apply, a second for the styles to settle.
    const frame = requestAnimationFrame(() =>
      requestAnimationFrame(() => root.removeAttribute('data-theme-switching')),
    );
    return () => cancelAnimationFrame(frame);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === 'escuro' ? 'claro' : 'escuro';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // A blocked storage must not prevent the theme from changing.
      }
      return next;
    });
  }, []);

  return { theme, toggleTheme };
}
