const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

const L = {
    latLng: (lat, lng) => ({ lat, lng }),
    point: (x, y) => ({ x, y }),
    CRS: {
        EPSG3857: {
            project: (ll) => {
                const d = Math.PI / 180;
                const max = 85.0511287798;
                const latClamped = Math.max(Math.min(max, ll.lat), -max);
                const sin = Math.sin(latClamped * d);
                const R = 6378137;
                const x = R * ll.lng * d;
                const y = R * Math.log((1 + sin) / (1 - sin)) / 2;
                return { x, y };
            },
            unproject: (p) => {
                const d = 180 / Math.PI;
                const R = 6378137;
                const lng = (p.x / R) * d;
                const lat = (2 * Math.atan(Math.exp(p.y / R)) - Math.PI / 2) * d;
                return { lat, lng };
            }
        }
    }
};

function extractFunction(name) {
    const startIdx = html.indexOf(`function ${name}(`);
    if (startIdx === -1) throw new Error(`Function ${name} not found`);
    let braceCount = 0;
    let foundFirstBrace = false;
    let endIdx = startIdx;
    for (let i = startIdx; i < html.length; i++) {
        if (html[i] === '{') {
            braceCount++;
            foundFirstBrace = true;
        } else if (html[i] === '}') {
            braceCount--;
            if (foundFirstBrace && braceCount === 0) {
                endIdx = i + 1;
                break;
            }
        }
    }
    return html.substring(startIdx, endIdx);
}

const PADRAO_LARGURA_M = 8.0;
const PADRAO_PROFUNDIDADE_M = 16.0;
const PADRAO_ESPACAMENTO_M = 1.0;

eval(extractFunction('gerarLotePadronizado'));
eval(extractFunction('aplicarTranslacaoMetros'));

function centroideMetrosLote(anel) {
    if (!anel || !anel.length) return { x: 0, y: 0 };
    const n = Math.min(4, anel.length > 4 ? 4 : anel.length - 1 || 1);
    let sx = 0, sy = 0;
    for (let i = 0; i < n; i++) {
        const p = L.CRS.EPSG3857.project(L.latLng(anel[i][1], anel[i][0]));
        sx += p.x;
        sy += p.y;
    }
    return { x: sx / n, y: sy / n };
}

function calcularCentroideMetros(features) {
    if (!features || !features.length) return { x: 0, y: 0 };
    let sx = 0, sy = 0;
    for (const f of features) {
        const c = centroideMetrosLote(f.properties._anelUni);
        sx += c.x;
        sy += c.y;
    }
    return { x: sx / features.length, y: sy / features.length };
}

function calcularEixoPrincipalSelecao(features) {
    if (!features || features.length < 2) return 0;
    const pts = features.map(f => centroideMetrosLote(f.properties._anelUni));
    const m = pts.length;
    const mx = pts.reduce((s, p) => s + p.x, 0) / m;
    const my = pts.reduce((s, p) => s + p.y, 0) / m;

    let sxx = 0, syy = 0, sxy = 0;
    for (const p of pts) {
        const dx = p.x - mx;
        const dy = p.y - my;
        sxx += dx * dx;
        syy += dy * dy;
        sxy += dx * dy;
    }
    return 0.5 * Math.atan2(2 * sxy, sxx - syy);
}

let snapshotBaseEspacamento = null;
let historicoEspacamentoSalvo = false;
function salvarSnapshotHistorico() {}
function obterIdGrupo(id) { return null; }
function marcarSalvo() {}
function salvarLocalStorage() {}
function atualizarOverlayEdicao() {}
function desenharNumeracaoCasas() {}
function st(msg) {}

function prepararSnapshotEspacamento() {
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

    fileiras.forEach((fil) => {
        fil.sort((a, b) => a.t - b.t);
        fil.tBaseMedia = fil.reduce((s, it) => s + it.t, 0) / fil.length;
        fil.dBaseMedia = fil.reduce((s, it) => s + it.d, 0) / fil.length;
    });

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
            E.ajustes[it.id] = {
                coords: novoAnel
            };
        });
    });
}

function verificarEspacamento(targetH, targetV) {
    const snap = snapshotBaseEspacamento;
    console.log(`\nVerificando H=${targetH}m, V=${targetV}m:`);
    let totalDesviosH = 0;
    snap.fileiras.forEach((fil, r) => {
        const rel = [];
        for (let k = 0; k < fil.length - 1; k++) {
            const p1 = centroideMetrosLote(fil[k].f.properties._anelUni);
            const p2 = centroideMetrosLote(fil[k + 1].f.properties._anelUni);
            const distBordas = ((p2.x - p1.x) * snap.ux + (p2.y - p1.y) * snap.uy) - PADRAO_LARGURA_M;
            const erro = Math.abs(distBordas - targetH);
            if (erro > 0.05) totalDesviosH++;
            rel.push(`${fil[k].f.properties.numero}->${fil[k + 1].f.properties.numero}: ${distBordas.toFixed(3)}m`);
        }
        console.log(`  Fileira ${r + 1}: ${rel.join(', ')}`);
    });

    let totalDesviosV = 0;
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
            console.log(`  Espaçamento V: ${distBordasV.toFixed(3)}m (alvo ${targetV}m, erro ${erro.toFixed(3)}m)`);
        }
    }
    console.log(`  => Desvios H > 0.05m = ${totalDesviosH} | Desvios V > 0.05m = ${totalDesviosV}`);
    return { totalDesviosH, totalDesviosV, valido: (totalDesviosH === 0 && totalDesviosV === 0) };
}

const gj = JSON.parse(fs.readFileSync('dados/casas_salvacao.geojson', 'utf8'));
const targets = new Set();
for (let i = 1012; i <= 1132; i += 10) targets.add(String(i));
for (let i = 2011; i <= 2131; i += 10) targets.add(String(i));

const casas = gj.features.filter(f => targets.has(String(f.properties.numero)));
const mapaCasasPorId = new Map();
casas.forEach(f => {
    const anelBase = f.properties.anel_uniforme || f.geometry.coordinates[0];
    const anelStd = gerarLotePadronizado(anelBase, PADRAO_LARGURA_M, PADRAO_PROFUNDIDADE_M);
    f.properties._anelUni = anelStd;
    f.properties._anelUniBase = JSON.parse(JSON.stringify(anelStd));
    mapaCasasPorId.set(f.properties.id, f);
});

const E = {
    selecionadas: new Set(casas.map(f => f.properties.id)),
    posicao: 'uniforme',
    ajustes: {}
};

prepararSnapshotEspacamento();

const testCases = [
    { h: 0.0, v: 1.0 },
    { h: 0.5, v: 1.0 },
    { h: 2.0, v: 3.0 }
];

testCases.forEach(({ h, v }) => {
    aplicarEspacamentoDeterministo('h', h);
    aplicarEspacamentoDeterministo('v', v);
    const r = verificarEspacamento(h, v);
    if (!r.valido) {
        console.error('FAIL!');
        process.exit(1);
    }
});
console.log('\nALL TEST CASES PASSED PERFECTLY WITH ZERO DEVIATIONS!');

