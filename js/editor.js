import { $ } from "./config.js";
import { E, S, st } from "./state.js";
import {
    centroide,
    calcularCentroideMetros,
    aplicarTranslacaoMetros,
    aplicarRotacaoMetros,
} from "./geometry.js";
import { desenharNumeracaoCasas, ocultarNumeracaoCanvas, alternarNumeracaoCasas } from "./numbering.js";
import {
    invalidarSnapshotEspacamento,
    prepararSnapshotEspacamento,
    aplicarEspacamentoDeterministo,
    formatarValorEspacamento,
    parseValEspacamento,
    iniciarAgrupamentoQuarteirao,
    iniciarNivelarHorizontal,
    iniciarAlinharLinha,
    cancelarPreviewQuarteirao,
} from "./spacing.js";
import {
    salvarSnapshotHistorico,
    desfazer,
    refazer,
    salvarLocalStorage,
    marcarSalvo,
    restaurarSelecionadas,
} from "./storage.js";
import { pintar, desenhar } from "./map-view.js";

// ============ Grupos e Quarteirões ============
export function obterGrupo(id) {
    if (!E.grupos) return null;
    for (const g of E.grupos) {
        const casas = Array.isArray(g) ? g : g.casas;
        if (casas && casas.includes(id)) {
            return Array.isArray(g)
                ? { id: "grp-" + casas[0], tipo: "grupo", casas }
                : g;
        }
    }
    return null;
}

export function obterIdGrupo(id) {
    const g = obterGrupo(id);
    return g ? g.id : null;
}

export function expandirGrupos(conjuntoIds) {
    const expandido = new Set(conjuntoIds);
    for (const id of conjuntoIds) {
        const g = obterGrupo(id);
        if (g && g.casas) {
            for (const membro of g.casas) expandido.add(membro);
        }
    }
    return expandido;
}

export function agrupar() {
    if (E.selecionadas.size < 2) return;
    invalidarSnapshotEspacamento();
    salvarSnapshotHistorico();
    const ids = Array.from(E.selecionadas);
    const novoGrpId = "grp-" + Date.now();

    // Remove de grupos anteriores
    E.grupos = E.grupos
        .map((g) => ({
            id: g.id || ("grp-" + (g.casas ? g.casas[0] : "")),
            tipo: g.tipo || "grupo",
            casas: (g.casas || g).filter((id) => !E.selecionadas.has(id))
        }))
        .filter((g) => g.casas.length >= 2);

    E.grupos.push({
        id: novoGrpId,
        tipo: "grupo",
        casas: ids
    });

    for (const id of ids) {
        if (!E.ajustes[id]) {
            const item = S.mapaCasasPorId.get(id);
            const anel = item.properties._anelUni;
            const c = centroide(anel);
            E.ajustes[id] = {
                lng: Number(c[0].toFixed(7)),
                lat: Number(c[1].toFixed(7)),
                rot_deg: 0,
                grupo_id: novoGrpId,
                coords: anel
            };
        } else {
            E.ajustes[id].grupo_id = novoGrpId;
        }
    }

    marcarSalvo(false);
    salvarLocalStorage();
    atualizarOverlayEdicao();
    atualizarUIEdicao();
    st(`<b>${ids.length}</b> casas agrupadas.`);
}

export function desagrupar() {
    if (E.selecionadas.size === 0) return;
    invalidarSnapshotEspacamento();
    salvarSnapshotHistorico();

    E.grupos = E.grupos
        .map((g) => ({
            id: g.id || ("grp-" + (g.casas ? g.casas[0] : "")),
            tipo: g.tipo || "grupo",
            casas: (g.casas || g).filter((id) => !E.selecionadas.has(id))
        }))
        .filter((g) => g.casas.length >= 2);

    for (const id of E.selecionadas) {
        if (E.ajustes[id]) {
            E.ajustes[id].grupo_id = null;
        }
    }

    marcarSalvo(false);
    salvarLocalStorage();
    atualizarOverlayEdicao();
    atualizarUIEdicao();
    st("Casas selecionadas desagrupadas.");
}

