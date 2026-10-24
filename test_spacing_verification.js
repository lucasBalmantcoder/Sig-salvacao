const fs = require('fs');

const gj = JSON.parse(fs.readFileSync('dados/casas_salvacao.geojson', 'utf8'));

const PADRAO_LARGURA_M = 10.0;
const PADRAO_PROFUNDIDADE_M = 16.0;

function project(lat, lng) {
    const d = Math.PI / 180;
    const max = 85.0511287798;
    const latClamped = Math.max(Math.min(max, lat), -max);
    const sin = Math.sin(latClamped * d);
    const R = 6378137;
    const x = R * lng * d;
    const y = R * Math.log((1 + sin) / (1 - sin)) / 2;
    return { x, y };
}

function unproject(x, y) {
    const d = 180 / Math.PI;
    const R = 6378137;
    const lng = (x / R) * d;
    const lat = (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * d;
    return [lng, lat];
}

function centroide(anel) {
    let sx = 0, sy = 0, n = anel.length;
    if (n > 1 && anel[0][0] === anel[n-1][0] && anel[0][1] === anel[n-1][1]) n--;
    for (let i = 0; i < n; i++) {
        sx += anel[i][0];
        sy += anel[i][1];
    }
    return [sx / n, sy / n];
}

function aplicarTranslacaoMetros(coords, dxMetros, dyMetros) {
    return coords.map((pt) => {
        const pM = project(pt[1], pt[0]);
        pM.x += dxMetros;
        pM.y += dyMetros;
        return unproject(pM.x, pM.y);
    });
}

const targets = new Set();
for (let i = 1012; i <= 1132; i += 10) targets.add(String(i));
for (let i = 2011; i <= 2131; i += 10) targets.add(String(i));

const houses = gj.features.filter(f => targets.has(String(f.properties.numero)));
houses.forEach(f => {
    f.properties._anelUni = f.geometry.coordinates[0];
});

// Snapshot preparation
function prepararSnapshot(feats) {
    const pts = feats.map(f => {
        const c = centroide(f.properties._anelUni);
        return project(c[1], c[0]);
    });
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
    const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    let ux = Math.cos(theta), uy = Math.sin(theta);
    if (ux < 0 || (ux === 0 && uy < 0)) { ux = -ux; uy = -uy; }
    const nx = -uy, ny = ux;

    const itens = feats.map(f => {
        const c = centroide(f.properties._anelUni);
        const pM = project(c[1], c[0]);
        const t = (pM.x - mx) * ux + (pM.y - my) * uy;
        const d = (pM.x - mx) * nx + (pM.y - my) * ny;
        return {
            id: f.properties.id,
            num: f.properties.numero,
            f,
            t,
            d,
            pM,
            coordsBase: JSON.parse(JSON.stringify(f.properties._anelUni))
        };
    });

    // Detecção de fileiras por tolerância consecutiva em d
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

    fileiras.forEach(fil => {
        fil.sort((a, b) => a.t - b.t);
        fil.tBaseMedia = fil.reduce((s, it) => s + it.t, 0) / fil.length;
        fil.dBaseMedia = fil.reduce((s, it) => s + it.d, 0) / fil.length;
    });

    // Espaçamento H inicial
    const gapsH = [];
    fileiras.forEach(fil => {
        for (let k = 0; k < fil.length - 1; k++) {
            gapsH.push((fil[k + 1].t - fil[k].t) - PADRAO_LARGURA_M);
        }
    });
    const espHMedio = gapsH.length ? gapsH.reduce((a, b) => a + b, 0) / gapsH.length : 1.0;
    const espHIrregular = gapsH.length ? (Math.max(...gapsH) - Math.min(...gapsH)) > 0.05 : false;

    // Espaçamento V inicial
    const gapsV = [];
    for (let r = 0; r < fileiras.length - 1; r++) {
        gapsV.push((fileiras[r + 1].dBaseMedia - fileiras[r].dBaseMedia) - PADRAO_PROFUNDIDADE_M);
    }
    const espVMedio = gapsV.length ? gapsV.reduce((a, b) => a + b, 0) / gapsV.length : 0.0;
    const espVIrregular = gapsV.length ? (Math.max(...gapsV) - Math.min(...gapsV)) > 0.05 : false;

    return {
        feats,
        centroMetros: { x: mx, y: my },
        ux, uy, nx, ny,
        fileiras,
        temDuasFileiras: fileiras.length >= 2,
        espHAtual: Number(espHMedio.toFixed(1)),
        espVAtual: Number(espVMedio.toFixed(1)),
        espHIrregular,
        espVIrregular,
        targetH: null,
        targetV: null
    };
}

function aplicarEspacamento(snap, eixo, valorAlvo) {
    const W = PADRAO_LARGURA_M;
    const D = PADRAO_PROFUNDIDADE_M;

    if (eixo === 'h') {
        snap.targetH = valorAlvo;
        snap.espHAtual = valorAlvo;
        snap.espHIrregular = false;
    } else if (eixo === 'v') {
        snap.targetV = valorAlvo;
        snap.espVAtual = valorAlvo;
        snap.espVIrregular = false;
    }

    const R = snap.fileiras.length;
    const dGlobalMedia = snap.fileiras.reduce((s, fil) => s + fil.dBaseMedia, 0) / R;

    snap.fileiras.forEach((fil, r) => {
        const m = fil.length;
        // Target T
        let t0 = fil.tBaseMedia;
        let passoH = W + (snap.targetH !== null ? snap.targetH : 0);
        if (snap.targetH !== null && m >= 2) {
            t0 = fil.tBaseMedia - ((m - 1) / 2) * passoH;
        }

        // Target D
        let deltaD = 0;
        if (snap.targetV !== null && R >= 2) {
            const passoV = D + snap.targetV;
            const d0 = dGlobalMedia - ((R - 1) / 2) * passoV;
            const dRowTarget = d0 + r * passoV;
            deltaD = dRowTarget - fil.dBaseMedia;
        }

        fil.forEach((it, k) => {
            const tTarget = (snap.targetH !== null && m >= 2) ? (t0 + k * passoH) : it.t;
            const dTarget = it.d + deltaD;
            const deltaT = tTarget - it.t;

            const dx = deltaT * snap.ux + deltaD * snap.nx;
            const dy = deltaT * snap.uy + deltaD * snap.ny;
            const novoAnel = aplicarTranslacaoMetros(it.coordsBase, dx, dy);

            it.f.properties._anelUni = novoAnel;
            it.novoAnel = novoAnel;
        });
    });
}

function verificarEspacamento(feats, targetH, targetV) {
    // Project and measure
    const snap = prepararSnapshot(feats);
    console.log(`\n--- Verificação: targetH=${targetH}, targetV=${targetV} ---`);
    console.log(`Fileiras detectadas: ${snap.fileiras.length}`);

    let totalDesviosH = 0;
    snap.fileiras.forEach((fil, r) => {
        console.log(`Fileira ${r + 1} (${fil.length} casas, de ${fil[0].num} até ${fil[fil.length - 1].num}):`);
        const desvios = [];
        for (let k = 0; k < fil.length - 1; k++) {
            const c1 = centroide(fil[k].f.properties._anelUni);
            const c2 = centroide(fil[k + 1].f.properties._anelUni);
            const p1 = project(c1[1], c1[0]);
            const p2 = project(c2[1], c2[0]);
            const distBordas = ((p2.x - p1.x) * snap.ux + (p2.y - p1.y) * snap.uy) - PADRAO_LARGURA_M;
            const erro = Math.abs(distBordas - targetH);
            if (erro > 0.05) totalDesviosH++;
            desvios.push(distBordas.toFixed(3));
        }
        console.log(`  Espaçamentos H entre vizinhos: ${desvios.join(', ')}`);
    });

    let totalDesviosV = 0;
    if (snap.fileiras.length >= 2) {
        for (let r = 0; r < snap.fileiras.length - 1; r++) {
            const fil1 = snap.fileiras[r];
            const fil2 = snap.fileiras[r + 1];
            const d1 = fil1.reduce((s, it) => {
                const c = centroide(it.f.properties._anelUni);
                const p = project(c[1], c[0]);
                return s + ((p.x - snap.centroMetros.x) * snap.nx + (p.y - snap.centroMetros.y) * snap.ny);
            }, 0) / fil1.length;
            const d2 = fil2.reduce((s, it) => {
                const c = centroide(it.f.properties._anelUni);
                const p = project(c[1], c[0]);
                return s + ((p.x - snap.centroMetros.x) * snap.nx + (p.y - snap.centroMetros.y) * snap.ny);
            }, 0) / fil2.length;
            const distBordasV = (d2 - d1) - PADRAO_PROFUNDIDADE_M;
            const erro = Math.abs(distBordasV - targetV);
            if (erro > 0.05) totalDesviosV++;
            console.log(`  Espaçamento V entre fileiras ${r + 1} e ${r + 2}: ${distBordasV.toFixed(3)} m (alvo: ${targetV} m)`);
        }
    }

    console.log(`Desvios H > 0.05m: ${totalDesviosH} | Desvios V > 0.05m: ${totalDesviosV}`);
    return { totalDesviosH, totalDesviosV };
}

// Initial snapshot test
const snap = prepararSnapshot(houses);
console.log('Initial espHAtual:', snap.espHAtual, 'irregular:', snap.espHIrregular);
console.log('Initial espVAtual:', snap.espVAtual, 'irregular:', snap.espVIrregular);

// Test cases required by prompt:
// H = 0, 0.5, 2.0 m
// V = 1.0, 3.0 m
const testCases = [
    { h: 0.0, v: 1.0 },
    { h: 0.5, v: 1.0 },
    { h: 2.0, v: 3.0 }
];

testCases.forEach(({ h, v }) => {
    aplicarEspacamento(snap, 'h', h);
    aplicarEspacamento(snap, 'v', v);
    verificarEspacamento(houses, h, v);
});

