# OmniGear — especificação visual para implementação

Conjunto concluído em 05/09/2026: 22 pranchas, com temas claro e escuro. A galeria
`design-review.html` é o índice do conjunto final; `design-catalog.json` registra os
arquivos. Alternativas anteriores continuam nas pastas de mocks como histórico.

Este material especifica o design. As telas desenhadas não representam recursos
já implementados, dispositivos homologados ou testes de hardware. A galeria é
interativa para navegação; os controles dentro das imagens são estáticos.

## Escolhas de composição

| Área                     | Decisão                                          |
| ------------------------ | ------------------------------------------------ |
| Home                     | Opção 1: lista de dispositivos e prévia          |
| Adicionar dispositivo    | Opção 1: janela central                          |
| Mouse / Botões           | Opção 3: edição contextual                       |
| Mouse / DPI              | Opção 2: estágios em linhas                      |
| Mouse / Desempenho       | Opção 3: mouse em destaque                       |
| Mouse / Parâmetros       | Opção 1: painéis e rotação visual                |
| Mouse / Perfis           | Opção 3: grade de slots                          |
| Mouse / Geral            | Opção 1: mouse à esquerda, informações à direita |
| Teclado / Teclas         | Opção 1: edição contextual                       |
| Teclado / Iluminação     | Opção 3: lista de efeitos                        |
| Teclado / Perfis e Geral | Adaptações das composições escolhidas para mouse |

As composições principais foram escolhidas pelo usuário. Estados, adaptações de
teclado e exemplos responsivos completam essas escolhas; não receberam escolhas
individuais em uma nova rodada de alternativas.

## Cobertura do conjunto

| Grupo         | Pranchas | Conteúdo                                                                                                               |
| ------------- | -------: | ---------------------------------------------------------------------------------------------------------------------- |
| Início        |        3 | Home com dispositivos, primeiro acesso e adicionar                                                                     |
| Mouse         |        6 | Botões, DPI, desempenho, parâmetros, perfis e Geral                                                                    |
| Teclado       |        4 | Teclas, iluminação, perfis e Geral                                                                                     |
| Estados       |        7 | Carregamento/desconexão; resultados e erros de conexão; aplicação/salvamento; confirmações; validação; arquivos/perfis |
| Telas menores |        2 | Home e editores de mouse/teclado                                                                                       |
| Total         |       22 | Todas apresentam os dois temas                                                                                         |

## Identidade e navegação

- Interface preta e branca, com contraste legível e hierarquia por espaço,
  tipografia e superfícies. Cor é funcional em iluminação, estágios e mensagens.
- Um único botão de tema: sol no tema claro, lua no escuro. Ao clicar, muda tema
  e ícone. Não usar switch, seletor duplo ou rótulos Claro/Escuro ao lado.
- O nome acessível e tooltip indicam a ação: “Ativar tema escuro” ou “Ativar tema
  claro”. Área clicável mínima de 44 × 44 px, foco visível e teclado suportado.
- A última seção interna chama-se **Geral**.
- A home distingue adicionar um periférico, selecionar um periférico e abrir
  sua configuração. Demonstração é claramente identificada quando ativa.
- Teclado inclui remapeamento, iluminação global, perfis e Geral. Não acrescentar
  macros, camadas, edição RGB por tecla, Hall effect ou rapid trigger nesta versão.

## Contratos de interação

1. **Conexão:** instruções no modal precedem a seleção nativa de dispositivos.
   Não reproduzir uma permissão falsa do navegador. Cancelamento mantém a home;
   erros oferecem recuperação específica. Demonstração usa dados simulados.
2. **Compatibilidade:** mostrar apenas funções realmente suportadas pelo modelo.
   Marcas nas referências não constituem lista de compatibilidade. Geometria de
   teclado, botões do mouse, limites, unidades e número de slots vêm do dispositivo.
3. **Rascunho, aplicação e gravação:** editar altera o rascunho. Aplicar à sessão
   e gravar em um perfil são resultados distintos. Só mostrar sucesso após
   confirmação do mecanismo real. Falha e desconexão preservam o rascunho.
4. **Perfis:** identificar o perfil em uso. Não oferecer Carregar no slot já
   ativo. Ao trocar com alterações pendentes, permitir cancelar, salvar e carregar
   ou descartar e carregar. Quantidade de slots segue a capacidade real.
5. **Restauração:** confirmar a restauração do perfil atual. A ação prepara os
   valores padrão no rascunho; não executar reset de fábrica de todo o dispositivo.
6. **Arquivos:** validar formato, versão e compatibilidade antes de importar.
   Revisar antes de substituir; arquivo inválido preserva os dados existentes.
   Exportar distingue rascunho atual e último perfil salvo. Nome vazio impede salvar.
7. **DPI:** eixos vinculados por padrão; quando independentes, editar X/Y com ajuda
   adequada. Intervalos e passos dependem do sensor; entradas inválidas exibem erro
   junto ao campo e impedem gravar o valor inválido. Sliders refletem o valor numérico.
