# Aprendendo UI com Spotifast e MonoCode

Análise do código público consultado em 7 de outubro de 2026.

A minha leitura é que os dois projetos têm uma qualidade em comum: controlam bem a atenção. Cor, formas e movimento seguem uma hierarquia. O Spotifast conecta a aparência à música; o MonoCode organiza uma área de trabalho com bastante informação.

**Escopo:** li os arquivos de implementação e a documentação pública. As capturas e o navegador local não carregaram nesta sessão. Portanto, as observações estéticas abaixo são interpretações do código, não uma avaliação visual completa ou um teste de uso. Não medi contraste, fluidez ou acessibilidade nos aplicativos executando.

## Duas maneiras de construir interfaces

| Aspecto                    | Spotifast                                                           | MonoCode                                                       |
| -------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------- |
| Construção                 | Rust, egui e eframe                                                 | React, TypeScript, Tailwind CSS e Vite, dentro de Tauri        |
| Organização                | Funções para painéis, páginas e widgets                             | Componentes React para a janela, sessões, editor e controles   |
| Linguagem visual no código | Superfícies escuras com matiz frio, verde de ação e cores das capas | Base neutra, contrastes sutis, estados e transparência         |
| Tipografia                 | Inter; funções para diferentes pesos                                | Família de fontes do sistema; fontes monoespaçadas para código |
| Ícones                     | Lucide, via a infraestrutura compartilhada                          | Hugeicons com uma camada de componentes própria                |
| O que estudar              | Paleta, geometria dos cards e adaptação ao conteúdo                 | Tokens CSS, composição de componentes e estados de interação   |

