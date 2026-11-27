import { $, ICO, MATIZES, NOMES_INDICADORES, PADRAO_LARGURA_M, PADRAO_PROFUNDIDADE_M } from "./config.js";
import { E, S, st } from "./state.js";
import { centroide, casco, gerarLotePadronizado } from "./geometry.js";
import { gerarIndicadoresMock, gerarMoradores, atribuirFichas, abrirMoradores } from "./health-mock.js";
import { desenharNumeracaoCasas } from "./numbering.js";
import { carregarAjustesIniciais, atualizarBotoesHistorico } from "./storage.js";
import { aoClicarCasaModoEdicao, aoMousedownCasaModoEdicao, atualizarUIEdicao } from "./editor.js";

export function initMap() {
    S.map = L.map("map", {
        preferCanvas: true,
        zoomControl: false,
        minZoom: 13,
        maxZoom: 20,
    }).setView([-2.46, -54.7625], 15);
    L.control.zoom({ position: "bottomright" }).addTo(S.map);
    L.control.scale({ imperial: false, position: "bottomright" }).addTo(S.map);

    const numeracaoPane = S.map.createPane("numeracaoPane");
    numeracaoPane.style.zIndex = "450";
    numeracaoPane.style.pointerEvents = "none";
    const canvasNumEl = $("canvasNumeracao");
    if (canvasNumEl) {
        numeracaoPane.appendChild(canvasNumEl);
    }

    S.cSelecaoOverlay = L.layerGroup().addTo(S.map);
    S.cPreviewOverlay = L.layerGroup().addTo(S.map);
    trocarBase("sat");
}


export function aplicarTema() {
    document.documentElement.dataset.theme = S.temaEscuro
        ? "dark"
        : "light";
    $("icoTema").innerHTML = S.temaEscuro ? ICO.sol : ICO.lua;
    if (typeof trocarBase === "function") trocarBase(S.baseAtual);
    // redesenha as camadas: rótulos, contornos e pontos carregam cores fixas do tema
    if (typeof desenhar === "function" && S.cCasas) {
        const sel = E.selec;
        desenhar();
        desenharLegenda();
        desenharLista();
        E.selec = sel;
        pintar();
    }
}

