# SIG Salvação — Visão Geral do Projeto

## O que é o projeto?

O **SIG Salvação** é um mapa interativo do **Residencial Salvação** (Santarém/PA), desenvolvido em parceria com a **Unidade Básica de Saúde (UBS)** do bairro. Ele reúne, em uma única tela de navegação simples, os quarteirões, as ruas e cerca de **2.800 residências** da comunidade, permitindo enxergar o território casa por casa.

---

## Que problema ele tenta resolver?

Na rotina da atenção básica de saúde, acompanhar milhares de moradores exige saber **quem precisa de cuidado e exatamente onde essa pessoa mora**. Quando essas informações ficam apenas em planilhas, papéis ou sistemas sem visão de mapa, surgem três dificuldades principais:

1. **Falta de visão territorial para a equipe de saúde**
   Agentes Comunitários de Saúde (ACS), enfermeiros e gestores precisam planejar visitas domiciliares, busca ativa e campanhas por quarteirão ou rua. Sem um mapa por domicílio, é difícil enxergar onde se concentram grupos prioritários ou identificar rapidamente uma casa específica durante o trabalho em campo.

2. **Distância entre o cadastro oficial e a realidade das ruas**
   Os dados oficiais de endereços (base CNEFE/IBGE) nem sempre refletem perfeitamente o desenho real dos lotes: há pontos deslocados por imprecisão de GPS, casas sobrepostas ou fora do alinhamento do quarteirão. Corrigir isso manualmente em ferramentas tradicionais de geoprocessamento é complexo e exige conhecimento técnico especializado.

3. **Dificuldade de cruzar endereço com acompanhamento de saúde**
   Saber apenas o endereço não basta para a tomada de decisão clínica e comunitária; é preciso relacionar cada residência às condições e necessidades dos moradores que vivem ali.

---

## Como o SIG Salvação resolve esses problemas?

### 1. Mapa vivo do bairro, casa por casa
Qualquer pessoa da equipe consegue abrir o mapa, navegar por todo o Residencial Salvação ou ir direto a um quarteirão, rua ou número específico. Cada lote exibe seu número, endereço e detalhes dos moradores cadastrados.

### 2. Filtros rápidos por prioridades de saúde
O mapa permite destacar visualmente as residências de acordo com indicadores e grupos de acompanhamento da UBS, facilitando o planejamento de rotas e ações direcionadas, como:
* Gestantes, recém-nascidos e crianças menores de 2 anos
* Hiperdia, hipertensão arterial e saúde mental
* Idosos (60+), pessoas acamadas e acompanhamento de tuberculose
* Vacinação atrasada e risco epidemiológico e sanitário
* Rastreamento de câncer de mama e de colo do útero, HPV / saúde sexual e reprodutiva
* Famílias acompanhadas pelo Bolsa Família

*(Na versão atual, os dados de moradores e fichas de saúde funcionam em modelo demonstrativo/simulado, validando a experiência antes da integração com os dados reais da unidade.)*

### 3. Ajuste visual do mapa sem perder os dados oficiais
Para aproximar o desenho do mapa à realidade observada na comunidade, o projeto inclui um **modo de edição visual**:
* Permite mover, girar, alinhar e padronizar quarteirões e fileiras de casas diretamente sobre o mapa.
* **Segurança dos dados:** os endereços e atributos oficiais do IBGE nunca são apagados ou alterados; os ajustes visuais ficam registrados à parte, preservando integralmente a base original.

---

## Quem se beneficia?

* **Equipes da UBS e Agentes Comunitários de Saúde:** ganham agilidade para localizar famílias, organizar visitas por quarteirão e priorizar atendimentos no território.
* **Gestão em Saúde:** passa a ter uma visão clara da distribuição espacial das demandas do bairro para apoiar o planejamento de ações e campanhas.
* **Comunidade do Residencial Salvação:** se beneficia de um acompanhamento de saúde mais organizado, próximo e aderente à realidade de cada rua.
