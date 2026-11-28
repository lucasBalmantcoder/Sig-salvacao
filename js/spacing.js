import { $, PADRAO_LARGURA_M, PADRAO_PROFUNDIDADE_M, PADRAO_ESPACAMENTO_M, PADRAO_INTERVALO_FILEIRAS_M } from "./config.js";
import { E, S, st } from "./state.js";
import {
    centroide,
    centroideMetrosLote,
    calcularCentroideMetros,
    calcularEixoPrincipalSelecao,
    aplicarTranslacaoMetros,
    aplicarRotacaoMetros,
} from "./geometry.js";
import { desenharNumeracaoCasas } from "./numbering.js";
import { salvarSnapshotHistorico, salvarLocalStorage, marcarSalvo } from "./storage.js";
import { obterIdGrupo, atualizarOverlayEdicao, atualizarUIEdicao } from "./editor.js";

// ============ Agrupar em Quarteirão (Formato de Referência) ============
export function calcularQuarteiraoPadronizado(conjuntoIds) {
    const feats = Array.from(conjuntoIds).map((id) => S.mapaCasasPorId.get(id)).filter(Boolean);
    if (feats.length < 2) return null;

    // 1. Centróides em EPSG:3857
    const ptsM = feats.map((f) => {
        const cLL = centroide(f.properties._anelUni);
        const pM = L.CRS.EPSG3857.project(L.latLng(cLL[1], cLL[0]));
        return { f, x: pM.x, y: pM.y };
    });

    const cxTotal = ptsM.reduce((s, p) => s + p.x, 0) / ptsM.length;
    const cyTotal = ptsM.reduce((s, p) => s + p.y, 0) / ptsM.length;

    // 2. Direção dominante (PCA) do quarteirão
    let sxx = 0, syy = 0, sxy = 0;
    for (const p of ptsM) {
        const dx = p.x - cxTotal;
        const dy = p.y - cyTotal;
        sxx += dx * dx;
        syy += dy * dy;
        sxy += dx * dy;
    }
    const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    let ux = Math.cos(theta);
    let uy = Math.sin(theta);
    let nx = -uy;
    let ny = ux;

    // 3. Divisão em duas fileiras
    const facesMap = new Map();
    for (const item of ptsM) {
        const faceVal = item.f.properties.face;
        if (!facesMap.has(faceVal)) facesMap.set(faceVal, []);
        facesMap.get(faceVal).push(item);
    }

    let fileira1 = [];
    let fileira2 = [];

    if (facesMap.size === 2) {
        const chaves = Array.from(facesMap.keys()).sort((a, b) => a - b);
        fileira1 = facesMap.get(chaves[0]);
        fileira2 = facesMap.get(chaves[1]);
    } else {
        // Divide pela posição em relação ao eixo principal
        const enriquecidos = ptsM.map((item) => {
            const distN = (item.x - cxTotal) * nx + (item.y - cyTotal) * ny;
            return { ...item, distN };
        }).sort((a, b) => a.distN - b.distN);

        const meio = Math.floor(enriquecidos.length / 2);
        fileira1 = enriquecidos.slice(0, meio);
        fileira2 = enriquecidos.slice(meio);
    }

    // Determina qual fileira fica em +n e qual em -n
    const avgN1 = fileira1.reduce((s, p) => s + ((p.x - cxTotal) * nx + (p.y - cyTotal) * ny), 0) / (fileira1.length || 1);
    const avgN2 = fileira2.reduce((s, p) => s + ((p.x - cxTotal) * nx + (p.y - cyTotal) * ny), 0) / (fileira2.length || 1);

    if (avgN1 > avgN2) {
        const tmp = fileira1;
        fileira1 = fileira2;
        fileira2 = tmp;
    }

    // 4. Ordenação dos lotes por número da casa
    const ordenarFileira = (fil) => {
        return fil.slice().sort((a, b) => {
            const numA = Number(a.f.properties.numero);
            const numB = Number(b.f.properties.numero);
            if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
            const tA = (a.x - cxTotal) * ux + (a.y - cyTotal) * uy;
            const tB = (b.x - cxTotal) * ux + (b.y - cyTotal) * uy;
            return tA - tB;
        });
    };

    const fil1Ord = ordenarFileira(fileira1);
    const fil2Ord = ordenarFileira(fileira2);

    // Ajusta o sentido do eixo u para coincidir com a progressão da numeração
    const checkSentido = (fil) => {
        if (fil.length < 2) return 0;
        const pPrimeiro = (fil[0].x - cxTotal) * ux + (fil[0].y - cyTotal) * uy;
        const pUltimo = (fil[fil.length - 1].x - cxTotal) * ux + (fil[fil.length - 1].y - cyTotal) * uy;
        return pUltimo - pPrimeiro;
    };
    const s1 = checkSentido(fil1Ord);
    const s2 = checkSentido(fil2Ord);
    if (s1 + s2 < 0) {
        ux = -ux; uy = -uy;
        nx = -nx; ny = -ny;
    }

    // 5. Posicionamento padronizado em 2 fileiras paralelas e alinhadas
    const W = PADRAO_LARGURA_M;
    const D = PADRAO_PROFUNDIDADE_M;
    const ESP = PADRAO_ESPACAMENTO_M;
    const G = PADRAO_INTERVALO_FILEIRAS_M;

    const nMax = Math.max(fil1Ord.length, fil2Ord.length);
    const passoLote = W + ESP;
    const distCentroFileiras = D + G;

    const resultadoAjustes = new Map();

    const gerarPoligonoMetros = (cxLote, cyLote) => {
        const hw = W / 2;
        const hd = D / 2;
        const cantos = [
            { x: cxLote - hw * ux - hd * nx, y: cyLote - hw * uy - hd * ny },
            { x: cxLote + hw * ux - hd * nx, y: cyLote + hw * uy - hd * ny },
            { x: cxLote + hw * ux + hd * nx, y: cyLote + hw * uy + hd * ny },
            { x: cxLote - hw * ux + hd * nx, y: cyLote - hw * uy + hd * ny },
        ];
        cantos.push(cantos[0]);
        return cantos.map((pt) => {
            const ll = L.CRS.EPSG3857.unproject(L.point(pt.x, pt.y));
            return [Number(ll.lng.toFixed(7)), Number(ll.lat.toFixed(7))];
        });
    };

    // Fileira 1 (lado -n)
    const offsetN1 = -distCentroFileiras / 2;
    for (let k = 0; k < fil1Ord.length; k++) {
        const tk = (k - (nMax - 1) / 2) * passoLote;
        const cxLote = cxTotal + tk * ux + offsetN1 * nx;
        const cyLote = cyTotal + tk * uy + offsetN1 * ny;
        const anel = gerarPoligonoMetros(cxLote, cyLote);
        const cLL = centroide(anel);
        resultadoAjustes.set(fil1Ord[k].f.properties.id, {
            coords: anel,
            lng: cLL[0],
            lat: cLL[1],
            rot_deg: Number(((theta * 180) / Math.PI).toFixed(2))
        });
    }

    // Fileira 2 (lado +n)
    const offsetN2 = distCentroFileiras / 2;
    for (let k = 0; k < fil2Ord.length; k++) {
        const tk = (k - (nMax - 1) / 2) * passoLote;
        const cxLote = cxTotal + tk * ux + offsetN2 * nx;
        const cyLote = cyTotal + tk * uy + offsetN2 * ny;
        const anel = gerarPoligonoMetros(cxLote, cyLote);
        const cLL = centroide(anel);
        resultadoAjustes.set(fil2Ord[k].f.properties.id, {
            coords: anel,
            lng: cLL[0],
            lat: cLL[1],
            rot_deg: Number(((theta * 180) / Math.PI).toFixed(2))
        });
    }

    return {
        resultadoAjustes,
        totalCasas: feats.length,
        n1: fil1Ord.length,
        n2: fil2Ord.length
    };
}

