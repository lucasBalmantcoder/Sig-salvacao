"""Diagnostica por que detectar_gaps.py marca todos os contornos como sem endereço.

Uso:
    python diagnosticar_gaps.py enderecos_salvacao.geojson contornos_bairro.geojson

Usa apenas a biblioteca padrão do Python.
"""
import json
import math
import sys


def carregar(caminho):
    with open(caminho, encoding="utf-8") as f:
        return json.load(f)["features"]


def coords_planas(geom):
    """Devolve todos os pares [x, y] de uma geometria."""
    t = geom["type"]
    c = geom["coordinates"]
    if t == "Point":
        return [c]
    if t == "Polygon":
        return [p for anel in c for p in anel]
    if t == "MultiPolygon":
        return [p for poly in c for anel in poly for p in anel]
    return []


def centroide(geom):
    pts = coords_planas(geom)
    if not pts:
        return None
    return (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))


def bbox(pontos):
    xs = [p[0] for p in pontos]
    ys = [p[1] for p in pontos]
    return min(xs), min(ys), max(xs), max(ys)


def dist_m(a, b):
    """Distância em metros (aproximação equirretangular, adequada para curtas distâncias)."""
    lat = math.radians((a[1] + b[1]) / 2)
    dx = math.radians(b[0] - a[0]) * math.cos(lat) * 6371000
    dy = math.radians(b[1] - a[1]) * 6371000
    return math.hypot(dx, dy)


def percentil(valores, p):
    v = sorted(valores)
    return v[min(len(v) - 1, int(p / 100 * len(v)))]


def main():
    if len(sys.argv) != 3:
        sys.exit("Uso: python diagnosticar_gaps.py <enderecos.geojson> <contornos.geojson>")

    enderecos = [centroide(f["geometry"]) for f in carregar(sys.argv[1])]
    contornos = [centroide(f["geometry"]) for f in carregar(sys.argv[2])]
    enderecos = [p for p in enderecos if p]
    contornos = [p for p in contornos if p]

    print(f"Endereços: {len(enderecos)} | Contornos: {len(contornos)}\n")

    be, bc = bbox(enderecos), bbox(contornos)
    print("Bounding box [lon_min, lat_min, lon_max, lat_max]")
    print("  CNEFE   :", [round(x, 5) for x in be])
    print("  Overture:", [round(x, 5) for x in bc])
    sobrepoe = not (be[2] < bc[0] or bc[2] < be[0] or be[3] < bc[1] or bc[3] < be[1])
    print("  Sobreposição:", "sim" if sobrepoe else "NÃO (verifique ordem lon/lat ou área baixada)")
    for nome, b in (("CNEFE", be), ("Overture", bc)):
        if not (-180 <= b[0] <= 180 and -90 <= b[1] <= 90) or abs(b[1]) > abs(b[0]):
            print(f"  ATENÇÃO: {nome} parece ter latitude/longitude invertidas.")

    dists = []
    for c in contornos:
        dists.append(min(dist_m(c, e) for e in enderecos))

    print("\nDistância de cada contorno ao endereço CNEFE mais próximo (metros)")
    print(f"  mínima : {min(dists):.1f}")
    for p in (10, 25, 50, 75, 90):
        print(f"  p{p:<2}    : {percentil(dists, p):.1f}")
    print(f"  máxima : {max(dists):.1f}")

    print("\nContornos com endereço dentro do raio")
    for r in (18, 25, 35, 50, 75, 100):
        n = sum(1 for d in dists if d <= r)
        print(f"  {r:>3} m : {n:>4} de {len(dists)} ({100 * n / len(dists):.0f}%)")


if __name__ == "__main__":
    main()
