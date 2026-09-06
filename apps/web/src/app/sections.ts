import type { PeripheralType } from '@gearhub/shared';
import {
  Crosshair,
  Gauge,
  Keyboard,
  Lightbulb,
  Mouse,
  Settings,
  SlidersHorizontal,
  UserRound,
  type LucideIcon,
} from 'lucide-react';

export interface SectionDefinition {
  id: string;
  label: string;
  title: string;
  description: string;
  /** Guidance shown in the change bar while nothing is selected. */
  hint?: string;
  icon: LucideIcon;
}

const mouseSections: SectionDefinition[] = [
  {
    id: 'botoes',
    label: 'Botões',
    title: 'Botões',
    description: 'Escolha um botão e defina sua ação.',
    hint: 'Selecione um botão no mouse.',
    icon: Mouse,
  },
  {
    id: 'dpi',
    label: 'DPI',
    title: 'DPI',
    description: 'Ajuste a sensibilidade do mouse.',
    icon: Crosshair,
  },
  {
    id: 'desempenho',
    label: 'Desempenho',
    title: 'Desempenho',
    description: 'Defina com que frequência o mouse informa sua posição.',
    icon: Gauge,
  },
  {
    id: 'parametros',
    label: 'Parâmetros',
    title: 'Parâmetros',
    description: 'Ajustes finos do sensor, dos cliques e da energia.',
    icon: SlidersHorizontal,
  },
  {
    id: 'perfis',
    label: 'Perfis',
    title: 'Perfis',
    description: 'Organize e salve suas configurações.',
    icon: UserRound,
  },
  {
    id: 'geral',
    label: 'Geral',
    title: 'Geral',
    description: 'Informações do dispositivo e manutenção do perfil.',
    icon: Settings,
  },
];

const keyboardSections: SectionDefinition[] = [
  {
    id: 'teclas',
    label: 'Teclas',
    title: 'Teclas',
    description: 'Escolha uma tecla e defina sua função.',
    hint: 'Selecione uma tecla no teclado.',
    icon: Keyboard,
  },
  {
    id: 'iluminacao',
    label: 'Iluminação',
    title: 'Iluminação',
    description: 'Efeito, cor e intensidade da iluminação do teclado.',
    icon: Lightbulb,
  },
  {
    id: 'perfis',
    label: 'Perfis',
    title: 'Perfis',
    description: 'Organize e salve suas configurações.',
    icon: UserRound,
  },
  {
    id: 'geral',
    label: 'Geral',
    title: 'Geral',
    description: 'Informações do dispositivo e manutenção do perfil.',
    icon: Settings,
  },
];

export function sectionsFor(type: PeripheralType): SectionDefinition[] {
  return type === 'mouse' ? mouseSections : keyboardSections;
}

export function findSection(type: PeripheralType, id: string): SectionDefinition | undefined {
  return sectionsFor(type).find((section) => section.id === id);
}
