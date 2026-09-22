"""
Gera casas_salvacao.geojson: um polígono (casa) para CADA domicílio do CNEFE,
posicionado na coordenada real, alinhado com a face da quadra e voltado para o interior.

Garantia: nenhuma casa é descartada. total de polígonos == total de domicílios.
"""
import json, math, collections, statistics, sys, os

ENTRADA = sys.argv[1] if len(sys.argv) > 1 else "enderecos_salvacao.geojson"
SAIDA = "casas_salvacao.geojson"
DOMICILIOS = {"1", "2"}

feats = json.load(open(ENTRADA, encoding="utf-8"))["features"]
pontos = [f for f in feats if f.get("geometry", {}).get("type") == "Point"]
doms = [f for f in pontos if str(f["properties"]["COD_ESPECIE"]) in DOMICILIOS]
outros = [f for f in pontos if str(f["properties"]["COD_ESPECIE"]) not in DOMICILIOS]

lat0 = sum(f["geometry"]["coordinates"][1] for f in pontos) / len(pontos)
lng0 = sum(f["geometry"]["coordinates"][0] for f in pontos) / len(pontos)
M_LAT = 111320.0
M_LNG = 111320.0 * math.cos(math.radians(lat0))

def para_xy(f):
    lng, lat = f["geometry"]["coordinates"][:2]
    return ((lng - lng0) * M_LNG, (lat - lat0) * M_LAT)

def para_lnglat(x, y):
    return [round(lng0 + x / M_LNG, 8), round(lat0 + y / M_LAT, 8)]

def num_endereco(texto):
    parte = (texto or "").rsplit(",", 1)
    dig = "".join(c for c in (parte[1] if len(parte) > 1 else "") if c.isdigit())
    return int(dig) if dig else None

def rua_endereco(texto):
    return (texto or "").rsplit(",", 1)[0].strip()

# ---------- agrupamento: quadra (setor + num_quadra) -> face ----------
quadras = collections.defaultdict(list)
for f in doms:
    p = f["properties"]
    quadras[(p["COD_SETOR"], p["NUM_QUADRA"])].append(f)

def eixo_principal(pts):
    """Direcao dominante (PCA) de um conjunto de pontos. Retorna vetor unitario."""
    n = len(pts)
    cx = sum(p[0] for p in pts) / n
    cy = sum(p[1] for p in pts) / n
    sxx = syy = sxy = 0.0
    for x, y in pts:
        dx, dy = x - cx, y - cy
        sxx += dx * dx; syy += dy * dy; sxy += dx * dy
    theta = 0.5 * math.atan2(2 * sxy, sxx - syy)
    return (math.cos(theta), math.sin(theta)), (cx, cy)

def espacamentos(ts, largura_padrao=9.0):
    """Retorna (passo tipico, passo estreito) dos vaos entre casas vizinhas da face."""
    difs = sorted(b - a for a, b in zip(ts, ts[1:]) if b - a > 0.5)
    if not difs:
        return largura_padrao, largura_padrao
    typ = statistics.median(difs)
    # percentil 25 dos vaos: lotes estreitos cabem sem sobreposicao
    estreito = difs[max(0, int(len(difs) * 0.25) - 1)] if len(difs) >= 4 else min(difs)
    return typ, estreito

casas = []
relatorio = []