const BASES = {
    sat: () =>
        L.tileLayer(
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            {
                maxZoom: 20,
                maxNativeZoom: 17,
                attribution:
                    "Imagens Esri, Maxar, Earthstar Geographics",
            },
        ),
    ruas: () =>
        L.tileLayer(
            "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            {
                maxZoom: 20,
                maxNativeZoom: 18,
                attribution: "&copy; OpenStreetMap",
            },
        ),
    limpo: () =>
        L.tileLayer(
            `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_${S.temaEscuro ? "Dark" : "Light"}_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
            {
                maxZoom: 20,
                maxNativeZoom: 16,
                attribution:
                    "Esri, HERE, Garmin, &copy; OpenStreetMap",
            },
        ),
};
export function trocarBase(v) {
    S.baseAtual = v;
    if (S.camadaBase) S.map.removeLayer(S.camadaBase);
    S.camadaBase = BASES[v]().addTo(S.map);
    S.camadaBase.bringToBack();
}

const cor = (i, l, c) =>
    `oklch(${l}% ${c} ${MATIZES[i % MATIZES.length]})`;
const corQuadra = (i) => cor(i, S.temaEscuro ? 66 : 58, 0.155);
const COR_OUTROS = () =>
    S.temaEscuro ? "oklch(72% .015 160)" : "oklch(52% .012 160)";
const traco = () =>
    S.temaEscuro
        ? "oklch(14% .01 160/.85)"
        : "oklch(20% .015 160/.7)";

/* ============ Carregar dados ============ */
export function carregar() {
    fetch("dados/casas_salvacao.geojson")
        .then((r) => {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
        })
        .then((gj) => {
            montar(gj);
        })
        .catch((err) => {
            $("carregando").innerHTML =
                `<div class="miolo"><p class="nota" style="max-width:40ch;text-align:center">
            Não foi possível carregar <b>dados/casas_salvacao.geojson</b>.<br>${err.message}
          </p></div>`;
        });
}

export function montar(gj) {
    E.dados = gj;
    E.casas = gj.features.filter(
        (f) => f.properties.tipo === "domicilio",
    );
    // Prepara geometrias padronizadas e preserva atributos intactos do IBGE
    for (const f of E.casas) {
        const anelIBGE = f.geometry.coordinates[0];
        f.properties._anelRealOrig = JSON.parse(JSON.stringify(anelIBGE));
        f.properties._anelReal = JSON.parse(JSON.stringify(anelIBGE));
        const anelBase = f.properties.anel_uniforme || anelIBGE;
        const anelStd = gerarLotePadronizado(anelBase, PADRAO_LARGURA_M, PADRAO_PROFUNDIDADE_M);
        f.properties._anelUni = anelStd;
        f.properties._anelUniBase = JSON.parse(JSON.stringify(anelStd));
        // Inicializa na visualização padrão ("Lotes iguais")
        f.geometry.coordinates = [anelStd];
        S.mapaCasasPorId.set(f.properties.id, f);
    }
    E.outros = gj.features.filter(
        (f) => f.properties.tipo !== "domicilio",
    );
    for (const f of E.casas) {
        const moradores = gerarMoradores(f);
        f.properties.indicadores_mock = gerarIndicadoresMock(
            f,
            moradores,
        );
        atribuirFichas(f, moradores);
        f.properties._moradoresCache = moradores;
    }

    // agrupa por quadra
    const mapaQ = new Map();
    for (const f of E.casas) {
        const p = f.properties,
            k = `${p.setor}|${p.quadra}`;
        if (!mapaQ.has(k))
            mapaQ.set(k, {
                chave: k,
                setor: p.setor,
                quadra: p.quadra,
                casas: [],
                faces: new Map(),
                ruas: new Map(),
            });
        const q = mapaQ.get(k);
        q.casas.push(f);
        if (!q.faces.has(p.face)) q.faces.set(p.face, []);
        q.faces.get(p.face).push(f);
        q.ruas.set(p.rua, (q.ruas.get(p.rua) || 0) + 1);
        p._c = centroide(f.geometry.coordinates[0]);
    }
    E.quadras = [...mapaQ.values()];
    // ordena de norte para sul, depois oeste para leste (leitura natural do bairro)
    E.quadras.forEach((q) => {
        const cs = q.casas.map((f) => f.properties._c);
        q.lng = cs.reduce((s, c) => s + c[0], 0) / cs.length;
        q.lat = cs.reduce((s, c) => s + c[1], 0) / cs.length;
        q.ruaPrinc = [...q.ruas.entries()].sort(
            (a, b) => b[1] - a[1],
        )[0][0];
        q.contorno = casco(
            q.casas.flatMap((f) =>
                f.geometry.coordinates[0].slice(0, -1),
            ),
        );
    });
    E.quadras.sort((a, b) => b.lat - a.lat || a.lng - b.lng);
    E.quadras.forEach((q, i) => {
        q.idx = i;
        q.nome = `Q${String(i + 1).padStart(2, "0")}`;
        q.casas.forEach((f) => {
            f.properties._qi = i;
            f.properties._qn = q.nome;
        });
    });

    // faces e ruas globais
    const setFaces = new Set(
        E.casas.map(
            (f) =>
                `${f.properties.setor}|${f.properties.quadra}|${f.properties.face}`,
        ),
    );
    E.ruas = [
        ...new Set(E.casas.map((f) => f.properties.rua)),
    ].sort((a, b) => a.localeCompare(b, "pt-BR"));
    E.ruaIdx = new Map(E.ruas.map((r, i) => [r, i]));

    $("kpiCasas").textContent =
        E.casas.length.toLocaleString("pt-BR");
    $("kpiQuadras").textContent = E.quadras.length;
    $("kpiFaces").textContent = setFaces.size;
    $("kpiOutros").textContent = E.outros.length;

    preencherRuas();
    desenharLista();
    desenharLegenda();
    desenhar();
    S.map.fitBounds(S.cCasas.getBounds(), { padding: [26, 26] });
    $("carregando").remove();
    st(
        `<b>${E.casas.length.toLocaleString("pt-BR")}</b> casas desenhadas em <b>${E.quadras.length}</b> quarteirões e ${setFaces.size} faces — nenhum domicílio ficou de fora.`,
    );
    carregarAjustesIniciais();
}

/* ============ Cores por critério ============ */
export function indiceCor(p) {
    if (E.criterio === "quadra") return p._qi;
    if (E.criterio === "face") return p._qi * 2 + (p.face - 1);
    return E.ruaIdx.get(p.rua) || 0;
}
export function estilo(f) {
    const p = f.properties;
    if (E.modoEdicao) {
        const estaSel = E.selecionadas.has(p.id);
        const temAjuste = !!(E.ajustes && E.ajustes[p.id]);
        if (estaSel) {
            return {
                color: "#00d2ff",
                weight: 2.4,
                opacity: 1,
                fillColor: "#00d2ff",
                fillOpacity: 0.75,
            };
        }
        if (temAjuste) {
            return {
                color: "#ff9800",
                weight: 1.6,
                opacity: 0.95,
                fillColor: corQuadra(indiceCor(p)),
                fillOpacity: E.opac,
            };
        }
    }
    const selecionada = E.selec === null || p._qi === E.selec;
    // Modo indicador: só as casas com o indicador ficam coloridas; as demais ficam apagadas
    if (E.indicador) {
        const tem = (p.indicadores_mock || []).includes(
            E.indicador.nome,
        );
        if (tem)
            return {
                color: E.indicador.cor,
                weight: 1.2,
                opacity: selecionada ? 1 : 0.3,
                fillColor: E.indicador.cor,
                fillOpacity: selecionada ? 0.95 : 0.25,
            };
        return {
            color: "#cccccc",
            weight: 0.5,
            opacity: selecionada ? 0.5 : 0.15,
            fillColor: "#e0e0e0",
            fillOpacity: selecionada ? 0.25 : 0.05,
        };
    }
    return {
        color: traco(),
        weight: 0.7,
        opacity: selecionada ? 0.85 : 0.2,
        fillColor: corQuadra(indiceCor(p)),
        fillOpacity: selecionada ? E.opac : E.opac * 0.16,
    };
}

export function marcarBotaoIndicador(nome) {
    document
        .querySelectorAll(".btn-indicador[data-ind]")
        .forEach((b) =>
            b.classList.toggle("ativo", b.dataset.ind === nome),
        );
}

// Chamada pelos botões do menu (onclick no HTML) — por isso é exposta em window
window.aplicarIndicador = function (nome, cor) {
    if (!S.cCasas) return; // mapa ainda não carregou
    // clicar de novo no mesmo indicador desliga o filtro
    if (E.indicador && E.indicador.nome === nome) {
        window.limparIndicadores();
        return;
    }
    E.indicador = { nome, cor };
    marcarBotaoIndicador(nome);
    pintar();
    // casas destacadas por cima das apagadas
    S.cCasas.eachLayer((l) => {
        if (
            (
                l.feature.properties.indicadores_mock || []
            ).includes(nome)
        )
            l.bringToFront();
    });
    const n = E.casas.filter((f) =>
        f.properties.indicadores_mock.includes(nome),
    ).length;
    st(
        `<b>${NOMES_INDICADORES[nome]}</b> — <b>${n}</b> casas com este indicador (dados fictícios de protótipo).`,
    );
};

window.limparIndicadores = function () {
    E.indicador = null;
    marcarBotaoIndicador(null);
    pintar();
    st(
        `<b>${E.casas.length.toLocaleString("pt-BR")}</b> casas em ${E.quadras.length} quarteirões.`,
    );
};

/* ============ Desenho ============ */
export function desenhar() {
    [
        S.cCasas,
        S.cPontos,
        S.cOutros,
        S.cContorno,
        S.cRotulos,
        S.cRealce,
    ].forEach((c) => c && S.map.removeLayer(c));

    S.cCasas = L.geoJSON(
        { type: "FeatureCollection", features: E.casas },
        {
            style: estilo,
            onEachFeature: (f, l) => {
                S.mapaCamadasCasas.set(f.properties.id, l);
                l.bindPopup(popupCasa(f.properties), {
                    closeButton: true,
                    maxWidth: 300,
                });
                l.on("mouseover", () => {
                    if (S.segurandoEspaco || S.panMeioAtivo) return;
                    if (!E.modoEdicao) {
                        l.setStyle({
                            weight: 2,
                            color: S.temaEscuro ? "#fff" : "#111",
                        });
                    }
                });
                l.on("mouseout", () => {
                    if (S.segurandoEspaco || S.panMeioAtivo) return;
                    if (!E.modoEdicao) {
                        l.setStyle(estilo(f));
                    }
                });
                l.on("mousedown", (e) => {
                    if (S.segurandoEspaco || S.panMeioAtivo) return;
                    if (E.modoEdicao && E.ferramentaEdicao === "selecionar" && e.originalEvent && e.originalEvent.button === 0) {
                        L.DomEvent.stopPropagation(e);
                        aoMousedownCasaModoEdicao(f, e);
                    }
                });
                l.on("click", (e) => {
                    if (S.segurandoEspaco || S.panMeioAtivo) return;
                    if (E.modoEdicao) {
                        L.DomEvent.stopPropagation(e);
                        S.map.closePopup();
                        aoClicarCasaModoEdicao(f, e);
                    } else {
                        selecionarCasa(f);
                        if (!l.isPopupOpen()) {
                            l.openPopup(e.latlng || l.getBounds().getCenter());
                        }
                    }
                });
                l.on("popupopen", (e) => {
                    const popEl = e && e.popup ? e.popup.getElement() : null;
                    const btn = popEl
                        ? popEl.querySelector(".btn-ver-moradores")
                        : document.getElementById("btnVerMoradores");
                    if (btn) {
                        btn.onclick = (ev) => {
                            if (ev) ev.stopPropagation();
                            S.map.closePopup();
                            abrirMoradores(f);
                        };
                    }
                });
            },
        },
    ).addTo(S.map);

    S.cPontos = L.geoJSON(
        {
            type: "FeatureCollection",
            features: E.casas.map((f) => ({
                type: "Feature",
                properties: f.properties,
                geometry: {
                    type: "Point",
                    coordinates: [
                        f.properties.lng_original,
                        f.properties.lat_original,
                    ],
                },
            })),
        },
        {
            pointToLayer: (f, ll) =>
                L.circleMarker(ll, {
                    radius: 1.9,
                    color: S.temaEscuro ? "#fff" : "#000",
                    weight: 0,
                    fillOpacity: 0.75,
                    fillColor: S.temaEscuro ? "#fff" : "#000",
                }),
        },
    );

    S.cOutros = L.geoJSON(
        { type: "FeatureCollection", features: E.outros },
        {
            pointToLayer: (f, ll) =>
                L.circleMarker(ll, {
                    radius: 3.6,
                    color: traco(),
                    weight: 0.9,
                    fillColor: COR_OUTROS(),
                    fillOpacity: 0.9,
                }),
            onEachFeature: (f, l) =>
                l.bindPopup(popupOutro(f.properties)),
        },
    );

    S.cContorno = L.layerGroup(
        E.quadras.map((q) =>
            L.polygon(
                q.contorno.map((c) => [c[1], c[0]]),
                {
                    color: corQuadra(q.idx),
                    weight: 1.6,
                    opacity: 0.85,
                    fill: false,
                    dashArray: "5 4",
                    interactive: false,
                },
            ),
        ),
    );

    S.cRotulos = L.layerGroup(
        E.quadras.map((q) =>
            L.marker([q.lat, q.lng], {
                interactive: false,
                icon: L.divIcon({
                    className: "",
                    iconSize: [62, 18],
                    html: `<span style="display:inline-block;transform:translate(-50%,-50%);padding:1px 6px;border-radius:5px;
        font:600 11px/1.4 'JetBrains Mono',monospace;white-space:nowrap;
        background:${S.temaEscuro ? "oklch(20% .015 165/.9)" : "oklch(100% 0 0/.88)"};
        color:var(--ink);border:1px solid var(--border)">${q.nome} · ${q.casas.length}</span>`,
                }),
            }),
        ),
    );

    sincronizarCamadas();
    desenharDestaqueCasa();
    if (typeof desenharNumeracaoCasas === "function") desenharNumeracaoCasas();
}

