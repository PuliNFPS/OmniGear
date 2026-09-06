# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Pessoas que usam mouses e teclados de diferentes marcas e querem configurar seus
periféricos em uma interface web unificada. O contexto atual do projeto é o de
periféricos gamer; o produto não fica restrito a uma única marca.

## Product Purpose

O OmniGear permite reunir a configuração de mouses e teclados em um único app web,
reduzindo a necessidade de alternar entre programas específicos de cada fabricante.
O usuário deve conseguir encontrar seu dispositivo, abri-lo e acessar suas opções
de configuração.

## Positioning

A proposta é uma experiência de configuração multimarcas, com navegação consistente
e opções adaptadas ao tipo de periférico e às capacidades do modelo. Universalidade
é a direção do produto; a compatibilidade efetiva depende dos protocolos e drivers
implementados. Não há uma lista de marcas ou modelos com suporte real confirmado.

## Operating Context

Fluxo confirmado pelo usuário em 2026-09-05:

1. Entrar na home, onde aparecem os dispositivos disponíveis e a ação de adicionar
   um dispositivo.
2. Selecionar um mouse ou teclado para entrar em sua área de configuração.
3. Navegar pelas telas de configuração do dispositivo selecionado.
4. Alternar entre tema preto e tema branco por um controle acessível na interface.

As referências mostram uma galeria de periféricos e um espaço de configuração com
navegação lateral por seção. Elas orientam a organização desejada, mas não confirmam
que cada funcionalidade do produto de referência fará parte do OmniGear.

## Capabilities and Constraints

### Escopo solicitado

- App web para mouses e teclados de várias marcas.
- Home com adição e seleção de dispositivos disponíveis.
- Telas de configuração específicas do periférico selecionado.
- Temas preto e branco, com controle para alternar entre ambos.
- Primeira versão do design de teclado: remapeamento de teclas, iluminação e
  perfis, conforme escolha do usuário em 2026-09-05.

### Estado da implementação em 2026-09-05

- A aplicação existente usa React, Vite e TypeScript, componentes compartilhados
  em `packages/ui` e um núcleo Rust compilado para WebAssembly.
- A demonstração atual usa mouses simulados. O fluxo de configuração inclui botões,
  estágios de DPI, taxa de reporte, parâmetros do sensor e perfis.
- O modelo distingue alterações aplicadas à sessão de alterações salvas em um slot
  de perfil. As telas futuras devem preservar essa distinção.
- Existe uma classe de transporte WebHID, mas a interface atual não comprova
  configuração de hardware real. Teclados ainda precisam de modelo e implementação
  próprios.
- Estimativas de autonomia e dados simulados não são medições de hardware nem prova
  de compatibilidade comercial.

### Decisões em aberto

- Marcas, modelos, protocolos e navegadores a atender primeiro.
- Inclusão futura de macros e recursos de teclados magnéticos; não fazem parte da
  primeira versão do design de teclado escolhida pelo usuário.
- Inclusão e alcance de iluminação de mouse, pareamento e atualização de firmware.
- Necessidade de contas, armazenamento em nuvem e compartilhamento de perfis.
- Idiomas de lançamento e requisitos específicos de acessibilidade.

As decisões antigas de limitar o produto a mouse e tema escuro, presentes na
especificação de 2026-09-04, foram substituídas pelo pedido do usuário de 2026-09-05.
As demais funcionalidades mostradas nas referências continuam sujeitas a definição
de escopo; a presença de um botão em uma captura não constitui requisito aprovado.

## Brand Commitments

- Nome existente do produto: OmniGear.
- Compromisso explícito do usuário: uma versão preta e uma branca, com alternância.
- A alternância de tema usa um único botão de ícone: sol no tema claro e lua no
  escuro; clicar troca o tema e o ícone. Esta decisão substitui o switch anterior.
  Não usar trilho, indicador deslizante ou dois ícones simultâneos.
- A seção de informações e manutenção do periférico se chama Geral no menu.
- As capturas do ATK Gear são referências fornecidas pelo usuário para o fluxo e a
  organização da interface. Marca, textos promocionais, métricas e serviços do ATK
  Gear não representam fatos sobre o OmniGear.

## Evidence on Hand

- Pedido direto do usuário em 2026-09-05: app web universal multimarcas para mouses e
  teclados, temas preto e branco, home para adicionar e selecionar dispositivos e
  acesso às telas de configuração ao clicar em um dispositivo.
- Nove capturas fornecidas pelo usuário, no diretório local
  `C:/Users/Paulo/Pictures/Screenshots/`:
  - `Captura de tela 2026-09-04 201134.png`: home sem dispositivo.
  - `Captura de tela 2026-09-04 201041.png`: galeria de mouse e teclados.
  - `Captura de tela 2026-09-04 201051.png`: remapeamento de botões.
  - `Captura de tela 2026-09-04 201059.png`: estágios de DPI.
  - `Captura de tela 2026-09-04 201105.png`: desempenho.
  - `Captura de tela 2026-09-04 201110.png` e
    `Captura de tela 2026-09-04 201113.png`: parâmetros do sensor.
  - `Captura de tela 2026-09-04 201119.png`: gerenciamento de configurações.
  - `Captura de tela 2026-09-04 201124.png`: informações e ações do dispositivo.
- Fontes da implementação, relativas à raiz do repositório:
  `apps/web/src/features/registry.ts`, `apps/web/src/hardware/mockDriver.ts`,
  `apps/web/src/hardware/WebHidTransport.ts`, `apps/web/src/store/mouseStore.ts` e
  `apps/web/src/app/DirtyBar.tsx`.
- Documento histórico:
  `docs/superpowers/specs/2026-09-04-mouse-ui-redesign-design.md`. Consultar como
  histórico, aplicando as substituições de escopo registradas acima.

## Product Principles

1. Reunir marcas e tipos de periférico em uma experiência consistente.
2. Começar pelo dispositivo: selecionar o periférico antes de configurá-lo.
3. Expor configurações coerentes com as capacidades do dispositivo.
4. Distinguir estado da sessão, configuração salva e dados de demonstração.
5. Oferecer os mesmos fluxos e funções nos temas preto e branco.
