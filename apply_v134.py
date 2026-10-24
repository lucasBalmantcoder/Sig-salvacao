import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update APP_VERSION and badge
content = content.replace(
    '<span class="versao-app" id="appVersao">v1.3.3</span>',
    '<span class="versao-app" id="appVersao">v1.3.4</span>'
)
content = content.replace(
    'const APP_VERSION = "1.3.3";',
    'const APP_VERSION = "1.3.4";'
)

# 2. Add .input-irregular css
old_css = """.grupo-input-flutuante input {
                border: 1px solid var(--border-strong);
                background: var(--surface);
                color: var(--ink);
                border-radius: 4px;
                text-align: center;
            }"""

new_css = """.grupo-input-flutuante input {
                border: 1px solid var(--border-strong);
                background: var(--surface);
                color: var(--ink);
                border-radius: 4px;
                text-align: center;
            }
            .grupo-input-flutuante input.input-irregular {
                color: #d97706;
                font-weight: 600;
            }"""

assert old_css in content, "old_css not found"
content = content.replace(old_css, new_css, 1)

# 3. Add invalidarSnapshotEspacamento, formatarValorEspacamento, parseValEspacamento
old_snap_def = """                // ============ Alinhamentos, Nivelamento e Espaçamentos ============
                let snapshotBaseEspacamento = null;
                let historicoEspacamentoSalvo = false;"""

new_snap_def = """                // ============ Alinhamentos, Nivelamento e Espaçamentos ============
                let snapshotBaseEspacamento = null;
                let historicoEspacamentoSalvo = false;

                function invalidarSnapshotEspacamento() {
                    snapshotBaseEspacamento = null;
                    historicoEspacamentoSalvo = false;
                }

                function formatarValorEspacamento(valor, irregular) {
                    if (valor === null || valor === undefined || isNaN(valor)) return "0,0";
                    const sinal = valor < -0.05 ? "-" : "";
                    const num = Math.abs(valor).toFixed(1).replace(".", ",");
                    const base = (valor >= -0.05 && valor < 0.05) ? "0,0" : (sinal + num);
                    return irregular ? `~ ${base}` : base;
                }

                function parseValEspacamento(str) {
                    if (!str) return NaN;
                    const limpo = String(str).replace("~", "").trim().replace(",", ".");
                    const val = parseFloat(limpo);
                    if (isNaN(val) || val < 0) return NaN;
                    return Math.round(val * 10) / 10;
                }"""

assert old_snap_def in content, "old_snap_def not found"
content = content.replace(old_snap_def, new_snap_def, 1)

# 4. Invalidate snapshot in aplicarSnapshot
old_aplicarSnapshot = """                function aplicarSnapshot(snapshot) {
                    cancelarPreviewQuarteirao();"""

new_aplicarSnapshot = """                function aplicarSnapshot(snapshot) {
                    cancelarPreviewQuarteirao();
                    invalidarSnapshotEspacamento();"""

assert old_aplicarSnapshot in content, "old_aplicarSnapshot not found"
content = content.replace(old_aplicarSnapshot, new_aplicarSnapshot, 1)

# 5. Invalidate snapshot in agrupar and desagrupar
old_agrupar = """                function agrupar() {
                    if (E.selecionadas.size < 2) return;
                    salvarSnapshotHistorico();"""

new_agrupar = """                function agrupar() {
                    if (E.selecionadas.size < 2) return;
                    invalidarSnapshotEspacamento();
                    salvarSnapshotHistorico();"""

assert old_agrupar in content, "old_agrupar not found"
content = content.replace(old_agrupar, new_agrupar, 1)

old_desagrupar = """                function desagrupar() {
                    if (E.selecionadas.size === 0) return;
                    salvarSnapshotHistorico();"""

new_desagrupar = """                function desagrupar() {
                    if (E.selecionadas.size === 0) return;
                    invalidarSnapshotEspacamento();
                    salvarSnapshotHistorico();"""

assert old_desagrupar in content, "old_desagrupar not found"
content = content.replace(old_desagrupar, new_desagrupar, 1)

# 6. Invalidate snapshot in confirmarPreviewAcao
old_confirmarPreview = """                    cancelarPreviewAcao();
                    marcarSalvo(false);
                    salvarLocalStorage();
                    atualizarOverlayEdicao();
                    atualizarUIEdicao();
                    desenharNumeracaoCasas();
                    st(`<b>Ação confirmada:</b> ${descAcao}.`);"""