// ============ Movimentação e Rotação ============
export function rotacionarCasasSelecionadas(graus) {
    if (E.selecionadas.size === 0 || !graus) return;
    invalidarSnapshotEspacamento();
    salvarSnapshotHistorico();
    const feats = Array.from(E.selecionadas).map((id) => S.mapaCasasPorId.get(id)).filter(Boolean);
    if (!feats.length) return;
    const centroM = calcularCentroideMetros(feats);
    const rad = (graus * Math.PI) / 180;
    for (const f of feats) {
        const id = f.properties.id;
        const anelAtual = f.properties._anelUni;
        const novoAnel = aplicarRotacaoMetros(anelAtual, centroM, rad);
        f.properties._anelUni = novoAnel;
        if (E.posicao === "uniforme") {
            f.geometry.coordinates = [novoAnel];
            f.properties._c = centroide(novoAnel);
            const layer = S.mapaCamadasCasas.get(id);
            if (layer) {
                layer.setLatLngs(novoAnel.map((c) => [c[1], c[0]]));
                layer.redraw();
            }
        }
        const cLL = centroide(novoAnel);
        const prevRot = (E.ajustes[id] && E.ajustes[id].rot_deg) || 0;
        if (!E.ajustes[id]) {
            E.ajustes[id] = { lng: cLL[0], lat: cLL[1], rot_deg: 0, grupo_id: obterIdGrupo(id), coords: novoAnel };
        }
        E.ajustes[id].rot_deg = Number((prevRot + graus).toFixed(2));
        E.ajustes[id].lng = Number(cLL[0].toFixed(7));
        E.ajustes[id].lat = Number(cLL[1].toFixed(7));
        E.ajustes[id].coords = novoAnel;
    }
    marcarSalvo(false);
    salvarLocalStorage();
    atualizarOverlayEdicao();
    atualizarUIEdicao();
    st(`Seleção rotacionada em <b>${graus > 0 ? "+" : ""}${graus}°</b>.`);
}

// ============ Interações e Seleção ============
export function aoClicarCasaModoEdicao(f, e) {
    const id = f.properties.id;
    const shift = e.originalEvent && (e.originalEvent.shiftKey || e.originalEvent.ctrlKey);
    if (shift) {
        const grupo = obterGrupo(id);
        const membros = (grupo && grupo.casas) ? grupo.casas : [id];
        const todosMarcados = membros.every((m) => E.selecionadas.has(m));
        if (todosMarcados) {
            membros.forEach((m) => E.selecionadas.delete(m));
        } else {
            membros.forEach((m) => E.selecionadas.add(m));
        }
    } else {
        const grupo = obterGrupo(id);
        if (grupo && grupo.casas) {
            E.selecionadas = new Set(grupo.casas);
        } else {
            E.selecionadas = new Set([id]);
        }
    }
    atualizarSelecao();
}

let arrastoEmAndamento = false;
let arrastoStartPos = null;
let arrastoStartCoords = new Map();

export function aoMousedownCasaModoEdicao(f, e) {
    if (e.originalEvent.button !== 0) return;
    const id = f.properties.id;
    const shift = e.originalEvent.shiftKey || e.originalEvent.ctrlKey;
    if (!E.selecionadas.has(id)) {
        if (shift) {
            const grupo = obterGrupo(id);
            const membros = (grupo && grupo.casas) ? grupo.casas : [id];
            membros.forEach((m) => E.selecionadas.add(m));
        } else {
            const grupo = obterGrupo(id);
            E.selecionadas = new Set((grupo && grupo.casas) ? grupo.casas : [id]);
        }
        atualizarSelecao();
    }

    arrastoEmAndamento = true;
    arrastoStartPos = e.latlng;
    arrastoStartCoords = new Map();
    for (const selId of E.selecionadas) {
        const item = S.mapaCasasPorId.get(selId);
        if (item) {
            arrastoStartCoords.set(selId, JSON.parse(JSON.stringify(item.properties._anelUni)));
        }
    }
}

let rotacionandoEmAndamento = false;
let rotStartAngle = 0;
let rotCentroMeters = null;
let rotStartCoords = new Map();
let rotDeltaDeg = 0;