export function iniciarAgrupamentoQuarteirao() {
    if (E.selecionadas.size < 2) return;
    const calc = calcularQuarteiraoPadronizado(E.selecionadas);
    if (!calc) return;
    calc.tipo = "quarteirao";
    calc.titulo = `Pré-visualização Quarteirão: ${calc.totalCasas} casas (${calc.n1} na Face A, ${calc.n2} na Face B)`;
    iniciarPreviewAcao(calc);
}

export function confirmarAgrupamentoQuarteirao() {
    confirmarPreviewAcao();
}

export function cancelarPreviewQuarteirao() {
    cancelarPreviewAcao();
}

// ============ Alinhamentos, Nivelamento e Espaçamentos ============


export function invalidarSnapshotEspacamento() {
    S.snapshotBaseEspacamento = null;
    S.historicoEspacamentoSalvo = false;
}

export function formatarValorEspacamento(valor, irregular) {
    if (valor === null || valor === undefined || isNaN(valor)) return "0,0";
    const sinal = valor < -0.05 ? "-" : "";
    const num = Math.abs(valor).toFixed(1).replace(".", ",");
    const base = (valor >= -0.05 && valor < 0.05) ? "0,0" : (sinal + num);
    return irregular ? `~ ${base}` : base;
}

export function parseValEspacamento(str) {
    if (!str) return NaN;
    const limpo = String(str).replace("~", "").trim().replace(",", ".");
    const val = parseFloat(limpo);
    if (isNaN(val) || val < 0) return NaN;
    return Math.round(val * 10) / 10;
}


