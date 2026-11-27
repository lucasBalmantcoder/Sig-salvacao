import { $, CHAVE_LS_NUM } from "./config.js";
import { E, S, st } from "./state.js";
import { centroide } from "./geometry.js";

// ============ Numeração das Casas em Canvas (v1.3.3) ============
export function ocultarNumeracaoCanvas() {
    const canvas = $("canvasNumeracao");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
}

// Obtém os vértices exatos do polígono atualmente desenhado pelo Leaflet na tela
export function obterVerticesPoligonoRenderizado(f) {
    const layer = S.mapaCamadasCasas.get(f.properties.id);
    if (layer && typeof layer.getLatLngs === "function") {
        const lls = layer.getLatLngs();
        const ring = Array.isArray(lls[0]) ? lls[0] : lls;
        if (ring && ring.length >= 3) {
            // Descarta o último vértice se for cópia do primeiro
            const n = (ring.length > 3 && ring[0].lat === ring[ring.length - 1].lat && ring[0].lng === ring[ring.length - 1].lng)
                ? ring.length - 1
                : ring.length;
            return ring.slice(0, n);
        }
    }
    const anel = (E.posicao === "uniforme" && f.properties._anelUni) ? f.properties._anelUni : f.geometry.coordinates[0];
    if (!anel || anel.length < 3) return null;
    const n = (anel.length > 3 && anel[0][0] === anel[anel.length - 1][0] && anel[0][1] === anel[anel.length - 1][1])
        ? anel.length - 1
        : anel.length;
    const arr = [];
    for (let i = 0; i < n; i++) {
        arr.push(L.latLng(anel[i][1], anel[i][0]));
    }
    return arr;
}

// Calcula o centróide exato do polígono em pixels de tela
export function calcularCentroPoligonoPixels(f) {
    const vertices = obterVerticesPoligonoRenderizado(f);
    if (!vertices || vertices.length < 3) return null;
    const pts = vertices.map((ll) => S.map.latLngToContainerPoint(ll));
    const n = pts.length;
    return {
        x: pts.reduce((s, p) => s + p.x, 0) / n,
        y: pts.reduce((s, p) => s + p.y, 0) / n,
        pts,
        vertices
    };
}

export function desenharNumeracaoCasas() {
    const canvas = $("canvasNumeracao");
    if (!canvas) return;
    const mapEl = S.map.getContainer();
    const w = mapEl.clientWidth;
    const h = mapEl.clientHeight;
    if (!w || !h) return;

    const topLeft = S.map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(canvas, topLeft);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";

    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext("2d");
    // Limpeza total do buffer físico para evitar qualquer fantasma ou duplicidade
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    if (!E.numeracaoCasas) return;
    const zoom = S.map.getZoom();
    if (zoom < 18) return; // Legível apenas em zoom >= 18

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const isDark = S.temaEscuro;
    const textColor = isDark ? "#ffffff" : "#111827";
    const strokeColor = isDark ? "rgba(0,0,0,0.92)" : "rgba(255,255,255,0.96)";

    const bounds = S.map.getBounds();
    const rotulosDesenhados = [];

    for (const f of E.casas) {
        const num = f.properties.numero;
        if (!num) continue;

        const geo = calcularCentroPoligonoPixels(f);
        if (!geo) continue;

        const { x: cx, y: cy, pts, vertices } = geo;

        // Se o centroide ou todos os vértices estiverem fora dos limites da tela, descarta
        if (cx < -40 || cx > w + 40 || cy < -40 || cy > h + 40) continue;
        if (!vertices.some((ll) => bounds.contains(ll))) continue;

        // Dimensões do lote projetadas na tela
        let menorLado = Infinity;
        for (let i = 0; i < pts.length; i++) {
            const p1 = pts[i];
            const p2 = pts[(i + 1) % pts.length];
            const lado = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            if (lado < menorLado) menorLado = lado;
        }

        // Se o lote for menor que 13 pixels na tela, oculta o rótulo para não poluir
        if (menorLado < 13) continue;

        // Ajusta a fonte dinamicamente à largura do polígono com margem interna
        let fontSize = Math.max(8, Math.min(13, Math.round(menorLado * 0.44)));
        ctx.font = `bold ${fontSize}px 'JetBrains Mono', monospace`;
        let metrics = ctx.measureText(num);

        // Se o texto for mais largo que 86% da menor dimensão do lote, reduz a fonte
        if (metrics.width > menorLado * 0.86 && fontSize > 8) {
            fontSize = 8;
            ctx.font = `bold ${fontSize}px 'JetBrains Mono', monospace`;
            metrics = ctx.measureText(num);
        }

        // Se mesmo com a menor fonte não couber dentro do lote, oculta para não sobrepor
        if (metrics.width > menorLado * 0.90) {
            continue;
        }

        // Detecção de colisão com rótulos já desenhados na mesma tela
        const halfW = metrics.width / 2 + 1.5;
        const halfH = fontSize / 2 + 1.5;
        let colide = false;
        for (const r of rotulosDesenhados) {
            if (Math.abs(cx - r.cx) < (halfW + r.halfW) && Math.abs(cy - r.cy) < (halfH + r.halfH)) {
                colide = true;
                break;
            }
        }
        if (colide) continue;

        rotulosDesenhados.push({ cx, cy, halfW, halfH });

        // Desenha o número no centro geométrico exato do polígono
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = strokeColor;
        ctx.strokeText(num, cx, cy);
        ctx.fillStyle = textColor;
        ctx.fillText(num, cx, cy);
    }
}

