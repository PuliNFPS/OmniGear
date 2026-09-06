import type {
  KeyboardAction,
  KeyboardKeySpot,
  KeyboardPeripheral,
  KeyboardSettings,
  MouseActionId,
  MouseButtonSpot,
  MousePeripheral,
  MouseSettings,
  PeripheralPhoto,
} from '@gearhub/shared';

/**
 * Simulated peripherals used by the demonstration. They borrow the layout and
 * the controls of the models they are named after so the interface can be seen
 * in use; the values are not hardware measurements, nothing here talks to that
 * hardware, and every screen marks them as a demonstration.
 */

/** Photo of the mouse, cropped to the product. 603 × 1200 in the file. */
const mousePhoto: PeripheralPhoto = {
  src: '/dispositivos/viper-v4-pro.webp',
  aspect: 603 / 1200,
};

/** Fractions of the photo, measured over the controls of the model. */
const mouseButtons: MouseButtonSpot[] = [
  { id: 'esquerdo', label: 'Clique esquerdo', position: { x: 0.27, y: 0.3 }, callout: 'esquerda' },
  { id: 'direito', label: 'Clique direito', position: { x: 0.73, y: 0.3 }, callout: 'direita' },
  { id: 'central', label: 'Clique central', position: { x: 0.5, y: 0.165 }, callout: 'direita' },
  {
    id: 'lateral-dianteiro',
    label: 'Lateral dianteiro',
    position: { x: 0.045, y: 0.4 },
    callout: 'esquerda',
  },
  {
    id: 'lateral-traseiro',
    label: 'Lateral traseiro',
    position: { x: 0.045, y: 0.555 },
    callout: 'esquerda',
  },
];

const mouseActions: MouseActionId[] = [
  'clique-esquerdo',
  'clique-direito',
  'clique-central',
  'voltar',
  'avancar',
  'dpi-ciclo',
  'dpi-aumentar',
  'dpi-diminuir',
  'rolagem-cima',
  'rolagem-baixo',
  'desativado',
];

const demoMouseDefaults: MouseSettings = {
  buttons: {
    esquerdo: 'clique-esquerdo',
    direito: 'clique-direito',
    central: 'clique-central',
    'lateral-dianteiro': 'avancar',
    'lateral-traseiro': 'voltar',
  },
  dpiStages: [
    { id: 'estagio-1', x: 400, y: 400 },
    { id: 'estagio-2', x: 800, y: 800 },
    { id: 'estagio-3', x: 1600, y: 1600 },
    { id: 'estagio-4', x: 3200, y: 3200 },
  ],
  activeStageId: 'estagio-2',
  independentAxes: false,
  pollingRate: 1000,
  performanceMode: null,
  parameters: {
    motionSync: true,
    angleSnapping: false,
    rippleControl: false,
    wirelessTurbo: false,
    liftOffDistance: 1,
    sensorRotation: 0,
    debounce: 4,
    sleepTimeout: 5,
  },
  rPlus: null,
};

function mouseProfile(changes: (settings: MouseSettings) => MouseSettings | void): MouseSettings {
  const settings = structuredClone(demoMouseDefaults);
  return changes(settings) ?? settings;
}

export function createDemoMouse(): MousePeripheral {
  return {
    id: 'demo-mouse',
    type: 'mouse',
    name: 'Viper V4 Pro',
    manufacturer: 'Razer',
    connection: 'sem-fio',
    status: 'conectado',
    firmware: null,
    demo: true,
    battery: 82,
    photo: mousePhoto,
    capabilities: {
      dpi: {
        min: 100,
        max: 6400,
        step: 50,
        minStages: 1,
        maxStages: 6,
        independentAxes: true,
      },
      pollingRates: [125, 250, 500, 1000, 2000, 4000, 8000],
      buttons: mouseButtons,
      actions: mouseActions,
      parameters: {
        motionSync: true,
        angleSnapping: true,
        rippleControl: true,
        liftOffDistance: { min: 0.5, max: 2, step: 0.1 },
        sensorRotation: { min: -30, max: 30, step: 1 },
        debounce: { options: [0, 1, 2, 4, 8, 16] },
        sleepTimeout: { options: [1, 2, 5, 10, 15] },
      },
      profileSlots: 4,
    },
    defaults: structuredClone(demoMouseDefaults),
    activeProfileSlot: 1,
    profiles: [
      { index: 1, name: 'Perfil 1', settings: structuredClone(demoMouseDefaults) },
      {
        index: 2,
        name: 'FPS',
        settings: mouseProfile((settings) => {
          settings.activeStageId = 'estagio-1';
        }),
      },
      {
        index: 3,
        name: 'Trabalho',
        settings: mouseProfile((settings) => {
          settings.activeStageId = 'estagio-3';
          settings.pollingRate = 500;
        }),
      },
      { index: 4, name: '', settings: null },
    ],
  };
}