new_confirmarPreview = """                    cancelarPreviewAcao();
                    invalidarSnapshotEspacamento();
                    marcarSalvo(false);
                    salvarLocalStorage();
                    atualizarOverlayEdicao();
                    atualizarUIEdicao();
                    desenharNumeracaoCasas();
                    st(`<b>Ação confirmada:</b> ${descAcao}.`);"""

assert old_confirmarPreview in content, "old_confirmarPreview not found"
content = content.replace(old_confirmarPreview, new_confirmarPreview, 1)

# 7. Invalidate snapshot in moverCasasSelecionadas and rotacionarCasasSelecionadas
old_mover = """                function moverCasasSelecionadas(dx, dy) {
                    if (E.selecionadas.size === 0) return;"""

new_mover = """                function moverCasasSelecionadas(dx, dy) {
                    if (E.selecionadas.size === 0) return;
                    invalidarSnapshotEspacamento();"""

assert old_mover in content, "old_mover not found"
content = content.replace(old_mover, new_mover, 1)

old_rot = """                function rotacionarCasasSelecionadas(graus) {
                    if (E.selecionadas.size === 0 || !graus) return;
                    salvarSnapshotHistorico();"""

new_rot = """                function rotacionarCasasSelecionadas(graus) {
                    if (E.selecionadas.size === 0 || !graus) return;
                    invalidarSnapshotEspacamento();
                    salvarSnapshotHistorico();"""

assert old_rot in content, "old_rot not found"
content = content.replace(old_rot, new_rot, 1)

# 8. Invalidate snapshot in mouseup (after drag or rotate finish)
old_arrasto_end = """                        arrastoStartPos = null;
                        atualizarOverlayEdicao();
                    }

                    // Fim da rotação
                    if (rotacionandoEmAndamento) {"""

new_arrasto_end = """                        arrastoStartPos = null;
                        invalidarSnapshotEspacamento();
                        atualizarOverlayEdicao();
                    }

                    // Fim da rotação
                    if (rotacionandoEmAndamento) {"""

assert old_arrasto_end in content, "old_arrasto_end not found"
content = content.replace(old_arrasto_end, new_arrasto_end, 1)

old_rot_end = """                        rotDeltaDeg = 0;
                        rotCentroMeters = null;
                        atualizarOverlayEdicao();
                    }

                    // Fim da caixa de seleção (marquee)"""

new_rot_end = """                        rotDeltaDeg = 0;
                        rotCentroMeters = null;
                        invalidarSnapshotEspacamento();
                        atualizarOverlayEdicao();
                    }

                    // Fim da caixa de seleção (marquee)"""

assert old_rot_end in content, "old_rot_end not found"
content = content.replace(old_rot_end, new_rot_end, 1)

# 9. Invalidate snapshot in restaurar functions
old_restaurar = """                function restaurarSelecionadas() {
                    if (E.selecionadas.size === 0) return;
                    salvarSnapshotHistorico();"""

new_restaurar = """                function restaurarSelecionadas() {
                    if (E.selecionadas.size === 0) return;
                    invalidarSnapshotEspacamento();
                    salvarSnapshotHistorico();"""

assert old_restaurar in content, "old_restaurar not found"
content = content.replace(old_restaurar, new_restaurar, 1)

# 10. Replace prepararSnapshotEspacamento, aplicarEspacamentoDeterministo, and add window.verificarEspacamento
old_espacamento_block = content[content.find("function prepararSnapshotEspacamento()"):content.find("// ============ Sistema Unificado de Pré-visualização ============")]