export function atualizarOverlayEdicao() {
    S.cSelecaoOverlay.clearLayers();
    const barra = $("barraFlutuanteSelecao");
    if (!E.modoEdicao || E.selecionadas.size === 0) {
        if (barra) barra.style.display = "none";
        return;
    }

    const feats = Array.from(E.selecionadas).map((id) => S.mapaCasasPorId.get(id)).filter(Boolean);
    if (!feats.length) {
        if (barra) barra.style.display = "none";
        return;
    }

    const latlngsTotais = [];
    for (const f of feats) {
        const pts = f.properties._anelUni.map((c) => [c[1], c[0]]);
        latlngsTotais.push(...pts);
        const selPoly = L.polygon(pts, {
            color: "#00d2ff",
            weight: 2.5,
            dashArray: "4 3",
            fillColor: "#00d2ff",
            fillOpacity: 0.35,
            interactive: true,
        });
        selPoly.on("mousedown", (e) => {
            if (e.originalEvent.button === 0 && E.ferramentaEdicao === "selecionar") {
                L.DomEvent.stopPropagation(e);
                aoMousedownCasaModoEdicao(f, e);
            }
        });
        S.cSelecaoOverlay.addLayer(selPoly);
    }

    const bounds = L.latLngBounds(latlngsTotais);
    const centroLatLng = bounds.getCenter();
    const northPoint = L.latLng(bounds.getNorth(), centroLatLng.lng);

    // Alça de rotação acima do topo da seleção
    const topScreen = S.map.latLngToContainerPoint(northPoint);
    const handleScreen = L.point(topScreen.x, topScreen.y - 32);
    const handleLatLng = S.map.containerPointToLatLng(handleScreen);

    const hasteRotacao = L.polyline([northPoint, handleLatLng], {
        color: "#00d2ff",
        weight: 1.8,
        dashArray: "3 3",
        interactive: false,
    });
    S.cSelecaoOverlay.addLayer(hasteRotacao);

    const alcaIcon = L.divIcon({
        className: "",
        html: '<div class="alca-rotacao-icone" title="Arraste para girar em torno do centro">↻</div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
    });
    const alcaMarker = L.marker(handleLatLng, {
        icon: alcaIcon,
        interactive: true,
    });
    alcaMarker.on("mousedown", (e) => {
        if (e.originalEvent.button !== 0) return;
        L.DomEvent.stopPropagation(e);
        rotacionandoEmAndamento = true;
        rotCentroMeters = calcularCentroideMetros(feats);
        const centerScreen = S.map.latLngToContainerPoint(centroLatLng);
        rotStartAngle = Math.atan2(e.originalEvent.clientY - centerScreen.y, e.originalEvent.clientX - centerScreen.x);
        rotStartCoords = new Map();
        rotDeltaDeg = 0;
        for (const selId of E.selecionadas) {
            const item = S.mapaCasasPorId.get(selId);
            if (item) {
                rotStartCoords.set(selId, JSON.parse(JSON.stringify(item.properties._anelUni)));
            }
        }
    });
    S.cSelecaoOverlay.addLayer(alcaMarker);

    // Atualiza a barra flutuante de ações rápidas sobre a seleção
    if (barra) {
        barra.style.display = "flex";
        const barraScreen = L.point(handleScreen.x, handleScreen.y - 18);
        barra.style.left = barraScreen.x + "px";
        barra.style.top = barraScreen.y + "px";

        const podeAgrupar = E.selecionadas.size >= 2;
        const algumEmGrupo = Array.from(E.selecionadas).some((id) => obterGrupo(id));

        if (!S.snapshotBaseEspacamento && podeAgrupar) {
            prepararSnapshotEspacamento();
        }
        const valHStr = S.snapshotBaseEspacamento
            ? formatarValorEspacamento(
                S.snapshotBaseEspacamento.targetH !== null ? S.snapshotBaseEspacamento.targetH : S.snapshotBaseEspacamento.espHAtual,
                S.snapshotBaseEspacamento.espHIrregular
              )
            : "1,0";
        const valVStr = S.snapshotBaseEspacamento
            ? formatarValorEspacamento(
                S.snapshotBaseEspacamento.targetV !== null ? S.snapshotBaseEspacamento.targetV : S.snapshotBaseEspacamento.espVAtual,
                S.snapshotBaseEspacamento.espVIrregular
              )
            : "0,0";

        const titleH = (S.snapshotBaseEspacamento && S.snapshotBaseEspacamento.espHIrregular)
            ? "espaçamentos irregulares; ao aplicar, serão uniformizados"
            : "Espaçamento horizontal uniforme entre as bordas dos lotes (em metros)";
        const titleV = (S.snapshotBaseEspacamento && S.snapshotBaseEspacamento.espVIrregular)
            ? "espaçamentos irregulares; ao aplicar, serão uniformizados"
            : "Espaçamento vertical uniforme entre as bordas das fileiras (em metros)";
        const classH = (S.snapshotBaseEspacamento && S.snapshotBaseEspacamento.espHIrregular) ? "input-irregular" : "";
        const classV = (S.snapshotBaseEspacamento && S.snapshotBaseEspacamento.espVIrregular) ? "input-irregular" : "";

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
            const snap = S.snapshotBaseEspacamento;
            const cur = snap ? (snap.targetH !== null ? snap.targetH : snap.espHAtual) : 1.0;
            const baseVal = Math.max(0, cur);
            const novo = Math.max(0, Math.round((baseVal - 0.1) * 10) / 10);
            aplicarEspacamentoDeterministo("h", novo);
        };
        if (bHMais) bHMais.onclick = (e) => {
            e.stopPropagation();
            const snap = S.snapshotBaseEspacamento;
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
                    inH.value = S.snapshotBaseEspacamento
                        ? formatarValorEspacamento(
                            S.snapshotBaseEspacamento.targetH !== null ? S.snapshotBaseEspacamento.targetH : S.snapshotBaseEspacamento.espHAtual,
                            S.snapshotBaseEspacamento.espHIrregular
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
            const snap = S.snapshotBaseEspacamento;
            const cur = snap ? (snap.targetV !== null ? snap.targetV : snap.espVAtual) : 0.0;
            const baseVal = Math.max(0, cur);
            const novo = Math.max(0, Math.round((baseVal - 0.1) * 10) / 10);
            aplicarEspacamentoDeterministo("v", novo);
        };
        if (bVMais) bVMais.onclick = (e) => {
            e.stopPropagation();
            const snap = S.snapshotBaseEspacamento;
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
                    inV.value = S.snapshotBaseEspacamento
                        ? formatarValorEspacamento(
                            S.snapshotBaseEspacamento.targetV !== null ? S.snapshotBaseEspacamento.targetV : S.snapshotBaseEspacamento.espVAtual,
                            S.snapshotBaseEspacamento.espVIrregular
                          )
                        : "0,0";
                }
            };
        }

        const bM15 = $("btnFlutuanteRotM15");
        if (bM15) bM15.onclick = (e) => { e.stopPropagation(); rotacionarCasasSelecionadas(-15); };
        const bP15 = $("btnFlutuanteRotP15");
        if (bP15) bP15.onclick = (e) => { e.stopPropagation(); rotacionarCasasSelecionadas(15); };
        const bRes = $("btnFlutuanteRestaurar");
        if (bRes) bRes.onclick = (e) => { e.stopPropagation(); restaurarSelecionadas(); };
    }
}