export function alternarNumeracaoCasas() {
    E.numeracaoCasas = !E.numeracaoCasas;
    localStorage.setItem("sig_salvacao_numeracao_casas", String(E.numeracaoCasas));
    desenharNumeracaoCasas();
    st(`Numeração das casas <b>${E.numeracaoCasas ? "ativada" : "desativada"}</b>.`);
}

// ============ Verificação Obrigatória da Numeração (Console) ============
window.verificarNumeracao = function () {
    if (!E.casas || !E.casas.length) {
        return { totalVisiveis: 0, desviosMaior1Px: 0, maxDesvio: 0, conforme: true };
    }
    const bounds = S.map.getBounds();
    let totalVisiveis = 0;
    let desviosMaior1Px = 0;
    let maxDesvio = 0;
    const desviosLista = [];

    for (const f of E.casas) {
        const geo = calcularCentroPoligonoPixels(f);
        if (!geo) continue;
        const { x: cx, y: cy, vertices } = geo;
        if (!vertices.some((ll) => bounds.contains(ll))) continue;

        totalVisiveis++;

        // Calcula o centroide dos vértices em pixels
        const pts = vertices.map((ll) => S.map.latLngToContainerPoint(ll));
        const polyCx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
        const polyCy = pts.reduce((s, p) => s + p.y, 0) / pts.length;

        // Desvio entre a posição do rótulo e o centroide do polígono
        const desvio = Math.hypot(cx - polyCx, cy - polyCy);
        if (desvio > maxDesvio) maxDesvio = desvio;

        if (desvio > 1.0) {
            desviosMaior1Px++;
            desviosLista.push({
                id: f.properties.id,
                numero: f.properties.numero,
                desvio: Number(desvio.toFixed(4)),
                polyCenter: [Number(polyCx.toFixed(2)), Number(polyCy.toFixed(2))],
                labelCenter: [Number(cx.toFixed(2)), Number(cy.toFixed(2))]
            });
        }
    }

    const relatorio = {
        versao: APP_VERSION,
        zoom: S.map.getZoom(),
        modo: E.modoEdicao ? "Edição" : "Visualização",
        posicao: E.posicao,
        totalVisiveis,
        desviosMaior1Px,
        maxDesvioPx: Number(maxDesvio.toFixed(4)),
        conforme: desviosMaior1Px === 0,
        amostraInconformes: desviosLista.slice(0, 5)
    };

    console.log("[SIG Salvação] Verificação de Numeração:", relatorio);
    return relatorio;
};
