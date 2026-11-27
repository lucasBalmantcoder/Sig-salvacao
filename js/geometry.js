export function centroide(ring) {
    let x = 0,
        y = 0,
        a = 0;
    for (
        let i = 0, j = ring.length - 2;
        i < ring.length - 1;
        j = i++
    ) {
        const [x0, y0] = ring[j],
            [x1, y1] = ring[i];
        const f = x0 * y1 - x1 * y0;
        a += f;
        x += (x0 + x1) * f;
        y += (y0 + y1) * f;
    }
    if (Math.abs(a) < 1e-14) {
        const n = ring.length - 1;
        return [
            ring.slice(0, n).reduce((s, p) => s + p[0], 0) / n,
            ring.slice(0, n).reduce((s, p) => s + p[1], 0) / n,
        ];
    }
    a *= 3;
    return [x / a, y / a];
}
// Casco convexo (Andrew monotone chain) para o contorno do quarteirão
export function casco(pts) {
    const p = [...pts].sort(
        (a, b) => a[0] - b[0] || a[1] - b[1],
    );
    if (p.length < 3) return p;
    const cruz = (o, a, b) =>
        (a[0] - o[0]) * (b[1] - o[1]) -
        (a[1] - o[1]) * (b[0] - o[0]);
    const meio = (arr) => {
        const h = [];
        for (const q of arr) {
            while (
                h.length >= 2 &&
                cruz(h[h.length - 2], h[h.length - 1], q) <= 0
            )
                h.pop();
            h.push(q);
        }
        return h;
    };
    const inf = meio(p),
        sup = meio([...p].reverse());
    return [...inf.slice(0, -1), ...sup.slice(0, -1)];
}

export function gerarLotePadronizado(anelCoords, larguraM, profundidadeM) {
    if (!anelCoords || anelCoords.length < 4) return anelCoords;
    const ptsM = [];
    for (let i = 0; i < Math.min(4, anelCoords.length); i++) {
        const p = L.CRS.EPSG3857.project(L.latLng(anelCoords[i][1], anelCoords[i][0]));
        ptsM.push(p);
    }
    const cx = (ptsM[0].x + ptsM[1].x + ptsM[2].x + ptsM[3].x) / 4;
    const cy = (ptsM[0].y + ptsM[1].y + ptsM[2].y + ptsM[3].y) / 4;

    // Vetor do bordo frontal (largura)
    let vx = ptsM[1].x - ptsM[0].x;
    let vy = ptsM[1].y - ptsM[0].y;
    let lenV = Math.hypot(vx, vy);
    let ux = 1, uy = 0;
    if (lenV > 0.001) {
        ux = vx / lenV;
        uy = vy / lenV;
    }

    // Vetor do bordo lateral (profundidade)
    let sx = ptsM[2].x - ptsM[1].x;
    let sy = ptsM[2].y - ptsM[1].y;
    let lenS = Math.hypot(sx, sy);
    let nx = -uy, ny = ux;
    if (lenS > 0.001) {
        nx = sx / lenS;
        ny = sy / lenS;
    }

    const hw = larguraM / 2;
    const hd = profundidadeM / 2;
    const cantos = [
        { x: cx - hw * ux - hd * nx, y: cy - hw * uy - hd * ny },
        { x: cx + hw * ux - hd * nx, y: cy + hw * uy - hd * ny },
        { x: cx + hw * ux + hd * nx, y: cy + hw * uy + hd * ny },
        { x: cx - hw * ux + hd * nx, y: cy - hw * uy + hd * ny },
    ];
    cantos.push(cantos[0]);
    return cantos.map((pt) => {
        const ll = L.CRS.EPSG3857.unproject(L.point(pt.x, pt.y));
        return [Number(ll.lng.toFixed(7)), Number(ll.lat.toFixed(7))];
    });
}

// Transformações em metros projetados (EPSG:3857) - sem deformações
export function aplicarTranslacaoMetros(anel, dx, dy) {
    return anel.map((pt) => {
        const p = L.CRS.EPSG3857.project(L.latLng(pt[1], pt[0]));
        p.x += dx;
        p.y += dy;
        const ll = L.CRS.EPSG3857.unproject(p);
        return [Number(ll.lng.toFixed(7)), Number(ll.lat.toFixed(7))];
    });
}

export function aplicarRotacaoMetros(anel, centroMetros, radianos) {
    const cos = Math.cos(radianos);
    const sin = Math.sin(radianos);
    return anel.map((pt) => {
        const p = L.CRS.EPSG3857.project(L.latLng(pt[1], pt[0]));
        const rx = p.x - centroMetros.x;
        const ry = p.y - centroMetros.y;
        const nx = centroMetros.x + rx * cos - ry * sin;
        const ny = centroMetros.y + rx * sin + ry * cos;
        const ll = L.CRS.EPSG3857.unproject(L.point(nx, ny));
        return [Number(ll.lng.toFixed(7)), Number(ll.lat.toFixed(7))];
    });
}

export function centroideMetrosLote(anel) {
    if (!anel || !anel.length) return { x: 0, y: 0 };
    const n = Math.min(4, anel.length > 4 ? 4 : (anel.length - 1 || 1));
    let sx = 0, sy = 0;
    for (let i = 0; i < n; i++) {
        const p = L.CRS.EPSG3857.project(L.latLng(anel[i][1], anel[i][0]));
        sx += p.x;
        sy += p.y;
    }
    return { x: sx / n, y: sy / n };
}

export function calcularCentroideMetros(features) {
    let totalX = 0, totalY = 0, totalPts = 0;
    for (const f of features) {
        const anel = f.properties._anelUni;
        for (let i = 0; i < anel.length - 1; i++) {
            const p = L.CRS.EPSG3857.project(L.latLng(anel[i][1], anel[i][0]));
            totalX += p.x;
            totalY += p.y;
            totalPts++;
        }
    }
    if (totalPts === 0) return { x: 0, y: 0 };
    return { x: totalX / totalPts, y: totalY / totalPts };
}

export function calcularEixoPrincipalSelecao(features) {
    if (!features || features.length < 2) return 0;
    const pts = features.map((f) => centroideMetrosLote(f.properties._anelUni));
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