for (setor, quadra), fs in sorted(quadras.items(), key=lambda kv: (str(kv[0][0]), kv[0][1])):
    pts_quadra = [para_xy(f) for f in fs]
    qcx = sum(p[0] for p in pts_quadra) / len(pts_quadra)
    qcy = sum(p[1] for p in pts_quadra) / len(pts_quadra)

    faces = collections.defaultdict(list)
    for f in fs:
        faces[f["properties"]["NUM_FACE"]].append(f)

    # direcao de reserva: eixo da quadra inteira (para faces com 1-2 pontos)
    u_quadra, _ = eixo_principal(pts_quadra)

    for face, itens in sorted(faces.items()):
        pts = [para_xy(f) for f in itens]
        if len(pts) >= 3:
            u, c = eixo_principal(pts)
        else:
            u = u_quadra
            c = (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))
        nx, ny = -u[1], u[0]  # normal

        # normal aponta para o INTERIOR da quadra
        if (qcx - c[0]) * nx + (qcy - c[1]) * ny < 0:
            nx, ny = -nx, -ny

        # ordena ao longo da face pelo numero do endereco, com a projecao como critério
        enriquecidos = []
        for f, (x, y) in zip(itens, pts):
            t = (x - c[0]) * u[0] + (y - c[1]) * u[1]
            s = (x - c[0]) * nx + (y - c[1]) * ny
            enriquecidos.append({"f": f, "x": x, "y": y, "t": t, "s": s,
                                 "num": num_endereco(f["properties"]["LOGRAD_NUM"])})
        enriquecidos.sort(key=lambda d: d["t"])

        ts = [d["t"] for d in enriquecidos]
        passo, estreito = espacamentos(ts)
        # largura guiada pelos lotes estreitos: evita sobrepor e preserva a posicao real
        largura = max(4.0, min(estreito * 0.9, passo * 0.85, 16.0))
        profundidade = max(8.0, min(passo * 1.6, 22.0))

        # desempilha somente enderecos que realmente se sobrepoem
        minimo = largura * 0.9
        for i in range(1, len(enriquecidos)):
            if enriquecidos[i]["t"] - enriquecidos[i - 1]["t"] < minimo:
                enriquecidos[i]["t"] = enriquecidos[i - 1]["t"] + minimo
                enriquecidos[i]["ajustado"] = True

        # recentraliza o conjunto deslocado sobre o intervalo original
        if enriquecidos:
            desloc = ((ts[0] + ts[-1]) / 2) - ((enriquecidos[0]["t"] + enriquecidos[-1]["t"]) / 2)
            if abs(desloc) > 0.01:
                for d in enriquecidos:
                    d["t"] += desloc

        # recuo padrao da testada: mediana da projecao normal da face
        s_base = statistics.median([d["s"] for d in enriquecidos])

        # posicoes uniformes: a face inteira dividida em lotes iguais (vista "fileira completa")
        n = len(enriquecidos)
        t_ini, t_fim = enriquecidos[0]["t"], enriquecidos[-1]["t"]
        vao = (t_fim - t_ini) / (n - 1) if n > 1 else 0.0
        largura_uni = max(4.0, min(vao * 0.88, 16.0)) if n > 1 else largura

        hw = largura / 2.0
        hw_uni = largura_uni / 2.0
        frente = -profundidade * 0.30
        fundo = profundidade * 0.70

        def retangulo(t_pos, meia_largura):
            ax = c[0] + t_pos * u[0] + s_base * nx
            ay = c[1] + t_pos * u[1] + s_base * ny
            cantos = [(-meia_largura, frente), (meia_largura, frente), (meia_largura, fundo),
                      (-meia_largura, fundo), (-meia_largura, frente)]
            return [para_lnglat(ax + dx * u[0] + dy * nx, ay + dx * u[1] + dy * ny)
                    for dx, dy in cantos]

        for ordem, d in enumerate(enriquecidos, start=1):
            p = d["f"]["properties"]
            # posicao real (coordenada do CNEFE, recuo regularizado)
            anel = retangulo(d["t"], hw)
            # posicao uniforme (lotes iguais ao longo da face)
            t_uni = t_ini + vao * (ordem - 1)
            anel_uni = retangulo(t_uni, hw_uni)
            casas.append({
                "type": "Feature",
                "properties": {
                    "id": f"{str(setor)[-5:]}-Q{quadra}-F{face}-{ordem:02d}",
                    "tipo": "domicilio",
                    "setor": p["COD_SETOR"], "quadra": quadra, "face": face,
                    "ordem_na_face": ordem, "casas_na_face": len(enriquecidos),
                    "endereco": p["LOGRAD_NUM"], "rua": rua_endereco(p["LOGRAD_NUM"]),
                    "numero": d["num"], "cep": p.get("CEP", ""),
                    "especie": str(p["COD_ESPECIE"]),
                    "cod_unico": p.get("COD_UNICO_ENDERECO", ""),
                    "largura_m": round(largura, 1), "profundidade_m": round(profundidade, 1),
                    "coord_ajustada": bool(d.get("ajustado")),
                    "lng_original": d["f"]["geometry"]["coordinates"][0],
                    "lat_original": d["f"]["geometry"]["coordinates"][1],
                    "anel_uniforme": anel_uni,
                    "largura_uniforme_m": round(largura_uni, 1),
                },
                "geometry": {"type": "Polygon", "coordinates": [anel]},
            })
        relatorio.append((str(setor)[-5:], quadra, face, len(enriquecidos), round(passo, 1), round(largura, 1)))

# outros usos (estabelecimentos, obras) seguem como pontos
for i, f in enumerate(outros, start=1):
    p = f["properties"]
    casas.append({
        "type": "Feature",
        "properties": {"id": f"O{i:03d}", "tipo": "outro uso",
                       "endereco": p.get("LOGRAD_NUM", ""), "rua": rua_endereco(p.get("LOGRAD_NUM", "")),
                       "especie": str(p["COD_ESPECIE"]),
                       "estabelecimento": p.get("DSC_ESTABELECIMENTO", "") or ""},
        "geometry": f["geometry"],
    })

json.dump({"type": "FeatureCollection", "features": casas},
          open(SAIDA, "w", encoding="utf-8"), ensure_ascii=False)

n_dom = sum(1 for c in casas if c["properties"]["tipo"] == "domicilio")
print(f"domicílios na entrada : {len(doms)}")
print(f"polígonos de casa     : {n_dom}")
assert n_dom == len(doms), "PERDA DE CASAS!"
print(f"outros usos (pontos)  : {len(outros)}")
print(f"quadras / faces       : {len(quadras)} / {len(relatorio)}")
aj = sum(1 for c in casas if c['properties'].get('coord_ajustada'))
print(f"coords empilhadas reposicionadas: {aj}")
larg = [r[5] for r in relatorio]
print(f"largura de lote: min {min(larg)}m · mediana {statistics.median(larg)}m · máx {max(larg)}m")
print(f"gerado: {os.path.abspath(SAIDA)}")
