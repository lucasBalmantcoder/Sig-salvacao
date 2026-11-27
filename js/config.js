export const $ = (id) => document.getElementById(id);

export const APP_VERSION = "1.3.4";

// Parâmetros Configuráveis de Padronização (em metros)
export const PADRAO_LARGURA_M = 8.0;
export const PADRAO_PROFUNDIDADE_M = 16.0;
export const PADRAO_ESPACAMENTO_M = 1.0;
export const PADRAO_INTERVALO_FILEIRAS_M = 3.0;

export const CHAVE_LS = "sig_salvacao_ajustes_v1";
export const CHAVE_LS_NUM = "sig_salvacao_numeracao_casas";

export const ICO = {
    sol: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M18.7 5.3L17 7M7 17l-1.7 1.7"/>',
    lua: '<path d="M20.5 14.2A8.6 8.6 0 1 1 9.8 3.5a6.9 6.9 0 0 0 10.7 10.7z"/>',
};

// 12 matizes bem separados, legíveis sobre satélite e em ambos os temas
export const MATIZES = [8, 32, 58, 92, 128, 158, 186, 212, 242, 272, 302, 332];

export const TODOS_INDICADORES = [
    "hiperdia",
    "recem_nascida",
    "saude_mental",
    "hipertensao",
    "acamados",
    "tuberculose",
    "gestantes",
    "menor_2_anos",
    "bolsa_familia",
    "idosos",
    "risco_sanitario",
    "vacina_atrasada",
    "cancer_colo_utero",
    "cancer_mama",
    "saude_sexual_juvenil",
];

export const NOMES_INDICADORES = {
    hiperdia: "Hiperdia",
    recem_nascida: "Criança recém-nascida",
    saude_mental: "Saúde mental",
    hipertensao: "Hipertensão arterial",
    acamados: "Acamados",
    tuberculose: "Tuberculose",
    gestantes: "Gestantes",
    menor_2_anos: "Criança < 2 anos",
    bolsa_familia: "Bolsa Família",
    idosos: "Idosos 60+",
    risco_sanitario: "Risco epidem. e sanitário",
    vacina_atrasada: "Vacina atrasada",
    cancer_colo_utero: "Rastreio câncer colo do útero",
    cancer_mama: "Rastreio câncer de mama",
    saude_sexual_juvenil: "HPV / saúde sexual e reprodutiva",
};

export const PROB_INDICADOR = {
    recem_nascida: 0.9,
    menor_2_anos: 0.9,
    bolsa_familia: 0.55,
    saude_sexual_juvenil: 0.35,
    cancer_colo_utero: 0.22,
    cancer_mama: 0.22,
};
