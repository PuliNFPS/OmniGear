# OmniGear — proposta de estrutura da interface

Status: home opção 1 e Mouse / Botões opção 3 escolhidas. Controle de tema
revisado para um único ícone sol/lua; menu de informações renomeado para Geral.
Escopo de teclado confirmado.
Alvo: `apps/web`.
Contexto do produto: `apps/web/PRODUCT.md`.
Modo da superfície: Operate — encontrar e configurar um periférico.

## Resultado esperado

O usuário entra na home, adiciona ou seleciona um dispositivo e encontra as
configurações compatíveis com ele. Os temas preto e branco oferecem os mesmos
fluxos, controles e estados. As capturas fornecidas do ATK Gear orientam a galeria
de dispositivos e a navegação lateral da área de configuração.

## Mapa de telas proposto

| Área                  | Conteúdo e ação principal                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Home                  | Dispositivos disponíveis, identificação visual, nome, marca, conexão e bateria quando disponíveis; ação Adicionar dispositivo. |
| Adicionar dispositivo | Orientação de conexão, seleção, resultado e recuperação de erros. A demonstração precisa se identificar como tal.              |
| Mouse / Botões        | Representação do mouse, seleção de um botão e edição da ação atribuída.                                                        |
| Mouse / DPI           | Estágios, estágio ativo, valores editáveis e eixos independentes quando suportados.                                            |
| Mouse / Desempenho    | Taxa de reporte e consequências da escolha; estimativas claramente identificadas.                                              |
| Mouse / Parâmetros    | Controles compatíveis de sensor, debounce, repouso e distância de levantamento.                                                |
| Perfis                | Perfil ativo, slots quando suportados, importar/exportar e salvar alterações.                                                  |
| Geral                 | Identificação, conexão e informações disponíveis. Ações de manutenção dependem de suporte confirmado.                          |
| Teclado / Teclas      | Seleção de tecla e remapeamento da ação atribuída.                                                                             |
| Teclado / Iluminação  | Efeitos, cor e intensidade conforme as capacidades do dispositivo.                                                             |
| Teclado / Perfis      | Seleção, edição e salvamento de conjuntos de configurações.                                                                    |

Escopo de teclado confirmado pelo usuário: remapeamento, iluminação e perfis.
Macros e recursos de teclados magnéticos, como ponto de atuação e Rapid Trigger,
ficam fora desta primeira versão do design.

## Navegação e interação

- Home com título e ação de adicionar visíveis antes do conteúdo. Lista de
  periféricos à esquerda e prévia do dispositivo selecionado à direita, com botão
  Configurar. Em telas estreitas, empilhar lista e prévia.
- Ao abrir um periférico, cabeçalho identifica o dispositivo e o perfil ativo;
  menu lateral organiza suas configurações. Voltar à home permanece acessível.
- Alternância de tema no cabeçalho global por um único botão de ícone: sol no
  tema claro, lua no escuro. Clicar muda tema e ícone. Sem switch ou ícones
  simultâneos. Nome acessível e tooltip descrevem a ação: Ativar tema escuro
  quando claro e Ativar tema claro quando escuro. Operável por teclado, com foco
  visível e alvo de pelo menos 44 × 44 px. Guardar a preferência localmente e
  usar a preferência do sistema na primeira visita.
- Conteúdo ajustado ao dispositivo e às suas capacidades; teclados não recebem
  controles de DPI e mouses não recebem controles de atuação de teclas.
- Usar a representação do periférico quando ela ajuda a selecionar uma tecla ou
  botão. Telas de valores e perfis priorizam seus controles e informações.
- Distinguir edição, aplicação à sessão e gravação no perfil. Informar alterações
  não salvas, aplicação em andamento, sucesso e falha no contexto da ação.

## Estados a desenhar

- Home vazia, carregamento, lista de dispositivos e dispositivo desconectado.
- Adição concluída, seleção cancelada, permissão recusada e dispositivo não
  reconhecido; disponibilidade real desses estados depende da integração escolhida.
- Demonstração claramente identificada, sem apresentar hardware simulado como real.
- Configuração sendo aplicada, alterações não salvas, salvamento concluído e erro.
- Perda de conexão durante edição, preservando o rascunho e oferecendo recuperação.
- Confirmação antes de descartar alterações ou executar uma ação destrutiva.

## Direção e critérios para a próxima prévia

- Respeitar o pedido de temas preto e branco e a organização das referências.
- Apresentar primeiro a home e uma tela de configuração de mouse nos dois temas;
  essa comparação estabelece a base antes de expandir para todas as seções.
