"""
Extrai os pontos de endereço (posição original do CNEFE) a partir do
casas_salvacao.geojson que você já tem, sem precisar reprocessar o .zip do CNEFE.

Uso:
    python extrair_pontos.py casas_salvacao.geojson
Gera:
    enderecos_salvacao.geojson
"""
import json, sys

ENTRADA = sys.argv[1] if len(sys.argv) > 1 else "casas_salvacao.geojson"
SAIDA = "enderecos_salvacao.geojson"

feats = json.load(open(ENTRADA, encoding="utf-8"))["features"]
pontos = []
for f in feats:
    p = f["properties"]
    if p.get("tipo") == "domicilio":
        pontos.append({
            "type": "Feature", "properties": p,
            "geometry": {"type": "Point", "coordinates": [p["lng_original"], p["lat_original"]]}
        })
    else:  # "outro uso": já é um ponto
        pontos.append(f)

json.dump({"type": "FeatureCollection", "features": pontos}, open(SAIDA, "w", encoding="utf-8"), ensure_ascii=False)
print(f"{len(pontos)} pontos extraídos -> {SAIDA}")
