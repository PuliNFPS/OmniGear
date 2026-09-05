# OmniGear — Redesign da interface de configuração de mouse

**Data:** 2026-09-04
**Status:** aprovado para planejamento
**Escopo:** substituição da UI e do modelo de dados do `apps/web` para configuração de mouse

---

## 1. Problema

O `apps/web` atual é uma página de configurações genérica: uma sidebar com a lista de
dispositivos e linhas de `título / descrição → controle`. Ela funciona, mas não comunica
nada sobre o objeto que está sendo configurado, e não tem estrutura para as capacidades
que um app de mouse precisa expor.

O obstáculo não é visual. É o modelo de dados. `DeviceSettings` mistura três coisas com
donos diferentes:

- `batteryLevel` é telemetria — vem do hardware, ninguém edita, não persiste;
- `dpi` e `pollingRate` são configuração de perfil — editáveis, persistem em slot;
- `profile: string` tenta ser um sistema de perfis e não consegue representar um.

Além disso, `dpi` é um escalar (não representa estágios), não existem bindings de botão
nem parâmetros de sensor, e `setDpi?()` / `setPollingRate?()` pendurados no objeto de
dados colocam transporte dentro do modelo — o que contraria a skill `onion-architecture`
do repositório e o gate `pnpm audit:boundaries`.

Qualquer redesign de tela que não resolva isso primeiro vira uma reescrita silenciosa do
`packages/shared` no meio da implementação.

## 2. Escopo

### Dentro do v1

- Configuração de **mouse** apenas.
- Sete telas: Devices (home), Buttons, DPI, Performance, Parameters, Profiles, Device.
- Modelo de dados novo em `packages/shared`, substituindo o atual.
- Driver como porta, com implementação **mock rica** (latência, falha, desconexão).
- Sistema visual monocromático, dark-only.

### Fora do v1

| Item                    | Motivo                                                                            |
| ----------------------- | --------------------------------------------------------------------------------- |
| Macros                  | Não selecionado no escopo. `ButtonAction` já reserva o caso `macro`.              |
| Cloud config / login    | É backend, não UI.                                                                |
| Iluminação / RGB        | Nenhum mouse das referências prioriza; o mock atual tem, mas sai.                 |
| Teclado                 | Decidido: só mouse no v1. Nomes `Mouse*` deixam o irmão `Keyboard*` óbvio depois. |
| WebHID real             | O `WebHidTransport` existe e não está ligado. Entra depois, atrás da mesma porta. |
| SVG por modelo de mouse | Ver decisão D4.                                                                   |
| Tema claro              | Ver decisão D7.                                                                   |

## 3. Decisões

Registradas com a alternativa que foi descartada, para que quem ler depois não refaça a
discussão.

| #   | Decisão                                                                                                                                 | Alternativa descartada                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| D1  | Arquitetura de informação espelhando o ATK Gear: home com galeria de devices → workspace com rail de seções, cada seção uma tela cheia. | Device persistente reagindo à seção editada; cockpit denso em tela única.           |
| D2  | Cada seção preenche a própria tela com conteúdo real. O render do mouse aparece só onde carrega informação.                             | Usar o render como preenchimento, que é o que produz as telas vazias da referência. |
| D3  | `applyLive` no mouse enquanto edita + `writeSlot` explícito para persistir. Dois conceitos distintos de "sujo".                         | Tudo live sem salvar; rascunho que não toca o mouse até aplicar.                    |
| D4  | Render genérico paramétrico (`renderId` + registry com fallback), hotspots vindos das capabilities.                                     | SVG por modelo no v1.                                                               |
| D5  | Primitivos de UI via `pnpm dlx shadcn@latest add` dentro de `packages/ui`.                                                              | Escrever à mão sobre `radix-ui`.                                                    |
| D6  | Chrome inteiramente monocromático. Cor reservada a dado: estágios de DPI e vermelho de destrutivo.                                      | Acento laranja de marca (`--primary: 29 89% 56%`).                                  |
| D7  | Dark-only no v1, com a camada de token preparada para receber o light depois.                                                           | Manter as duas paletas, o que empurra para gerar o dark invertindo o light.         |
| D8  | Tokens moram em `packages/ui`; o app importa.                                                                                           | Manter em `apps/web/src/styles.css`, o que inverte a dependência do design system.  |

