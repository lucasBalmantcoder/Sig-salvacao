const fs = require('fs');

const gj = JSON.parse(fs.readFileSync('dados/casas_salvacao.geojson', 'utf8'));

// Leaflet CRS EPSG:3857 projection logic
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
    // If closed ring with last == first, exclude last
    if (n > 1 && anel[0][0] === anel[n-1][0] && anel[0][1] === anel[n-1][1]) n--;
    for (let i = 0; i < n; i++) {
        sx += anel[i][0];
        sy += anel[i][1];
    }
    return [sx / n, sy / n];
}

const targets = new Set();
for (let i = 1012; i <= 1132; i += 10) targets.add(String(i));
for (let i = 2011; i <= 2131; i += 10) targets.add(String(i));

const houses = gj.features.filter(f => targets.has(String(f.properties.numero)));
houses.forEach(f => {
    f.properties._anelUni = f.geometry.coordinates[0];
});

// Centroid
const pts = houses.map(f => {
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

console.log('Theta degrees:', theta * 180 / Math.PI);
console.log('ux, uy:', ux, uy);

const items = houses.map(f => {
    const c = centroide(f.properties._anelUni);
    const pM = project(c[1], c[0]);
    const t = (pM.x - mx) * ux + (pM.y - my) * uy;
    const d = (pM.x - mx) * nx + (pM.y - my) * ny;
    return {
        id: f.properties.id,
        num: f.properties.numero,
        quadra: f.properties.quadra,
        face: f.properties.face,
        t,
        d
    };
});

items.sort((a, b) => a.d - b.d);
console.log('\nSorted by d:');
items.forEach(it => {
    console.log(`Num: ${String(it.num).padEnd(5)} | Face: ${it.face} | d = ${it.d.toFixed(2).padStart(7)} | t = ${it.t.toFixed(2).padStart(7)}`);
});