new_espacamento_block = """function prepararSnapshotEspacamento() {
                    const feats = Array.from(E.selecionadas).map((id) => mapaCasasPorId.get(id)).filter(Boolean);
                    if (feats.length < 2) {
                        snapshotBaseEspacamento = null;
                        historicoEspacamentoSalvo = false;
                        return null;
                    }

                    const centroMetros = calcularCentroideMetros(feats);
                    const theta = calcularEixoPrincipalSelecao(feats);
                    let ux = Math.cos(theta);
                    let uy = Math.sin(theta);
                    if (ux < 0 || (ux === 0 && uy < 0)) { ux = -ux; uy = -uy; }
                    const nx = -uy;
                    const ny = ux;

                    // Projeção dos centros de cada lote no sistema coordenado da fileira (u, n)
                    const itens = feats.map((f) => {
                        const c = centroide(f.properties._anelUni);
                        const pM = L.CRS.EPSG3857.project(L.latLng(c[1], c[0]));
                        const t = (pM.x - centroMetros.x) * ux + (pM.y - centroMetros.y) * uy;
                        const d = (pM.x - centroMetros.x) * nx + (pM.y - centroMetros.y) * ny;
                        return {
                            id: f.properties.id,
                            f,
                            t,
                            d,
                            pM,
                            coordsBase: JSON.parse(JSON.stringify(f.properties._anelUni)),
                            rotBase: (E.ajustes[f.properties.id] && E.ajustes[f.properties.id].rot_deg) || 0
                        };
                    });

                    // Detecção de fileiras por tolerância consecutiva na coordenada perpendicular d
                    const ordenadosD = [...itens].sort((a, b) => a.d - b.d);
                    const fileiras = [];
                    let filAtual = [ordenadosD[0]];
                    for (let k = 1; k < ordenadosD.length; k++) {
                        const it = ordenadosD[k];
                        const prev = ordenadosD[k - 1];
                        if ((it.d - prev.d) > (PADRAO_PROFUNDIDADE_M * 0.5)) {
                            fileiras.push(filAtual);
                            filAtual = [it];
                        } else {
                            filAtual.push(it);
                        }
                    }
                    if (filAtual.length) fileiras.push(filAtual);

                    // Para cada fileira, ordena ao longo do eixo u e calcula âncoras locais
                    fileiras.forEach((fil) => {
                        fil.sort((a, b) => a.t - b.t);
                        fil.tBaseMedia = fil.reduce((s, it) => s + it.t, 0) / fil.length;
                        fil.dBaseMedia = fil.reduce((s, it) => s + it.d, 0) / fil.length;
                    });

                    // Calcula o espaçamento horizontal real atual (entre bordas de lotes adjacentes: deltaT - W)
                    const gapsH = [];
                    fileiras.forEach((fil) => {
                        for (let k = 0; k < fil.length - 1; k++) {
                            const distBordas = (fil[k + 1].t - fil[k].t) - PADRAO_LARGURA_M;
                            gapsH.push(distBordas);
                        }
                    });
                    const espHMedio = gapsH.length
                        ? (gapsH.reduce((a, b) => a + b, 0) / gapsH.length)
                        : PADRAO_ESPACAMENTO_M;
                    const espHIrregular = gapsH.length >= 2
                        ? (Math.max(...gapsH) - Math.min(...gapsH)) > 0.05
                        : false;

                    // Calcula o espaçamento vertical real atual (entre centros das fileiras - D)
                    const gapsV = [];
                    for (let r = 0; r < fileiras.length - 1; r++) {
                        const distBordasV = (fileiras[r + 1].dBaseMedia - fileiras[r].dBaseMedia) - PADRAO_PROFUNDIDADE_M;
                        gapsV.push(distBordasV);
                    }
                    const espVMedio = gapsV.length
                        ? (gapsV.reduce((a, b) => a + b, 0) / gapsV.length)
                        : 0.0;
                    const espVIrregular = gapsV.length >= 2
                        ? (Math.max(...gapsV) - Math.min(...gapsV)) > 0.05
                        : false;

                    snapshotBaseEspacamento = {
                        feats,
                        centroMetros,
                        ux,
                        uy,
                        nx,
                        ny,
                        fileiras,
                        temDuasFileiras: fileiras.length >= 2,
                        espHAtual: Number(espHMedio.toFixed(1)),
                        espVAtual: Number(espVMedio.toFixed(1)),
                        espHIrregular,
                        espVIrregular,
                        targetH: null,
                        targetV: null
                    };

                    return snapshotBaseEspacamento;
                }

                function aplicarEspacamentoDeterministo(eixo, novoEspacamentoM) {
                    if (!snapshotBaseEspacamento) {
                        prepararSnapshotEspacamento();
                    }
                    if (!snapshotBaseEspacamento) return;

                    const snap = snapshotBaseEspacamento;
                    const W = PADRAO_LARGURA_M;
                    const D = PADRAO_PROFUNDIDADE_M;

                    // Registra no histórico uma única vez por sessão contínua de ajuste
                    if (!historicoEspacamentoSalvo) {
                        salvarSnapshotHistorico();
                        historicoEspacamentoSalvo = true;
                    }

                    const valorAlvo = Math.max(0, novoEspacamentoM);

                    if (eixo === "h") {
                        snap.targetH = valorAlvo;
                        snap.espHAtual = valorAlvo;
                        snap.espHIrregular = false;
                    } else if (eixo === "v") {
                        if (!snap.temDuasFileiras || snap.fileiras.length < 2) {
                            st("O espaçamento vertical requer ao menos duas fileiras na seleção.");
                            return;
                        }
                        snap.targetV = valorAlvo;
                        snap.espVAtual = valorAlvo;
                        snap.espVIrregular = false;
                    }

                    const R = snap.fileiras.length;
                    const dGlobalMedia = snap.fileiras.reduce((s, fil) => s + fil.dBaseMedia, 0) / R;

                    snap.fileiras.forEach((fil, r) => {
                        const m = fil.length;
                        let t0 = fil.tBaseMedia;
                        let passoH = W + (snap.targetH !== null ? snap.targetH : 0);
                        if (snap.targetH !== null && m >= 2) {
                            t0 = fil.tBaseMedia - ((m - 1) / 2) * passoH;
                        }

                        let deltaD = 0;
                        if (snap.targetV !== null && R >= 2) {
                            const passoV = D + snap.targetV;
                            const d0 = dGlobalMedia - ((R - 1) / 2) * passoV;
                            const dRowTarget = d0 + r * passoV;
                            deltaD = dRowTarget - fil.dBaseMedia;
                        }

                        fil.forEach((it, k) => {
                            const tTarget = (snap.targetH !== null && m >= 2) ? (t0 + k * passoH) : it.t;
                            const deltaT = tTarget - it.t;

                            const dx = deltaT * snap.ux + deltaD * snap.nx;
                            const dy = deltaT * snap.uy + deltaD * snap.ny;
                            const novoAnel = aplicarTranslacaoMetros(it.coordsBase, dx, dy);

                            const f = it.f;
                            f.properties._anelUni = novoAnel;
                            if (E.posicao === "uniforme") {
                                f.geometry.coordinates = [novoAnel];
                                f.properties._c = centroide(novoAnel);
                                const layer = mapaCamadasCasas.get(it.id);
                                if (layer) {
                                    layer.setLatLngs(novoAnel.map((pt) => [pt[1], pt[0]]));
                                    layer.redraw();
                                }
                            }
                            const cLL = centroide(novoAnel);
                            E.ajustes[it.id] = {
                                lng: Number(cLL[0].toFixed(7)),
                                lat: Number(cLL[1].toFixed(7)),
                                rot_deg: it.rotBase,
                                grupo_id: obterIdGrupo(it.id),
                                coords: novoAnel
                            };
                        });
                    });

                    marcarSalvo(false);
                    salvarLocalStorage();
                    atualizarOverlayEdicao(true);
                    desenharNumeracaoCasas();
                    st(`Espaçamento ${eixo === "h" ? "horizontal" : "vertical"} ajustado para <b>${valorAlvo.toFixed(1).replace(".", ",")}m</b>.`);
                }

                // ============ Auditoria de Espaçamento via Console ============
                window.verificarEspacamento = function(paramH, paramV) {
                    const feats = Array.from(E.selecionadas).map((id) => mapaCasasPorId.get(id)).filter(Boolean);
                    if (feats.length < 2) {
                        console.warn("[verificarEspacamento] Selecione ao menos 2 casas.");
                        return null;
                    }

                    const snap = prepararSnapshotEspacamento();
                    if (!snap) return null;

                    const targetH = (paramH !== undefined) ? Number(paramH) : (snap.targetH !== null ? snap.targetH : snap.espHAtual);
                    const targetV = (paramV !== undefined) ? Number(paramV) : (snap.targetV !== null ? snap.targetV : snap.espVAtual);

                    console.log(`%c[verificarEspacamento] Verificando ${feats.length} casas selecionadas. Alvo H: ${targetH}m | Alvo V: ${targetV}m`, "font-weight:bold;color:#0284c7;");
                    console.log(`Fileiras detectadas: ${snap.fileiras.length}`);

                    let totalDesviosH = 0;
                    const relatorioFileiras = [];

                    snap.fileiras.forEach((fil, r) => {
                        const espacos = [];
                        let desviosFil = 0;
                        for (let k = 0; k < fil.length - 1; k++) {
                            const c1 = centroide(fil[k].f.properties._anelUni);
                            const c2 = centroide(fil[k + 1].f.properties._anelUni);
                            const p1 = L.CRS.EPSG3857.project(L.latLng(c1[1], c1[0]));
                            const p2 = L.CRS.EPSG3857.project(L.latLng(c2[1], c2[0]));
                            const distBordas = ((p2.x - p1.x) * snap.ux + (p2.y - p1.y) * snap.uy) - PADRAO_LARGURA_M;
                            const erro = Math.abs(distBordas - targetH);
                            if (erro > 0.05) {
                                totalDesviosH++;
                                desviosFil++;
                            }
                            espacos.push({
                                de: fil[k].f.properties.numero || fil[k].id,
                                para: fil[k + 1].f.properties.numero || fil[k + 1].id,
                                distM: Number(distBordas.toFixed(3)),
                                desvio: Number(erro.toFixed(3))
                            });
                        }
                        relatorioFileiras.push({
                            fileira: r + 1,
                            totalCasas: fil.length,
                            casas: fil.map((it) => it.f.properties.numero || it.id),
                            espacos,
                            desviosH: desviosFil
                        });
                        console.log(`  Fileira ${r + 1} (${fil.length} casas):`, espacos.map((e) => `${e.de}->${e.para}: ${e.distM}m`).join(", "));
                    });

                    let totalDesviosV = 0;
                    const espacosV = [];
                    if (snap.fileiras.length >= 2) {
                        for (let r = 0; r < snap.fileiras.length - 1; r++) {
                            const fil1 = snap.fileiras[r];
                            const fil2 = snap.fileiras[r + 1];
                            const d1 = fil1.reduce((s, it) => {
                                const c = centroide(it.f.properties._anelUni);
                                const p = L.CRS.EPSG3857.project(L.latLng(c[1], c[0]));
                                return s + ((p.x - snap.centroMetros.x) * snap.nx + (p.y - snap.centroMetros.y) * snap.ny);
                            }, 0) / fil1.length;
                            const d2 = fil2.reduce((s, it) => {
                                const c = centroide(it.f.properties._anelUni);
                                const p = L.CRS.EPSG3857.project(L.latLng(c[1], c[0]));
                                return s + ((p.x - snap.centroMetros.x) * snap.nx + (p.y - snap.centroMetros.y) * snap.ny);
                            }, 0) / fil2.length;
                            const distBordasV = (d2 - d1) - PADRAO_PROFUNDIDADE_M;
                            const erro = Math.abs(distBordasV - targetV);
                            if (erro > 0.05) totalDesviosV++;
                            espacosV.push({
                                fileiraA: r + 1,
                                fileiraB: r + 2,
                                distM: Number(distBordasV.toFixed(3)),
                                desvio: Number(erro.toFixed(3))
                            });
                            console.log(`  Espaçamento V entre fileiras ${r + 1} e ${r + 2}: ${distBordasV.toFixed(3)}m (alvo: ${targetV}m, erro: ${erro.toFixed(3)}m)`);
                        }
                    }

                    console.log(`%c[verificarEspacamento] Desvios H > 0.05m = ${totalDesviosH} | Desvios V > 0.05m = ${totalDesviosV}`, totalDesviosH === 0 && totalDesviosV === 0 ? "color:green;font-weight:bold;" : "color:red;font-weight:bold;");
                    return {
                        totalCasas: feats.length,
                        fileiras: relatorioFileiras,
                        espacosV,
                        totalDesviosH,
                        totalDesviosV,
                        valido: (totalDesviosH === 0 && totalDesviosV === 0)
                    };
                };

                """

