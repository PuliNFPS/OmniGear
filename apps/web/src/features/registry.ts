import type { ComponentType } from 'react';
import { Gauge } from 'lucide-react';
import { PerformanceSection } from './performance/PerformanceSection';

export interface SectionDefinition {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  Component: ComponentType;
}

export const sectionRegistry: SectionDefinition[] = [
  { id: 'performance', label: 'Desempenho', icon: Gauge, Component: PerformanceSection },
];