export function atualizarSelecao() {
    S.snapshotBaseEspacamento = null;
    S.historicoEspacamentoSalvo = false;
    atualizarOverlayEdicao();
    atualizarUIEdicao();
    pintar();
}

export function atualizarUIEdicao() {
    const selCount = E.selecionadas.size;
    const gruposCount = E.grupos.length;
    const edContador = $("edContadorSel");
    if (edContador) {
        edContador.textContent = `${selCount} casa(s) selecionada(s)`;
    }
    const edGrupos = $("edContadorGrupos");
    if (edGrupos) {
        edGrupos.textContent = `${gruposCount} grupo(s)`;
    }

    const bAg = $("btnAgrupar");
    if (bAg) bAg.disabled = selCount < 2;

    const bQuart = $("btnQuarteirao");
    if (bQuart) bQuart.disabled = selCount < 2;

    const bDes = $("btnDesagrupar");
    if (bDes) {
        const temGrupoNaSel = Array.from(E.selecionadas).some((id) => obterGrupo(id));
        bDes.disabled = !temGrupoNaSel;
    }

    const bRestSel = $("btnRestaurarSel");
    if (bRestSel) bRestSel.disabled = selCount === 0;

    const bRestQuart = $("btnRestaurarQuarteirao");
    if (bRestQuart) bRestQuart.disabled = selCount === 0;

    atualizarBotoesHistorico();
}

