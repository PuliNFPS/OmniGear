import type { ComponentType } from 'react';
import { PerformanceSection } from './performance/PerformanceSection';

export interface SectionDefinition {
  id: string;
  label: string;
  Component: ComponentType;
}

export const sectionRegistry: SectionDefinition[] = [
  { id: 'performance', label: 'Desempenho', Component: PerformanceSection },
];
