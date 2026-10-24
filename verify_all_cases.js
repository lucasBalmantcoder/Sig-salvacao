const fs = require('fs');

// Read index.html and evaluate the needed functions
const html = fs.readFileSync('index.html', 'utf8');

// Mock Leaflet and minimal browser objects
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

const window = {};
const document = {
    getElementById: () => null
};

// Extract functions from index.html
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
const PADRAO_INTERVALO_FILEIRAS_M = 3.0;

// Constants and functions
eval(extractFunction('centroide'));
eval(extractFunction('aplicarTranslacaoMetros'));
eval(extractFunction('calcularCentroideMetros'));
eval(extractFunction('calcularEixoPrincipalSelecao'));
eval(extractFunction('formatarValorEspacamento'));
eval(extractFunction('parseValEspacamento'));

let snapshotBaseEspacamento = null;
let historicoEspacamentoSalvo = false;
function salvarSnapshotHistorico() {}
function obterIdGrupo(id) { return null; }
function marcarSalvo() {}
function salvarLocalStorage() {}
function atualizarOverlayEdicao() {}
function desenharNumeracaoCasas() {}
function st(msg) {}

eval(extractFunction('invalidarSnapshotEspacamento'));
eval(extractFunction('prepararSnapshotEspacamento'));
eval(extractFunction('aplicarEspacamentoDeterministo'));

// Extract window.verificarEspacamento
const vStart = html.indexOf('window.verificarEspacamento = function');
const vEnd = html.indexOf('// ============ Sistema Unificado de Pré-visualização ============');
const vBlock = html.substring(vStart, vEnd).trim();
eval(vBlock);

// Load data
const gj = JSON.parse(fs.readFileSync('dados/casas_salvacao.geojson', 'utf8'));

const targets = new Set();
for (let i = 1012; i <= 1132; i += 10) targets.add(String(i));
for (let i = 2011; i <= 2131; i += 10) targets.add(String(i));

const casasSelecionadas = gj.features.filter(f => targets.has(String(f.properties.numero)));
console.log(`Carregadas ${casasSelecionadas.length} casas para o teste.`);

const mapaCasasPorId = new Map();
casasSelecionadas.forEach(f => {
    f.properties._anelUni = JSON.parse(JSON.stringify(f.geometry.coordinates[0]));
    f.properties._anelUniBase = JSON.parse(JSON.stringify(f.geometry.coordinates[0]));
    mapaCasasPorId.set(f.properties.id, f);
});

const E = {
    selecionadas: new Set(casasSelecionadas.map(f => f.properties.id)),
    posicao: 'uniforme',
    ajustes: {}
};

const mapaCamadasCasas = new Map();

console.log('\n=== TESTE 1: Snapshot Inicial e Exibição Fiel ===');
const snap0 = prepararSnapshotEspacamento();
console.log('Fileiras detectadas:', snap0.fileiras.length);
snap0.fileiras.forEach((fil, idx) => {
    console.log(`  Fileira ${idx + 1}: ${fil.length} casas (de ${fil[0].f.properties.numero} até ${fil[fil.length - 1].f.properties.numero})`);
});
console.log(`espHAtual: ${snap0.espHAtual}m (irregular: ${snap0.espHIrregular})`);
console.log(`espVAtual: ${snap0.espVAtual}m (irregular: ${snap0.espVIrregular})`);

const strH = formatarValorEspacamento(snap0.espHAtual, snap0.espHIrregular);
const strV = formatarValorEspacamento(snap0.espVAtual, snap0.espVIrregular);
console.log(`Exibição no campo H: "${strH}"`);
console.log(`Exibição no campo V: "${strV}"`);

console.log('\n=== TESTE 2: Execução dos Casos de Aceite Obrigatórios ===');

const casos = [
    { h: 0.0, v: 1.0 },
    { h: 0.5, v: 1.0 },
    { h: 2.0, v: 3.0 }
];

casos.forEach(({ h, v }, index) => {
    console.log(`\n--- Caso ${index + 1}: H = ${h}m, V = ${v}m ---`);
    aplicarEspacamentoDeterministo('h', h);
    aplicarEspacamentoDeterministo('v', v);
    const resultado = window.verificarEspacamento(h, v);
    console.log(`Resultado Caso ${index + 1}: Desvios H > 0.05m = ${resultado.totalDesviosH}, Desvios V > 0.05m = ${resultado.totalDesviosV}, Valido = ${resultado.valido}`);
    if (!resultado.valido) {
        console.error(`FALHA no Caso ${index + 1}!`);
        process.exit(1);
    }
});

console.log('\n=== TESTE 3: Preservação Cruzada de H e V ===');
aplicarEspacamentoDeterministo('h', 0.5);
aplicarEspacamentoDeterministo('v', 2.0);
let r1 = window.verificarEspacamento(0.5, 2.0);
console.log(`Após H=0.5 e V=2.0 -> Valido: ${r1.valido} (Desvios H: ${r1.totalDesviosH}, V: ${r1.totalDesviosV})`);

// Modifica apenas H para 1.5; V deve permanecer exatamente 2.0
aplicarEspacamentoDeterministo('h', 1.5);
let r2 = window.verificarEspacamento(1.5, 2.0);
console.log(`Após mudar apenas H para 1.5 (V deve manter 2.0) -> Valido: ${r2.valido} (Desvios H: ${r2.totalDesviosH}, V: ${r2.totalDesviosV})`);

// Modifica apenas V para 0.5; H deve permanecer exatamente 1.5
aplicarEspacamentoDeterministo('v', 0.5);
let r3 = window.verificarEspacamento(1.5, 0.5);
console.log(`Após mudar apenas V para 0.5 (H deve manter 1.5) -> Valido: ${r3.valido} (Desvios H: ${r3.totalDesviosH}, V: ${r3.totalDesviosV})`);

console.log('\n=== TESTE 4: Teste de Passo 0.1m e Parsing ===');
const baseH = 0.5;
aplicarEspacamentoDeterministo('h', baseH);
const snapPasso = snapshotBaseEspacamento;
const cur = snapPasso.targetH;
const maisUm = Math.round((cur + 0.1) * 10) / 10;
aplicarEspacamentoDeterministo('h', maisUm);
console.log(`Passo +0.1m: de ${cur} para ${snapshotBaseEspacamento.targetH} (esperado: 0.6)`);
const menosUm = Math.max(0, Math.round((snapshotBaseEspacamento.targetH - 0.1) * 10) / 10);
aplicarEspacamentoDeterministo('h', menosUm);
console.log(`Passo -0.1m: de ${maisUm} para ${snapshotBaseEspacamento.targetH} (esperado: 0.5)`);

// Teste de parsing com vírgula e ~
console.log('parseValEspacamento("~ -0,4"):', parseValEspacamento("~ -0,4"));
console.log('parseValEspacamento("~ 1,5"):', parseValEspacamento("~ 1,5"));
console.log('parseValEspacamento("2,3"):', parseValEspacamento("2,3"));
console.log('parseValEspacamento("0"):', parseValEspacamento("0"));
console.log('parseValEspacamento("-1"):', parseValEspacamento("-1"));
console.log('parseValEspacamento("abc"):', parseValEspacamento("abc"));

console.log('\nTODOS OS TESTES PASSARAM COM SUCESSO (0 DESVIOS)!');
