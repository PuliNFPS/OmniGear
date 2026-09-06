# OmniGear — plano de implementação da interface

Origem: `apps/web/.impeccable/design-handoff.md`, `design-catalog.json` e as 22
pranchas em `apps/web/.impeccable/mocks/`. Alvo: `apps/web`.

O design está fechado. Este documento é a lista de execução da implementação e
sobrevive a compactações de contexto. Atualizar os marcadores conforme avança.

## Decisões de implementação

- **Idioma da interface:** português, com os textos das pranchas como fonte
  (`Seus dispositivos`, `Configurar`, `1 alteração não salva`, `Descartar`,
  `Salvar no perfil`). A interface atual em inglês é substituída.
- **Rotas:** roteador próprio por hash, sem dependência nova.
  `#/` para a home e `#/dispositivo/<id>/<secao>` para os editores.
  Seções de mouse: `botoes`, `dpi`, `desempenho`, `parametros`, `perfis`, `geral`.
  Seções de teclado: `teclas`, `iluminacao`, `perfis`, `geral`.
- **Camadas:** tipos do domínio em `@gearhub/shared` (contrato sem framework);
  regras puras em `apps/web/src/domain` (testadas com vitest); adaptadores de
  hardware em `apps/web/src/hardware`; estado em `apps/web/src/store`; telas em
  `apps/web/src/components`. Dependência em sentido único: `editorStore` conhece
  o dispositivo, nunca o contrário (`no-circular-runtime-dependencies`).
- **Primitivos de UI:** acrescentar em `packages/ui` apenas quando uma tela
  consumir, espelhando a forma de importação de `select.tsx` (pacote `radix-ui`
  unificado, não `@radix-ui/react-*`, que quebraria `audit:boundaries`).
- **Representação dos periféricos:** SVG semântico, orientado por dados, com
  pontos de seleção derivados da geometria do modelo. O PNG das pranchas não é
  interface, conforme o handoff.
- **Tokens:** identidade preto e branco. Remover o laranja de `--primary`/
  `--ring`; `primary` passa a ser o inverso do fundo. Cor permanece funcional em
  destrutivo, iluminação e estados.
- **Testes:** não há stack de DOM instalada em `apps/web`. Cobrir com vitest a
  lógica pura: validação de DPI, contagem de alterações do rascunho, gating por
  capacidade, transições de perfil e validação de importação.

## Máquina de estados de edição

Derivada de `mocks/estados/salvamento-conexao.png` e `confirmacoes.png`.

| Estado         | Barra de alterações                                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `limpo`        | Sem barra ou `Nenhuma alteração pendente.`                                                                                     |
| `sujo`         | `N alteração(ões) não salva(s)` · `Descartar` · `Salvar no perfil`                                                             |
| `aplicando`    | `Aplicando ajustes…` · `A gravação no perfil ainda está pendente.` · salvar desabilitado                                       |
| `gravando`     | `Salvando no <perfil>…` · salvar desabilitado                                                                                  |
| `gravado`      | `Alterações salvas no <perfil>` · `Nenhuma alteração pendente.`                                                                |
| `falha`        | `Não foi possível salvar.` · `Suas alterações foram preservadas.` · `Tentar novamente` · `Descartar`                           |
| `desconectado` | `Dispositivo desconectado` · `Seu rascunho foi mantido. Reconecte para aplicar e salvar.` · `Reconectar` · salvar desabilitado |

Editar altera o rascunho e dispara aplicação à sessão. Gravar no perfil é uma
ação distinta e explícita. Falha e desconexão preservam o rascunho.

Diálogos: `Descartar alterações?`, `Restaurar o perfil atual?`,
`Carregar <perfil>?` (Cancelar · Salvar e carregar · Descartar e carregar) e
`Importar configurações?`.

## Fases

### Fase 1 — Fundação

- [x] Modelo de domínio em `@gearhub/shared`: capacidades por tipo, configuração
      de mouse e teclado, slots de perfil, ações de botão e geometria de teclas.
- [x] Dispositivos de demonstração (mouse e teclado) com capacidades reais do mock.
- [x] `domain/`: padrões, validação de DPI, diff de rascunho, gating por capacidade.
- [x] Tokens preto e branco e limpeza do CSS do shell antigo.
- [x] Tema com persistência local, preferência do sistema e botão único sol/lua.
- [x] Roteador por hash.

### Fase 2 — Shell e home

- [x] Cabeçalho global com marca, selo `Demonstração` condicional e botão de tema.
- [x] Home: lista de dispositivos + prévia com `Configurar`.
- [x] Estados da home: primeiro acesso, carregando, desconectado.
- [x] Modal `Adicionar dispositivo` com instruções, demonstração e erros.

### Fase 3 — Fatia vertical: DPI

- [x] Shell do dispositivo: cabeçalho, seletor de perfil, navegação lateral, voltar.
- [x] Tela de DPI: estágios em linhas, ativo, adicionar/remover, eixos X/Y.
- [x] Barra de alterações completa: aplicar, gravar, descartar, falha, desconexão.
- [x] Testes da lógica de estágios e do rascunho.

### Fase 4 — Demais telas de mouse