export function calcularNivelamentoHorizontal(conjuntoIds) {
    const feats = Array.from(conjuntoIds).map((id) => S.mapaCasasPorId.get(id)).filter(Boolean);
    if (feats.length < 2) return null;

    const centroMetros = calcularCentroideMetros(feats);
    const theta = calcularEixoPrincipalSelecao(feats);
    // Rotação mínima para nivelar o eixo à horizontal: delta = -theta
    const deltaRad = -theta;
    const deltaDeg = Number(((deltaRad * 180) / Math.PI).toFixed(1));

    const resultadoAjustes = new Map();
    for (const f of feats) {
        const id = f.properties.id;
        const startRing = f.properties._anelUni;
        const novoAnel = aplicarRotacaoMetros(startRing, centroMetros, deltaRad);
        const cLL = centroide(novoAnel);
        const prevRot = (E.ajustes[id] && E.ajustes[id].rot_deg) || 0;
        resultadoAjustes.set(id, {
            lng: Number(cLL[0].toFixed(7)),
            lat: Number(cLL[1].toFixed(7)),
            rot_deg: Number(((prevRot + deltaDeg) % 360).toFixed(1)),
            coords: novoAnel,
            grupo_id: obterIdGrupo(id)
        });
    }
    return {
        tipo: "nivelar",
        titulo: `Pré-visualização: Nivelar na horizontal (${feats.length} casas, rotação ${deltaDeg > 0 ? "+" : ""}${deltaDeg}°)`,
        resultadoAjustes,
        totalCasas: feats.length
    };
}

