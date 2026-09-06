# Smoke test físico — RAWM Leviathan V4

Primeiro contato com o hardware real. **Esta etapa é somente leitura.** Nada é gravado
no mouse até que o snapshot real seja validado contra o parser.

## Por que existe uma página separada

O caminho de produção não serve para o primeiro teste, por três motivos:

1. `connectLeviathanV4.ts` valida com rigor: lança exceção se o nome do mouse não casar
   com `/leviathan|魔鲸\s*v4/i` e se `parseMouseParamState` recusar o snapshot.
2. `deviceDiscovery.ts` reduz qualquer exceção a `{ status: 'erro', reason: 'falha' }`.
   A mensagem original é descartada.
3. `editorStore.ts:161` chama `applyToSession` a cada edição, sem confirmação. Um clique
   acidental em qualquer controle dispara `encodeConfigReset()` e a gravação completa dos
   parâmetros.

Ou seja: no caminho normal, a falha mais provável do primeiro teste apaga justamente o
payload que explicaria a falha — e um clique errado grava no mouse.

Por isso o probe é uma **entrada Vite separada** (`apps/web/diagnostico.html`). Ela não
monta o `App`, não chama `restoreSession`, não registra driver e não importa o editor.
Os únicos bytes que ela transmite vêm de `buildQueryEvent`. Ser somente leitura é uma
propriedade estrutural, não uma promessa.

## Como executar

1. Conecte o receptor RAWM na USB e ligue o mouse.
2. **Mexa o mouse** imediatamente antes de consultar. Um mouse adormecido atrás de um
   receptor 2,4 GHz pode não responder dentro do tempo limite (3 s).
3. Suba o app:

   ```bash
   pnpm dev
   ```

4. Abra <http://localhost:5173/diagnostico.html> no Chrome ou Edge.
   Não abra a página principal ainda.
5. Clique em **Selecionar receptor RAWM** e escolha `RAWM HS Receiver` no seletor nativo.
   O botão fica ocupado por até ~6 s: são duas janelas de 3 s, uma por canal.
   - O seletor do WebHID é uma janela nativa do navegador: só você consegue clicar nela.
   - O filtro pede a coleção `0xff00`/`0x0001`, então deve aparecer **uma única linha**.
     O receptor publica várias interfaces HID com o mesmo nome; sem esse filtro o
     seletor lista linhas idênticas e escolher a errada entrega uma interface sem
     relatórios de saída, incapaz de responder.
   - Se nada aparecer, use **Mostrar todos os dispositivos**: significa que a página
     vendor real é outra, e o relatório vai mostrar quais coleções existem.

## O que o relatório traz

| Etapa                  | O que confirma                                 |
| ---------------------- | ---------------------------------------------- |
| Coleção vendor         | existe a coleção `0xff00`/`0x0001`             |
| Consulta ao receptor   | o receptor respondeu JSON pelo canal físico    |
| Identidade do receptor | `pi` = `0x2346` e `vi` = `0x1915`              |
| Consulta ao mouse      | o mouse respondeu pelo canal virtual           |
| Nome do mouse          | `dn` casa com o filtro de nome atual           |
| Snapshot de parâmetros | `parseMouseParamState` aceitou a resposta real |

Cada etapa é independente: uma falhar não impede as seguintes nem descarta o payload.
As respostas cruas do receptor e do mouse, o snapshot interpretado e todos os relatórios
HID recebidos em hexadecimal ficam na página, com botão de copiar e **Baixar relatório**.

## Interpretando o resultado

- **Tudo OK** — o registro e o parser conferem com o hardware. Só então siga para o
  próximo passo: abrir a página principal, conectar e testar `Apply to Session`.
- **Aviso em identidade ou nome** — o hardware relata valores diferentes dos registrados.
  Ajuste `deviceRegistry.ts` / `connectLeviathanV4.ts` com os valores reais antes de
  conectar pelo app; do contrário a conexão será recusada.
- **Falha no snapshot** — copie a resposta crua do mouse, anonimize e crie uma fixture.
  Escreva o teste com a fixture **antes** de mexer no parser, e não altere o driver
  enquanto o parser não passar.
