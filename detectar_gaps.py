"""
Compara os contornos de edificação (Overture/OSM) com os endereços do CNEFE
e aponta prédios sem nenhum endereço cadastrado por perto: candidatos a
"casa não cadastrada" (CNEFE desatualizado, construção posterior ao Censo 2022).

Entradas:
  enderecos_salvacao.geojson  -> pontos do CNEFE (gerado por exportar_salvacao.py)
  contornos_bairro.geojson    -> polígonos de edificação (overturemaps download --type=building)

Saída:
  gaps_salvacao.geojson       -> só os contornos SEM endereço CNEFE próximo,
                                 prontos para revisão em campo / inclusão manual

Uso:
    python detectar_gaps.py enderecos_salvacao.geojson contornos_bairro.geojson
"""
import json
import math
import sys

ENDERECOS = sys.argv[1] if len(sys.argv) > 1 else "enderecos_salvacao.geojson"
CONTORNOS = sys.argv[2] if len(sys.argv) > 2 else "contornos_bairro.geojson"
SAIDA = "gaps_salvacao.geojson"
RAIO_M = 18.0  # distância máxima para considerar que um ponto do CNEFE "cobre" o contorno


def centroide(anel):
    n = len(anel) - 1
    x = sum(p[0] for p in anel[:n]) / n
    y = sum(p[1] for p in anel[:n]) / n
    return x, y


enderecos = json.load(open(ENDERECOS, encoding="utf-8"))["features"]
contornos = json.load(open(CONTORNOS, encoding="utf-8"))["features"]
print(f"{len(enderecos)} endereços (CNEFE)  |  {len(contornos)} contornos de edificação")

pontos = [f["geometry"]["coordinates"][:2] for f in enderecos if f["geometry"]["type"] == "Point"]
lat0 = sum(p[1] for p in pontos) / len(pontos)
m_lat = 111320.0
m_lng = 111320.0 * math.cos(math.radians(lat0))

grade = {}
CEL = 40.0  # metros
for lng, lat in pontos:
    x, y = lng * m_lng, lat * m_lat
    grade.setdefault((int(x // CEL), int(y // CEL)), []).append((x, y))


def tem_endereco_perto(cx, cy):
    ix, iy = int(cx // CEL), int(cy // CEL)
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for px, py in grade.get((ix + dx, iy + dy), []):
                if math.hypot(px - cx, py - cy) <= RAIO_M:
                    return True
    return False


gaps = []
for f in contornos:
    g = f["geometry"]
    poligonos = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"] if g["type"] == "MultiPolygon" else []
    for anel in poligonos:
        cx, cy = centroide(anel[0])
        cx, cy = cx * m_lng, cy * m_lat
        if not tem_endereco_perto(cx, cy):
            gaps.append({
                "type": "Feature",
                "properties": {"tipo": "possivel_nao_cadastrada", "fonte": f.get("properties", {}).get("sources", "")},
                "geometry": {"type": "Polygon", "coordinates": anel}
            })
            break  # um contorno MultiPolygon conta uma vez

json.dump({"type": "FeatureCollection", "features": gaps}, open(SAIDA, "w", encoding="utf-8"), ensure_ascii=False)
print(f"{len(gaps)} contornos SEM endereço CNEFE próximo (raio de {RAIO_M:.0f} m)")
print(f"gerado: {SAIDA}")
print("\nAbra esse arquivo junto com os outros no mapa, ou veja rápido em https://geojson.io (arrastar o arquivo).")