// 2. Alinhar em uma única linha horizontal
export function calcularAlinhamentoLinha(conjuntoIds) {
    const feats = Array.from(conjuntoIds).map((id) => S.mapaCasasPorId.get(id)).filter(Boolean);
    if (feats.length < 2) return null;

    const centroMetros = calcularCentroideMetros(feats);
    const theta = calcularEixoPrincipalSelecao(feats);

    // Eixo unitário ao longo da reta principal
    let ux = Math.cos(theta);
    let uy = Math.sin(theta);
    if (ux < 0 || (ux === 0 && uy < 0)) { ux = -ux; uy = -uy; } // Orientação consistente

    // Projeta cada casa ao longo do eixo u para definir a ordem
    const casasOrdenadas = feats.map((f) => {
        const c = centroide(f.properties._anelUni);
        const pMetros = L.CRS.EPSG3857.project(L.latLng(c[1], c[0]));
        const t = (pMetros.x - centroMetros.x) * ux + (pMetros.y - centroMetros.y) * uy;
        return { f, t };
    }).sort((a, b) => a.t - b.t).map((it) => it.f);

    const W = PADRAO_LARGURA_M;
    const D = PADRAO_PROFUNDIDADE_M;
    const ESP = PADRAO_ESPACAMENTO_M;
    const passo = W + ESP;
    const m = casasOrdenadas.length;
    const x0 = centroMetros.x - ((m - 1) / 2) * passo;

    const resultadoAjustes = new Map();
    casasOrdenadas.forEach((f, k) => {
        const id = f.properties.id;
        const cx = x0 + k * passo;
        const cy = centroMetros.y;
        const hw = W / 2;
        const hd = D / 2;

        // Retângulo reto (orientação padrão)
        const ringMetros = [
            [cx - hw, cy - hd],
            [cx + hw, cy - hd],
            [cx + hw, cy + hd],
            [cx - hw, cy + hd],
            [cx - hw, cy - hd]
        ];
        const coords = ringMetros.map(([mx, my]) => {
            const ll = L.CRS.EPSG3857.unproject(L.point(mx, my));
            return [Number(ll.lng.toFixed(7)), Number(ll.lat.toFixed(7))];
        });
        const cLL = centroide(coords);
        resultadoAjustes.set(id, {
            lng: Number(cLL[0].toFixed(7)),
            lat: Number(cLL[1].toFixed(7)),
            rot_deg: 0,
            coords: coords,
            grupo_id: obterIdGrupo(id)
        });
    });

    return {
        tipo: "linha",
        titulo: `Pré-visualização: Alinhar em uma linha (${m} casas alinhadas na horizontal)`,
        resultadoAjustes,
        totalCasas: m
    };
}