- **Sem resposta do mouse** — mexa o mouse e repita. Se persistir, o canal virtual
  (`0xc0`) ou o framing pode divergir; os relatórios HID em hexadecimal mostram o que
  chegou de fato.
- **"O dispositivo recusou o envio"** — o problema é a transmissão, não o mouse. Confira
  os ids de relatório de saída que a página lista para a coleção vendor: o probe envia
  com `reportId: 0` e o Chrome recusa se esse id não estiver no descritor.
- **"Chegaram bytes que não puderam ser decodificados"** — o dispositivo respondeu, mas o
  framing não confere. Os relatórios em hexadecimal são o material para ajustar
  `protocol.ts`.

Se a coleção vendor não existir, o probe para antes de transmitir qualquer coisa: sem ela
a consulta não teria como funcionar, e o seletor sem filtro pode entregar outro
dispositivo qualquer.

## Depois da leitura

Só avance para gravação quando o snapshot real passar no parser. A ordem é:
`Apply to Session` → perfil temporário → conferir na releitura a taxa de reporte, o modo
de desempenho e o Turbo sem fio.

## Teste de escrita mínimo

Depois que todas as etapas fecharem OK, a seção **Teste de escrita** no fim da página envia
**um único** evento de parâmetros: o snapshot recém-lido com a taxa de reporte alterada e
todo o resto idêntico.

Ela existe porque `applyToSession` não serve como primeiro teste — o driver manda
`CONFIG_RESET`, o corpo completo de parâmetros **e todos os mapeamentos de botão**, que
foram lidos do software oficial sem confirmação em hardware. Um erro ali seria difícil de
atribuir.

O que a seção não faz: `CONFIG_RESET`, mapeamento de botão, e `ACTION_SAVE_CONFIG_TO_FDS`.
Sem gravação em flash, desligar e religar o mouse desfaz a mudança.

Depois de escrever, ela relê e compara **campo a campo**. Um layout de bytes errado aparece
como divergência nomeada, não como um mouse se comportando de forma estranha.

## Teste de mapeamento de botão

Diferente do teste de parâmetros, **este não se verifica sozinho**. A resposta de consulta
não traz nenhum campo de mapeamento — os 46 campos são todos de parâmetro — então não há o
que reler. A única verificação é comportamental: apertar o botão.

Isso importa porque os ids físicos em `physicalKeyIds` foram lidos do software oficial e
nunca confirmados. Um id errado remapeia outro botão.

Procedimento, um id por vez:

1. Comece pelo **botão de DPI (id 7)**, o menos crítico.
2. Escolha uma ação observável, como clique central.
3. Clique em **Remapear** e aperte o botão físico.
4. Anote qual botão mudou de comportamento — se foi outro, o id é desse outro.
5. **Desligue e religue o mouse** para reverter antes do próximo id.

Nada vai para a flash, então o power cycle sempre restaura. Deixe o id 1 (clique esquerdo)
por último: se ele estiver errado e o clique esquerdo parar de funcionar, você vai precisar
do teclado até religar o mouse.

## O que o hardware ensinou sobre mapeamentos

Duas execuções, com um byte de diferença entre elas:

| tentativa                         | resultado                                      |
| --------------------------------- | ---------------------------------------------- |
| mapeamento isolado                | evento aceito, nenhum efeito                   |
| `CONFIG_RESET` + mesmo mapeamento | scroll parou; o botão não virou clique direito |

Disso decorrem três conclusões.

**Mapeamentos só valem dentro do bloco aberto pelo `CONFIG_RESET`.** Isolado, o evento é
aceito e ignorado. Parâmetros, ao contrário, valem imediatamente.

**`CONFIG_RESET` apaga todos os mapeamentos.** Não é um "prepare-se para receber um": é uma
limpeza. Por isso a sequência oficial reenvia o conjunto inteiro depois dele. Uma escrita
parcial de mapeamento não existe.

**O conjunto do driver está incompleto.** `mappingEvents` cobre só os seis botões; a roda
não tem key id, e o id 4 nunca é usado. Aplicar esse conjunto depois de um reset apagaria a
roda sem restaurá-la — foi exatamente o que matou o scroll no teste.