## 4. Arquitetura de informação

Sete telas. O rail de seções é estado local (`section`), não rota — o projeto não tem
router e o v1 não precisa de deep-link.

| #   | Tela               | Conteúdo                                                                              |
| --- | ------------------ | ------------------------------------------------------------------------------------- |
| 0   | **Devices (home)** | Galeria de devices conectados. Estado vazio com chamada para conectar.                |
| 1   | **Buttons**        | Render do mouse com um callout por botão. Clicar abre o picker de ação.               |
| 2   | **DPI**            | Cards de estágio: cor, slider, valor editável, X/Y independente, adicionar e remover. |
| 3   | **Performance**    | Polling rate → bateria estimada recalculando em tempo real + modo do sensor.          |
| 4   | **Parameters**     | Duas colunas: correções e debounce à esquerda; LOD e rotação do sensor à direita.     |
| 5   | **Profiles**       | Slots onboard, importar e exportar, estado de alterações não salvas.                  |
| 6   | **Device**         | Firmware, pareamento, restauração de fábrica.                                         |

Duas telas divergem da referência de propósito:

**Performance.** Na referência é um render parado ocupando a maior parte da tela com uma
barra de polling embaixo. Aqui o conteúdo primário é a **consequência da escolha**: mudar
o polling recalcula a estimativa de bateria na hora. O render sai da tela.

**Profiles.** Sem cloud nem login. Em troca ganha o estado "alterações não salvas no slot
①", que a referência não tem e que é onde esse tipo de app costuma trair o usuário.

## 5. Modelo de dados

Substitui `DeviceSettings` e `ConnectedPeripheral`. **É substituição, não extensão.**

### 5.1 Três tipos, três donos

```ts
// Capabilities — o que o hardware suporta. Estático, vem do driver.
export interface MouseCapabilities {
  dpi: { min: number; max: number; step: number; maxStages: number; independentXY: boolean };
  pollingRate: { supported: number[] };
  buttons: MouseButton[];
  parameters: ParameterCapabilities;
  profiles: { onboardSlots: number };
  battery: boolean;
  renderId: MouseRenderId;
}

// Profile — a configuração editável. É isto que salva no slot.
export interface MouseProfile {
  name: string;
  dpi: { stages: DpiStage[]; activeStageId: string; independentXY: boolean };
  pollingRate: number;
  bindings: Record<string, ButtonAction>;
  parameters: MouseParameters;
}

// Telemetry — estado vivo, read-only. Nunca persiste.
export interface MouseTelemetry {
  batteryPercent?: number;
  charging?: boolean;
  connection: 'wired' | 'dongle' | 'bluetooth';
  firmware: string;
}
```

**A regra que torna o app multi-marca:** capability ausente ⇒ o controle não existe. Não
há estado "cinza / não suportado" em lugar nenhum. Se o mouse não expõe LOD, a tela de
Parameters tem uma linha a menos.

### 5.2 Tipos de apoio