// Contorno que marca qual casa está sendo consultada no momento. Não muda a
// cor da casa — é só uma borda (halo branco/preto + linha amarela) por cima,
// que fica até outra casa ser clicada. Sobrevive a troca de tema, posição
// (coordenada real/lotes iguais) e critério de cor, porque é redesenhado no
// fim de desenhar() a cada vez.
export function desenharDestaqueCasa() {
    if (S.cDestaqueCasa) {
        S.map.removeLayer(S.cDestaqueCasa);
        S.cDestaqueCasa = null;
    }
    if (!E.casaSelecionadaId) return;
    const f = E.casas.find(
        (c) => c.properties.id === E.casaSelecionadaId,
    );
    if (!f) return;
    const latlngs = f.geometry.coordinates[0].map((c) => [
        c[1],
        c[0],
    ]);
    const halo = L.polygon(latlngs, {
        color: S.temaEscuro ? "#000" : "#fff",
        weight: 6,
        opacity: 0.8,
        fill: false,
        interactive: false,
    });
    const linha = L.polygon(latlngs, {
        color: "#FFD600",
        weight: 2.6,
        opacity: 1,
        fill: false,
        interactive: false,
    });
    S.cDestaqueCasa = L.layerGroup([halo, linha]).addTo(S.map);
}
export function selecionarCasa(f) {
    E.casaSelecionadaId = f.properties.id;
    desenharDestaqueCasa();
}