As tecnologias estão declaradas nos [manifestos do Spotifast](https://github.com/crmne/spotifast/blob/main/Cargo.toml) e do [MonoCode](https://github.com/hardbeat920/monocode/blob/main/package.json). As referências de fonte e ícones do Spotifast estão no [README](https://github.com/crmne/spotifast#acknowledgements); as do MonoCode estão no [CSS](https://github.com/hardbeat920/monocode/blob/main/src/styles/index.css) e na [camada de ícones](https://github.com/hardbeat920/monocode/blob/main/src/shared/ui/icons.tsx).

No Spotifast, uma função descreve a interface em cada atualização do egui e recebe respostas de interação. No MonoCode, componentes React produzem elementos da interface web, estilizados com CSS. O desenho visual pode ser aprendido e reproduzido em outras tecnologias; cada implementação fornece ferramentas diferentes.

## Spotifast: fazer a interface conversar com o conteúdo

### A paleta tem papéis definidos

A paleta escura separa fundo da janela (#0f1114), painel (#15181c), superfície (#1d2127), hover (#262b33), texto principal (#f2f4f6) e secundário (#a9b1bc). O verde de ação é #1ed760. Existem ainda cores específicas para aviso e erro.

Isso permite organizar profundidade e importância sem depender de uma borda forte em cada elemento. O arquivo também centraliza raios de 8 e 4 unidades, linhas de 56, 48 e 36 e barra do player de 88. São unidades lógicas do egui, não uma promessa de pixels físicos em qualquer tela. [Paleta e medidas](https://github.com/crmne/spotifast/blob/main/src/theme.rs).

**Lição:** dê nomes às cores por função. “Texto secundário” e “superfície em hover” são decisões que você consegue aplicar de forma consistente.

### A capa influencia o ambiente

A página busca uma cor associada à imagem do álbum, artista ou playlist e mistura essa cor com o fundo. O resultado vira um gradiente vertical em uma faixa de 340 unidades no topo. A intensidade varia com a página e respeita a configuração correspondente. [Composição da página](https://github.com/crmne/spotifast/blob/main/src/ui/mod.rs).

A barra do player usa outra medida: mistura 12% da cor associada à arte ao painel e muda entre cores em 0,45 segundo. [Barra do player](https://github.com/crmne/spotifast/blob/main/src/ui/player_bar.rs).

**Minha interpretação:** isso dá continuidade entre imagem e interface. Você reconhece a identidade do conteúdo além do retângulo da capa.

### Os cards têm uma geometria cuidadosa

O card reserva espaço para uma linha de título e duas de subtítulo, mesmo quando o subtítulo é curto. Isso mantém as capas alinhadas. O título usa peso semibold em tamanho 14; o subtítulo, regular em 12,5. Há 12 unidades de padding e 10 entre imagem e título.

As capas podem ser quadradas ou circulares. No hover, surge um fundo discreto e, para conteúdo reproduzível, um controle de play. O gradiente é desenhado com uma malha de dois triângulos; as sombras também são explícitas. [Widgets](https://github.com/crmne/spotifast/blob/main/src/ui/widgets.rs).

**Lição:** alinhamento precisa funcionar com conteúdo real. Uma coleção com nomes curtos e longos deve manter seu ritmo.

## MonoCode: fazer muitas ferramentas parecerem uma única interface

### Tokens mantêm os contrastes relacionados

O CSS deriva fundo e texto de variáveis HSL e cria seleções por mistura de cores. No tema escuro, a luminosidade padrão do fundo é 9% e a do conteúdo, 92%. Separadores usam uma mistura de 7% da cor de conteúdo com transparência.

As durações também têm nomes: feedback em 120 ms, reordenação em 160 ms e fechamento de abas em 200 ms. Há regras para reduzir movimento conforme a preferência do sistema.

O fundo opcional do chat combina cópias da imagem, blur e máscaras graduais. Essas configurações estão no [CSS central](https://github.com/hardbeat920/monocode/blob/main/src/styles/index.css), e as camadas são montadas pelo [componente de fundo](https://github.com/hardbeat920/monocode/blob/main/src/features/settings/ui/GradientBlurBackground.tsx).

**Lição:** tokens são valores compartilhados com significado. Eles ajudam os componentes a pertencer à mesma família.

### O vidro envolve a janela do sistema

A aparência chama comandos Tauri para ativar vidro e configurar blur. Também coordena a mudança entre o preenchimento nativo e o CSS. A janela é configurada com transparência e barra de título sobreposta. [Controle de aparência](https://github.com/hardbeat920/monocode/blob/main/src/features/settings/model/appearance.ts), [configuração da janela](https://github.com/hardbeat920/monocode/blob/main/src-tauri/tauri.conf.json).

Esse efeito precisa ser avaliado no sistema operacional de destino. Um preview web pode mostrar os estilos dos componentes sem reproduzir a aparência completa da janela.

### Hierarquia acontece nos componentes pequenos

Na sidebar, nomes e contagens recebem tamanhos, pesos e opacidades diferentes. Alguns controles aparecem em hover ou foco de teclado. Estados de trabalho, conclusão e necessidade de atenção recebem sinais próprios. [Sidebar](https://github.com/hardbeat920/monocode/blob/main/src/app/shell/Sidebar.tsx).

O campo de mensagem reúne escrita, anexos, projeto, modelo e ações. Seu contorno fica mais forte ao receber foco; menus guardam ações adicionais. [Composer](https://github.com/hardbeat920/monocode/blob/main/src/features/sessions/ui/Composer.tsx).

**Minha interpretação:** a interface mantém ferramentas disponíveis e reduz a competição visual entre elas. Esse princípio costuma ser chamado de divulgação progressiva: mostrar detalhes conforme a necessidade.

### O acabamento inclui comportamento

O popover reposiciona o menu quando conteúdo ou janela mudam, fecha com Escape ou clique externo e separa a camada de blur da camada que se move. [Popover](https://github.com/hardbeat920/monocode/blob/main/src/shared/ui/Popover.tsx).

Na inicialização, o aplicativo espera a interface aparecer antes de retirar a cobertura de abertura. [Bootstrap](https://github.com/hardbeat920/monocode/blob/main/src/main.tsx).

Esses cuidados explicam parte do que chamamos de polimento: transições entre estados também precisam parecer organizadas.

## Como estudar sem se perder no código inteiro

Comece por uma área pequena. Eu faria estes exercícios:

1. **Uma linha de sidebar:** ícone, título e contador. Experimente pesos e cores antes de adicionar efeitos.
2. **Três cards com textos diferentes:** um curto, um longo e um com subtítulo em duas linhas. Compare alinhamentos.
3. **Estados do mesmo componente:** normal, hover, foco, selecionado e desabilitado.
4. **Um fundo ligado ao conteúdo:** escolha uma cor de uma imagem e misture ao fundo com intensidade baixa.
5. **Uma interação curta:** anime uma troca de estado e verifique se ela esclarece o que aconteceu.
6. **Uma janela estreita:** observe o que deve quebrar linha, reduzir, rolar ou se recolher.

Construa primeiro em tons de cinza. Depois adicione uma cor de ação; por último, sombras, gradientes e transparência. Essa sequência permite descobrir qual decisão melhora a organização.

Para uma aplicação web, HTML e CSS permitem experimentar rapidamente essas relações. React ajuda a reutilizar componentes quando você já sabe como eles devem se comportar. Rust e egui são um caminho interessante para estudar desenho e interação em um aplicativo desktop.

## Arquivos que eu leria primeiro

| Projeto   | Ordem sugerida                                                        | O que procurar                                               |
| --------- | --------------------------------------------------------------------- | ------------------------------------------------------------ |
| Spotifast | theme.rs → ui/widgets.rs → ui/mod.rs → ui/player_bar.rs               | Papéis das cores, medidas, cards, gradiente e mudança de cor |
| MonoCode  | styles/index.css → Sidebar.tsx → Composer.tsx → shared/ui/Popover.tsx | Tokens, hierarquia, estados e acabamento de menus            |

Eu deixaria o App.tsx do MonoCode para depois: ele concentra muita coordenação do aplicativo, enquanto os arquivos acima permitem estudar uma decisão visual por vez.

A pergunta mais útil durante o estudo é: **“O que este componente me faz perceber primeiro, e qual decisão no código produz isso?”**
