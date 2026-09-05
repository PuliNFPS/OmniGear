import type { ComponentType } from 'react';
import { Crosshair, Gauge, MousePointerClick, SlidersHorizontal } from 'lucide-react';
import { ButtonsSection } from './buttons/ButtonsSection';
import { DpiSection } from './dpi/DpiSection';
import { ParametersSection } from './parameters/ParametersSection';
import { PerformanceSection } from './performance/PerformanceSection';

export interface SectionDefinition {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  Component: ComponentType;
}

export const sectionRegistry: SectionDefinition[] = [
  { id: 'buttons', label: 'Botões', icon: MousePointerClick, Component: ButtonsSection },
  { id: 'dpi', label: 'DPI', icon: Crosshair, Component: DpiSection },
  { id: 'performance', label: 'Desempenho', icon: Gauge, Component: PerformanceSection },
  { id: 'parameters', label: 'Parâmetros', icon: SlidersHorizontal, Component: ParametersSection },
];