export function sincronizarCamadas() {
    const p = [
        [S.cCasas, "ckCasas"],
        [S.cPontos, "ckPontos"],
        [S.cOutros, "ckOutros"],
        [S.cContorno, "ckContorno"],
        [S.cRotulos, "ckRotulos"],
    ];
    for (const [c, id] of p) {
        if (!c) continue;
        const on = $(id).checked;
        if (on && !S.map.hasLayer(c)) c.addTo(S.map);
        if (!on && S.map.hasLayer(c)) S.map.removeLayer(c);
    }
    if (
        S.cCasas &&
        S.map.hasLayer(S.cCasas) &&
        S.cPontos &&
        S.map.hasLayer(S.cPontos)
    )
        S.cPontos.bringToFront();
}
export function pintar() {
    if (S.cCasas) S.cCasas.setStyle(estilo);
}

// Troca a geometria entre a coordenada real e os lotes iguais, sem recarregar os dados.
export function aplicarPosicao() {
    const uni = E.posicao === "uniforme";
    for (const f of E.casas) {
        const anel = uni
            ? f.properties._anelUni
            : f.properties._anelRealOrig;
        f.geometry.coordinates = [anel];
        f.properties._c = centroide(anel);
    }
    $("notaPos").innerHTML = uni
        ? "Cada face dividida em lotes de largura igual, no tamanho e alinhamento padronizados."
        : "Cada casa no ponto exato levantado pelo IBGE (apenas para leitura e referência).";
    const selec = E.selec;
    E.quadras.forEach((q) => {
        q.contorno = casco(
            q.casas.flatMap((f) =>
                f.geometry.coordinates[0].slice(0, -1),
            ),
        );
    });
    desenhar();
    if (selec !== null) {
        E.selec = null;
        selecionar(selec);
    }
    st(
        uni
            ? `Visão <b>lotes iguais</b> — as ${E.casas.length.toLocaleString("pt-BR")} casas exibidas com tamanho e espaçamento padronizados.`
            : `Visão <b>coordenada real</b> — ${E.casas.length.toLocaleString("pt-BR")} casas no ponto original do CNEFE/IBGE (apenas leitura).`,
    );
}

