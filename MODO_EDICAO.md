# Guia Completo do Modo de Edição — SIG Salvação

Este documento detalha todas as funcionalidades do **Modo de Edição** do SIG Salvação, onde estão implementadas e como funcionam na prática.

> **Restrição fundamental:** o Modo de Edição altera apenas a **posição** e a **rotação** visuais dos lotes no modo **Lotes iguais**. O arquivo oficial `dados/casas_salvacao.geojson` e todos os atributos do IBGE (CEP, rua, número, setor, quadra, face, ordem e coordenadas originais) nunca são modificados.

---

## 1. Ativação e Navegação
* **Alternar Modo (`Visualização` / `Modo Edição`)** — `alternarModoApp()` em [editor.js](file:///c:/Users/ghost/Documents/Setembro/sig-salvacao/js/editor.js)
  * Exibe o painel de edição na barra lateral e desabilita o arraste padrão do mapa enquanto a ferramenta **Seleção / Mover** está ativa.
  * Caso o usuário esteja em **Coordenada real**, alterna automaticamente para **Lotes iguais** (a coordenada real do IBGE é somente leitura).
* **Ferramentas (`Seleção / Mover` e `Mover mapa (Pan)`)** — `alternarFerramentaEdicao()` em [editor.js](file:///c:/Users/ghost/Documents/Setembro/sig-salvacao/js/editor.js)
  * **Seleção / Mover:** permite clicar, arrastar retângulo de seleção e mover/rotacionar casas.
  * **Mover mapa (Pan):** reativa o arraste do mapa para navegação.
* **Atalhos rápidos de Pan:** segurar a tecla **`Espaço`** + arrastar ou usar o **botão do meio do mouse** permite mover o mapa a qualquer momento sem sair da ferramenta de seleção.

---

## 2. Seleção e Movimentação
* **Clique simples / `Shift` + Clique** — `aoClicarCasaModoEdicao()` em [editor.js](file:///c:/Users/ghost/Documents/Setembro/sig-salvacao/js/editor.js)
  * Seleciona uma casa (ou expande automaticamente para todas as casas do grupo/quarteirão vinculado).
  * Com `Shift`, adiciona ou remove casas/grupos da seleção atual.
* **Seleção por retângulo (Marquee)** — `initEditorEvents()` em [editor.js](file:///c:/Users/ghost/Documents/Setembro/sig-salvacao/js/editor.js)
  * Clicar e arrastar em uma área vazia do mapa desenha uma caixa de seleção e seleciona todas as casas que intersectam o retângulo.
* **Mover casas arrastando** — `aoMousedownCasaModoEdicao()` + `mousemove`/`mouseup` em [editor.js](file:///c:/Users/ghost/Documents/Setembro/sig-salvacao/js/editor.js)
  * Arrastar uma casa selecionada move todo o conjunto selecionado em metros projetados (EPSG:3857), mantendo tamanho e rotação.

---

## 3. Agrupamento e Organização de Quarteirões
* **Agrupar (`🔗 Agrupar`)** — `agrupar()` em [editor.js](file:///c:/Users/ghost/Documents/Setembro/sig-salvacao/js/editor.js)
  * Vincula as casas selecionadas (mínimo 2) em um grupo lógico; ao clicar em qualquer uma delas depois, o grupo inteiro é selecionado junto.
* **Desagrupar (`⛓️‍💥 Desagrupar`)** — `desagrupar()` em [editor.js](file:///c:/Users/ghost/Documents/Setembro/sig-salvacao/js/editor.js)
  * Remove o vínculo de grupo das casas selecionadas.
* **Agrupar em quarteirão (`🏘️ Agrupar em quarteirão`)** — `calcularQuarteiraoPadronizado()` e `iniciarAgrupamentoQuarteirao()` em [spacing.js](file:///c:/Users/ghost/Documents/Setembro/sig-salvacao/js/spacing.js)
  * Reorganiza a seleção (mínimo 2 casas) em um quarteirão padronizado com **2 fileiras paralelas**, lotes de `8,0 m × 16,0 m`, espaçamento horizontal de `1,0 m` e intervalo vertical de `3,0 m` entre fileiras, vinculados a um grupo do tipo `"quarteirao"`.
  * Abre uma **pré-visualização em laranja** com barra de **✓ Confirmar** / **✕ Cancelar** (`confirmarPreviewAcao()` / `cancelarPreviewAcao()`).

---

## 4. Menu de Contexto (Botão Direito no Mapa)
Implementado em `abrirMenuContexto()` em [editor.js](file:///c:/Users/ghost/Documents/Setembro/sig-salvacao/js/editor.js):
* **Ativar / Desativar numeração das casas (`🔢`)** — `alternarNumeracaoCasas()` em [numbering.js](file:///c:/Users/ghost/Documents/Setembro/sig-salvacao/js/numbering.js)
  * Liga ou desliga os números centralizados sobre cada polígono (renderizados em `<canvas>` para zoom ≥ 18) e salva a preferência no `localStorage`.
* **Nivelar na horizontal (`📐`)** — `calcularNivelamentoHorizontal()` e `iniciarNivelarHorizontal()` em [spacing.js](file:///c:/Users/ghost/Documents/Setembro/sig-salvacao/js/spacing.js) *(requer ≥ 2 casas)*
  * Calcula o eixo principal (PCA) da seleção e gira todo o bloco em torno do centroide até a fileira ficar horizontal, preservando espaçamentos e posições relativas (com pré-visualização antes de confirmar).
* **Alinhar em uma linha (`📏`)** — `calcularAlinhamentoLinha()` e `iniciarAlinharLinha()` em [spacing.js](file:///c:/Users/ghost/Documents/Setembro/sig-salvacao/js/spacing.js) *(requer ≥ 2 casas)*
  * Organiza as casas selecionadas em uma única fileira horizontal uniforme, com `1,0 m` entre lotes (com pré-visualização antes de confirmar).

---

## 5. Barra Flutuante da Seleção e Espaçamento H / V
Renderizada por `atualizarOverlayEdicao()` em [editor.js](file:///c:/Users/ghost/Documents/Setembro/sig-salvacao/js/editor.js):
* Exibe ações rápidas sobre o conjunto selecionado: `Agrupar`, `Agrupar em quarteirão`, `Desagrupar`, `-15°`, `+15°`, `Restaurar (↺)` e os controles de espaçamento.
* **Espaçamento Horizontal (`↔ H`) e Vertical (`↕ V`)** — `prepararSnapshotEspacamento()` e `aplicarEspacamentoDeterministo()` em [spacing.js](file:///c:/Users/ghost/Documents/Setembro/sig-salvacao/js/spacing.js)
  * Separa automaticamente a seleção em fileiras pela coordenada perpendicular (em metros projetados EPSG:3857) sem misturar casas de fileiras diferentes.
  * Exibe o espaçamento médio real entre bordas (inclusive valores negativos quando há sobreposição) e indica com **`~`** + tooltip quando os vãos estão irregulares.
  * Botões **`-` / `+`** ajustam em passos determinísticos de **`0,1 m`** (mínimo `0,0 m`), mantendo o centro de cada fileira fixo em H e o centro do conjunto fixo em V, preservando o ajuste do outro eixo e agrupando cliques contínuos em uma única entrada de desfazer.

---

## 6. Rotação
* **Botões fixos e campo numérico (`-15°`, `-1°`, `+1°`, `+15°`, `°`)** — `rotacionarCasasSelecionadas()` em [editor.js](file:///c:/Users/ghost/Documents/Setembro/sig-salvacao/js/editor.js)
  * Rotaciona todas as casas selecionadas em bloco em torno do centroide métrico do conjunto.
* **Alça visual de rotação (`↻`)** — `atualizarOverlayEdicao()` + `mousemove`/`mouseup` em [editor.js](file:///c:/Users/ghost/Documents/Setembro/sig-salvacao/js/editor.js)
  * Arrastar o ícone `↻` acima da seleção gira as casas interativamente em tempo real com indicação do ângulo aplicado.

---

## 7. Histórico e Restauração
Implementados em [storage.js](file:///c:/Users/ghost/Documents/Setembro/sig-salvacao/js/storage.js):
* **Desfazer (`Ctrl+Z` / `↩ Desfazer`)** e **Refazer (`Ctrl+Y` ou `Ctrl+Shift+Z` / `↪ Refazer`)** — `desfazer()`, `refazer()`, `salvarSnapshotHistorico()`.
* **Restaurar selecionadas (`↺ Restaurar selecionadas`)** — `restaurarSelecionadas()`: devolve apenas as casas selecionadas à geometria padronizada original.
* **Restaurar quarteirão (`🏘️ Restaurar quarteirão da seleção`)** — `restaurarQuarteiraoSelecionado()`: restaura todas as casas pertencentes ao quarteirão/grupo da seleção e desfaz o agrupamento.
* **Restaurar todas (`⚠️ Restaurar todas ao original`)** — `restaurarTodas()`: limpa todos os ajustes e grupos após confirmação.

---

## 8. Persistência e Exportação
Implementados em [storage.js](file:///c:/Users/ghost/Documents/Setembro/sig-salvacao/js/storage.js):
* **Salvamento automático local (`localStorage`)** — `salvarLocalStorage()` e `carregarAjustesIniciais()`: salva cada alteração automaticamente no navegador e carrega `dados/casas_ajustadas.json` na inicialização quando disponível.
* **Salvar `casas_ajustadas.json` (`💾`)** — `salvarArquivoAjustes()`: grava diretamente via File System Access API (quando suportada) ou baixa o arquivo JSON com `versao`, `grupos` e `ajustes`.
* **Exportar GeoJSON ajustado (`🌐`)** — `exportarGeoJsonAjustado()`: gera `casas_salvacao_ajustado.geojson` mantendo todos os atributos originais do IBGE.
* **Importar JSON (`📂`)** — handler em [main.js](file:///c:/Users/ghost/Documents/Setembro/sig-salvacao/js/main.js): restaura ajustes e grupos a partir de um arquivo `.json` salvo anteriormente.

---

## 9. Auditoria via Console (Desenvolvimento)
* `window.verificarEspacamento(alvoH, alvoV)` em [spacing.js](file:///c:/Users/ghost/Documents/Setembro/sig-salvacao/js/spacing.js): lista as fileiras detectadas, a distância entre cada par de vizinhos e aponta desvios > `0,05 m`.
* `window.verificarNumeracao()` em [numbering.js](file:///c:/Users/ghost/Documents/Setembro/sig-salvacao/js/numbering.js): verifica se todos os rótulos renderizados estão centralizados nos respectivos polígonos sem desvios > `1 px`.
