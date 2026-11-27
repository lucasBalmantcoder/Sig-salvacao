import { $, APP_VERSION, CHAVE_LS } from "./config.js";
import { E, S, st } from "./state.js";
import { centroide } from "./geometry.js";
import { desenharNumeracaoCasas } from "./numbering.js";
import { invalidarSnapshotEspacamento, cancelarPreviewQuarteirao } from "./spacing.js";
import { obterIdGrupo, atualizarOverlayEdicao, atualizarUIEdicao } from "./editor.js";






export function salvarSnapshotHistorico() {
    S.undoStack.push({
        ajustes: JSON.parse(JSON.stringify(E.ajustes)),
        grupos: JSON.parse(JSON.stringify(E.grupos)),
        selecionadas: Array.from(E.selecionadas)
    });
    if (S.undoStack.length > 50) S.undoStack.shift();
    S.redoStack.length = 0;
    atualizarBotoesHistorico();
}

export function atualizarBotoesHistorico() {
    const btnD = $("btnDesfazer");
    const btnR = $("btnRefazer");
    if (btnD) btnD.disabled = S.undoStack.length === 0;
    if (btnR) btnR.disabled = S.redoStack.length === 0;
}

export function desfazer() {
    if (S.undoStack.length === 0) return;
    S.redoStack.push({
        ajustes: JSON.parse(JSON.stringify(E.ajustes)),
        grupos: JSON.parse(JSON.stringify(E.grupos)),
        selecionadas: Array.from(E.selecionadas)
    });
    const snapshot = S.undoStack.pop();
    aplicarSnapshot(snapshot);
    marcarSalvo(false);
    salvarLocalStorage();
    st("Ação desfeita.");
}

export function refazer() {
    if (S.redoStack.length === 0) return;
    S.undoStack.push({
        ajustes: JSON.parse(JSON.stringify(E.ajustes)),
        grupos: JSON.parse(JSON.stringify(E.grupos)),
        selecionadas: Array.from(E.selecionadas)
    });
    const snapshot = S.redoStack.pop();
    aplicarSnapshot(snapshot);
    marcarSalvo(false);
    salvarLocalStorage();
    st("Ação refeita.");
}

export function aplicarSnapshot(snapshot) {
    cancelarPreviewQuarteirao();
    invalidarSnapshotEspacamento();
    E.ajustes = JSON.parse(JSON.stringify(snapshot.ajustes || {}));
    E.grupos = JSON.parse(JSON.stringify(snapshot.grupos || []));
    E.selecionadas = new Set(snapshot.selecionadas || []);

    for (const f of E.casas) {
        const id = f.properties.id;
        if (E.ajustes[id] && E.ajustes[id].coords) {
            f.properties._anelUni = JSON.parse(JSON.stringify(E.ajustes[id].coords));
        } else {
            f.properties._anelUni = JSON.parse(JSON.stringify(f.properties._anelUniBase));
        }
        if (E.posicao === "uniforme") {
            f.geometry.coordinates = [f.properties._anelUni];
            f.properties._c = centroide(f.properties._anelUni);
            const layer = S.mapaCamadasCasas.get(id);
            if (layer) {
                layer.setLatLngs(f.properties._anelUni.map((c) => [c[1], c[0]]));
                layer.redraw();
            }
        }
    }
    atualizarOverlayEdicao();
    atualizarUIEdicao();
    atualizarBotoesHistorico();
    pintar();
    if (typeof desenharNumeracaoCasas === "function") desenharNumeracaoCasas();
}

// ============ Restauração ============
export function restaurarSelecionadas() {
    if (E.selecionadas.size === 0) return;
    invalidarSnapshotEspacamento();
    salvarSnapshotHistorico();
    for (const id of E.selecionadas) {
        delete E.ajustes[id];
        const f = S.mapaCasasPorId.get(id);
        if (f) {
            f.properties._anelUni = JSON.parse(JSON.stringify(f.properties._anelUniBase));
            if (E.posicao === "uniforme") {
                f.geometry.coordinates = [f.properties._anelUni];
                f.properties._c = centroide(f.properties._anelUni);
                const layer = S.mapaCamadasCasas.get(id);
                if (layer) {
                    layer.setLatLngs(f.properties._anelUni.map((c) => [c[1], c[0]]));
                    layer.redraw();
                }
            }
        }
    }
    desagrupar();
    marcarSalvo(false);
    salvarLocalStorage();
    atualizarOverlayEdicao();
    atualizarUIEdicao();
    st("Casas selecionadas restauradas para o padrão geométrico original.");
}