```ts
export interface DpiStage {
  id: string;
  x: number;
  y: number;
  color: DpiStageColor;
}

// Sem amber, sem vermelho e sem laranja: ver decisão D6 e seção 7.
export type DpiStageColor = 'green' | 'cyan' | 'blue' | 'violet' | 'magenta';

export interface MouseButton {
  id: string;
  label: string;
  hotspot: { x: number; y: number }; // normalizado 0..1 no viewBox do render
  remappable: boolean;
}

export type ButtonAction =
  | { kind: 'button'; button: 'left' | 'right' | 'middle' | 'back' | 'forward' }
  | { kind: 'dpi'; mode: 'cycle' | 'shift' | 'up' | 'down' }
  | { kind: 'keystroke'; keys: string[] }
  | { kind: 'scroll'; direction: 'up' | 'down' }
  | { kind: 'disabled' }
  | { kind: 'macro'; macroId: string }; // reservado; nenhuma UI no v1

export interface ParameterCapabilities {
  motionSync?: boolean;
  straightLineCorrection?: boolean;
  rippleCorrection?: boolean;
  longRangeMode?: boolean;
  debounceMs?: { supported: number[] };
  sleepMinutes?: { supported: number[] };
  lod?: { min: number; max: number; step: number };
  sensorRotation?: { min: number; max: number; step: number };
}

export interface MouseParameters {
  motionSync: boolean;
  straightLineCorrection: boolean;
  rippleCorrection: boolean;
  longRangeMode: boolean;
  debounceMs: number;
  sleepMinutes: number;
  lodMm: number;
  sensorRotationDeg: number;
}

export interface ProfileSlot {
  index: number;
  profile: MouseProfile | null;
}

// Identifica qual silhueta o registry de render deve desenhar. O conjunto cresce
// quando chegarem SVGs por modelo; até lá as duas genéricas cobrem todo device.
export type MouseRenderId = 'generic-5button' | 'generic-7button';
```

### 5.3 Sessão

```ts
export interface MouseSession {
  id: string;
  name: string;
  manufacturer: string;
  capabilities: MouseCapabilities;
  telemetry: MouseTelemetry;
  slots: ProfileSlot[];
  activeSlotIndex: number;
  draft: MouseProfile; // o que está na tela e no mouse
}
```

`dirty` é **derivado** (`draft ≠ slots[activeSlotIndex].profile`), nunca armazenado. Um
`dirty` guardado em estado é uma segunda fonte de verdade que sai de sincronia.

## 6. Porta do driver e fluxo de dados

```ts
export interface MouseDriver {
  readCapabilities(): Promise<MouseCapabilities>;
  readTelemetry(): Promise<MouseTelemetry>;
  readSlots(): Promise<ProfileSlot[]>;
  applyLive(profile: MouseProfile): Promise<void>;
  writeSlot(index: number, profile: MouseProfile): Promise<void>;
  factoryReset(): Promise<void>;
}
```

`applyLive` recebe o perfil inteiro de propósito: a porta fala a linguagem do domínio, e
**decidir quais relatórios HID enviar é responsabilidade do adapter**, que faz o diff
contra o último perfil aplicado. A UI nunca sabe o que é um report.

O throttle do arraste é responsabilidade do store, não do driver: aplicar no máximo a
cada ~100 ms durante o arraste e uma vez no fim do gesto.

### Os dois "sujos", e por que têm feedback diferente

| Estado     | Significa                            | Feedback                                                                                                                  |
| ---------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `applying` | O draft está indo para o mouse agora | Sutil e **global** (pulso no header). Nunca spinner por controle — arrastar um slider não pode acender quarenta spinners. |
| `dirty`    | `draft` diverge do slot ativo        | Barra persistente: "alterações não salvas no slot ①" + ação de salvar.                                                    |

## 7. Sistema visual

Monocromático, dark-only. **Cor não é cromo: cor é dado.**

As duas únicas presenças cromáticas em todo o app:

1. **Estágios de DPI** — identidade. Verde, ciano, azul, violeta, magenta.
2. **Vermelho de destrutivo** — perigo. Exclusivo de "restaurar padrão de fábrica".

Vermelho, laranja e amber estão fora do conjunto de estágios porque colidiriam com o
destrutivo. O ponto de "conectado" também é monocromático (cheio = conectado, oco = não);
verde de status seria um segundo significado para hue.

### 7.1 Camada de tokens

Hoje há um bug de nomes: `--primary` é a marca e `--accent` é o cinza de hover
(`.device-nav-item:hover`). Com os nomes trocados é impossível responder "qual token é o
interativo?" sem ler o CSS.

Dois níveis:

- **Primitivos**, nomeados por valor (`--gray-800`). Nunca referenciados por componente.
- **Semânticos**, nomeados por papel (`--color-bg-raised`, `--color-text-muted`). O único
  nível que componente usa.

