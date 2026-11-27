import { $, CHAVE_LS_NUM } from "./config.js";

export const E = {
    casas: [],
    outros: [],
    quadras: [],
    ruas: [],
    criterio: "quadra",
    posicao: "uniforme",
    selec: null,
    opac: 0.8,
    dados: null,
    indicador: null,
    casaSelecionadaId: null,
    numeracaoCasas: localStorage.getItem(CHAVE_LS_NUM) === "true",
    modoEdicao: false,
    ferramentaEdicao: "selecionar",
    selecionadas: new Set(),
    grupos: [],
    ajustes: {},
    alteracoesSalvas: true,
};

export const S = {
    map: null,
    temaEscuro: window.matchMedia("(prefers-color-scheme: dark)").matches,
    camadaBase: null,
    baseAtual: "sat",
    cCasas: null,
    cPontos: null,
    cOutros: null,
    cContorno: null,
    cRotulos: null,
    cRealce: null,
    cDestaqueCasa: null,
    cSelecaoOverlay: null,
    cPreviewOverlay: null,
    mapaCasasPorId: new Map(),
    mapaCamadasCasas: new Map(),
    undoStack: [],
    redoStack: [],
    snapshotBaseEspacamento: null,
    historicoEspacamentoSalvo: false,
    previewAcaoAtiva: null,
    previewQuarteiraoAtivo: null,
    segurandoEspaco: false,
    panMeioAtivo: false,
    panMeioStartClient: [0, 0],
    boxAtiva: false,
    boxStartPoint: null,
    realce: null,
};

export const st = (msg) => {
    const el = $("status");
    if (el) el.innerHTML = msg;
};