export function alternarModoApp(modo) {
    const isEdit = modo === "edit";
    E.modoEdicao = isEdit;
    document.body.classList.toggle("modo-edicao-ativo", isEdit);
    const grpEd = $("grupoEdicao");
    if (grpEd) grpEd.style.display = isEdit ? "flex" : "none";

    if (isEdit) {
        if (E.posicao !== "uniforme") {
            E.posicao = "uniforme";
            [...$("segPos").children].forEach((x) =>
                x.setAttribute("aria-pressed", String(x.dataset.v === "uniforme")),
            );
            aplicarPosicao();
            st("<b>Modo Edição ativado.</b> Ajustes permitidos apenas na geometria 'Lotes iguais' (tamanho padronizado).");
        } else {
            st("<b>Modo Edição ativado.</b> Selecione casas para mover, agrupar ou rotacionar.");
        }
        if (E.ferramentaEdicao === "selecionar") {
            S.map.dragging.disable();
        }
        S.map.closePopup();
    } else {
        cancelarPreviewQuarteirao();
        S.map.dragging.enable();
        E.selecionadas.clear();
        atualizarOverlayEdicao();
        st("<b>Modo Visualização ativado.</b>");
    }
    pintar();
}

export function alternarFerramentaEdicao(f) {
    E.ferramentaEdicao = f;
    
    if (f === "pan") {
        S.map.dragging.enable();
        mapEl.classList.add("cursor-pan");
    } else {
        S.map.dragging.disable();
        mapEl.classList.remove("cursor-pan");
    }
}

// ============ Eventos de Arrastar, Rotacionar, Pan e Menu de Contexto ============








export function limparEstadoPanEspaco() {
    S.segurandoEspaco = false;
    if (E.modoEdicao && E.ferramentaEdicao === "selecionar") {
        S.map.dragging.disable();
    }
    document.body.classList.remove("cursor-pan-global");
    mapEl.classList.remove("cursor-pan");
}

export function limparEstadoPanMeio() {
    S.panMeioAtivo = false;
    document.body.classList.remove("cursor-pan-global");
    mapEl.classList.remove("cursor-pan");
}

export function fecharMenuContexto() {
    const menu = $("menuContextoMapa");
    if (menu) menu.style.display = "none";
}

export function abrirMenuContexto(e) {
    const menu = $("menuContextoMapa");
    if (!menu) return;
    const podeAcaoSel = E.selecionadas.size >= 2;

    menu.innerHTML = `
        <button class="item-menu-contexto" id="itemMenuNumCasas">
            <span>🔢</span>
            <span>${E.numeracaoCasas ? "Desativar numeração das casas" : "Ativar numeração das casas"}</span>
        </button>
        <div class="divisor-menu-contexto"></div>
        <button class="item-menu-contexto" id="itemMenuNivelar" ${!podeAcaoSel ? "disabled" : ""} title="${!podeAcaoSel ? 'Selecione ao menos 2 casas' : 'Gira a seleção como um bloco até a fileira ficar horizontal'}">
            <span>📐</span>
            <span>Nivelar na horizontal (ajustar rotação)</span>
        </button>
        <button class="item-menu-contexto" id="itemMenuAlinharLinha" ${!podeAcaoSel ? "disabled" : ""} title="${!podeAcaoSel ? 'Selecione ao menos 2 casas' : 'Reorganiza os polígonos em uma única linha horizontal padronizada'}">
            <span>📏</span>
            <span>Alinhar em uma linha</span>
        </button>
    `;

    menu.style.display = "flex";
    const rect = mapEl.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;

    const menuW = 230;
    const menuH = 140;
    if (x + menuW > rect.width) x = Math.max(10, rect.width - menuW - 10);
    if (y + menuH > rect.height) y = Math.max(10, rect.height - menuH - 10);

    menu.style.left = x + "px";
    menu.style.top = y + "px";

    $("itemMenuNumCasas").onclick = (ev) => {
        ev.stopPropagation();
        fecharMenuContexto();
        alternarNumeracaoCasas();
    };

    const btnNivelar = $("itemMenuNivelar");
    if (btnNivelar && podeAcaoSel) {
        btnNivelar.onclick = (ev) => {
            ev.stopPropagation();
            fecharMenuContexto();
            iniciarNivelarHorizontal();
        };
    }

    const btnLinha = $("itemMenuAlinharLinha");
    if (btnLinha && podeAcaoSel) {
        btnLinha.onclick = (ev) => {
            ev.stopPropagation();
            fecharMenuContexto();
            iniciarAlinharLinha();
        };
    }
}