export function restaurarQuarteiraoSelecionado() {
    if (E.selecionadas.size === 0) return;
    salvarSnapshotHistorico();

    const grpsParaRemover = new Set();
    const casasParaRestaurar = new Set();

    for (const id of E.selecionadas) {
        const g = obterGrupo(id);
        if (g) {
            grpsParaRemover.add(g.id);
            for (const cid of (g.casas || g)) casasParaRestaurar.add(cid);
        } else {
            casasParaRestaurar.add(id);
        }
    }

    for (const id of casasParaRestaurar) {
        delete E.ajustes[id];
        const f = S.mapaCasasPorId.get(id);
        if (f) {
            f.properties._anelUni = JSON.parse(JSON.stringify(f.properties._anelUniBase));
            if (E.posicao === "uniforme") {
                f.geometry.coordinates = [f.properties._anelUni];
                f.properties._c = centroide(f.properties._anelUni);
                const layer = S.mapaCamadasCasas.get(id);
                if (layer) {
                    layer.setLatLngs(f.properties._anelUni.map((c) => [c[1], c[0]]));
                    layer.redraw();
                }
            }
        }
    }

    E.grupos = E.grupos.filter((g) => !grpsParaRemover.has(g.id));
    marcarSalvo(false);
    salvarLocalStorage();
    atualizarOverlayEdicao();
    atualizarUIEdicao();
    st(`<b>${casasParaRestaurar.size}</b> casas do quarteirão restauradas ao padrão original.`);
}

export function restaurarTodas() {
    if (!confirm("Restaurar todas as casas para o padrão original? Esta ação remove todas as edições manuais.")) return;
    salvarSnapshotHistorico();
    E.ajustes = {};
    E.grupos = [];
    for (const f of E.casas) {
        f.properties._anelUni = JSON.parse(JSON.stringify(f.properties._anelUniBase));
        if (E.posicao === "uniforme") {
            f.geometry.coordinates = [f.properties._anelUni];
            f.properties._c = centroide(f.properties._anelUni);
            const layer = S.mapaCamadasCasas.get(f.properties.id);
            if (layer) {
                layer.setLatLngs(f.properties._anelUni.map((c) => [c[1], c[0]]));
                layer.redraw();
            }
        }
    }
    E.selecionadas.clear();
    marcarSalvo(false);
    salvarLocalStorage();
    atualizarOverlayEdicao();
    atualizarUIEdicao();
    st("Todas as casas foram restauradas ao padrão original.");
}

// ============ Persistência ============
const LOCAL_STORAGE_KEY = "sig_salvacao_casas_ajustadas_v1";

export function salvarLocalStorage() {
    try {
        const payload = {
            versao: 1,
            data_modificacao: new Date().toISOString(),
            descricao: "Ajustes manuais de posição e rotação das casas (Residencial Salvação, Santarém/PA)",
            parametros_padronizacao: {
                largura_m: PADRAO_LARGURA_M,
                profundidade_m: PADRAO_PROFUNDIDADE_M,
                espacamento_lotes_m: PADRAO_ESPACAMENTO_M,
                intervalo_fileiras_m: PADRAO_INTERVALO_FILEIRAS_M,
            },
            total_ajustadas: Object.keys(E.ajustes).length,
            grupos: E.grupos,
            ajustes: E.ajustes,
        };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
        console.warn("Erro ao salvar no localStorage:", e);
    }
}

export function marcarSalvo(isSalvo) {
    E.alteracoesSalvas = isSalvo;
    const badge = $("badgeSalvo");
    if (badge) {
        if (isSalvo) {
            badge.className = "badge-salvo";
            badge.textContent = "✓ Salvo";
        } else {
            badge.className = "badge-salvo pendente";
            badge.textContent = "● Alterações não salvas";
        }
    }
}