- Manter controles, textos e foco legíveis em ambos os temas; o branco precisa de
  hierarquia própria entre fundo, superfícies e bordas.
- Desktop é o contexto principal indicado pelas referências. Em telas estreitas,
  recolher a navegação e empilhar controles sem perder funções.
- Usar textos em português como continuidade da interface atual; idiomas de
  lançamento ainda não foram definidos.
- Proposta de acessibilidade: navegação por teclado, nomes acessíveis, foco visível,
  estados comunicados além da cor e respeito à preferência de movimento reduzido.

## Limites e decisões pendentes

Esta proposta organiza o design; não implementa drivers nem comprova compatibilidade
com marcas ou modelos. Login, nuvem, firmware e pareamento não entram por simples
presença nas capturas. A arquitetura atual e o comportamento funcional de mouse
devem ser preservados durante a construção da interface.

A composição da home foi escolhida: lista com prévia, acrescida da alteração
solicitada no seletor de tema. A organização das telas internas ainda será
detalhada. Este arquivo não é um plano de implementação.

## Prévias para escolha

Foram geradas três comparações da home, cada uma com tema preto acima e branco
abaixo. São imagens exploratórias, não capturas da aplicação implementada.

1. Lista com prévia: `apps/web/.impeccable/mocks/decision/lista-previa.png`.
2. Galeria de dispositivos: `apps/web/.impeccable/mocks/decision/galeria.png`.
3. Dispositivo em destaque: `apps/web/.impeccable/mocks/decision/destaque.png`.

Prompts completos estão nos arquivos JSON de mesmo nome e nos metadados dos PNGs.
O usuário escolheu a opção 1 e pediu uma única alteração: substituir os dois botões
de tema por um switch. A versão de referência passa a ser
`apps/web/.impeccable/mocks/decision/lista-previa-toggle.png`, com o registro de
aprovação e do ajuste solicitado no JSON correspondente. As outras opções não
foram escolhidas; a imagem original da opção 1 permanece como histórico.

Página de escolha: `http://127.0.0.1:27070/`; chave `5298c13b`.
Payload: `apps/web/.impeccable/home-options.json`.
A escolha foi recebida diretamente na conversa; não aguardar novamente essa
decisão na página de comparação.
O fluxo imagem primeiro está ativo apenas nesta rodada; nenhum padrão permanente
de construção foi escolhido ou salvo.

## Alternativas de Mouse / Botões — 2026-09-05

O usuário pediu a próxima tela com alternativas antes de continuar as demais.
Foram desenhadas três composições, cada uma nos temas preto e branco, herdando
a identidade da home aprovada. O usuário escolheu a opção 3, edição sobre o mouse.

1. Mouse com editor lateral: `.impeccable/mocks/botoes/botoes-1-editor-lateral.png`.
2. Lista de atribuições: `.impeccable/mocks/botoes/botoes-2-lista-atribuicoes.png`.
3. Edição sobre o mouse: `.impeccable/mocks/botoes/botoes-3-edicao-contextual.png`.

Caminhos relativos a `apps/web`. Prompts completos nos JSONs de mesmo nome e nos
metadados dos PNGs. São alternativas visuais, não telas implementadas; posições
dos pontos devem acompanhar a geometria exata de cada modelo na implementação.
Todas mostram seleção de botão, atribuição, restauração, alteração não salva,
descarte e salvamento no perfil. A opção 3 escolhida usa mouse centralizado e
editor contextual junto ao botão selecionado.

## Revisão vigente: Geral e ícone de tema

O usuário substituiu o switch por um único ícone clicável de sol/lua e definiu
Geral como nome da seção antes chamada Dispositivo. A home e a composição 3
foram atualizadas. As versões anteriores permanecem apenas como histórico.

- Home atual: `apps/web/.impeccable/mocks/revised/home-icone-tema.png`.
- Botões atual: `apps/web/.impeccable/mocks/revised/botoes-contextual-geral-icone-tema.png`.

Essas duas referências orientam as próximas telas. São desenhos; o comportamento
interativo descrito será implementado em código na etapa de construção.

## Alternativas de DPI

Próxima tela apresentada em três composições, preto e branco, com Geral no menu
e um único ícone de tema. O usuário escolheu a opção 2, lista de estágios.

1. Grade: `apps/web/.impeccable/mocks/dpi/dpi-1-grade.png`.
2. Lista: `apps/web/.impeccable/mocks/dpi/dpi-2-linhas.png`.
3. Editor por estágio: `apps/web/.impeccable/mocks/dpi/dpi-3-editor.png`.

