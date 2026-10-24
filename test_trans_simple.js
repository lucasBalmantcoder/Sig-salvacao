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

eval(extractFunction('centroide'));
eval(extractFunction('aplicarTranslacaoMetros'));

const pA = { x: -6000000, y: -200000 };
const ring = [
    [pA.x - 4, pA.y - 8],
    [pA.x + 4, pA.y - 8],
    [pA.x + 4, pA.y + 8],
    [pA.x - 4, pA.y + 8],
    [pA.x - 4, pA.y - 8]
].map(pt => {
    const ll = L.CRS.EPSG3857.unproject(L.point(pt[0], pt[1]));
    return [ll.lng, ll.lat];
});

console.log('Original ring:');
const c0 = centroide(ring);
const p0 = L.CRS.EPSG3857.project(L.latLng(c0[1], c0[0]));
console.log('Original centroid projected:', p0);

const ringTrans = aplicarTranslacaoMetros(ring, 20.0, 10.0);
const c1 = centroide(ringTrans);
const p1 = L.CRS.EPSG3857.project(L.latLng(c1[1], c1[0]));
console.log('Translated centroid projected:', p1);

console.log('ring coords:', ring);
console.log('c0:', c0);
console.log('ringTrans coords:', ringTrans);
console.log('c1:', c1);
for (let i = 0; i < ring.length; i++) {
    const p_orig = L.CRS.EPSG3857.project(L.latLng(ring[i][1], ring[i][0]));
    const p_trans = L.CRS.EPSG3857.project(L.latLng(ringTrans[i][1], ringTrans[i][0]));
    console.log(`Point ${i}: dx = ${p_trans.x - p_orig.x}, dy = ${p_trans.y - p_orig.y}`);
}