// ============ Modelo Determinístico de Espaçamento H e V ============
export function prepararSnapshotEspacamento() {
    const feats = Array.from(E.selecionadas).map((id) => S.mapaCasasPorId.get(id)).filter(Boolean);
    if (feats.length < 2) {
        S.snapshotBaseEspacamento = null;
        S.historicoEspacamentoSalvo = false;
        return null;
    }

    const centroMetros = calcularCentroideMetros(feats);
    const theta = calcularEixoPrincipalSelecao(feats);
    let ux = Math.cos(theta);
    let uy = Math.sin(theta);
    if (ux < 0 || (ux === 0 && uy < 0)) { ux = -ux; uy = -uy; }
    const nx = -uy;
    const ny = ux;

    // Projeção dos centros métricos exatos de cada lote no sistema coordenado da fileira (u, n)
    const itens = feats.map((f) => {
        const pM = centroideMetrosLote(f.properties._anelUni);
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

    S.snapshotBaseEspacamento = {
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

    return S.snapshotBaseEspacamento;
}

export function aplicarEspacamentoDeterministo(eixo, novoEspacamentoM) {
    if (!S.snapshotBaseEspacamento) {
        prepararSnapshotEspacamento();
    }
    if (!S.snapshotBaseEspacamento) return;

    const snap = S.snapshotBaseEspacamento;
    const W = PADRAO_LARGURA_M;
    const D = PADRAO_PROFUNDIDADE_M;

    // Registra no histórico uma única vez por sessão contínua de ajuste
    if (!S.historicoEspacamentoSalvo) {
        salvarSnapshotHistorico();
        S.historicoEspacamentoSalvo = true;
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
                const layer = S.mapaCamadasCasas.get(it.id);
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
    const feats = Array.from(E.selecionadas).map((id) => S.mapaCasasPorId.get(id)).filter(Boolean);
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
            const p1 = centroideMetrosLote(fil[k].f.properties._anelUni);
            const p2 = centroideMetrosLote(fil[k + 1].f.properties._anelUni);
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
                const p = centroideMetrosLote(it.f.properties._anelUni);
                return s + ((p.x - snap.centroMetros.x) * snap.nx + (p.y - snap.centroMetros.y) * snap.ny);
            }, 0) / fil1.length;
            const d2 = fil2.reduce((s, it) => {
                const p = centroideMetrosLote(it.f.properties._anelUni);
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

// ============ Sistema Unificado de Pré-visualização ============

export function iniciarPreviewAcao(calc) {
    if (!calc) return;
    S.previewAcaoAtiva = calc;
    S.previewQuarteiraoAtivo = calc;
    S.cPreviewOverlay.clearLayers();

    for (const [id, ajust] of calc.resultadoAjustes) {
        const pts = ajust.coords.map((c) => [c[1], c[0]]);
        const poly = L.polygon(pts, {
            color: "#ff7700",
            weight: 2.2,
            dashArray: "5 4",
            fillColor: "#ff9900",
            fillOpacity: 0.55,
            interactive: false
        });
        S.cPreviewOverlay.addLayer(poly);
    }

    const banner = $("bannerPreviewQuarteirao");
    if (banner) {
        banner.style.display = "flex";
        const txt = $("previewQuarteiraoTexto");
        if (txt) {
            txt.innerHTML = `<b>${calc.titulo || "Pré-visualização"}</b>`;
        }
    }
    st("<b>Pré-visualização gerada.</b> Confirme para aplicar as alterações ou cancele.");
}

export function confirmarPreviewAcao() {
    if (!S.previewAcaoAtiva) return;
    salvarSnapshotHistorico();

    const calc = S.previewAcaoAtiva;
    const ids = Array.from(calc.resultadoAjustes.keys());

    if (calc.tipo === "quarteirao") {
        const novoGrpId = "quarteirao-" + Date.now();
        E.grupos = E.grupos
            .map((g) => ({
                id: g.id || ("grp-" + (g.casas ? g.casas[0] : "")),
                tipo: g.tipo || "grupo",
                casas: (g.casas || g).filter((id) => !calc.resultadoAjustes.has(id))
            }))
            .filter((g) => g.casas.length >= 2);

        E.grupos.push({
            id: novoGrpId,
            tipo: "quarteirao",
            casas: ids
        });
        for (const [id, ajust] of calc.resultadoAjustes) {
            ajust.grupo_id = novoGrpId;
        }
    }

    for (const [id, ajust] of calc.resultadoAjustes) {
        const item = S.mapaCasasPorId.get(id);
        if (item) {
            item.properties._anelUni = ajust.coords;
            if (E.posicao === "uniforme") {
                item.geometry.coordinates = [ajust.coords];
                item.properties._c = [ajust.lng, ajust.lat];
                const layer = S.mapaCamadasCasas.get(id);
                if (layer) {
                    layer.setLatLngs(ajust.coords.map((c) => [c[1], c[0]]));
                    layer.redraw();
                }
            }
        }
        E.ajustes[id] = {
            lng: ajust.lng,
            lat: ajust.lat,
            rot_deg: ajust.rot_deg,
            grupo_id: ajust.grupo_id || obterIdGrupo(id),
            coords: ajust.coords
        };
    }

    const descAcao = calc.tipo === "quarteirao"
        ? `${ids.length} casas agrupadas em 2 fileiras paralelas`
        : (calc.tipo === "linha" ? `${ids.length} casas alinhadas em linha horizontal` : `${ids.length} casas niveladas na horizontal`);

    cancelarPreviewAcao();
    invalidarSnapshotEspacamento();
    marcarSalvo(false);
    salvarLocalStorage();
    atualizarOverlayEdicao();
    atualizarUIEdicao();
    desenharNumeracaoCasas();
    st(`<b>Ação confirmada:</b> ${descAcao}.`);
}

export function cancelarPreviewAcao() {
    S.previewAcaoAtiva = null;
    S.previewQuarteiraoAtivo = null;
    S.cPreviewOverlay.clearLayers();
    const banner = $("bannerPreviewQuarteirao");
    if (banner) banner.style.display = "none";
}

export function iniciarNivelarHorizontal() {
    if (E.selecionadas.size < 2) return;
    const calc = calcularNivelamentoHorizontal(E.selecionadas);
    if (!calc) return;
    iniciarPreviewAcao(calc);
}

export function iniciarAlinharLinha() {
    if (E.selecionadas.size < 2) return;
    const calc = calcularAlinhamentoLinha(E.selecionadas);
    if (!calc) return;
    iniciarPreviewAcao(calc);
}