interface KeyRowInput {
  row: number;
  /** Extra space above the row, in units, such as under a function row. */
  topGap?: number;
  keys: Array<[id: string, label: string, width?: number, gap?: number]>;
}

const letters = 'QWERTYUIOPASDFGHJKLZXCVBNM'.split('');

/** ANSI 60% layout of the simulated keyboard: 61 keys, no function or arrow block. */
const keyboardRows: KeyRowInput[] = [
  {
    row: 0,
    keys: [
      ['Escape', 'Esc'],
      ['Digit1', '1'],
      ['Digit2', '2'],
      ['Digit3', '3'],
      ['Digit4', '4'],
      ['Digit5', '5'],
      ['Digit6', '6'],
      ['Digit7', '7'],
      ['Digit8', '8'],
      ['Digit9', '9'],
      ['Digit0', '0'],
      ['Minus', '-'],
      ['Equal', '='],
      ['Backspace', 'Backspace', 2],
    ],
  },
  {
    row: 1,
    keys: [
      ['Tab', 'Tab', 1.5],
      ...letters.slice(0, 10).map((letter) => [`Key${letter}`, letter] as [string, string]),
      ['BracketLeft', '['],
      ['BracketRight', ']'],
      ['Backslash', '\\', 1.5],
    ],
  },
  {
    row: 2,
    keys: [
      ['CapsLock', 'Caps', 1.75],
      ...letters.slice(10, 19).map((letter) => [`Key${letter}`, letter] as [string, string]),
      ['Semicolon', ';'],
      ['Quote', "'"],
      ['Enter', 'Enter', 2.25],
    ],
  },
  {
    row: 3,
    keys: [
      ['ShiftLeft', 'Shift', 2.25],
      ...letters.slice(19).map((letter) => [`Key${letter}`, letter] as [string, string]),
      ['Comma', ','],
      ['Period', '.'],
      ['Slash', '/'],
      ['ShiftRight', 'Shift', 2.75],
    ],
  },
  {
    row: 4,
    keys: [
      ['ControlLeft', 'Ctrl', 1.25],
      ['MetaLeft', 'Win', 1.25],
      ['AltLeft', 'Alt', 1.25],
      ['Space', 'Espaço', 6.25],
      ['AltRight', 'Alt', 1.25],
      ['ContextMenu', 'Menu', 1.25],
      ['ControlRight', 'Ctrl', 1.25],
      ['Fn', 'Fn', 1.25],
    ],
  },
];

/** Keys that switch layers on the model and therefore are not remapped. */
const layerKeys = new Set(['Fn']);

/** Photo of the keyboard with the grid its keys follow. 712 × 267 in the file. */
const keyboardPhoto: PeripheralPhoto = {
  src: '/dispositivos/teclado-60.webp',
  aspect: 712 / 267,
  keyGrid: { left: 4.4, top: 5.8, unitX: 6.067, unitY: 16.55 },
};

function buildKeyboardLayout(rows: KeyRowInput[]): KeyboardKeySpot[] {
  return rows.flatMap((row) => {
    let x = 0;
    return row.keys.map(([id, label, width = 1, gap = 0]) => {
      x += gap;
      const spot: KeyboardKeySpot = { id, label, row: row.row, x, width };
      if (row.topGap) spot.topGap = row.topGap;
      if (gap) spot.gap = gap;
      if (layerKeys.has(id)) spot.remappable = false;
      x += width;
      return spot;
    });
  });
}

const keyboardKeys = buildKeyboardLayout(keyboardRows);

