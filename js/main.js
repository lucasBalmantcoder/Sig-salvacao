import { $, APP_VERSION } from "./config.js";
import { E, S, st } from "./state.js";
import { initModalMoradores } from "./health-mock.js";
import { ocultarNumeracaoCanvas, desenharNumeracaoCasas } from "./numbering.js";
import {
    iniciarAgrupamentoQuarteirao,
    confirmarAgrupamentoQuarteirao,
    cancelarPreviewQuarteirao,
} from "./spacing.js";
import {
    salvarSnapshotHistorico,
    desfazer,
    refazer,
    aplicarSnapshot,
    marcarSalvo,
    salvarLocalStorage,
    salvarArquivoAjustes,
    exportarGeoJsonAjustado,
    restaurarSelecionadas,
    restaurarQuarteiraoSelecionado,
    restaurarTodas,
} from "./storage.js";
import {
    initMap,
    aplicarTema,
    trocarBase,
    pintar,
    desenharLegenda,
    desenhar,
    aplicarPosicao,
    sincronizarCamadas,
    desenharLista,
    carregar,
    initBusca,
} from "./map-view.js";
import {
    agrupar,
    desagrupar,
    rotacionarCasasSelecionadas,
    atualizarOverlayEdicao,
    alternarModoApp,
    alternarFerramentaEdicao,
    initEditorEvents,
} from "./editor.js";

function segmento(id, aoMudar) {
    $(id).addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (!b) return;
        [...$(id).children].forEach((x) =>
            x.setAttribute("aria-pressed", String(x === b)),
        );
        aoMudar(b.dataset.v || b.dataset.m || b.dataset.f);
    });
}

const versaoEl = $("appVersao");
if (versaoEl) versaoEl.textContent = "v" + APP_VERSION;

$("btnTema").addEventListener("click", () => {
    S.temaEscuro = !S.temaEscuro;
    aplicarTema();
});

initMap();
initModalMoradores();
initBusca();
initEditorEvents();

S.map.on("zoomstart zoomanim", () => {
    if (typeof ocultarNumeracaoCanvas === "function") {
        ocultarNumeracaoCanvas();
    }
});

S.map.on("move", () => {
    if (!S.map._animatingZoom && typeof desenharNumeracaoCasas === "function") {
        desenharNumeracaoCasas();
    }
});

S.map.on("zoomend moveend viewreset resize", () => {
    if (typeof desenharNumeracaoCasas === "function") {
        desenharNumeracaoCasas();
    }
    if (E.modoEdicao && E.selecionadas.size > 0) {
        atualizarOverlayEdicao();
    }
});

segmento("segBase", trocarBase);
segmento("segCor", (v) => {
    E.criterio = v;
    pintar();
    desenharLegenda();
    if (S.cContorno) desenhar();
});
segmento("segPos", (v) => {
    if (E.modoEdicao && v === "real") {
        alert("A visualização 'Coordenada real' é apenas para leitura e referência do IBGE e não pode ser editada. Desative o Modo Edição para visualizá-la.");
        [...$("segPos").children].forEach((x) =>
            x.setAttribute("aria-pressed", String(x.dataset.v === "uniforme")),
        );
        return;
    }
    E.posicao = v;
    aplicarPosicao();
});
[
    "ckCasas",
    "ckPontos",
    "ckOutros",
    "ckContorno",
    "ckRotulos",
].forEach((id) =>
    $(id).addEventListener("change", sincronizarCamadas),
);
$("rgOpac").addEventListener("input", (e) => {
    E.opac = +e.target.value / 100;
    $("vOpac").textContent = e.target.value + "%";
    pintar();
});
$("filtroRua").addEventListener("change", () => {
    E.selec = null;
    desenharLista();
    pintar();
});

// Controles de Modo e Edição
segmento("segModo", alternarModoApp);
segmento("segFerramentaEdicao", alternarFerramentaEdicao);

$("btnAgrupar").addEventListener("click", agrupar);
$("btnDesagrupar").addEventListener("click", desagrupar);
$("btnQuarteirao").addEventListener("click", iniciarAgrupamentoQuarteirao);
$("btnConfirmarQuarteirao").addEventListener("click", confirmarAgrupamentoQuarteirao);
$("btnCancelarQuarteirao").addEventListener("click", cancelarPreviewQuarteirao);

$("btnDesfazer").addEventListener("click", desfazer);
$("btnRefazer").addEventListener("click", refazer);

$("btnRotM15").addEventListener("click", () => rotacionarCasasSelecionadas(-15));
$("btnRotM1").addEventListener("click", () => rotacionarCasasSelecionadas(-1));
$("btnRotP1").addEventListener("click", () => rotacionarCasasSelecionadas(1));
$("btnRotP15").addEventListener("click", () => rotacionarCasasSelecionadas(15));
$("inpRotGraus").addEventListener("change", (e) => {
    const g = parseFloat(e.target.value) || 0;
    if (g !== 0) {
        rotacionarCasasSelecionadas(g);
        e.target.value = "0";
    }
});

$("btnSalvarAjustes").addEventListener("click", salvarArquivoAjustes);
$("btnExportarGeojson").addEventListener("click", exportarGeoJsonAjustado);

$("btnImportarAjustes").addEventListener("click", () => $("inputImportar").click());
$("inputImportar").addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
        try {
            const json = JSON.parse(evt.target.result);
            if (json && (json.ajustes || json.grupos)) {
                salvarSnapshotHistorico();
                aplicarSnapshot(json);
                marcarSalvo(false);
                salvarLocalStorage();
                st("Edições importadas com sucesso.");
            } else {
                alert("Arquivo JSON inválido para edições.");
            }
        } catch (err) {
            alert("Erro ao ler JSON: " + err.message);
        }
    };
    reader.readAsText(file);
    e.target.value = "";
});

const menuRes = $("menuRestaurar");
$("btnRestaurarMenu").addEventListener("click", () => {
    menuRes.style.display = menuRes.style.display === "none" ? "flex" : "none";
});
$("btnRestaurarSel").addEventListener("click", () => {
    menuRes.style.display = "none";
    restaurarSelecionadas();
});
$("btnRestaurarQuarteirao").addEventListener("click", () => {
    menuRes.style.display = "none";
    restaurarQuarteiraoSelecionado();
});
$("btnRestaurarTodas").addEventListener("click", () => {
    menuRes.style.display = "none";
    restaurarTodas();
});

// Alerta de fechamento se houver edições não salvas no arquivo
window.addEventListener("beforeunload", (e) => {
    if (!E.alteracoesSalvas && E.modoEdicao && Object.keys(E.ajustes).length > 0) {
        e.preventDefault();
        e.returnValue = "";
    }
});

aplicarTema();

carregar();

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
}
