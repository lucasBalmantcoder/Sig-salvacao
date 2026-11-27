import { $, TODOS_INDICADORES, NOMES_INDICADORES, PROB_INDICADOR } from "./config.js";

export function hash01(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    h ^= h >>> 15;
    h = Math.imul(h, 2246822519);
    h ^= h >>> 13;
    return (h >>> 0) / 4294967296;
}
export function gerarIndicadoresMock(f, moradores) {
    // só considera o indicador se, além do sorteio de probabilidade, existir ao
    // menos um morador com perfil compatível (ex.: "gestantes" exige mulher em
    // idade fértil na casa) — evita atribuições sem sentido, como uma
    // "gestante" de 70 anos.
    return TODOS_INDICADORES.filter((ind) => {
        const prob = PROB_INDICADOR[ind] ?? 0.15;
        if (hash01(f.properties.id + "|" + ind) >= prob)
            return false;
        return moradores.some((m) =>
            perfilCombina(ind, m, idadeEmAnos(m.nascimento)),
        );
    });
}

/* ============ Moradores fictícios (protótipo) ============ =======
   Dados 100% inventados para fins de demonstração da interface.
   Nenhum dado real de morador, CPF, RG ou prontuário é usado aqui.
   Tudo é determinístico (semente por casa), então o resultado não
   muda a cada recarga da página. =================================== */

