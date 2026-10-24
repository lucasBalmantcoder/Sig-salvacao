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

function centroideExato(anel) {
    const n = Math.min(4, anel.length - 1 > 0 ? anel.length - 1 : anel.length);
    let sx = 0, sy = 0;
    for (let i = 0; i < n; i++) {
        const p = L.CRS.EPSG3857.project(L.latLng(anel[i][1], anel[i][0]));
        sx += p.x;
        sy += p.y;
    }
    return { x: sx / n, y: sy / n };
}

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

function aplicarTranslacaoMetros(anel, dx, dy) {
    return anel.map((pt) => {
        const p = L.CRS.EPSG3857.project(L.latLng(pt[1], pt[0]));
        p.x += dx;
        p.y += dy;
        const ll = L.CRS.EPSG3857.unproject(p);
        return [Number(ll.lng.toFixed(7)), Number(ll.lat.toFixed(7))];
    });
}

const c0 = centroideExato(ring);
const ringTrans = aplicarTranslacaoMetros(ring, 20.0, 10.0);
const c1 = centroideExato(ringTrans);

console.log('c0:', c0);
console.log('c1:', c1);
console.log('dx:', c1.x - c0.x, 'expected: 20.0');
console.log('dy:', c1.y - c0.y, 'expected: 10.0');