Papéis que as telas novas exigem e não existem hoje: `bg-canvas`, `bg-surface`,
`bg-raised` (card dentro de card — DPI e Parameters têm isso), `bg-hover`,
`border-subtle` vs `border-strong`, `text-primary` / `text-secondary` / `text-muted`.

Sem acento cromático, **"selecionado / primário" é inversão de contraste**: fill claro,
texto quase-preto. Hover é um degrau de superfície. Foco é anel claro.

### 7.2 Regras que valem para o sistema todo

**Elevação não é sombra.** O CSS atual aplica `box-shadow: 0 10px 36px hsl(0 0% 0% /
0.05)` sobre um fundo de 6% de lightness — invisível. Em dark, elevação se lê por
lightness de superfície mais borda: `bg-canvas` < `bg-surface` < `bg-raised`, cada degrau
visível. Sombra fica restrita a popover e dialog, onde há sobreposição real.

**A rampa de neutros é o item crítico.** Num sistema com hue dá para disfarçar hierarquia
com cor. Em monocromático tudo se apoia em lightness, então os degraus precisam ser
genuinamente distinguíveis. Nem preto puro (não dá para descer mais, e mata a elevação)
nem branco puro.

**Numerais tabulares são obrigatórios.** Todo valor de configuração muda enquanto o
usuário arrasta: DPI, Hz, ms, mm, graus. Com numerais proporcionais o número muda de
largura e o layout treme — em quatro cards de DPI ao mesmo tempo.
`font-variant-numeric: tabular-nums` em todo valor numérico de configuração.

**Um mecanismo de tema só.** Classe no `documentElement`, como já é hoje. Não misturar
com `prefers-color-scheme` definindo outros tokens.

**Movimento reduzido.** O bloco `@media (prefers-reduced-motion: reduce)` do
`styles.css` atual é mantido.

### 7.3 Valores

Os valores concretos da paleta **não fazem parte deste spec**. Eles são produzidos e
medidos pela skill `interfaces:better-colors` durante a implementação, sobre tela
construída — medir contra mockup descartável seria falsa precisão. O que este spec fixa é
a estrutura: papéis, nomes e as regras acima.

As rampas são geradas em OKLCH, onde lightness é perceptual, e **emitidas na notação HSL
que o projeto já usa** em `hsl(var(--token))`. Isso evita misturar dois sistemas de cor no
mesmo CSS sem exigir migração.

## 8. Estados e tratamento de erro

O app fala com hardware. Os estados de falha são o produto, não um detalhe.

| Situação                          | Comportamento                                                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `applyLive` falha                 | O controle reverte para o último valor confirmado. Alerta não bloqueante. Otimismo com reversão, porque o usuário está sentindo o efeito na mão. |
| Mouse desconecta durante a edição | O `draft` é preservado. Banner persistente e controles desabilitados. Ao reconectar, reaplica o `draft`.                                         |
| `writeSlot` falha                 | `dirty` permanece. O erro aparece na ação de salvar, não em um toast que some.                                                                   |
| Sair com `dirty`                  | Aviso antes de trocar de slot ou de device.                                                                                                      |
| Capability ausente                | O controle não é renderizado. Nunca desabilitado, nunca cinza.                                                                                   |
| Slot vazio                        | Estado explícito com ação de criar, não um card em branco.                                                                                       |

O mock implementa latência, falha e desconexão para que esses caminhos sejam construídos
e testados desde o primeiro dia — é por isso que a decisão foi "mock rico" e não "mock
puro".

## 9. Estrutura de arquivos

Respeitando o `pnpm audit:boundaries`, que já rejeita dependências de pacote para app,
ciclos em runtime e acesso a WASM fora do `coreBridge.ts`.