/* ============ Popups ============ */
export function popupCasa(p) {
    const q = E.quadras[p._qi];
    return `<div class="pop">
    <h3>${p.rua}${p.numero ? ", " + p.numero : ""}</h3>
    <div class="sub">Domicílio ${p.especie === "2" ? "coletivo" : "particular"} · CEP ${p.cep ? formatarCep(p.cep) : "—"}</div>
    <dl>
      <dt>Quarteirão</dt><dd>${p._qn} <span style="color:var(--ink-3)">(${q.casas.length} casas)</span></dd>
      <dt>Face</dt><dd>${p.face} de ${q.faces.size}</dd>
      <dt>Ordem na face</dt><dd>${p.ordem_na_face} / ${p.casas_na_face}</dd>
      <dt>Lote aprox.</dt><dd>${E.posicao === "uniforme" ? p.largura_uniforme_m : p.largura_m} × ${p.profundidade_m} m</dd>
      <dt>Setor IBGE</dt><dd>…${String(p.setor).slice(-5)}</dd>
      <dt>Quadra IBGE</dt><dd>${p.quadra}</dd>
      <dt>Coordenada</dt><dd>${p.lat_original.toFixed(6)}, ${p.lng_original.toFixed(6)}</dd>
    </dl>
    ${(p.indicadores_mock || []).length ? `<div class="sub" style="margin-top:var(--space-3);margin-bottom:0">Indicadores (fictício): ${p.indicadores_mock.map((i) => NOMES_INDICADORES[i]).join(", ")}</div>` : ""}
    <span class="tag">${
        E.posicao === "uniforme"
            ? "Desenho em lotes iguais ao longo da face"
            : p.coord_ajustada
              ? "Posição ajustada na face (coordenada repetida no cadastro)"
              : "Posição conforme coordenada do CNEFE"
    }</span>
    <button class="btn btn-ver-moradores" id="btnVerMoradores" type="button">
      👪 Ver moradores (${(p._moradoresCache || []).length})
    </button>
  </div>`;
}
export function popupOutro(p) {
    return `<div class="pop">
    <h3>${p.rua || "Endereço não residencial"}</h3>
    <div class="sub">Fora da contagem de domicílios</div>
    <dl>
      <dt>Endereço</dt><dd style="font-family:inherit">${p.endereco || "—"}</dd>
      ${p.estabelecimento ? `<dt>Estabelecimento</dt><dd style="font-family:inherit">${p.estabelecimento}</dd>` : ""}
      <dt>Espécie</dt><dd>${p.especie}</dd>
    </dl></div>`;
}
const formatarCep = (c) =>
    String(c).length === 8
        ? String(c).slice(0, 5) + "-" + String(c).slice(5)
        : c;

