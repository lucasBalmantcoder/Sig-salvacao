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

eval(extractFunction('centroide'));
eval(extractFunction('aplicarTranslacaoMetros'));
eval(extractFunction('gerarLotePadronizado'));
eval(extractFunction('calcularCentroideMetros'));
eval(extractFunction('calcularEixoPrincipalSelecao'));

let snapshotBaseEspacamento = null;
let historicoEspacamentoSalvo = false;
function salvarSnapshotHistorico() {}
function obterIdGrupo(id) { return null; }
function marcarSalvo() {}
function salvarLocalStorage() {}
function atualizarOverlayEdicao() {}
function desenharNumeracaoCasas() {}
function st(msg) {}

eval(extractFunction('prepararSnapshotEspacamento'));
eval(extractFunction('aplicarEspacamentoDeterministo'));

const gj = JSON.parse(fs.readFileSync('dados/casas_salvacao.geojson', 'utf8'));

const targets = new Set();
for (let i = 1012; i <= 1132; i += 10) targets.add(String(i));
for (let i = 2011; i <= 2131; i += 10) targets.add(String(i));

const casas = gj.features.filter(f => targets.has(String(f.properties.numero)));
const mapaCasasPorId = new Map();
casas.forEach(f => {
    // Generate standardized polygon as index.html does:
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

const mapaCamadasCasas = new Map();

// Test debug
console.log('--- Initial snapshot ---');
const snap0 = prepararSnapshotEspacamento();
console.log('Fileiras:', snap0.fileiras.length);
snap0.fileiras.forEach((fil, idx) => {
    console.log(`Fileira ${idx+1} (${fil.length} casas):`, fil.map(it => it.f.properties.numero).join(', '));
    fil.forEach((it, k) => {
        console.log(`  k=${k} num=${it.f.properties.numero} t=${it.t.toFixed(2)} d=${it.d.toFixed(2)}`);
    });
});

console.log('--- Applying H=0, V=1 ---');
const fil = snap0.fileiras[0];
const m = fil.length;
const passoH = PADRAO_LARGURA_M + 0;
const t0 = fil.tBaseMedia - ((m - 1) / 2) * passoH;
console.log('fil.tBaseMedia:', fil.tBaseMedia, 't0:', t0, 'passoH:', passoH);
fil.forEach((it, k) => {
    const tTarget = t0 + k * passoH;
    console.log(`k=${k} num=${it.f.properties.numero} base_t=${it.t.toFixed(4)} tTarget=${tTarget.toFixed(4)} deltaT=${(tTarget - it.t).toFixed(4)}`);
});
function debugAplicar(eixo, valor) {
    aplicarEspacamentoDeterministo(eixo, valor);
    const it2011 = snapshotBaseEspacamento.fileiras[0].find(x => x.f.properties.numero == 2011);
    const c = centroide(it2011.f.properties._anelUni);
    const p = L.CRS.EPSG3857.project(L.latLng(c[1], c[0]));
    console.log(`After aplicar(${eixo}, ${valor}): p2011 = (${p.x}, ${p.y})`);
}

debugAplicar('h', 0);
debugAplicar('v', 1);

const it0 = fil.find(x => x.f.properties.numero == 2011);
const c_old = centroide(it0.coordsBase);
const p_old = L.CRS.EPSG3857.project(L.latLng(c_old[1], c_old[0]));
const c_new = centroide(it0.f.properties._anelUni);
const p_new = L.CRS.EPSG3857.project(L.latLng(c_new[1], c_new[0]));
console.log('p_old:', p_old.x, p_old.y);
console.log('p_new:', p_new.x, p_new.y);
console.log('deltaT was:', 22.1394);
console.log('dx expected:', 22.1394 * snap0.ux);
console.log('dx actual:', p_new.x - p_old.x);
console.log('dy expected:', 22.1394 * snap0.uy);
console.log('dy actual:', p_new.y - p_old.y);