Todas cobrem adicionar/remover estágio, editar valor, definir ativo, eixos X/Y
independentes, alterações não salvas, descarte e salvamento. A terceira distingue
estágio selecionado para edição (3) de estágio ativo (2). Valores e escalas das
imagens são ilustrativos; os limites, incrementos e posições de slider devem ser
derivados das capacidades do dispositivo na implementação.

## Alternativas de Desempenho

Após a escolha da lista de DPI, foram apresentadas três composições de Desempenho
nos temas preto e branco. O usuário escolheu a opção 3, mouse em destaque.

1. Controle direto: `apps/web/.impeccable/mocks/desempenho/desempenho-1-painel.png`.
2. Comparação por frequência: `apps/web/.impeccable/mocks/desempenho/desempenho-2-lista.png`.
3. Mouse em destaque: `apps/web/.impeccable/mocks/desempenho/desempenho-3-mouse.png`.

Escopo preservado da seção atual: taxa de reporte e autonomia estimada quando
disponível. As imagens identificam a autonomia como exemplo simulado. Intervalo
entre envios equivale a 1000 / frequência em milissegundos; não é latência total
do sistema. Opções de frequência dependem das capacidades reais do dispositivo.
Não foram incluídos modos de sensor adicionais.

## Alternativas de Parâmetros

Após a escolha de Desempenho opção 3, foram desenhadas três alternativas de
Parâmetros nos dois temas. O usuário escolheu a opção 1, painéis.

1. Painéis: `apps/web/.impeccable/mocks/parametros/parametros-1-paineis.png`.
2. Lista: `apps/web/.impeccable/mocks/parametros/parametros-2-lista.png`.
3. Grupos recolhíveis: `apps/web/.impeccable/mocks/parametros/parametros-3-grupos.png`.

Controles: sincronização de movimento, correção de linha reta, correção de
ondulação, altura de rastreio, rotação do sensor, atraso antirrepique, suspensão
e alcance estendido. Exibir somente os suportados pelo dispositivo. A opção 3
mostra Sensor aberto e resumos de Cliques e Energia recolhidos; expandir cada
grupo revela os respectivos controles. Os switches desses ajustes são
independentes do controle de tema, que continua sendo um único ícone sol/lua.

## Alternativas de Perfis

Após a escolha de Parâmetros opção 1, foram desenhadas três alternativas de
Perfis nos dois temas. O usuário escolheu a opção 3, slots visuais.

1. Lista e detalhes: `apps/web/.impeccable/mocks/perfis/perfis-1-previa.png`.
2. Tabela: `apps/web/.impeccable/mocks/perfis/perfis-2-tabela.png`.
3. Slots visuais: `apps/web/.impeccable/mocks/perfis/perfis-3-slots.png`.

Todas mostram perfil em uso, renomeação, resumo das configurações, carregamento,
slot vazio com ação de gravação, importar/exportar e alterações não salvas.
Os quatro slots são ilustrativos: a quantidade real depende do dispositivo.
Renomear/importar/exportar são propostas de interação, não recursos já
implementados. Antes de carregar outro perfil com rascunho sujo, confirmar o
descarte. Importação deve validar compatibilidade antes de substituir ajustes;
exportação deve explicitar se inclui alterações ainda não gravadas. Sem nuvem
ou contas no escopo desta proposta.

## Alternativas de Geral

Após a escolha de Perfis opção 3, foram desenhadas três alternativas de Geral
nos dois temas. O usuário escolheu a opção 1, mouse com informações.

1. Mouse e informações: `apps/web/.impeccable/mocks/geral/geral-1-mouse.png`.
2. Resumo no topo: `apps/web/.impeccable/mocks/geral/geral-2-faixas.png`.
3. Lista: `apps/web/.impeccable/mocks/geral/geral-3-lista.png`.

Dados apresentados: modelo, conexão, firmware quando disponível e perfil em uso.
A demonstração identifica conexão simulada e firmware não informado. A ação
proposta Restaurar padrões repõe os ajustes padrão no rascunho do perfil atual,
após confirmação, para revisão e salvamento explícito; não apaga todos os perfis
nem representa reset de fábrica do hardware. Atualização de firmware e pareamento
permanecem fora do escopo confirmado. As prévias mostram estado sem alterações;
em estado sujo, reutilizar a barra de alterações compartilhada.

## Alternativas de Teclado / Teclas

Após a escolha de Geral opção 1, foram desenhadas três alternativas de
remapeamento de teclado nos dois temas. O usuário escolheu a opção 1, contextual.

