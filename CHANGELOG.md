# Changelog

Todas as alterações notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [1.3.2] - 2026-10-22

### Corrigido
- **Numeração das casas desacoplada durante o zoom**: O número da casa agora é calculado dinamicamente a partir da geometria atualizada (centróide) do polígono a cada redesenho. Durante animações de zoom (`zoomstart` e `zoomanim`), o canvas é limpo para evitar rótulos flutuando fora de posição, sendo redesenhado imediatamente ao término do zoom (`zoomend`).
- **Dimensão e sobreposição de rótulos**: O tamanho da fonte é delimitado à largura útil do polígono; números que não cabem com folga no interior do lote são ocultados automaticamente para evitar sobreposição entre domicílios vizinhos ou vazamento das bordas.
- **Espaçamento horizontal e vertical instável**: Implementação do modelo determinístico baseado em instantâneo (*snapshot*) de posições. O espaçamento é medido e aplicado em coordenadas métricas projetadas (EPSG:3857) ao longo da direção da fileira e na perpendicular, respeitando a rotação real da seleção.
- **Cálculo de espaçamento real inicial**: Ao abrir o popup ou alterar a seleção, os campos H e V calculam e exibem a distância real entre as bordas dos lotes da seleção, substituindo o valor estático anterior de 0,0, com formatação decimal brasileira (vírgula).
- **Agrupamento por fileiras**: O espaçamento horizontal é aplicado uniformemente dentro de cada fileira mantendo a âncora estável; o espaçamento vertical é aplicado entre as duas fileiras como blocos paralelos.
- **Histórico coeso de espaçamento**: Sequências de cliques contínuos em incremento ou decremento de espaçamento são agrupadas em um único estado no histórico de desfazer (`Ctrl+Z`).

### Removido
- **Alinhar verticalmente**: Remoção do botão "Alinhar vert." da barra flutuante de seleção e do código associado.

### Adicionado
- **Versionamento v1.3.2**: Constante `APP_VERSION` unificada no código e identificador discreto da versão exibido junto ao título do projeto.