// Gerador pseudoaleatório com semente (mulberry32), para que cada casa
// sempre produza os mesmos moradores/fichas nesta sessão de dados.
function semeador(txt) {
    let h = 2166136261;
    for (let i = 0; i < txt.length; i++) {
        h ^= txt.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}
function rngDe(txt) {
    let s = semeador(txt);
    return function () {
        s |= 0;
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const sorteiaItem = (rng, arr) =>
    arr[Math.floor(rng() * arr.length)];
const sorteiaInt = (rng, min, max) =>
    min + Math.floor(rng() * (max - min + 1));

const NOMES_M = [
    "João",
    "José",
    "Antônio",
    "Francisco",
    "Carlos",
    "Paulo",
    "Pedro",
    "Lucas",
    "Marcos",
    "Rafael",
    "Gabriel",
    "Daniel",
    "Felipe",
    "Bruno",
    "Thiago",
    "André",
    "Ricardo",
    "Eduardo",
    "Gustavo",
    "Fernando",
    "Luiz",
    "Mateus",
    "Diego",
    "Vitor",
    "Alexandre",
    "Renato",
    "Sérgio",
    "Wagner",
    "Cláudio",
    "Hélio",
    "Jorge",
    "Nilson",
    "Raimundo",
    "Edson",
    "Adriano",
    "Fábio",
    "Leandro",
    "Rodrigo",
    "Samuel",
    "Igor",
];
const NOMES_F = [
    "Maria",
    "Ana",
    "Francisca",
    "Antônia",
    "Adriana",
    "Juliana",
    "Márcia",
    "Fernanda",
    "Patrícia",
    "Aline",
    "Sandra",
    "Camila",
    "Amanda",
    "Bruna",
    "Jéssica",
    "Letícia",
    "Larissa",
    "Gabriela",
    "Rafaela",
    "Vanessa",
    "Cristina",
    "Débora",
    "Luciana",
    "Simone",
    "Tatiane",
    "Raquel",
    "Rosa",
    "Benedita",
    "Socorro",
    "Conceição",
    "Rosangela",
    "Eliane",
    "Valéria",
    "Priscila",
    "Daniela",
    "Carla",
    "Natália",
    "Beatriz",
    "Sueli",
    "Ivone",
];
const SOBRENOMES = [
    "Silva",
    "Souza",
    "Oliveira",
    "Santos",
    "Pereira",
    "Costa",
    "Rodrigues",
    "Almeida",
    "Nascimento",
    "Lima",
    "Araújo",
    "Fernandes",
    "Carvalho",
    "Gomes",
    "Martins",
    "Rocha",
    "Ribeiro",
    "Alves",
    "Monteiro",
    "Mendes",
    "Barros",
    "Freitas",
    "Barbosa",
    "Pinto",
    "Moura",
    "Cavalcante",
    "Dias",
    "Castro",
    "Campos",
    "Teixeira",
    "Picanço",
    "Maciel",
    "Tavares",
    "Corrêa",
    "Furtado",
    "Pantoja",
    "Miranda",
    "Cardoso",
    "Brandão",
    "Azevedo",
];

// Raça/cor — categorias oficiais do IBGE/CNS, mesmas usadas no cadastro do
// e-SUS. Distribuição aproximada da região Norte (onde "parda" é maioria),
// só para o sorteio ficar plausível — não vem de nenhum dado real.
const RACAS = [
    { r: "Parda", peso: 65 },
    { r: "Branca", peso: 17 },
    { r: "Preta", peso: 9 },
    { r: "Indígena", peso: 5 },
    { r: "Amarela", peso: 4 },
];
function sorteiaRaca(rng) {
    const total = RACAS.reduce((s, x) => s + x.peso, 0);
    let alvo = rng() * total;
    for (const x of RACAS) {
        alvo -= x.peso;
        if (alvo <= 0) return x.r;
    }
    return RACAS[0].r;
}

function nomeCompleto(rng, sexo) {
    const primeiro =
        sexo === "F"
            ? sorteiaItem(rng, NOMES_F)
            : sorteiaItem(rng, NOMES_M);
    const n = rng() < 0.55 ? 2 : 1;
    const sobrenomes = new Set();
    while (sobrenomes.size < n)
        sobrenomes.add(sorteiaItem(rng, SOBRENOMES));
    return `${primeiro} ${[...sobrenomes].join(" ")}`;
}

// Relações possíveis com o(a) chefe da família, com a faixa etária típica de cada uma
const RELACOES = [
    { r: "Cônjuge/companheiro(a)", min: 18, max: 85, peso: 3 },
    { r: "Filho(a)", min: 0, max: 45, peso: 6 },
    { r: "Neto(a)", min: 0, max: 17, peso: 2 },
    { r: "Mãe", min: 45, max: 98, peso: 1 },
    { r: "Pai", min: 45, max: 98, peso: 1 },
    { r: "Irmão(ã)", min: 0, max: 85, peso: 2 },
    { r: "Outro parente", min: 0, max: 90, peso: 1 },
];
function sorteiaRelacao(rng) {
    const total = RELACOES.reduce((s, r) => s + r.peso, 0);
    let alvo = rng() * total;
    for (const rel of RELACOES) {
        alvo -= rel.peso;
        if (alvo <= 0) return rel;
    }
    return RELACOES[0];
}

function nascimentoPorIdade(rng, idadeAnos) {
    const hoje = new Date();
    const diasNaIdade = Math.floor(idadeAnos * 365.25);
    const d = new Date(hoje);
    d.setDate(
        d.getDate() - diasNaIdade - sorteiaInt(rng, 0, 364),
    );
    return d;
}
function idadeEmAnos(nascimento) {
    return (
        (Date.now() - nascimento.getTime()) /
        (365.25 * 24 * 3600 * 1000)
    );
}
function formatarData(d) {
    return d.toLocaleDateString("pt-BR");
}

// Gera o grupo familiar fictício de uma casa (1 a 5 pessoas)
export function gerarMoradores(f) {
    const p = f.properties;
    const rng = rngDe(p.id + "|moradores");
    const n = sorteiaInt(rng, 1, 5);
    const moradores = [];

    // chefe da família
    const sexoChefe = rng() < 0.5 ? "M" : "F";
    const idadeChefe = sorteiaInt(rng, 24, 72);
    moradores.push({
        id: p.id + "-m1",
        nome: nomeCompleto(rng, sexoChefe),
        sexo: sexoChefe,
        raca: sorteiaRaca(rng),
        relacao: "Responsável pelo domicílio",
        nascimento: nascimentoPorIdade(rng, idadeChefe),
    });

    for (let i = 1; i < n; i++) {
        const rel = sorteiaRelacao(rng);
        let sexo = rng() < 0.5 ? "M" : "F";
        if (rel.r === "Mãe") sexo = "F";
        if (rel.r === "Pai") sexo = "M";
        // Residencial com muitas famílias jovens: quando a relação permite
        // (filho, neto, irmão, outro parente), quase metade das vezes essa
        // pessoa é sorteada como criança pequena (0 a 9 anos), em vez de usar
        // a faixa inteira da relação. Isso deixa a base com mais crianças,
        // como é comum num bairro residencial.
        const podeSerCrianca = rel.min === 0;
        const idade =
            podeSerCrianca && rng() < 0.45
                ? sorteiaInt(rng, 0, 9)
                : sorteiaInt(rng, rel.min, rel.max);
        moradores.push({
            id: `${p.id}-m${i + 1}`,
            nome: nomeCompleto(rng, sexo),
            sexo,
            raca: sorteiaRaca(rng),
            relacao: rel.r,
            nascimento: nascimentoPorIdade(rng, idade),
        });
    }
    return moradores;
}

/* ---------- Fichas fictícias por indicador (baseadas nos critérios do
   Guia de Bolso de Indicadores da APS — CONASEMS/Ministério da Saúde,
   quando aplicável; demais indicadores são protótipo livre) ---------- */
const FICHAS_INDICADOR = {
    menor_2_anos: {
        titulo: "Cuidado no desenvolvimento infantil",
        itens: [
            { t: "1ª consulta até o 30º dia de vida", p: 15 },
            {
                t: "Pelo menos 9 consultas até os 2 anos de vida",
                p: 15,
            },
            {
                t: "Pelo menos 9 registros de peso e altura",
                p: 15,
            },
            {
                t: "2 visitas do ACS (até 30 dias e até 6 meses)",
                p: 15,
            },
            {
                t: "Suplementação de vitamina A em dia para a idade",
                p: 10,
            },
            {
                t: "Atendimento odontológico realizado no período",
                p: 10,
            },
            // Esquema vacinal: cruzamento doença a doença, em vez de um único item genérico
            { t: "Vacina contra difteria registrada", p: 2 },
            { t: "Vacina contra tétano registrada", p: 2 },
            {
                t: "Vacina contra tosse convulsa (pertussis) registrada",
                p: 2,
            },
            { t: "Vacina contra hepatite B registrada", p: 2 },
            {
                t: "Vacina contra Haemophilus influenzae tipo b registrada",
                p: 2,
            },
            {
                t: "Vacina contra poliomielite registrada",
                p: 2,
            },
            { t: "Vacina contra sarampo registrada", p: 2 },
            {
                t: "Vacina contra papeira (caxumba) registrada",
                p: 2,
            },
            { t: "Vacina contra rubéola registrada", p: 2 },
            {
                t: "Vacina contra doença pneumocócica registrada",
                p: 2,
            },
        ],
    },

    recem_nascida: {
        titulo: "Acompanhamento do recém-nascido",
        itens: [
            { t: "1ª consulta até o 30º dia de vida", p: 30 },
            { t: "Visita do ACS até 30 dias de vida", p: 25 },
            { t: "Teste do pezinho realizado", p: 25 },
            {
                t: "Vacinas de maternidade (BCG e hepatite B)",
                p: 20,
            },
        ],
    },

    gestantes: {
        titulo: "Cuidado na gestação e puerpério",
        itens: [
            {
                t: "1ª consulta até a 12ª semana de gestação",
                p: 10,
            },
            { t: "Pelo menos 7 consultas de pré-natal", p: 9 },
            {
                t: "7 registros de pressão arterial na gestação",
                p: 9,
            },
            {
                t: "7 registros de peso e altura na gestação",
                p: 9,
            },
            {
                t: "3 visitas do ACS após a 1ª consulta de pré-natal",
                p: 9,
            },
            { t: "Vacina dTpa a partir da 20ª semana", p: 9 },
            {
                t: "Exames para sífilis, HIV e hepatites no 1º trimestre",
                p: 9,
            },
            {
                t: "Exames para sífilis e HIV no 3º trimestre",
                p: 9,
            },
            { t: "Consulta no puerpério", p: 9 },
            { t: "Visita do ACS no puerpério", p: 9 },
            { t: "Atividade de saúde bucal na gestação", p: 9 },
        ],
    },

    hipertensao: {
        titulo: "Cuidado da pessoa com hipertensão",
        itens: [
            {
                t: "Consulta presencial ou remota nos últimos 6 meses",
                p: 25,
            },
            {
                t: "Aferição de pressão arterial nos últimos 6 meses",
                p: 25,
            },
            {
                t: "Registro de peso e altura no último ano",
                p: 25,
            },
            {
                t: "2 visitas domiciliares do ACS no último ano, com intervalo mínimo de 30 dias entre elas",
                p: 25,
            },
        ],
    },

    hiperdia: {
        titulo: "Acompanhamento Hiperdia (hipertensão/diabetes)",
        itens: [
            {
                t: "Consulta médica ou de enfermagem nos últimos 6 meses",
                p: 20,
            },
            {
                t: "Aferição de pressão arterial nos últimos 6 meses",
                p: 15,
            },
            {
                t: "Registro de peso e altura no último ano",
                p: 15,
            },
            {
                t: "2 visitas domiciliares do ACS no último ano, com intervalo mínimo de 30 dias entre elas",
                p: 20,
            },
            {
                t: "Solicitação de hemoglobina glicada nos últimos 12 meses",
                p: 15,
            },
            {
                t: "Avaliação dos pés nos últimos 12 meses",
                p: 15,
            },
        ],
    },

    idosos: {
        titulo: "Cuidado da pessoa idosa",
        itens: [
            {
                t: "Consulta médica ou de enfermagem nos últimos 12 meses",
                p: 25,
            },
            {
                t: "Registro de peso e altura nos últimos 12 meses",
                p: 25,
            },
            {
                t: "2 visitas do ACS nos últimos 12 meses",
                p: 25,
            },
            {
                t: "Dose da vacina contra influenza no último ano",
                p: 25,
            },
        ],
    },

    bolsa_familia: {
        titulo: "Condicionalidades de saúde — Bolsa Família",
        itens: [
            {
                t: "Peso e altura acompanhados no semestre",
                p: 35,
            },
            { t: "Calendário vacinal em dia", p: 35 },
            {
                t: "Participação em ação educativa de saúde",
                p: 30,
            },
        ],
    },

    saude_mental: {
        titulo: "Acompanhamento em saúde mental (protótipo)",
        itens: [
            {
                t: "Consulta ou atendimento nos últimos 6 meses",
                p: 35,
            },
            {
                t: "Visita domiciliar da equipe no período",
                p: 35,
            },
            {
                t: "Participação em grupo ou atividade terapêutica",
                p: 30,
            },
        ],
    },

    acamados: {
        titulo: "Cuidado domiciliar à pessoa acamada (protótipo)",
        itens: [
            {
                t: "Visita domiciliar da equipe no último mês",
                p: 40,
            },
            {
                t: "Avaliação de risco de lesão por pressão",
                p: 30,
            },
            {
                t: "Plano de cuidados domiciliares atualizado",
                p: 30,
            },
        ],
    },

    tuberculose: {
        titulo: "Acompanhamento de tuberculose (protótipo)",
        itens: [
            { t: "Tratamento supervisionado em dia", p: 40 },
            {
                t: "Exame de escarro de controle realizado",
                p: 30,
            },
            {
                t: "Busca ativa de contatos domiciliares",
                p: 30,
            },
        ],
    },

    risco_sanitario: {
        titulo: "Risco epidemiológico e sanitário (protótipo)",
        itens: [
            {
                t: "Visita de vigilância sanitária/ambiental realizada",
                p: 50,
            },
            {
                t: "Situação de risco identificada e notificada",
                p: 50,
            },
        ],
    },

    vacina_atrasada: {
        titulo: "Situação vacinal em atraso (protótipo)",
        itens: [
            {
                t: "Dose em atraso identificada pela equipe",
                p: 50,
            },
            {
                t: "Busca ativa para atualização vacinal realizada",
                p: 50,
            },
        ],
    },

    cancer_colo_utero: {
        titulo: "Rastreio do câncer de colo do útero",
        itens: [
            {
                t: "Exame de rastreamento dentro do intervalo recomendado para o método",
                p: 100,
            },
        ],
        extra: (rng) =>
            rng() < 0.3
                ? "Método: teste de HPV-DNA — intervalo de rastreamento de 60 meses."
                : "Método: citologia (Papanicolau) — intervalo de rastreamento de 36 meses.",
    },

    cancer_mama: {
        titulo: "Rastreio do câncer de mama",
        itens: [
            {
                t: "Mamografia (ou exame equivalente) solicitada ou avaliada nos últimos 24 meses",
                p: 100,
            },
        ],
    },
};

function classificarFicha(pontos) {
    if (pontos > 75)
        return { texto: "Ótimo", classe: "selo-otimo" };
    if (pontos > 50)
        return { texto: "Bom", classe: "selo-bom" };
    if (pontos > 25)
        return {
            texto: "Suficiente",
            classe: "selo-suficiente",
        };
    return { texto: "Regular", classe: "selo-regular" };
}

// Perfil etário/sexo esperado para cada indicador — usado só para tentar
// escolher, entre os moradores da casa, alguém plausível para a ficha.
function perfilCombina(indicador, m, idade) {
    switch (indicador) {
        case "recem_nascida":
            return idade <= 2 / 12;
        case "menor_2_anos":
            return idade < 2;
        case "gestantes":
            return m.sexo === "F" && idade >= 16 && idade <= 45;
        case "idosos":
            return idade >= 60;
        case "bolsa_familia":
            return idade < 18;
        case "cancer_colo_utero":
            return m.sexo === "F" && idade >= 25 && idade <= 64;
        case "cancer_mama":
            return m.sexo === "F" && idade >= 50 && idade <= 69;
        case "saude_sexual_juvenil":
            return idade >= 9 && idade <= 69;
        default:
            return idade >= 18; // hiperdia, hipertensao, saude_mental, acamados, tuberculose, risco_sanitario, vacina_atrasada
    }
}

// Ficha de "HPV / saúde sexual e reprodutiva" muda de conteúdo conforme a
// idade/sexo da pessoa: a vacina de HPV só se aplica a meninas de 9 a 14
// anos, e o atendimento em saúde sexual e reprodutiva vale de 14 a 69 anos.
// Quando os dois se aplicam (meninas de 14 anos), cada um valendo metade.
function gerarFichaSaudeSexual(rng, idade, sexo) {
    const podeHpv = sexo === "F" && idade >= 9 && idade <= 14;
    const podeReprodutiva = idade >= 14 && idade <= 69;
    const base = [];
    if (podeHpv)
        base.push({
            t: "Dose da vacina contra HPV (meninas de 9 a 14 anos)",
            p: podeReprodutiva ? 50 : 100,
        });
    if (podeReprodutiva)
        base.push({
            t: "Atendimento em saúde sexual e reprodutiva no último ano (14 a 69 anos)",
            p: podeHpv ? 50 : 100,
        });
    if (!base.length)
        base.push({
            t: "Avaliação de saúde sexual e reprodutiva",
            p: 100,
        });
    let pontos = 0;
    const itens = base.map((it) => {
        const atendido = rng() < 0.35 + rng() * 0.5;
        if (atendido) pontos += it.p;
        return { t: it.t, atendido };
    });
    return {
        indicador: "saude_sexual_juvenil",
        titulo: "HPV / saúde sexual e reprodutiva",
        pontos,
        classificacao: classificarFicha(pontos),
        itens,
        extra: null,
    };
}

function gerarFichaParaMorador(rng, indicador, idade, sexo) {
    if (indicador === "saude_sexual_juvenil")
        return gerarFichaSaudeSexual(rng, idade, sexo);
    const modelo = FICHAS_INDICADOR[indicador];
    if (!modelo) return null;
    let pontos = 0;
    const itens = modelo.itens.map((it) => {
        const atendido = rng() < 0.35 + rng() * 0.5; // varia a "qualidade" do acompanhamento por morador
        if (atendido) pontos += it.p;
        return { t: it.t, atendido };
    });
    const cls = classificarFicha(pontos);
    return {
        indicador,
        titulo: modelo.titulo,
        pontos,
        classificacao: cls,
        itens,
        extra: modelo.extra ? modelo.extra(rng) : null,
    };
}

// Atribui, para cada indicador ativo da casa, um morador "atendido" plausível
// e preenche a ficha fictícia dele. Quem não recebe nenhuma ficha fica
// marcado como "sem informação" — o ACS sabe o nome, mas não há atendimento
// registrado para essa pessoa neste protótipo.
export function atribuirFichas(f, moradores) {
    const p = f.properties;
    const rng = rngDe(p.id + "|fichas");
    const indicadores = p.indicadores_mock || [];
    for (const ind of indicadores) {
        const idades = moradores.map((m) =>
            idadeEmAnos(m.nascimento),
        );
        const candidatos = moradores.filter((m, i) =>
            perfilCombina(ind, m, idades[i]),
        );
        const escolhido = candidatos.length
            ? sorteiaItem(rng, candidatos)
            : sorteiaItem(rng, moradores);
        const idadeEscolhido = idadeEmAnos(
            escolhido.nascimento,
        );
        const ficha = gerarFichaParaMorador(
            rng,
            ind,
            idadeEscolhido,
            escolhido.sexo,
        );
        if (!escolhido.fichas) escolhido.fichas = [];
        escolhido.fichas.push(ficha);
    }
    garantirCoberturaInfantil(f, moradores, rng);
}

// Reforço pedido: quase todas as crianças com menos de 10 anos devem ter
// dados de atendimento, como se a grande maioria fosse de fato acompanhada
// pela equipe. Quem com menos de 10 anos ainda não ganhou nenhuma ficha pelo
// sorteio normal de indicadores recebe uma agora, com 90% de chance.
function garantirCoberturaInfantil(f, moradores, rng) {
    const p = f.properties;
    for (const m of moradores) {
        const idade = idadeEmAnos(m.nascimento);
        if (idade >= 10) continue;
        if (m.fichas && m.fichas.length) continue;
        if (rng() >= 0.9) continue;
        const ind =
            idade <= 2 / 12
                ? "recem_nascida"
                : idade < 2
                  ? "menor_2_anos"
                  : "bolsa_familia";
        if (!p.indicadores_mock.includes(ind))
            p.indicadores_mock.push(ind);
        const ficha = gerarFichaParaMorador(
            rng,
            ind,
            idade,
            m.sexo,
        );
        m.fichas = [ficha];
    }
}

/* ============ Modal "Moradores da casa" ============ */
function iconeAtendido(ok) {
    return ok
        ? '<span class="ok">✓</span>'
        : '<span class="falta">✕</span>';
}
function htmlFicha(ficha) {
    return `<div class="ficha">
    <div class="ficha-topo">
      <span class="ficha-titulo">${ficha.titulo}</span>
      <span class="selo-class ${ficha.classificacao.classe}">${ficha.classificacao.texto} · ${ficha.pontos}/100</span>
    </div>
    <div class="ficha-itens">
      ${ficha.itens.map((it) => `<div class="ficha-item${it.atendido ? "" : " nao-atendido"}">${iconeAtendido(it.atendido)} ${it.t}</div>`).join("")}
    </div>
    ${ficha.extra ? `<div class="ficha-extra">${ficha.extra}</div>` : ""}
  </div>`;
}
function htmlMorador(m) {
    const idade = Math.floor(idadeEmAnos(m.nascimento));
    const temFicha = m.fichas && m.fichas.length;
    return `<div class="morador">
    <div class="morador-topo">
      <span class="morador-nome">${m.nome}</span>
      <span class="morador-idade">${idade} ${idade === 1 ? "ano" : "anos"}</span>
    </div>
    <div class="morador-rel">${m.relacao} · ${m.raca} · nascimento ${formatarData(m.nascimento)}</div>
    ${
        temFicha
            ? m.fichas.map(htmlFicha).join("")
            : `<span class="selo-seminfo">Sem informação de atendimento para esta pessoa</span>`
    }
  </div>`;
}

export function abrirMoradores(f) {
    const p = f.properties;
    if (!p._moradoresCache) return;
    $("modalTitulo").textContent =
        `${p.rua}${p.numero ? ", " + p.numero : ""}`;
    $("modalSub").textContent =
        `${p._moradoresCache.length} morador(es) cadastrado(s) pelo ACS · ${p._qn} · dados fictícios de protótipo`;
    $("modalCorpo").innerHTML = p._moradoresCache
        .map(htmlMorador)
        .join("");
    $("modalMoradores").style.display = "flex";
}
export function fecharModalMoradores() {
    $("modalMoradores").style.display = "none";
}
export function initModalMoradores() {
    $("modalFechar").addEventListener("click", fecharModalMoradores);
    $("modalMoradores").addEventListener("click", (e) => {
        if (e.target.id === "modalMoradores") fecharModalMoradores();
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") fecharModalMoradores();
    });
}