// Previne autoscroll no botão do meio
window.addEventListener("auxclick", (e) => {
    if (e.button === 1) e.preventDefault();
});

mapEl.addEventListener("mousedown", (e) => {
    // Pan com botão do meio (botão 1)
    if (e.button === 1) {
        e.preventDefault();
        S.panMeioAtivo = true;
        S.panMeioStartClient = [e.clientX, e.clientY];
        mapEl.classList.add("cursor-pan");
        document.body.classList.add("cursor-pan-global");
        fecharMenuContexto();
        return;
    }

    // Se estiver com Espaço segurado, não faz seleção
    if (S.segurandoEspaco) {
        return;
    }

    // Seleção por retângulo em área vazia (botão esquerdo)
    if (E.modoEdicao && E.ferramentaEdicao === "selecionar" && e.button === 0 && !arrastoEmAndamento && !rotacionandoEmAndamento) {
        if (e.target.closest(".leaflet-interactive") || e.target.closest(".barra-flutuante-selecao") || e.target.closest(".banner-preview-quarteirao") || e.target.closest(".leaflet-control") || e.target.closest(".menu-contexto")) {
            return;
        }
        S.boxAtiva = true;
        S.boxStartPoint = S.map.mouseEventToContainerPoint(e);
    }
});

window.addEventListener("mousemove", (e) => {
    // Pan com botão do meio
    if (S.panMeioAtivo) {
        const dx = e.clientX - S.panMeioStartClient[0];
        const dy = e.clientY - S.panMeioStartClient[1];
        S.panMeioStartClient = [e.clientX, e.clientY];
        S.map.panBy([-dx, -dy], { animate: false });
        return;
    }

    // Se pan por Espaço estiver ativo, ignora hover e seleção
    if (S.segurandoEspaco) {
        return;
    }

    // Arrastando casas
    if (arrastoEmAndamento && arrastoStartPos) {
        const curLatLng = S.map.mouseEventToLatLng(e);
        const pStart = L.CRS.EPSG3857.project(arrastoStartPos);
        const pCur = L.CRS.EPSG3857.project(curLatLng);
        const dx = pCur.x - pStart.x;
        const dy = pCur.y - pStart.y;

        for (const selId of E.selecionadas) {
            const startRing = arrastoStartCoords.get(selId);
            if (!startRing) continue;
            const novoAnel = aplicarTranslacaoMetros(startRing, dx, dy);
            const item = S.mapaCasasPorId.get(selId);
            if (item) {
                item.properties._anelUni = novoAnel;
                item.geometry.coordinates = [novoAnel];
                item.properties._c = centroide(novoAnel);
                const layer = S.mapaCamadasCasas.get(selId);
                if (layer) {
                    layer.setLatLngs(novoAnel.map((c) => [c[1], c[0]]));
                    layer.redraw();
                }
            }
        }
        atualizarOverlayEdicao();
        return;
    }

    // Rotacionando casas
    if (rotacionandoEmAndamento && rotCentroMeters) {
        const centroLatLng = L.CRS.EPSG3857.unproject(L.point(rotCentroMeters.x, rotCentroMeters.y));
        const centerScreen = S.map.latLngToContainerPoint(centroLatLng);
        const curAngle = Math.atan2(e.clientY - centerScreen.y, e.clientX - centerScreen.x);
        let deltaRad = curAngle - rotStartAngle;

        if (e.shiftKey) {
            deltaRad = (Math.round(((deltaRad * 180) / Math.PI) / 15) * 15 * Math.PI) / 180;
        }

        rotDeltaDeg = Number(((deltaRad * 180) / Math.PI).toFixed(1));
        const rotLbl = $("edRotLabel");
        if (rotLbl) rotLbl.textContent = `${rotDeltaDeg > 0 ? "+" : ""}${rotDeltaDeg}°`;

        for (const selId of E.selecionadas) {
            const startRing = rotStartCoords.get(selId);
            if (!startRing) continue;
            const novoAnel = aplicarRotacaoMetros(startRing, rotCentroMeters, deltaRad);
            const item = S.mapaCasasPorId.get(selId);
            if (item) {
                item.properties._anelUni = novoAnel;
                item.geometry.coordinates = [novoAnel];
                item.properties._c = centroide(novoAnel);
                const layer = S.mapaCamadasCasas.get(selId);
                if (layer) {
                    layer.setLatLngs(novoAnel.map((c) => [c[1], c[0]]));
                    layer.redraw();
                }
            }
        }
        atualizarOverlayEdicao();
        return;
    }

    // Desenho da caixa de seleção (marquee)
    if (S.boxAtiva && S.boxStartPoint) {
        const curPoint = S.map.mouseEventToContainerPoint(e);
        const x1 = Math.min(S.boxStartPoint.x, curPoint.x);
        const y1 = Math.min(S.boxStartPoint.y, curPoint.y);
        const w = Math.abs(curPoint.x - S.boxStartPoint.x);
        const h = Math.abs(curPoint.y - S.boxStartPoint.y);

        if (w > 4 || h > 4) {
            const mBox = $("marqueeBox");
            if (mBox) {
                mBox.style.display = "block";
                mBox.style.left = x1 + "px";
                mBox.style.top = y1 + "px";
                mBox.style.width = w + "px";
                mBox.style.height = h + "px";
            }
        }
    }
});