/* ============ Legenda ============ */
export function desenharLegenda() {
    const el = $("legenda");
    if (E.criterio === "quadra") {
        el.innerHTML = `
      <div class="rampa">${E.quadras
          .slice(0, 12)
          .map((q, i) => `<i style="background:${corQuadra(i)}"></i>`)
          .join("")}</div>
      <div class="lg">Uma cor por quarteirão (${E.quadras.length} no total, 12 matizes reaproveitados)</div>
      <div class="lg"><span class="sw" style="background:${COR_OUTROS()}"></span>Outros usos</div>`;
    } else if (E.criterio === "face") {
        el.innerHTML = `
      <div class="lg"><span class="sw" style="background:${corQuadra(0)}"></span>Face 1 · <span class="sw" style="background:${corQuadra(1)}"></span>Face 2 do mesmo quarteirão</div>
      <div class="lg">Cada fileira de casas de um lado da rua recebe cor própria.</div>`;
    } else {
        el.innerHTML =
            `<div class="lg">Uma cor por logradouro — ${E.ruas.length} ruas.</div>` +
            E.ruas
                .slice(0, 8)
                .map(
                    (r) =>
                        `<div class="lg"><span class="sw" style="background:${corQuadra(E.ruaIdx.get(r))}"></span>${r.replace(/^(RUA|AVENIDA|TRAVESSA) /, "")}</div>`,
                )
                .join("") +
            (E.ruas.length > 8
                ? `<div class="lg" style="color:var(--ink-3)">+ ${E.ruas.length - 8} outras</div>`
                : "");
    }
}