Por isso `applyToSession` passou a escrever **apenas o bloco de parâmetros**, que está
confirmado, e `writeProfile` recusa: ele gravaria na flash, e aí o power cycle não desfaz.

## Key ids: o que o hardware confirmou

Conjunto testado: 1=esquerdo, 2=direito, 3=central, 4=rolagem-cima, 5=voltar, 6=avancar,
7=dpi.

| controle           | resultado |
| ------------------ | --------- |
| clique esquerdo    | funciona  |
| clique direito     | funciona  |
| rolagem para baixo | funciona  |
| rolagem para cima  | nao       |
| clique da roda     | nao       |
| laterais (os dois) | nao       |

**Confirmado:** id 1 = esquerdo, id 2 = direito. A convencao HID vale, e a tabela original
do driver estava trocada, com `central: 2` e `direito: 3`.

**Decorre disso:** como MKEY 1 e 2 funcionaram, os codigos de acao estao corretos. O que
esta errado sao os key ids de 3, 5 e 6.

**Direcao da roda invertida:** o id 4 foi mapeado para `rolagem-cima` (`0x41`) e o efeito
observado foi rolagem para baixo. Entao `0x41` e baixo, e os rotulos em `actions` estao
trocados.

Sobram cinco funcoes (central, dois laterais, DPI e roda) para os ids 3, 4, 5, 6 e 7.
O preset **Descoberta** da a cada id uma acao que nenhum outro tem, entao uma unica passada
pelo hardware nomeia todos de uma vez. Os ids 1 e 2 ficam nos seus lugares confirmados para
o mouse seguir usavel durante o teste.

## Separando id de acao

Duas rodadas com ids diferentes deram o mesmo resultado por acao:

| acao              | id na rodada 1 | id na descoberta | resultado |
| ----------------- | -------------- | ---------------- | --------- |
| `clique-esquerdo` | 1              | 1                | funciona  |
| `clique-direito`  | 2              | 2                | funciona  |
| `voltar`          | 5              | 3                | nunca     |
| `avancar`         | 6              | 4                | nunca     |
| `dpi-ciclo`       | 7              | 6                | nunca     |

Uma falha que segue a **acao** entre conjuntos, e nao o id, aponta para a codificacao da
acao. Um id errado nao se comportaria assim.

Como o id 2 esta provado como o botao direito, ele serve de banco de teste: coloque a acao
suspeita nele e aperte o direito. Nada acontecer acusa a acao, nao o id. Os presets
`Acao no id 2` fazem exatamente isso, um encoding por vez.

Tambem observado: com a roda mapeada, **os dois sentidos rolam para baixo**. Isso aconteceu
com `0x41` na rodada 1 e com `0x3f` na descoberta, em ids diferentes, entao a rolagem nao
parece vir do mapeamento que enviamos.

## Correcao: os ids 1 e 2 nunca foram confirmados

Mapear `id 1 -> clique-esquerdo` e `id 2 -> clique-direito` sobre botoes que ja eram
esquerdo e direito nao prova nada: o resultado e o mesmo se o mapeamento for ignorado.
E a mesma tautologia detectada no teste de polling, e ela passou despercebida aqui.

O teste que desfez o engano: `id 2 -> clique-central` deixou o botao direito dando clique
direito. Se o mapeamento tivesse efeito, ele teria virado clique de roda.

A leitura que explica todas as rodadas: **nenhum mapeamento teve efeito**. Esquerdo e
direito funcionam por serem nativos e sobreviverem ao reset; o resto morre no reset e nossos
eventos nao restauram nada.

Sobra uma peca nunca testada: os dois `ACTION_SAVE_CONFIG_TO_FDS` da sequencia oficial. O
primeiro nomeia o slot de destino, o ultimo confirma. Sem eles os mapeamentos podem nao ter
onde ser gravados, o que explicaria terem sido aceitos e ignorados em todas as variantes.

Isso grava na flash, e o power cycle deixa de desfazer. Escreva num slot que nao seja o
ativo: o mouse declara quatro em `ocn` e esta no primeiro segundo `oci`.