assert len(old_espacamento_block) > 100, "old_espacamento_block not extracted correctly"
content = content.replace(old_espacamento_block, new_espacamento_block, 1)

# 11. Update popup markup and events in atualizarOverlayEdicao
old_popup_start = content.find("if (!snapshotBaseEspacamento && podeAgrupar) {")
old_popup_end = content.find("const bM15 = $(\"btnFlutuanteRotM15\");")

old_popup_section = content[old_popup_start:old_popup_end]

new_popup_section = """if (!snapshotBaseEspacamento && podeAgrupar) {
                            prepararSnapshotEspacamento();
                        }
                        const valHStr = snapshotBaseEspacamento
                            ? formatarValorEspacamento(
                                snapshotBaseEspacamento.targetH !== null ? snapshotBaseEspacamento.targetH : snapshotBaseEspacamento.espHAtual,
                                snapshotBaseEspacamento.espHIrregular
                              )
                            : "1,0";
                        const valVStr = snapshotBaseEspacamento
                            ? formatarValorEspacamento(
                                snapshotBaseEspacamento.targetV !== null ? snapshotBaseEspacamento.targetV : snapshotBaseEspacamento.espVAtual,
                                snapshotBaseEspacamento.espVIrregular
                              )
                            : "0,0";

                        const titleH = (snapshotBaseEspacamento && snapshotBaseEspacamento.espHIrregular)
                            ? "espaçamentos irregulares; ao aplicar, serão uniformizados"
                            : "Espaçamento horizontal uniforme entre as bordas dos lotes (em metros)";
                        const titleV = (snapshotBaseEspacamento && snapshotBaseEspacamento.espVIrregular)
                            ? "espaçamentos irregulares; ao aplicar, serão uniformizados"
                            : "Espaçamento vertical uniforme entre as bordas das fileiras (em metros)";
                        const classH = (snapshotBaseEspacamento && snapshotBaseEspacamento.espHIrregular) ? "input-irregular" : "";
                        const classV = (snapshotBaseEspacamento && snapshotBaseEspacamento.espVIrregular) ? "input-irregular" : "";

                        barra.innerHTML = `
                            <b>${E.selecionadas.size} casa(s)</b>
                            ${podeAgrupar ? '<button class="btn" id="btnFlutuanteAgrupar" title="Agrupar casas selecionadas">🔗 Agrupar</button>' : ""}
                            ${podeAgrupar ? '<button class="btn" id="btnFlutuanteQuarteirao" title="Organizar seleção em quarteirão padronizado">🏘️ Agrupar em quarteirão</button>' : ""}
                            ${algumEmGrupo ? '<button class="btn" id="btnFlutuanteDesagrupar" title="Desagrupar casas selecionadas">⛓️‍💥 Desagrupar</button>' : ""}
                            ${podeAgrupar ? `
                                <span class="divisor-flutuante"></span>
                                <div class="grupo-input-flutuante" title="${titleH}">
                                    <span>↔ H:</span>
                                    <button class="btn-micro" id="btnFlutuanteEspHMenos" title="Diminuir espaçamento horizontal (0,1m)">-</button>
                                    <input type="text" id="inputFlutuanteEspH" class="${classH}" value="${valHStr}" title="${titleH}" style="width:48px;height:20px;font-size:11px;" />
                                    <button class="btn-micro" id="btnFlutuanteEspHMais" title="Aumentar espaçamento horizontal (0,1m)">+</button>
                                    <span>m</span>
                                </div>
                                <span class="divisor-flutuante"></span>
                                <div class="grupo-input-flutuante" title="${titleV}">
                                    <span>↕ V:</span>
                                    <button class="btn-micro" id="btnFlutuanteEspVMenos" title="Diminuir espaçamento vertical (0,1m)">-</button>
                                    <input type="text" id="inputFlutuanteEspV" class="${classV}" value="${valVStr}" title="${titleV}" style="width:48px;height:20px;font-size:11px;" />
                                    <button class="btn-micro" id="btnFlutuanteEspVMais" title="Aumentar espaçamento vertical (0,1m)">+</button>
                                    <span>m</span>
                                </div>
                            ` : ""}
                            <span class="divisor-flutuante"></span>
                            <button class="btn" id="btnFlutuanteRotM15" title="Girar -15°">-15°</button>
                            <button class="btn" id="btnFlutuanteRotP15" title="Girar +15°">+15°</button>
                            <button class="btn" id="btnFlutuanteRestaurar" title="Restaurar ao padrão original">↺</button>
                        `;

                        const bAg = $("btnFlutuanteAgrupar");
                        if (bAg) bAg.onclick = (e) => { e.stopPropagation(); agrupar(); };
                        const bQuart = $("btnFlutuanteQuarteirao");
                        if (bQuart) bQuart.onclick = (e) => { e.stopPropagation(); iniciarAgrupamentoQuarteirao(); };
                        const bDes = $("btnFlutuanteDesagrupar");
                        if (bDes) bDes.onclick = (e) => { e.stopPropagation(); desagrupar(); };

                        const bHMenos = $("btnFlutuanteEspHMenos");
                        const bHMais = $("btnFlutuanteEspHMais");
                        const inH = $("inputFlutuanteEspH");
                        if (bHMenos) bHMenos.onclick = (e) => {
                            e.stopPropagation();
                            const snap = snapshotBaseEspacamento;
                            const cur = snap ? (snap.targetH !== null ? snap.targetH : snap.espHAtual) : 1.0;
                            const baseVal = Math.max(0, cur);
                            const novo = Math.max(0, Math.round((baseVal - 0.1) * 10) / 10);
                            aplicarEspacamentoDeterministo("h", novo);
                        };
                        if (bHMais) bHMais.onclick = (e) => {
                            e.stopPropagation();
                            const snap = snapshotBaseEspacamento;
                            const cur = snap ? (snap.targetH !== null ? snap.targetH : snap.espHAtual) : 1.0;
                            const baseVal = Math.max(0, cur);
                            const novo = Math.min(30, Math.round((baseVal + 0.1) * 10) / 10);
                            aplicarEspacamentoDeterministo("h", novo);
                        };
                        if (inH) {
                            inH.onclick = (e) => e.stopPropagation();
                            inH.onkeydown = (e) => {
                                if (e.key === "Enter") {
                                    e.target.blur();
                                }
                            };
                            inH.onchange = (e) => {
                                const val = parseValEspacamento(e.target.value);
                                if (!isNaN(val) && val >= 0) {
                                    aplicarEspacamentoDeterministo("h", val);
                                } else {
                                    inH.value = snapshotBaseEspacamento
                                        ? formatarValorEspacamento(
                                            snapshotBaseEspacamento.targetH !== null ? snapshotBaseEspacamento.targetH : snapshotBaseEspacamento.espHAtual,
                                            snapshotBaseEspacamento.espHIrregular
                                          )
                                        : "1,0";
                                }
                            };
                        }

                        const bVMenos = $("btnFlutuanteEspVMenos");
                        const bVMais = $("btnFlutuanteEspVMais");
                        const inV = $("inputFlutuanteEspV");
                        if (bVMenos) bVMenos.onclick = (e) => {
                            e.stopPropagation();
                            const snap = snapshotBaseEspacamento;
                            const cur = snap ? (snap.targetV !== null ? snap.targetV : snap.espVAtual) : 0.0;
                            const baseVal = Math.max(0, cur);
                            const novo = Math.max(0, Math.round((baseVal - 0.1) * 10) / 10);
                            aplicarEspacamentoDeterministo("v", novo);
                        };
                        if (bVMais) bVMais.onclick = (e) => {
                            e.stopPropagation();
                            const snap = snapshotBaseEspacamento;
                            const cur = snap ? (snap.targetV !== null ? snap.targetV : snap.espVAtual) : 0.0;
                            const baseVal = Math.max(0, cur);
                            const novo = Math.min(30, Math.round((baseVal + 0.1) * 10) / 10);
                            aplicarEspacamentoDeterministo("v", novo);
                        };
                        if (inV) {
                            inV.onclick = (e) => e.stopPropagation();
                            inV.onkeydown = (e) => {
                                if (e.key === "Enter") {
                                    e.target.blur();
                                }
                            };
                            inV.onchange = (e) => {
                                const val = parseValEspacamento(e.target.value);
                                if (!isNaN(val) && val >= 0) {
                                    aplicarEspacamentoDeterministo("v", val);
                                } else {
                                    inV.value = snapshotBaseEspacamento
                                        ? formatarValorEspacamento(
                                            snapshotBaseEspacamento.targetV !== null ? snapshotBaseEspacamento.targetV : snapshotBaseEspacamento.espVAtual,
                                            snapshotBaseEspacamento.espVIrregular
                                          )
                                        : "0,0";
                                }
                            };
                        }

                        """

assert len(old_popup_section) > 100, "old_popup_section not extracted correctly"
content = content.replace(old_popup_section, new_popup_section, 1)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully applied v1.3.4 updates to index.html!")

