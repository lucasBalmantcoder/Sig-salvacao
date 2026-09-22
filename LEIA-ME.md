# SIG Salvação — casas por quarteirão

Aplicação de visualização das casas do Residencial Salvação (Santarém/PA),
base CNEFE/IBGE 2022, para o projeto em parceria com a UBS do bairro.

## Como as casas são posicionadas

`gerar_casas.py` transforma cada endereço do CNEFE em um polígono de casa:

1. Agrupa os domicílios por **quadra IBGE** (`COD_SETOR` + `NUM_QUADRA`) e por **face** (`NUM_FACE`).
2. Para cada face, calcula o **eixo principal (PCA)** dos pontos — é a direção da rua.
3. A normal do eixo é orientada para o **interior da quadra**, então a casa se projeta
   da testada para dentro do lote (30% à frente, 70% ao fundo).
4. A largura do lote vem do **percentil 25 dos vãos** entre casas vizinhas da face,
   o que evita sobreposição sem deslocar as casas da posição real.
5. O recuo da testada é a **mediana** da projeção normal da face, regularizando ruído de GPS.
6. Endereços com **coordenada repetida** no cadastro são espalhados ao longo da face
   (mínimo de 0,9 × largura entre vizinhos) e o conjunto é recentralizado.
7. É gerado também um anel **uniforme** por casa: a face dividida em lotes iguais,
   usado no modo "Lotes iguais" da aplicação.

O script tem um `assert`: o número de polígonos é sempre igual ao número de
domicílios na entrada. Nenhuma casa é descartada por filtro de área.

## Uso

```bash
python gerar_casas.py enderecos_salvacao.geojson   # gera casas_salvacao.geojson
cp casas_salvacao.geojson dados/
python3 -m http.server 5000                         # abre a aplicação
```

## Modos da aplicação

- **Coordenada real** — cada casa no ponto exato do levantamento. Vãos na fileira
  são lotes sem domicílio cadastrado, não casas faltando.
- **Lotes iguais** — fileira contínua, útil para conferir contagem por face.

## Fonte

CNEFE 2022 — Cadastro Nacional de Endereços para Fins Estatísticos, IBGE.
Arquivo `qg_810_endereco_Munic1506807.json` (Santarém/PA),
localidade `RESIDENCIAL SALVACAO`.
https://www.ibge.gov.br/estatisticas/sociais/populacao/22827-censo-demografico-2022.html
