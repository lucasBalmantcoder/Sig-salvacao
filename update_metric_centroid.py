with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Define centroideMetrosLote before calcularCentroideMetros
old_def = """                function calcularCentroideMetros(features) {"""

new_def = """                function centroideMetrosLote(anel) {
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

                function calcularCentroideMetros(features) {"""

assert old_def in content, "old_def not found"
content = content.replace(old_def, new_def, 1)

# 2. Update calcularEixoPrincipalSelecao
old_eixo = """                // Ajuste de reta / PCA das posições para encontrar o eixo principal da seleção
                function calcularEixoPrincipalSelecao(features) {
                    if (!features || features.length < 2) return 0;
                    const pts = features.map((f) => {
                        const c = centroide(f.properties._anelUni);
                        return L.CRS.EPSG3857.project(L.latLng(c[1], c[0]));
                    });"""

new_eixo = """                // Ajuste de reta / PCA das posições para encontrar o eixo principal da seleção
                function calcularEixoPrincipalSelecao(features) {
                    if (!features || features.length < 2) return 0;
                    const pts = features.map((f) => centroideMetrosLote(f.properties._anelUni));"""

assert old_eixo in content, "old_eixo not found"
content = content.replace(old_eixo, new_eixo, 1)

# 3. Update prepararSnapshotEspacamento
old_snap_item = """                    // Projeção dos centros de cada lote no sistema coordenado da fileira (u, n)
                    const itens = feats.map((f) => {
                        const c = centroide(f.properties._anelUni);
                        const pM = L.CRS.EPSG3857.project(L.latLng(c[1], c[0]));
                        const t = (pM.x - centroMetros.x) * ux + (pM.y - centroMetros.y) * uy;
                        const d = (pM.x - centroMetros.x) * nx + (pM.y - centroMetros.y) * ny;"""

new_snap_item = """                    // Projeção dos centros métricos exatos de cada lote no sistema coordenado da fileira (u, n)
                    const itens = feats.map((f) => {
                        const pM = centroideMetrosLote(f.properties._anelUni);
                        const t = (pM.x - centroMetros.x) * ux + (pM.y - centroMetros.y) * uy;
                        const d = (pM.x - centroMetros.x) * nx + (pM.y - centroMetros.y) * ny;"""

assert old_snap_item in content, "old_snap_item not found"
content = content.replace(old_snap_item, new_snap_item, 1)

# 4. Update window.verificarEspacamento
old_verif_h = """                        for (let k = 0; k < fil.length - 1; k++) {
                            const c1 = centroide(fil[k].f.properties._anelUni);
                            const c2 = centroide(fil[k + 1].f.properties._anelUni);
                            const p1 = L.CRS.EPSG3857.project(L.latLng(c1[1], c1[0]));
                            const p2 = L.CRS.EPSG3857.project(L.latLng(c2[1], c2[0]));
                            const distBordas = ((p2.x - p1.x) * snap.ux + (p2.y - p1.y) * snap.uy) - PADRAO_LARGURA_M;"""

new_verif_h = """                        for (let k = 0; k < fil.length - 1; k++) {
                            const p1 = centroideMetrosLote(fil[k].f.properties._anelUni);
                            const p2 = centroideMetrosLote(fil[k + 1].f.properties._anelUni);
                            const distBordas = ((p2.x - p1.x) * snap.ux + (p2.y - p1.y) * snap.uy) - PADRAO_LARGURA_M;"""

assert old_verif_h in content, "old_verif_h not found"
content = content.replace(old_verif_h, new_verif_h, 1)

old_verif_v = """            const d1 = fil1.reduce((s, it) => {
                                const c = centroide(it.f.properties._anelUni);
                                const p = L.CRS.EPSG3857.project(L.latLng(c[1], c[0]));
                                return s + ((p.x - snap.centroMetros.x) * snap.nx + (p.y - snap.centroMetros.y) * snap.ny);
                            }, 0) / fil1.length;
                            const d2 = fil2.reduce((s, it) => {
                                const c = centroide(it.f.properties._anelUni);
                                const p = L.CRS.EPSG3857.project(L.latLng(c[1], c[0]));
                                return s + ((p.x - snap.centroMetros.x) * snap.nx + (p.y - snap.centroMetros.y) * snap.ny);
                            }, 0) / fil2.length;"""

new_verif_v = """            const d1 = fil1.reduce((s, it) => {
                                const p = centroideMetrosLote(it.f.properties._anelUni);
                                return s + ((p.x - snap.centroMetros.x) * snap.nx + (p.y - snap.centroMetros.y) * snap.ny);
                            }, 0) / fil1.length;
                            const d2 = fil2.reduce((s, it) => {
                                const p = centroideMetrosLote(it.f.properties._anelUni);
                                return s + ((p.x - snap.centroMetros.x) * snap.nx + (p.y - snap.centroMetros.y) * snap.ny);
                            }, 0) / fil2.length;"""

assert old_verif_v in content, "old_verif_v not found"
content = content.replace(old_verif_v, new_verif_v, 1)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated index.html with centroideMetrosLote successfully!")