export function baixarArquivo(conteudo, nomeArquivo, tipoMime) {
    const blob = new Blob([conteudo], { type: tipoMime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export async function salvarArquivoAjustes() {
    const payload = {
        versao: 1,
        data_modificacao: new Date().toISOString(),
        descricao: "Ajustes manuais de posição e rotação das casas (Residencial Salvação, Santarém/PA)",
        parametros_padronizacao: {
            largura_m: PADRAO_LARGURA_M,
            profundidade_m: PADRAO_PROFUNDIDADE_M,
            espacamento_lotes_m: PADRAO_ESPACAMENTO_M,
            intervalo_fileiras_m: PADRAO_INTERVALO_FILEIRAS_M,
        },
        total_ajustadas: Object.keys(E.ajustes).length,
        grupos: E.grupos,
        ajustes: E.ajustes,
    };
    const jsonStr = JSON.stringify(payload, null, 2);
    let gravou = false;

    if (window.showSaveFilePicker) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: "casas_ajustadas.json",
                types: [
                    {
                        description: "Arquivo JSON de Ajustes",
                        accept: { "application/json": [".json"] },
                    },
                ],
            });
            const writable = await handle.createWritable();
            await writable.write(jsonStr);
            await writable.close();
            gravou = true;
            st("Arquivo <b>casas_ajustadas.json</b> gravado com sucesso no disco!");
        } catch (err) {
            if (err.name === "AbortError") return;
            console.warn("showSaveFilePicker falhou, usando download:", err);
        }
    }

    if (!gravou) {
        baixarArquivo(jsonStr, "casas_ajustadas.json", "application/json");
        st("Arquivo <b>casas_ajustadas.json</b> baixado. Coloque-o na pasta <b>dados/</b> do repositório para versionar no Git.");
    }
    marcarSalvo(true);
}

export function exportarGeoJsonAjustado() {
    const featuresCasas = E.casas.map((f) => {
        const props = {};
        for (const [k, v] of Object.entries(f.properties)) {
            if (!k.startsWith("_") && k !== "indicadores_mock") {
                props[k] = v;
            }
        }
        return {
            type: "Feature",
            properties: props,
            geometry: {
                type: "Polygon",
                coordinates: [f.properties._anelUni],
            },
        };
    });

    const featuresOutros = E.outros.map((f) => {
        const props = {};
        for (const [k, v] of Object.entries(f.properties)) {
            if (!k.startsWith("_")) props[k] = v;
        }
        return {
            type: "Feature",
            properties: props,
            geometry: f.geometry,
        };
    });

    const geojson = {
        type: "FeatureCollection",
        features: [...featuresCasas, ...featuresOutros],
    };

    baixarArquivo(JSON.stringify(geojson, null, 2), "casas_salvacao_ajustado.geojson", "application/geo+json");
    st("GeoJSON exportado como <b>casas_salvacao_ajustado.geojson</b> com atributos do IBGE preservados.");
}

export function carregarAjustesIniciais() {
    let localData = null;
    try {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (raw) localData = JSON.parse(raw);
    } catch (e) {
        console.warn("Erro no localStorage:", e);
    }

    fetch("dados/casas_ajustadas.json")
        .then((r) => (r.ok ? r.json() : null))
        .then((servidorData) => {
            let escolhido = servidorData;
            if (localData && servidorData) {
                const tLocal = new Date(localData.data_modificacao || 0).getTime();
                const tServ = new Date(servidorData.data_modificacao || 0).getTime();
                escolhido = tLocal >= tServ ? localData : servidorData;
            } else if (localData) {
                chosen: escolhido = localData;
            }

            if (escolhido && (Object.keys(escolhido.ajustes || {}).length > 0 || (escolhido.grupos || []).length > 0)) {
                aplicarSnapshot(escolhido);
                st(`Padrão ajustado carregado: <b>${Object.keys(escolhido.ajustes || {}).length}</b> casas com ajustes.`);
            }
        })
        .catch(() => {
            if (localData) aplicarSnapshot(localData);
        });
}
