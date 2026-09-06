# RAWM Leviathan V4 — especificação de suporte

Data: 2026-09-06  
Status: aprovado para implementação

## Objetivo

Adicionar o RAWM Leviathan V4 ao OmniGear por meio do receptor 2,4 GHz, com
reconhecimento, leitura segura do estado, aplicação à sessão e gravação no
perfil. A implementação deve permitir que novos modelos declarem apenas os
recursos que realmente possuem.

## Identidade do dispositivo

- Fabricante WebHID: `0x1915`.
- Produto do receptor observado no Windows: `0x2346`.
- Nome observado: `RAWM HS Receiver`.
- Coleção usada: página de uso `0xFF00`, uso `0x0001`, com relatórios de entrada
  e saída de ID `0`.
- O receptor hospeda um mouse virtual no canal ESB de mouse. O app consulta o
  receptor e depois o mouse nesse canal antes de expor o dispositivo.

## Contrato de capacidades

As capacidades são por modelo, não por marca. Para mouse, o contrato passa a
permitir opcionalmente:

- modos de desempenho, com IDs e rótulos declarados pelo driver;
- Turbo sem fio do receptor 2,4 GHz;
- camada R-Plus e lista de botões que podem ativá-la;
- Motion Sync, Angle Snapping, Ripple Control, LOD, rotação, debounce e repouso.

Um modelo que não declare uma capacidade não mostra seu controle. Isto cobre,
por exemplo, mouses Logitech sem Motion Sync sem criar exceções de interface.

## Estado editável

- `performanceMode` armazena o modo selecionado quando suportado.
- `wirelessTurbo` substitui o antigo e semanticamente incorreto
  `extendedRange`.
- `rPlus.activatorButtonId` identifica o botão que ativa a camada.
- `rPlus.buttons` contém as ações secundárias. O ativador não aceita uma ação
  secundária na própria camada.

## Interface aprovada

- Desempenho preserva o mouse em pé e os indicadores atuais.
- Taxa de reporte e Modo de desempenho ficam lado a lado, sem divisória entre
  os blocos. Os modos do Leviathan são Office, LP, HP e Gaming+.
- Parâmetros apresenta “Turbo sem fio” em Energia, com a descrição:
  “Melhora a conexão 2,4 GHz em longas distâncias ou ambientes com
  interferência. Pode aumentar o consumo.”
- Botões ganha seletor do ativador R-Plus e alternância entre as camadas
  Principal e R-Plus.

## Segurança do protocolo

O app não envia um retrato completo de parâmetros presumidos para hardware real.
Antes da primeira escrita, a consulta precisa retornar um pacote íntegro,
identificar o modelo suportado e fornecer todos os campos preservados pelo pacote
de configuração. Resposta incompleta, tempo esgotado ou identidade divergente
mantêm o dispositivo fora do editor e retornam erro de reconhecimento/conexão.

O transporte fragmenta mensagens em relatórios de 64 bytes e reagrupa as
respostas. CRC, cabeçalhos e canal virtual são tratados na camada de protocolo.
Telemetria, atualização de firmware e chamadas aos serviços do fabricante não
fazem parte desta implementação.

## Critérios de aceite

1. O seletor WebHID filtra o VID do fabricante e reconhece PID/coleção do
   receptor do Leviathan V4.
2. Dispositivos já autorizados são restaurados via `navigator.hid.getDevices()`.
3. Desconexão afeta somente o dispositivo correspondente.
4. O editor mostra apenas capacidades declaradas pelo modelo.
5. Desempenho, Turbo sem fio e R-Plus atualizam o rascunho e usam o driver real.
6. Nenhuma escrita ocorre sem uma consulta validada do estado do dispositivo.
7. Testes cobrem registro, enquadramento, CRC, parsing, capacidades e invariantes
   de R-Plus; build e lint permanecem verdes.