- [x] Botões (edição contextual sobre o mouse).
- [x] Desempenho (taxa de reporte e autonomia identificada como estimativa).
- [x] Parâmetros (painéis, somente controles suportados).
- [x] Perfis (grade de slots, carregar, renomear, importar/exportar).
- [x] Geral (identificação, conexão, restaurar padrões).

### Fase 5 — Teclado

- [x] Teclas (prévia em SVG, seleção e remapeamento contextual).
- [x] Iluminação (efeitos, cor, intensidade, velocidade condicional).
- [x] Perfis e Geral adaptados.

### Fase 6 — Fechamento

- [x] Responsivo conforme as duas pranchas de telas menores.
- [x] Acessibilidade: foco contido em diálogos, Escape, retorno de foco, nomes
      acessíveis, estados não dependentes apenas de cor, movimento reduzido.
- [x] `pnpm format`, `pnpm verify` e registro do que foi verificado.

## Registro de implementação — 05/09/2026

Todas as telas do conjunto foram implementadas e ligadas ao estado da aplicação.

- Shell com tema persistente, roteador por hash e selo `Demonstração` condicional.
- Home com lista, prévia, primeiro acesso, carregamento e modal de adicionar
  dispositivo, incluindo cancelamento e os três erros de conexão.
- Mouse: Botões (mapa em SVG com pontos numerados e edição contextual), DPI,
  Desempenho, Parâmetros, Perfis e Geral.
- Teclado: Teclas (prévia semântica, uma tecla por dado do modelo), Iluminação,
  Perfis e Geral.
- Barra de alterações com rascunho, aplicação, gravação, sucesso, falha e
  desconexão; diálogos de descarte, troca de perfil, restauração e importação.
- Perfis: slots em grade, renomear, gravar em slot vazio, importar com validação
  de formato, versão e compatibilidade, e exportar rascunho ou última versão salva.

Refinamentos após a revisão do conjunto:

- Os eixos X/Y guardam o valor de Y ao serem vinculados e o devolvem quando
  voltam a ser independentes, em vez de descartá-lo (`unlinkAxes`). Enquanto
  vinculados o rascunho continua com um único valor, que é o que o dispositivo
  usa; um estágio editado nesse intervalo mantém o valor mostrado.
- As ações do editor releem o dispositivo no `deviceStore` (`liveDevice`), então
  uma desconexão entre a renderização e o clique não é aplicada nem gravada como
  se o dispositivo continuasse conectado.
- A contagem de alterações compara listas identificadas por `id`, então remover
  um estágio no meio da lista conta uma alteração e não o deslocamento dos
  seguintes.

Dispositivos da demonstração — 05/09/2026:

- Passaram a se chamar `Viper V4 Pro` (sem fio) e `Wooting 60HE v2`, no lugar dos
  nomes genéricos. Continuam simulados: `demo: true`, selo `Demonstração` no
  cabeçalho, `(simulada)` na conexão e nenhum acesso a hardware real.
- O teclado virou um ANSI 60% de 61 teclas; `Fn` e `Mod` não são remapeáveis. O
  espaçamento entre fileiras deixou de presumir uma fileira de função e passou a
  vir do dado (`topGap` em `KeyboardKeySpot`).
- As telas passaram a mostrar a **foto** dos dispositivos, e não um desenho.
  Os arquivos ficam em `apps/web/public/dispositivos/` (WebP recortado no produto,
  fundo removido) e chegam pelo dado: `photo` em `PeripheralBase`, com `aspect`
  para manter a caixa na forma do arquivo e `keyGrid` para o teclado.
  `MouseArt` foi removido; `DevicePhoto` e `KeyboardPhoto` ocupam o lugar.
- Os alvos ficam por cima da foto: os cinco números do mouse em frações medidas
  na imagem e as 61 teclas a partir de `keyGrid`, medido com grade de calibração
  em navegador headless. Trocar a foto exige refazer essa medição — `aspect` e
  `keyGrid` são do arquivo, não do modelo. Iluminação continua com o desenho `KeyboardView`, que é
  quem consegue simular o efeito tecla a tecla, e a altura de rastreio continua
  com o diagrama lateral `MouseSideArt`, que precisa mostrar o mouse saindo da
  superfície.
- Os números do sensor (DPI máximo, estágios) seguem os da demonstração, não os
  do modelo real.

Verificações executadas:

- `pnpm lint`, `pnpm test` (38 testes), `pnpm build`, `pnpm audit:ts` e
  `pnpm audit:boundaries` passaram.
- Conferência visual em navegador headless nos dois temas e em 390 px de largura,
  cobrindo home, adicionar dispositivo, as seis telas de mouse e as duas de teclado.
- `pnpm verify` não conclui nesta máquina: `cargo` não está instalado, então
  `format:check` e `audit:rust` param na etapa de Rust. `pnpm graph:update`
  continua pendente porque `graphify` não está no PATH.
- Não há stack de DOM no projeto: os testes cobrem domínio e stores, não a
  renderização dos componentes.

## Limites

Implementa a interface e a liga ao estado da aplicação com dispositivos de
demonstração. Não implementa drivers reais, nuvem, login, firmware ou pareamento.
`pnpm graph:update` continua pendente enquanto `graphify` não estiver no PATH.