window.addEventListener("mouseup", (e) => {
    // Fim do Pan com botão do meio
    if (S.panMeioAtivo && e.button === 1) {
        limparEstadoPanMeio();
        return;
    }

    // Fim do arrasto de casas
    if (arrastoEmAndamento) {
        arrastoEmAndamento = false;
        if (arrastoStartPos) {
            const curLatLng = S.map.mouseEventToLatLng(e);
            const pStart = L.CRS.EPSG3857.project(arrastoStartPos);
            const pCur = L.CRS.EPSG3857.project(curLatLng);
            const dx = pCur.x - pStart.x;
            const dy = pCur.y - pStart.y;
            if (Math.hypot(dx, dy) > 0.3) {
                salvarSnapshotHistorico();
                for (const selId of E.selecionadas) {
                    const item = S.mapaCasasPorId.get(selId);
                    if (item) {
                        const cLL = centroide(item.properties._anelUni);
                        const prevRot = (E.ajustes[selId] && E.ajustes[selId].rot_deg) || 0;
                        E.ajustes[selId] = {
                            lng: Number(cLL[0].toFixed(7)),
                            lat: Number(cLL[1].toFixed(7)),
                            rot_deg: prevRot,
                            grupo_id: obterIdGrupo(selId),
                            coords: item.properties._anelUni
                        };
                    }
                }
                marcarSalvo(false);
                salvarLocalStorage();
                atualizarUIEdicao();
                desenharNumeracaoCasas();
                st("Casas reposicionadas com sucesso.");
            }
        }
        arrastoStartPos = null;
        invalidarSnapshotEspacamento();
        atualizarOverlayEdicao();
    }

    // Fim da rotação
    if (rotacionandoEmAndamento) {
        rotacionandoEmAndamento = false;
        if (Math.abs(rotDeltaDeg) > 0.1) {
            salvarSnapshotHistorico();
            for (const selId of E.selecionadas) {
                const item = S.mapaCasasPorId.get(selId);
                if (item) {
                    const cLL = centroide(item.properties._anelUni);
                    const prevRot = (E.ajustes[selId] && E.ajustes[selId].rot_deg) || 0;
                    E.ajustes[selId] = {
                        lng: Number(cLL[0].toFixed(7)),
                        lat: Number(cLL[1].toFixed(7)),
                        rot_deg: Number((prevRot + rotDeltaDeg).toFixed(2)),
                        grupo_id: obterIdGrupo(selId),
                        coords: item.properties._anelUni
                    };
                }
            }
            marcarSalvo(false);
            salvarLocalStorage();
            atualizarUIEdicao();
            desenharNumeracaoCasas();
            st(`Seleção rotacionada em <b>${rotDeltaDeg > 0 ? "+" : ""}${rotDeltaDeg}°</b>.`);
        }
        rotDeltaDeg = 0;
        rotCentroMeters = null;
        invalidarSnapshotEspacamento();
        atualizarOverlayEdicao();
    }

    // Fim da caixa de seleção (marquee)
    if (S.boxAtiva) {
        S.boxAtiva = false;
        const mBox = $("marqueeBox");
        if (mBox && mBox.style.display === "block") {
            mBox.style.display = "none";
            const curPoint = S.map.mouseEventToContainerPoint(e);
            const x1 = Math.min(S.boxStartPoint.x, curPoint.x);
            const y1 = Math.min(S.boxStartPoint.y, curPoint.y);
            const w = Math.abs(curPoint.x - S.boxStartPoint.x);
            const h = Math.abs(curPoint.y - S.boxStartPoint.y);

            const b1 = S.map.containerPointToLatLng([x1, y1]);
            const b2 = S.map.containerPointToLatLng([x1 + w, y1 + h]);
            const rectBounds = L.latLngBounds(b1, b2);

            const shift = e.shiftKey || e.ctrlKey;
            const novasSel = new Set(shift ? E.selecionadas : []);

            for (const f of E.casas) {
                const anel = f.properties._anelUni;
                const fBounds = L.latLngBounds(anel.map((p) => [p[1], p[0]]));
                if (rectBounds.intersects(fBounds)) {
                    novasSel.add(f.properties.id);
                }
            }
            E.selecionadas = expandirGrupos(novasSel);
            atualizarSelecao();
        } else if (E.modoEdicao && E.ferramentaEdicao === "selecionar") {
            // Clique simples em área vazia limpa seleção
            if (!e.target.closest(".leaflet-interactive") && !e.target.closest(".barra-flutuante-selecao") && !e.target.closest(".banner-preview-quarteirao") && !e.target.closest(".leaflet-control") && !e.target.closest(".menu-contexto")) {
                if (E.selecionadas.size > 0) {
                    E.selecionadas.clear();
                    atualizarSelecao();
                }
            }
        }
        S.boxStartPoint = null;
    }
});