1. Contextual: `apps/web/.impeccable/mocks/teclas/teclas-1-contextual.png`.
2. Editor lateral: `apps/web/.impeccable/mocks/teclas/teclas-2-lateral.png`.
3. Faixa inferior: `apps/web/.impeccable/mocks/teclas/teclas-3-faixa.png`.

Navegação específica do teclado: Teclas, Iluminação, Perfis, Geral. Exemplo de
edição: tecla física Caps Lock atribuída a Ctrl esquerdo, com restauração da
tecla e salvamento no perfil. Desenho e legendas do teclado são ilustrativos;
na implementação usar geometria e teclas semânticas exatas do modelo. Não foram
adicionadas camadas, macros ou configurações de teclados magnéticos.

## Alternativas de Teclado / Iluminação

Após a escolha de Teclas opção 1, foram desenhadas três alternativas de
Iluminação nos dois temas. O usuário escolheu a opção 3, lista de efeitos.

1. Painel lateral: `apps/web/.impeccable/mocks/iluminacao/iluminacao-1-lateral.png`.
2. Faixa inferior: `apps/web/.impeccable/mocks/iluminacao/iluminacao-2-faixa.png`.
3. Lista de efeitos: `apps/web/.impeccable/mocks/iluminacao/iluminacao-3-efeitos.png`.

Conteúdo: prévia simulada, efeito, cor, intensidade e velocidade quando aplicável.
O exemplo usa Estático, branco e intensidade 70%. Velocidade fica desabilitada
no efeito estático; desligar iluminação desabilita os controles dependentes.
Apresentar apenas efeitos e recursos suportados pelo modelo. A iluminação é
global, sem edição por tecla ou camadas. Amostras de cor são controles funcionais;
a identidade da interface permanece preta e branca.

## Complementos de teclado

Perfis e Geral adaptam as composições já escolhidas para mouse, sem nova rodada
de alternativas. Conteúdo e navegação são específicos de teclado.

- Perfis: `apps/web/.impeccable/mocks/teclado-complementos/teclado-perfis-corrigido.png`.
- Geral: `apps/web/.impeccable/mocks/teclado-complementos/teclado-geral.png`.

Perfis mantém os quatro slots ilustrativos e substitui DPI/taxa de reporte por
resumo de remapeamentos e iluminação. A versão corrigida remove Carregar do
perfil em uso no tema claro. Geral mostra teclado à esquerda e dados/ação de
restauração à direita, com espaço horizontal adequado ao periférico.

## Alternativas de Adicionar dispositivo

Após a escolha de Iluminação opção 3, foram desenhadas três apresentações do
mesmo fluxo de conexão, nos dois temas. O usuário escolheu a opção 1, janela central.

1. Janela central: `apps/web/.impeccable/mocks/adicionar/adicionar-1-modal.png`.
2. Painel lateral: `apps/web/.impeccable/mocks/adicionar/adicionar-2-painel.png`.
3. Página dedicada: `apps/web/.impeccable/mocks/adicionar/adicionar-3-pagina.png`.

As instruções antecedem a seleção nativa do navegador. Não simular um seletor de
permissões como se fosse fornecido pelo browser. Cancelar retorna à home; Explorar
demonstração abre os dispositivos simulados e então exibe o badge Demonstração.
Nenhuma compatibilidade comercial é presumida. Modal/painel precisam de foco
contido, retorno de foco ao fechar, Escape e fundo sem interação enquanto abertos.

## Conjunto final de design — 05/09/2026

Concluídas 22 pranchas: Início (3), Mouse (6), Teclado (4), Estados (7) e
Telas menores (2), todas com temas claro e escuro. As escolhas anteriores são
histórico; a especificação consolidada prevalece sobre propostas superadas,
incluindo o antigo switch de tema.

- Galeria: `apps/web/.impeccable/design-review.html`.
- Catálogo final: `apps/web/.impeccable/design-catalog.json`.
- Comportamentos e limites: `apps/web/.impeccable/design-handoff.md`.

O botão de tema final é um único ícone que alterna entre sol e lua. A seção
final chama-se Geral. O modal central de adicionar dispositivo foi escolhido.
Estados complementares cobrem conexão, desconexão, rascunho, aplicação,
salvamento, erros, confirmações, importação/exportação e validação. Os exemplos
responsivos mostram os padrões de empilhamento e edição para telas menores.

Este fechamento conclui o desenho, não a implementação do aplicativo. As
composições principais foram escolhidas pelo usuário; estados e adaptações
complementares foram derivados dessas escolhas, sem alegar aprovação individual.
