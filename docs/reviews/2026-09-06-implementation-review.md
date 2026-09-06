# Revisão da implementação OmniGear — 2026-09-06

Revisão dos fluxos implementados para home, mouse, teclado, perfis, temas e
animações, usando o brief existente e a direção visual aprovada. As alterações
anteriores do workspace foram preservadas; nenhum commit foi criado.

## Falhas corrigidas

| Prioridade | Problema verificado                                                                                                     | Correção                                                                                                                    |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| P1         | “Salvar e carregar” carregava o destino mesmo após falha ao salvar, apagando o rascunho.                                | A troca depende de confirmação de sucesso; a falha mantém ajustes e perfil ativo.                                           |
| P1         | Importação aceitava ajustes incompletos e lançava exceções para campos nulos.                                           | Validação de estrutura completa, tipos, ações, parâmetros, iluminação, limites e passos de DPI antes de substituir ajustes. |
| P1         | Conclusão de aplicação anterior podia substituir o estado de gravação; operações antigas podiam afetar uma nova sessão. | Identificação de operações, invalidação ao esquecer dispositivos e bloqueio de ações incompatíveis durante escrita.         |
| P2         | Nova tentativa de gravar em outro slot escrevia no perfil ativo.                                                        | Preservação do slot, nome e ajustes da operação que falhou.                                                                 |
| P2         | Gravar uma cópia anunciava o perfil errado e dizia que não havia alterações pendentes.                                  | Feedback identifica o destino real e conserva o estado pendente do perfil ativo.                                            |
| P2         | Renomear alterava apenas o estado local.                                                                                | Renomeação usa o mesmo fluxo confirmado de escrita, com recuperação de falha.                                               |
| P2         | Dez teclas de pontuação não tinham ação correspondente no seletor.                                                      | Ações adicionadas e cobertura de todas as teclas remapeáveis verificada.                                                    |
| P2         | Valores Y descartados podiam reaparecer ao separar os eixos novamente.                                                  | Cache de eixos é invalidado no descarte, restauração e carregamento de perfil.                                              |
| P2         | Reiniciar a demonstração apagava perfis da sessão; carregamento atrasado podia reabri-la após sair.                     | Entrada idempotente e invalidação de carregamentos anteriores.                                                              |
| P2         | Recarregar ou sair da demonstração podia perder rascunhos sem aviso.                                                    | Aviso de saída quando há alterações pendentes ou gravação em curso.                                                         |
| P2         | Layout de 320 px transbordava por causa da largura mínima somada à barra de rolagem.                                    | Largura fluida e cabeçalho ajustado; todas as dez seções ficaram sem overflow horizontal da página.                         |

## UI, UX e movimento

- Navegação compacta em telas pequenas, foco no conteúdo após navegar e link de
  salto para usuários de teclado.
- Seleção de efeitos por radios nativos, incluindo navegação com setas e foco
  visível; controles de gravação permanecem em posição consistente.
- Área da barra de alterações mais estável, textos de estado coerentes e ações
  distribuídas em telas estreitas.
- Diálogos limitados à altura disponível e botões com quebra de linha; seletor de
  arquivo interno removido da navegação visual.
- Entrada discreta da imagem ao selecionar outro dispositivo na home.
- Prévia reativa responde ao clique, incluindo Fn. Intensidade zero remove o brilho.
- Onda começa com fases distribuídas; ciclos têm duração mínima de 800 ms.
- Animações contínuas pausam fora da área visível ou quando a página está oculta.
  Preferência de movimento reduzido remove movimento espacial, pulsação e rotação
  de carregamento, mantendo informação textual e transições suaves de opacidade.
- Sliders ganharam área de interação maior; seleção de texto, cursor e rolagem
  usam cores do tema.

## Verificação

- 66 testes Vitest passando (44 existentes e 22 casos adicionais).
- Casos de regressão de importação, escrita, retry e demonstração observados
  falhando antes das respectivas correções.
- Build TypeScript/Vite, lint de frontend e tipos dos pacotes compartilhados.
- Dependency Cruiser sem violações; Knip sem código morto reportado, com um aviso
  preexistente de entrada `src/hooks/**/*.ts` ausente em `packages/ui`.
- Revisão independente confirmou as correções e não encontrou regressões bloqueantes.
- Navegador: temas claro e escuro, home, seis seções de mouse e quatro de teclado;
  capturas em 1280, 1024, 390 e 320 px ao longo da revisão.
- Na confirmação final de 320 px, todas as dez seções tiveram largura do conteúdo
  igual à área útil de 305 px (15 px reservados para a barra vertical).
- Fluxo real na UI: editar taxa, gravar cópia no slot 4, preservar alteração
  pendente, salvar origem e carregar outro perfil. Radios pelas setas, iluminação
  reativa e brilho zero também verificados no navegador. Sem erros/avisos no console
  da sessão final.

## Limites da validação

Hardware real continua sem driver implementado, conforme o escopo do produto.
Validação interativa usou dispositivos simulados. Rust não está instalado e os
scripts existentes pulam suas verificações. `pnpm graph:update` foi executado,
mas não pôde atualizar o grafo porque o executável `graphify` não está disponível;
o grafo existente ainda representa uma versão anterior do código.

O Impeccable também sinaliza ausência de `buildPath` na configuração. A definição
de um padrão permanente de construção por imagem ou diretamente em código não
foi alterada nesta revisão.