8. **Iluminação:** efeito estático desabilita velocidade. Desligar iluminação
   desabilita os ajustes dependentes, preservando seus valores para reativação.
9. **Diálogos:** foco contido, Escape, retorno de foco ao elemento de origem e
   fundo inerte. Ações destrutivas têm escopo explícito. Ícone de fechar é X.
10. **Mensagens:** carregamento, aplicação e gravação têm estado ocupado;
    erros são acionáveis, não dependem apenas de cor e não apagam trabalho.

## Adaptação e acessibilidade

Os dois estudos responsivos definem padrões, não uma imagem separada para cada
rota e largura. Home empilha lista e prévia. Editores recolhem a navegação e
posicionam o formulário abaixo do periférico. Parâmetros passam a uma coluna;
slots quebram de 2 × 2 para uma coluna quando necessário. Modais usam a largura
disponível com margem, altura limitada e rolagem interna.

A prévia do teclado pode ser ampliada, mantendo seleção e ações acessíveis por
teclado e alternativa textual. Não reduzir teclas e hotspots abaixo de áreas
utilizáveis. Não usar o PNG como interface: reconstruir controles semânticos,
legendas corretas, estados de foco, labels, mensagens de erro e anúncios de status.

## Limites visuais das pranchas

As imagens orientam composição e intenção. São estudos gerados com IA: dimensões,
ícones, legendas, numeração de hotspots, valores e posições de sliders exigem
normalização na implementação. Medidas não são um contrato pixel a pixel. Textos
editoriais externos às telas, como títulos de linhas comparativas, não entram no app.

As duas versões em uma mesma imagem permitem comparação. O tema da própria
galeria muda apenas seu entorno; a prancha continua mostrando ambos os temas.
Cada PNG final tem prompt embutido e um JSON de origem ao lado. Correções têm
seu próprio prompt e referências; originais continuam preservados no histórico.

## Próxima etapa

Implementar componentes e navegação das composições escolhidas, começando pelo
shell com tema, home e seleção de dispositivo. Depois conectar os editores ao
estado existente e adaptar as capacidades por dispositivo. Validar em navegador
os dois temas, teclado, responsividade e transições de estado; integração física
depende de modelos efetivamente suportados. Nuvem, login, atualização de firmware
e pareamento não fazem parte deste conjunto.

## Abrir a galeria

Abrir `design-review.html` diretamente ou executar, a partir da raiz do projeto:

```powershell
node apps/web/.impeccable/serve-design.mjs
```

Acessar `http://127.0.0.1:27120/design-review.html`. O servidor atende somente na
máquina local. Para regenerar o HTML após editar o catálogo ou template:

```powershell
node apps/web/.impeccable/build-design-gallery.mjs
```

## Registro de verificação — 05/09/2026

- Catálogo conferido: 22 imagens e 22 JSONs de origem presentes; todos os PNGs
  têm assinatura e dimensões válidas. O scan `embed-prompt` dos 10 rasters de
  estados retornou `0 missing`.
- `build-design-gallery.mjs` gerou o HTML com 22 itens; `node --check` passou
  para `serve-design.mjs`. A galeria foi aberta e a navegação Home → Adicionar
  foi confirmada pela árvore de acessibilidade. O botão de tema passou a
  “Ativar tema escuro”, com captura de tela confirmando o tema claro.
- A revisão independente não identificou problemas materiais na documentação
  nem na amostra visual de `confirmacoes.png`, `ajustes-validacao-final.png` e
  `responsivo-editores.png`.

Estas verificações cobrem os mockups e a galeria. Não validam o aplicativo
implementado, integração com hardware ou acessibilidade dos futuros controles.

Pendência técnica: `pnpm graph:update` foi tentado, mas falhou porque `graphify`
não estava disponível no PATH. Executar novamente quando a ferramenta estiver
disponível para atualizar o grafo do projeto.

## Extensão aprovada — RAWM Leviathan V4 (06/09/2026)

O usuário aprovou três extensões específicas do modelo:

- **Desempenho:** preservar o mouse em pé e os indicadores da tela atual. Taxa
  de reporte e Modo de desempenho ficam lado a lado, sem divisória entre os
  blocos. As opções são Office, LP, HP e Gaming+.
- **Parâmetros:** substituir o incorreto Alcance estendido por **Turbo sem fio**,
  explicado como melhoria da conexão do receptor 2,4 GHz em distância ou
  interferência, com possível aumento de consumo. Não chamar esse enlace de
  Wi-Fi nem relacionar o recurso ao alcance do sensor óptico.
- **Botões:** integrar **R-Plus** à tela existente, com escolha do botão ativador
  e edição das camadas Principal e R-Plus. O ativador não recebe uma atribuição
  secundária em sua própria camada.

Esses controles são dirigidos por capacidades declaradas pelo driver. Outros
modelos não os herdam por fabricante nem por semelhança visual; um recurso
ausente, como Motion Sync em certos mouses, simplesmente não é renderizado.