```
packages/shared/src/
  mouse/capabilities.ts     MouseCapabilities, MouseButton, ParameterCapabilities
  mouse/profile.ts          MouseProfile, DpiStage, ButtonAction, MouseParameters
  mouse/telemetry.ts        MouseTelemetry
  mouse/session.ts          MouseSession, ProfileSlot
  mouse/driver.ts           MouseDriver (porta)
  index.ts                  re-export

packages/ui/src/
  styles/tokens.css         primitivos + semânticos (novo; sai do app)
  components/               slider, switch, tabs, dialog, tooltip via shadcn
                            + alert, badge, button, select existentes

apps/web/src/
  app/AppShell.tsx          header, rail de seções, barra de dirty
  features/devices/         galeria e estado vazio
  features/buttons/         render + callouts + picker de ação
  features/dpi/             cards de estágio
  features/performance/     polling + estimativa de bateria
  features/parameters/      correções, debounce, LOD, rotação
  features/profiles/        slots, importar, exportar
  features/device/          firmware, pareamento, reset
  components/MouseRender/   silhueta paramétrica + registry de renderId
  hardware/mockDriver.ts    MouseDriver com latência, falha e desconexão
  mocks/mice.ts             fixtures no modelo novo: 2 mice com capabilities diferentes,
                            para provar que capability ausente remove o controle
  store/mouseStore.ts       sessão, draft, applying, throttle
```

### Arquivos que este redesign substitui ou remove

`App.tsx`, `DevicePanel.tsx`, `Sidebar.tsx`, `SettingRow.tsx`, `SegmentedControl.tsx`,
`deviceStore.ts`, `deviceDiscovery.ts`, `deviceDiscovery.test.ts`, `mocks/peripherals.ts`,
`hardware/ConnectedDevice.ts` e o bloco de tokens de `styles.css`.

`ConnectedDevice.ts` desaparece: ele existe para implementar `ConnectedPeripheral`, que
deixa de existir. `WebHidTransport.ts` permanece intocado, aguardando o adapter real.

O plano de implementação precisa tratar isso explicitamente como substituição. Se ficar
ambíguo, a primeira etapa entra em conflito com os tipos antigos.

## 10. Testes

Seguindo a skill `pragmatic-testing` do repositório: testar as decisões do projeto, não a
biblioteca.

| Camada                 | O que é testado                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Domínio (puro, rápido) | Derivação de `dirty`; validação de estágio de DPI contra as capabilities; `ButtonAction` como união discriminada.         |
| Store                  | Throttle do arraste; reversão quando `applyLive` falha; preservação do `draft` na desconexão e reaplicação ao reconectar. |
| Driver (fake)          | Contrato da porta com um fake, incluindo os caminhos de falha.                                                            |
| Componentes            | Ausência de capability ⇒ controle ausente; posicionamento de hotspot a partir de coordenadas normalizadas.                |

Não são testados: comportamento interno dos primitivos shadcn e valores de token.

## 11. Gates de qualidade

Além do `pnpm verify` já existente (format, lint, test, build, audit), cada fase de
implementação roda as skills de interface **sobre tela construída**:

| Skill                             | Quando                                                                        |
| --------------------------------- | ----------------------------------------------------------------------------- |
| `interfaces:better-colors`        | Produz e mede os valores da paleta; reporta contraste medido, nunca estimado. |
| `interfaces:better-accessibility` | Cada tela: foco, ordem de leitura, rótulos, alvos de toque.                   |
| `interfaces:better-layout`        | Agrupamento, alinhamento e hierarquia por tela.                               |
| `interfaces:better-ui`            | Raio concêntrico, alinhamento óptico, profundidade de superfície.             |
| `interfaces:better-writing`       | Rótulos e descrições — as da referência são traduções mecânicas.              |
| `interfaces:better-interface`     | Revisão combinada ao fim.                                                     |

E `pnpm graph:update` após cada mudança estrutural, conforme o `AGENTS.md`.

## 12. Caminho depois do v1

Nenhum destes é construído agora, mas o modelo os acomoda sem reescrita:

- **WebHID real** — novo adapter atrás de `MouseDriver`. Nenhuma tela muda.
- **SVG por modelo** — novas entradas no registry de `renderId`. Nenhum componente muda.
- **Macros** — `ButtonAction` já tem o caso; falta a tela e o editor.
- **Teclado** — tipos irmãos `Keyboard*` e uma segunda arquitetura de informação.
- **Tema claro** — um bloco de valores; os papéis de token já existem.