const keyboardActions: KeyboardAction[] = [
  { id: 'desativado', label: 'Desativada', group: 'Sistema' },
  { id: 'ControlLeft', label: 'Ctrl esquerdo', group: 'Modificadores' },
  { id: 'ControlRight', label: 'Ctrl direito', group: 'Modificadores' },
  { id: 'ShiftLeft', label: 'Shift esquerdo', group: 'Modificadores' },
  { id: 'ShiftRight', label: 'Shift direito', group: 'Modificadores' },
  { id: 'AltLeft', label: 'Alt esquerdo', group: 'Modificadores' },
  { id: 'AltRight', label: 'Alt direito', group: 'Modificadores' },
  { id: 'MetaLeft', label: 'Win', group: 'Modificadores' },
  { id: 'CapsLock', label: 'Caps Lock', group: 'Modificadores' },
  { id: 'Escape', label: 'Esc', group: 'Sistema' },
  /** The 60% layout drops this key, so it stays available as an assignment. */
  { id: 'Backquote', label: 'Crase e til', group: 'Sistema' },
  { id: 'Tab', label: 'Tab', group: 'Sistema' },
  { id: 'Enter', label: 'Enter', group: 'Sistema' },
  { id: 'Backspace', label: 'Backspace', group: 'Sistema' },
  { id: 'Space', label: 'Espaço', group: 'Sistema' },
  { id: 'ContextMenu', label: 'Menu', group: 'Sistema' },
  ...keyboardKeys
    .filter((key) =>
      [
        'Minus',
        'Equal',
        'BracketLeft',
        'BracketRight',
        'Backslash',
        'Semicolon',
        'Quote',
        'Comma',
        'Period',
        'Slash',
      ].includes(key.id),
    )
    .map((key) => ({ id: key.id, label: key.label, group: 'Pontuação' })),
  ...letters
    .slice()
    .sort()
    .map((letter) => ({ id: `Key${letter}`, label: letter, group: 'Letras' })),
  ...Array.from({ length: 10 }, (_, index) => ({
    id: `Digit${(index + 1) % 10}`,
    label: String((index + 1) % 10),
    group: 'Números',
  })),
  ...Array.from({ length: 12 }, (_, index) => ({
    id: `F${index + 1}`,
    label: `F${index + 1}`,
    group: 'Funções',
  })),
  { id: 'Insert', label: 'Insert', group: 'Navegação' },
  { id: 'Delete', label: 'Delete', group: 'Navegação' },
  { id: 'Home', label: 'Início', group: 'Navegação' },
  { id: 'End', label: 'Fim', group: 'Navegação' },
  { id: 'PageUp', label: 'Página acima', group: 'Navegação' },
  { id: 'PageDown', label: 'Página abaixo', group: 'Navegação' },
  { id: 'ArrowUp', label: 'Seta acima', group: 'Navegação' },
  { id: 'ArrowDown', label: 'Seta abaixo', group: 'Navegação' },
  { id: 'ArrowLeft', label: 'Seta esquerda', group: 'Navegação' },
  { id: 'ArrowRight', label: 'Seta direita', group: 'Navegação' },
];

const demoKeyboardDefaults: KeyboardSettings = {
  keymap: {},
  lighting: {
    enabled: true,
    effectId: 'estatico',
    color: '#ffffff',
    brightness: 70,
    speed: 50,
  },
};

export function createDemoKeyboard(): KeyboardPeripheral {
  return {
    id: 'demo-keyboard',
    type: 'keyboard',
    name: 'Wooting 60HE v2',
    manufacturer: 'Wooting',
    connection: 'usb',
    status: 'conectado',
    firmware: null,
    demo: true,
    battery: null,
    photo: keyboardPhoto,
    capabilities: {
      keys: keyboardKeys,
      actions: keyboardActions,
      lighting: {
        effects: [
          {
            id: 'estatico',
            label: 'Estático',
            description: 'Uma cor fixa em todo o teclado.',
            animated: false,
            usesColor: true,
          },
          {
            id: 'respiracao',
            label: 'Respiração',
            description: 'A cor escolhida acende e apaga continuamente.',
            animated: true,
            usesColor: true,
          },
          {
            id: 'onda',
            label: 'Onda',
            description: 'A cor percorre o teclado da esquerda para a direita.',
            animated: true,
            usesColor: true,
          },
          {
            id: 'espectro',
            label: 'Espectro',
            description: 'Ciclo contínuo de cores, sem cor definida.',
            animated: true,
            usesColor: false,
          },
          {
            id: 'reativo',
            label: 'Reativo',
            description: 'A tecla acende ao ser pressionada.',
            animated: true,
            usesColor: true,
          },
        ],
        color: true,
        brightness: true,
        speed: true,
      },
      profileSlots: 4,
    },
    defaults: structuredClone(demoKeyboardDefaults),
    activeProfileSlot: 1,
    profiles: [
      { index: 1, name: 'Perfil 1', settings: structuredClone(demoKeyboardDefaults) },
      {
        index: 2,
        name: 'Jogos',
        settings: {
          keymap: { CapsLock: 'ControlLeft' },
          lighting: {
            enabled: true,
            effectId: 'onda',
            color: '#ffffff',
            brightness: 90,
            speed: 60,
          },
        },
      },
      {
        index: 3,
        name: 'Escrita',
        settings: {
          keymap: {},
          lighting: {
            enabled: false,
            effectId: 'estatico',
            color: '#ffffff',
            brightness: 40,
            speed: 50,
          },
        },
      },
      { index: 4, name: '', settings: null },
    ],
  };
}