// Menu de contexto com botão direito

export function initEditorEvents() {
    const mapEl = S.map.getContainer();
    mapEl.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        if (S.segurandoEspaco || S.panMeioAtivo) return;
        abrirMenuContexto(e);
    });
    
    window.addEventListener("click", (e) => {
        if (!e.target.closest("#menuContextoMapa")) {
            fecharMenuContexto();
        }
    });
    
    window.addEventListener("blur", () => {
        limparEstadoPanEspaco();
        limparEstadoPanMeio();
        fecharMenuContexto();
    });
    
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            limparEstadoPanEspaco();
            limparEstadoPanMeio();
            fecharMenuContexto();
        }
    });
    
    mapEl.addEventListener("mouseleave", () => {
        limparEstadoPanEspaco();
        limparEstadoPanMeio();
    });
    
    // Atalhos de teclado
    document.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
            e.preventDefault();
            if (e.shiftKey) refazer();
            else desfazer();
            return;
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y")) {
            e.preventDefault();
            refazer();
            return;
        }
        if (e.code === "Space" && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
            if (!S.segurandoEspaco) {
                S.segurandoEspaco = true;
                S.map.dragging.enable();
                mapEl.classList.add("cursor-pan");
                document.body.classList.add("cursor-pan-global");
            }
            e.preventDefault();
        }
        if (e.key === "Escape") {
            fecharMenuContexto();
            if (S.previewAcaoAtiva || S.previewQuarteiraoAtivo) {
                cancelarPreviewAcao();
                return;
            }
            if (E.modoEdicao) {
                E.selecionadas.clear();
                atualizarSelecao();
            }
        }
    });
    
    document.addEventListener("keyup", (e) => {
        if (e.code === "Space") {
            limparEstadoPanEspaco();
        }
    });
}