/* ============ Lista de quadras ============ */
export function preencherRuas() {
    const s = $("filtroRua");
    for (const r of E.ruas) {
        const o = document.createElement("option");
        o.value = r;
        o.textContent = r;
        s.appendChild(o);
    }
}
export function desenharLista() {
    const rua = $("filtroRua").value;
    const vis = rua
        ? E.quadras.filter((q) => q.ruas.has(rua))
        : E.quadras;
    $("contaQuadras").textContent =
        `${vis.length}/${E.quadras.length}`;
    const box = $("listaQuadras");
    box.innerHTML = "";
    for (const q of vis) {
        const b = document.createElement("button");
        b.className = E.selec === q.idx ? "ativo" : "";
        b.innerHTML = `<span>${q.nome}<span class="rua">${q.ruaPrinc.replace(/^(RUA|AVENIDA|TRAVESSA) /, "")} · ${q.faces.size} faces</span></span>
   <span class="n">${q.casas.length}</span>`;
        b.addEventListener("click", () => selecionar(q.idx));
        box.appendChild(b);
    }
    if (!vis.length)
        box.innerHTML = `<p class="nota" style="padding:var(--space-2)">Nenhum quarteirão nessa rua.</p>`;
}
export function selecionar(idx) {
    E.selec = E.selec === idx ? null : idx;
    pintar();
    desenharLista();
    if (E.selec !== null) {
        const q = E.quadras[E.selec];
        const b = L.latLngBounds(
            q.contorno.map((c) => [c[1], c[0]]),
        );
        S.map.fitBounds(b, { padding: [70, 70], maxZoom: 18 });
        const faces = [...q.faces.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(
                ([f, l]) =>
                    `face ${f}: ${l.length} casas (${l[0].properties.rua.replace(/^(RUA|AVENIDA|TRAVESSA) /, "")})`,
            )
            .join(" · ");
        st(
            `<b>${q.nome}</b> — ${q.casas.length} casas · ${faces}`,
        );
    } else {
        S.map.fitBounds(S.cCasas.getBounds(), {
            padding: [26, 26],
        });
        st(
            `<b>${E.casas.length.toLocaleString("pt-BR")}</b> casas em ${E.quadras.length} quarteirões.`,
        );
    }
}
$("btnTodos").addEventListener("click", () => {
    if (E.selec !== null) selecionar(E.selec);
    else
        S.map.fitBounds(S.cCasas.getBounds(), {
            padding: [26, 26],
        });
});

/* ============ Busca ============ */
export function initBusca() {
    $("busca").addEventListener("input", (e) => {
    const t = e.target.value.trim();
    if (S.realce) {
        S.map.removeLayer(S.realce);
        S.realce = null;
    }
    if (t.length < 3) {
        $("resBusca").textContent =
            "Digite a rua e, se quiser, o número.";
        return;
    }
    const num = (t.match(/\d+/) || [])[0];
    const texto = t
        .replace(/\d+/g, "")
        .replace(/[,\.]/g, "")
        .trim()
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    const norm = (s) =>
        s
            .toUpperCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
    let achados = E.casas.filter((f) => {
        const p = f.properties;
        const okRua = !texto || norm(p.rua).includes(texto);
        const okNum = !num || String(p.numero) === num;
        return okRua && okNum;
    });
    if (!achados.length) {
        $("resBusca").textContent =
            "Nenhum endereço encontrado.";
        return;
    }
    $("resBusca").innerHTML =
        `<b>${achados.length}</b> endereço(s). ${achados.length > 60 ? "Refine com o número." : "Destacados em laranja no mapa."}`;
    const mostrar = achados.slice(0, 400);
    S.realce = L.geoJSON(
        { type: "FeatureCollection", features: mostrar },
        {
            style: {
                color: "oklch(62% .19 45)",
                weight: 2,
                fillColor: "oklch(70% .18 55)",
                fillOpacity: 0.95,
            },
        },
    ).addTo(S.map);
    S.map.fitBounds(S.realce.getBounds(), {
        padding: [80, 80],
        maxZoom: 18,
    });
    if (achados.length === 1) {
        const p = achados[0].properties;
        st(
            `<b>${p.rua}, ${p.numero}</b> — quarteirão ${p._qn}, face ${p.face}, ${p.ordem_na_face}ª casa da face.`,
        );
    }
});
}
