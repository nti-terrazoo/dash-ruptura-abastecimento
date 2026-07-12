# Regras de Dados e Cálculos feitos no Dashboard

**Escopo:** como cada seção da aplicação nova (`backend/` FastAPI + Oracle, `frontend/` React/TS) busca dados, o que calcula em cima deles, e como monta cada gráfico e tabela na tela. Este documento descreve o sistema **como ele é hoje**, arquivo por arquivo, função por função.

---

## 1. Arquitetura e fluxo de uma requisição

```
Navegador (React)
  → hook de React Query (frontend/src/api/queries.ts)
    → GET /api/<recurso> (frontend/src/api/client.ts → fetch)
      → router FastAPI (backend/app/routers/*.py)
        → dashboard_service.py (orquestra: busca views + aplica regras)
          → raw_data.py (uma função por view, com cache)
            → queries.py (SQL) → Oracle (12 views EPORTAL.VW_DASH_*)
```

Cada aba do dashboard corresponde a 1-2 endpoints REST (`/api/overview`, `/api/lojas`, etc.), todos aceitando `?date=YYYY-MM-DD` opcional. O backend nunca reprocessa nada no cliente: toda a agregação, filtro e cálculo acontece em `dashboard_service.py`, e o frontend só formata e desenha o que recebe pronto (percentuais, valores e cores já vêm calculados da API).

### 1.1 Data de referência (`data_referencia`)

Função `get_reference_date` (`backend/app/routers/common.py:30`):
- Se a query recebe `?date=YYYY-MM-DD`, usa essa data (valida o formato, senão HTTP 422).
- Se não, chama `raw_data.get_available_dates()` e usa **a primeira data da lista** — que vem de `VW_DASH_DIA_A_DIA` ordenada por `DATA_REFERENCIA DESC` (`AVAILABLE_DATES` em `queries.py`), ou seja, sempre a **data mais recente com dado real no Oracle** (não é o relógio do servidor).
- Se não houver nenhuma data disponível (Oracle fora do ar ou schema vazio), retorna HTTP 503.

No frontend, `useSelectedDate()` (`frontend/src/hooks/useSelectedDate.ts`) guarda a data escolhida no parâmetro `?date=` da própria URL do dashboard (não em estado local) — assim o link é compartilhável e sobrevive a um F5. Se não houver `?date=` na URL, usa `default` de `GET /api/dates` (a mesma data mais recente).

### 1.2 Cache

`backend/app/cache.py`: um `TTLCache` (biblioteca `cachetools`) em memória, thread-safe, chave = `(nome_da_view, data_ou_intervalo)`, TTL configurável via `.env` (`CACHE_TTL_SECONDS`, default 30 min). Toda função de `raw_data.py` passa por esse cache antes de tocar o Oracle — a **primeira** requisição para uma data popula o cache; as seguintes (trocar de aba, trocar de filtro) são instantâneas e não geram nova consulta SQL, mesmo que várias seções peçam a mesma view (ex.: `get_dde_fornecedor` é reusada por Overview, Fornecedores e Ruptura Segmentos).

### 1.3 As 12 views Oracle

Todo dado vem de `EPORTAL.VW_DASH_*` (schema configurável via `.env`), acessadas em `backend/app/db/queries.py` via bind variable (nunca f-string com valor do usuário). Mapeamento função → view:

| Função (`raw_data.py`) | View Oracle | Granularidade |
|---|---|---|
| `get_planilha_geral` | `VW_DASH_PLANILHA_GERAL` | 1 linha por (fornecedor, segmento) no dia |
| `get_planilha_grafico` | `VW_DASH_PLANILHA_GRAFICO` | 1 linha por segmento no dia (s/CD) |
| `get_planilha_grafico_cd` | `VW_DASH_PLANILHA_GRAFICO_CD` | idem, com CD |
| `get_dia_a_dia` | `VW_DASH_DIA_A_DIA` | 1 linha por dia (geral, s/CD) |
| `get_dia_a_dia_cd` | `VW_DASH_DIA_A_DIA_CD` | idem, com CD |
| `get_lojas` | `VW_DASH_LOJAS` | 1 linha por loja no dia |
| `get_fornecedores` | `VW_DASH_FORNECEDORES` | 1 linha por fornecedor no dia (sem segmento) |
| `get_lojas_bridge` | `VW_DASH_LOJAS_BRIDGE` | 1 linha por item/produto/loja (a mais granular; tem `SITUACAO`, `FACING`, `QTD_ESTOQUE_CD` etc.) |
| `get_dde_geral` | `VW_DASH_DDE` | 1 linha por dia |
| `get_dde_fornecedor` | `VW_DASH_DDE_FORNECEDOR` | 1 linha por fornecedor no dia |
| `get_dde_lojas` | `VW_DASH_DDE_LOJAS` | 1 linha por loja no dia |
| `get_dde_segmento` | `VW_DASH_DDE_SEGMENTO` | 1 linha por segmento no dia |

As mesmas views também têm variantes `_RANGE` (`BETWEEN :data_inicio AND :data_fim`) usadas pelos gráficos de série histórica. `get_available_dates` usa `VW_DASH_DIA_A_DIA` (garantida ter 1 linha por data) com `ROWNUM <= :limit` (compatível com Oracle 11g, sem `FETCH FIRST`).

---

## 2. Regras de negócio compartilhadas (`backend/app/core/business_rules.py`)

Constantes de código (não vêm de tabela do banco):

- **`SEG_METAS`** — meta de % de ruptura por segmento: `FOOD=8, FARMACIA=5, JARDINAGEM=15, AGROPECUARIA=12, HIGIENE E BELEZA=13, ACESSORIOS=20, FAUNA=20, AQUARISMO=15, LAZER=20`. `VALID_SEGMENTOS` é a lista dessas 9 chaves (ordem = ordem de declaração), usada como universo de segmentos conhecidos e para indexar a paleta de cor.
- **`SEG_ALIAS`** — tabela de normalização de nomes vindos do banco (ex. `"PETFOOD"`/`"PET FOOD"` → `"FOOD"`, `"FARMÁCIA"` → `"FARMACIA"`, `"AGROPECUÁRIA"` → `"AGROPECUARIA"`).
- **`norm_seg(segmento)`** — normalização usada em **todo** cálculo por segmento: (1) `strip().upper()`; (2) se bate em `SEG_ALIAS`, usa o canônico; (3) senão, remove prefixo `"PET "` (4 chars) ou `"PET"` (3 chars); (4) senão devolve a string original com espaços removidos das pontas. É chamada em praticamente toda função de `dashboard_service.py` que lê a coluna `SEGMENTO`.
- **`DDE_META_SEG`** — meta mensal de DDE por segmento, 10 valores (março a dezembro de 2026) por segmento (ex. `FOOD: [62,61,61,60,59,59,58,58,58,58]`). `get_dde_meta(segmento, data)` pega `data.month`, usa índice `mês - 3`; se mês < 3 usa o primeiro valor (março), se mês > 12 (nunca acontece na prática) usa o último (dezembro).
- **`BRIDGE_STATUS_DEFS`** — as 5 categorias da "bridge" (waterfall), cada uma com uma lista de substrings (case-insensitive) que casam com o texto livre de `SITUACAO`. **Ordem importa** — a primeira categoria cujo array bate é usada:
  1. `Sit. Crítica c/ Pedido` (`#ff4444`) — `PEDIDO PENDENTE`, `SITUAÇÃO CRÍTICA - PEDIDO`, `SITUACAO CRITICA - PEDIDO`, `- PEDIDO`
  2. `Sit. Crítica s/ Pedido` (`#ff9999`) — `SEM PEDIDO`, `SITUAÇÃO CRÍTICA - SEM`, `SITUACAO CRITICA - SEM`, `- SEM`
  3. `CD Insuficiente` (`#f4a030`) — `CD INSUFICIENTE`, `INSUFICIENTE P/`, `CD INSUF`
  4. `CD Atende Loja` (`#34c97a`) — `CD ATENDE LOJA`, `CD ATENDE`, `ATENDE LOJA`, `PRENOTA`
  5. `Estoque Negativo` (`#ffd166`) — `ESTOQUE NEGATIVO`, `NEGATIVO`
  - `match_bridge_status(situacao)` percorre essa lista e devolve a primeira definição cujo `keys` contém uma substring do texto (uppercased); `None` se nada bater (item fica de fora de qualquer agregação de bridge).
- **`BRIDGE_FALLBACK_PROPORTIONS = [0.400, 0.214, 0.102, 0.252, 0.032]`** — usado só quando não há nenhum item real de bridge no dia/recorte (ver §5).
- **`CRIT_LEGACY_FACTOR = 0.614`** — soma das duas primeiras proporções de fallback (`0.400+0.214`); usado só em `get_segmento_detail` para estimar `critico_estimado` (ver §7). O próprio comentário no código registra que é um valor herdado sem justificativa de negócio documentada.
- **`EXCLUDED_STORE_PREFIXES`** — `["TERRAZOO CD", "LYNKZ BR", "RV PRODUÇÃO", "LYNKZ IMPERATRI", "CD "]`. `is_excluded_store(nome)` compara por **prefixo**, case-insensitive — qualquer loja cujo nome comece com um desses é excluída de **toda** listagem/ranking de lojas (é o Centro de Distribuição, produção ou parceiro logístico, não um ponto de venda real).
- **`EXCLUDED_BRIDGE_UNIDADES = {"300", "203"}`** — códigos de unidade sempre descartados dos itens de bridge (linhas de produto), em qualquer seção que use `VW_DASH_LOJAS_BRIDGE`.
- **`SEGMENTO_COLOR_PALETTE`** — 9 cores (`#5ed9a0, #4cbf8a, #3ca574, #2e8b5e, #7ff5b8, #9aebb2, #c4e8ce, #6bb5ff, #f4a85d`), cicladas por índice em `VALID_SEGMENTOS` (`segmento_color(seg)`). Fallback para índice 0 se o segmento não estiver na lista dos 9 conhecidos.
- **`loja_status(percentual)`** — 4 faixas: `≤10% → "OK"`, `≤15% → "Atenção"`, `≤25% → "Alerta"`, `>25% → "Crítico"`.
- **`loja_color(percentual)`** — binário: `≤10% → "#2d6b4a"` (verde), senão `"#e05555"` (vermelho) — note que isso é **mais grosso** que `loja_status` (Atenção/Alerta/Crítico compartilham a mesma cor vermelha).
- **`fornecedor_color(percentual)`** — 3 faixas: `>30% → "#ff6b6b"`, `>15% → "#ffd166"`, senão `"#5ed9a0"`.
- **`segmento_is_over_meta`** — helper definido mas não usado (a lógica `meta is not None and percentual > meta` é reescrita inline em `dashboard_service.py` em vez de chamar essa função — redundância inofensiva, mesmo resultado).

---

## 3. Cálculos matemáticos compartilhados (`backend/app/core/calculations.py`)

### `normalize_percentual(valor)`
Defensivo: se `0 < valor < 1`, multiplica por 100 (assume que a view devolveu fração em vez de 0-100). Chamado em **toda** leitura de `RUPTURA_PERCENTUAL` no sistema.

### `aggregate_bridge_status_totals(itens)`
Recebe uma lista de `{valor, situacao}` e devolve `{label_status: soma_do_valor}` para as 5 categorias (inicializadas em 0). Ignora itens com `valor <= 0` ou cuja `situacao` não bate em nenhuma categoria (`match_bridge_status` devolve `None`).

### `split_bridge_by_official_total(status_totals, official_valor, official_pct)` — a fórmula do waterfall
Esta é a função mais importante do sistema para a aba Bridge/waterfall. Reparte um valor/percentual **oficial** (vindo de uma view "de referência" — dia-a-dia geral, uma loja ou um segmento) nas 5 categorias, usando a **proporção interna** dos itens de bridge:

1. `total_bridge = soma de status_totals.values()`.
2. Se `total_bridge <= 0` (nenhum item real bate em nenhuma categoria nesse recorte): usa as `BRIDGE_FALLBACK_PROPORTIONS` fixas diretamente sobre `official_valor`/`official_pct` (ex. categoria 1 sempre leva 40% do total oficial).
3. Senão, para as **4 primeiras** categorias: `proporção = status_totals[categoria] / total_bridge`; `valor = round(proporção × official_valor, 2)`; `pp = round(proporção × official_pct, 2)`.
4. A **5ª categoria** (Estoque Negativo) **não** usa a proporção — fecha por subtração: `valor = official_valor − soma das 4 primeiras`, `pp = official_pct − soma das 4 primeiras`. Isso garante que a soma das 5 fatias bate **exatamente** com o número oficial, sem erro de arredondamento acumulado (a 5ª categoria absorve toda a sobra de arredondamento).

**Exemplo numérico** (dado real, `GET /api/bridge?mode=segmento&chave=FOOD`, 2026-07-07): `official_pct=8.7`, itens de bridge do segmento batem em 2 categorias reais — CD Insuficiente (R$15.043,13) e CD Atende Loja (R$2.125,58) — `total_bridge = 17.168,71`. Proporção CD Insuficiente = `15043.13/17168.71 = 87,6%` → `pp = 8.7 × 0.876 = 7.36`. CD Atende Loja: `12,4% × 8.7 = 1.04`. As duas categorias "Sit. Crítica" (sem itens reais nesse dia) ficam em 0. A última categoria (Estoque Negativo) fecha o resto: `8.7 − 7.36 − 1.04 − 0 − 0 = 0.30`.

Essa mesma função é reutilizada **identicamente** para os 3 modos da Bridge (`geral`, `segmento`, `loja`) — só muda de onde vem `official_valor`/`official_pct`/quais itens entram em `status_totals`.

---

## 4. Seção Visão Geral (Overview)

**Endpoints:** `GET /api/overview` (`overview.py` → `dashboard_service.get_overview`) e `GET /api/overview/series?days=15|30|60&cd=bool` (→ `get_series`).

**Frontend:** `OverviewPage.tsx` chama `useOverview(selectedDate)` (1 request) e `useOverviewSeries` **duas vezes** — uma para a série s/CD (sempre habilitada se o toggle "s/CD" estiver ligado) e outra para c/CD — cada uma é uma query independente do React Query, então trocar `days` ou os toggles dispara só as requisições necessárias.

### 4.1 `get_overview` — cálculos, campo por campo

- **`ruptura_sem_cd` / `ruptura_com_cd`**: `_kpi_from_rows()` pega a **primeira linha** de `get_dia_a_dia`/`get_dia_a_dia_cd` (a view já devolve 1 linha para a data pedida) e normaliza o percentual. Viram os dois primeiros cards de KPI ("% Ruptura" e "Valor em Ruptura", cada um mostrando a versão s/CD grande e c/CD menor embaixo).
- **`dde_geral`**: primeira linha de `get_dde_geral` (`VW_DASH_DDE`), campo `dias_estoque`. `None` se a view não tiver linha para a data.
- **`top_fornecedores_dde`**: de `get_dde_fornecedor`, filtra `0 < dias_estoque <= 400` (descarta zero/negativo e valores implausíveis acima de 400 dias), ordena descendente por `dde`, pega os 3 primeiros — os fornecedores com **mais** dias de estoque (mais parados).
- **`get_segmentos_today(data)`** (função compartilhada, também usada por Lojas... não, por Bridge e Segmentos): monta `{segmento: {valor, percentual}}` em duas passadas:
  1. Passada primária sobre `get_planilha_grafico` (já vem por segmento): `norm_seg`, descarta linhas com `valor<=0 AND percentual<=0`.
  2. Para os segmentos de `VALID_SEGMENTOS` que **não apareceram** na passada primária, uma segunda passada sobre `get_planilha_geral` (granularidade fornecedor×segmento): soma `valor` por segmento, e o `percentual` fica com o **último valor não-zero** visto (não é média nem soma) — replica a "complementação entre fontes" do sistema legado para preencher segmentos ausentes na view principal do dia.
- **`top_segmentos`**: os 3 segmentos (dentre os presentes em `get_segmentos_today`, não limitado aos 9 conhecidos) com maior `percentual`.
- **`ruptura_por_segmento`**: para cada segmento presente no dia, busca `meta = SEG_METAS.get(seg)` (pode ser `None` para um segmento fora dos 9 conhecidos — ex. dado real "MATERIAL NÃO PRODUTIVO"), `acima_meta = meta is not None and percentual > meta`, `cor = "#e05555"` se acima da meta, senão `segmento_color(seg)`. Ordenado descendente por `percentual`. É a lista que aparece no card "Ruptura por Segmento".
- **`item_critico`**: `_pick_item_critico(bridge_rows)` sobre **todas** as linhas de `get_lojas_bridge` (sem filtrar por loja/segmento) — filtra por `_valid_bridge_rows` (exclui unidades 300/203 e valor ≤ 0) e pega o item de **maior `ruptura_valor_venda`** com `max()`. Sem critério de desempate além da ordem natural, sem considerar o status/situação.
- **`meta_percentual`**: sempre `10` (constante, a meta "geral" da empresa, distinta da meta por segmento).

### 4.2 `get_series` (gráfico "Evolução Diária")
`inicio = data_referencia − (dias−1)` (janela **inclusiva** terminando na data de referência). Busca `get_dia_a_dia_range`/`get_dia_a_dia_cd_range` conforme `com_cd`, devolve pontos `{data, valor, percentual}` sem nenhum filtro adicional.

### 4.3 Como o gráfico é montado (`SeriesChart.tsx`)
Chart.js "puro" (via hook `useChart`, não `react-chartjs-2`) — `type: "bar"` como base, combinando datasets `bar` e `line` no mesmo `data.datasets` (eixos múltiplos):
- Se `showSemCd`: barra "Valor s/ CD" (eixo `yV`, direita, oculto) + linha "% s/ CD" (eixo `yP`, esquerda).
- Se `showComCd`: barra "Valor c/ CD" (verde mais escuro) + linha "% c/ CD" (tracejada).
- Sempre: linha "Meta {X}%" tracejada e sem pontos (visual apenas).
- Eixo `yV` (valor, oculto): `max = maior valor visível × 1.8` (headroom fixo para não colidir com a linha de %).
- Um plugin customizado (`seriesValueLabelsPlugin`, em `chartPlugins.ts`) desenha os rótulos numéricos sobre o gráfico: valor em R$ rotacionado 90° dentro de cada barra, e o percentual acima de cada ponto da linha — identifica o que desenhar pela propriedade `datasetLabelKind` que cada dataset carrega (`"valor-barra"`/`"percentual-linha"`), não pelo tipo Chart.js.
- Tooltip compartilhado (`tooltipBaseStyle`) com cores fixas (fundo quase-branco, borda verde clara).

Todos os textos/eixos usam `formatCurrency`/`formatPercent` (`lib/format.ts`) só na hora de desenhar — os dados crus que chegam da API são sempre número puro.

### 4.4 Card "Item Mais Crítico" e cor do segmento
O frontend não tem `cor` para o segmento do item crítico vindo da API (o schema `ItemBridge` não carrega essa cor). Por isso `OverviewPage.tsx` chama `segmentColor(item_critico.segmento)` (`lib/segmentos.ts`) — uma cópia local, no frontend, da mesma paleta/lógica de índice do backend (`segmento_color()`), calculada de forma independente mas com os **mesmos valores exatos** de cor e a mesma lista de 9 segmentos, então o resultado é sempre idêntico ao que o backend daria para aquele segmento (fora do caso raro do segmento não pertencer aos 9 conhecidos, quando ambos caem no mesmo fallback de índice 0).

---

## 5. Seção Lojas

**Endpoints:** `GET /api/lojas` e `GET /api/lojas/{cod_unidade}` (detalhe/drawer).

### 5.1 `get_lojas`
Para cada linha de `get_lojas` (`VW_DASH_LOJAS`): descarta se `is_excluded_store(nome)`; calcula `percentual` (normalizado), `dde` (via lookup em `get_dde_lojas` por `cod_unidade`), `status = loja_status(percentual)`, `cor = loja_color(percentual)`. Ordena a lista completa descendente por `percentual`. Depois divide em:
- `dentro_meta`: `percentual ≤ 10`
- `acima_meta`: `percentual > 10`

(divisão binária pela meta geral de 10%, independente das 4 faixas de `loja_status`).

**Frontend (`LojasPage.tsx`):** os 2 grupos de cards viram os blocos "✓ Lojas Dentro da Meta" (reordenado **ascendente** por percentual no cliente — a API devolve descendente, mas para "dentro da meta" faz mais sentido mostrar a melhor primeiro) e "🔴 Acima da Meta" (mantém a ordem descendente da API — pior primeiro). A tabela "Todas as Lojas" usa a lista `lojas` completa, colorindo a célula de % com o campo `cor` que já vem pronto da API.

### 5.2 `get_loja_detail(data, cod_unidade)`
Reaproveita `get_lojas()` para achar a loja (garante mesma exclusão/status). Se não encontrar, devolve `None` → o router converte em HTTP 404. Para o drawer:
- Filtra `get_lojas_bridge` pelo `cod_unidade`, aplica `_valid_bridge_rows` (exclui unidades 300/203 e valor ≤ 0).
- `segmentos_ofensores`: soma `ruptura_valor_venda` por `norm_seg(segmento)` dentro dessa loja, ordenado descendente por valor — "quais segmentos mais pesam na ruptura desta loja".
- `top_itens`: as mesmas linhas de bridge ordenadas descendente por valor, **top 10**.

**Frontend:** o drawer mostra 3 KPIs (% Ruptura, Valor, DDE), a lista de segmentos ofensores como barrinhas horizontais (largura proporcional ao maior valor do próprio conjunto, `s.valor / maxOfensor`), coloridas por `segmentColor(segmento)` (mesma paleta local do frontend, já explicada acima — o backend não expõe uma `cor` para `segmentos_ofensores`). Clicar num segmento filtra a lista de itens abaixo comparando `segmento` normalizado (é um filtro **local**, dentro dos 10 itens já trazidos — não busca mais itens no servidor).

---

## 6. Seção Fornecedores

**Endpoint:** `GET /api/fornecedores?segmento=TODOS|<segmento>`.

### `get_fornecedores(data, segmento)`
1. `seg_filtro = None` se `segmento.upper() == "TODOS"`, senão `norm_seg(segmento)`.
2. Agregação primária sobre `get_planilha_geral` (granularidade fornecedor×segmento no dia), filtrando por `seg_filtro` quando houver: para cada fornecedor, `valor` **soma** entre as linhas (um fornecedor pode aparecer em >1 segmento em modo TODOS); `percentual` usa **média ponderada por valor** — acumula `pv_acumulado += percentual × valor` de cada linha, e no final `percentual_final = pv_acumulado / valor_total`. (Essa média ponderada é uma decisão deliberada: mais estável do que "pegar o último percentual não-zero processado", que seria a alternativa mais simples.)
3. **Fallback**: se a agregação primária não achou nenhum fornecedor (ex. filtro de segmento sem correspondência na view), busca em `get_fornecedores` (`VW_DASH_FORNECEDORES`, sem granularidade por segmento) em vez de devolver lista vazia.
4. Para cada fornecedor: `dde` via lookup em `get_dde_fornecedor` (mesmo valor não varia por segmento), `cor = fornecedor_color(percentual)`.
5. **Ordena por `valor` (R$) descendente** — não por percentual. `destaques` = top 3 dessa lista (usados nos 3 cards "Maior Ruptura"); `ranking` = lista completa (o frontend corta para 10 na tabela/gráfico).

**Frontend (`FornecedoresPage.tsx`):** os pills de segmento (`TODOS` + os 9 de `SEGMENTOS`) trocam o parâmetro `segmento` da query — cada troca dispara uma nova requisição (o backend refaz toda a agregação filtrada). A coluna "Seg." da tabela só aparece quando um segmento específico está selecionado (mostra o próprio nome do segmento filtrado, já que em modo `TODOS` um fornecedor pode pertencer a vários segmentos simultaneamente — não haveria um único valor correto a mostrar). Cor da % vem direto de `r.cor` (API); cor do "Fornecedor" e do rank (negrito) é aplicada no cliente para as 3 primeiras linhas.

### Gráfico "Top 10 Fornecedores" (`FornecedorRankingChart.tsx`)
Barra horizontal (`indexAxis: "y"`) simples (Chart.js puro), plotando `valor` (R$) dos 10 primeiros do `ranking` (já vem ordenado por valor da API) — eixo X em R$ (`formatCurrency` nos ticks), sem eixo de percentual. Cor da barra é fixa por posição (não pelo campo `cor` do fornecedor): dourado (`#ffd166`) para as 3 primeiras, verde translúcido para as demais. Tooltip mostra `R$ · %`.

---

## 7. Seção Bridge (Waterfall)

**Endpoints:** `GET /api/bridge?mode=geral|segmento|loja&chave=...` e `GET /api/bridge/drilldown?mode=...&chave=...&status_label=...`.

### 7.1 `_bridge_official_totals(data, mode, chave)` — de onde vêm os números "oficiais"
- `mode=geral`: `_kpi_from_rows(get_dia_a_dia(data))` → `(percentual, valor)`; meta sempre `10`.
- `mode=segmento`: `get_segmentos_today(data)[norm_seg(chave)]` → `(percentual, valor)`; **meta sempre `10`** (não usa `SEG_METAS[seg]` — o waterfall sempre reconcilia contra a meta geral da empresa, mesmo olhando um segmento específico, para o gráfico ser comparável entre segmentos).
- `mode=loja`: busca a loja em `get_lojas()["lojas"]` por `cod_unidade`; se não achar, `(0, 0, 10)`; meta sempre `10`.

### 7.2 `_bridge_filtered_rows(data, mode, chave)`
Sempre começa de `_valid_bridge_rows(get_lojas_bridge(data))` (exclui unidades 300/203 e valor ≤ 0). Se `mode=segmento`, filtra por `norm_seg(segmento) == chave`; se `mode=loja`, filtra por `cod_unidade == chave`; se `mode=geral`, usa todas as linhas válidas do país inteiro.

### 7.3 `get_bridge` — monta a resposta
`totals = aggregate_bridge_status_totals(rows filtradas)` → `statuses = split_bridge_by_official_total(totals, valor_oficial, percentual_oficial)` (fórmula detalhada no §3). Devolve os 5 status com `{label, color, valor, pp}` que somam exatamente ao valor/percentual oficial do recorte escolhido.

### 7.4 `get_bridge_drilldown` — clique numa barra
Reaplica `_bridge_filtered_rows`, depois filtra pelas linhas cujo `match_bridge_status(situacao).label == status_label` pedido, ordena descendente por valor, mapeia para `ItemBridge` (produto, loja, fornecedor, valor, situação). É a lista que aparece no drawer lateral ao clicar num card de status ou numa barra do waterfall.

**Frontend (`BridgePage.tsx`):** 3 botões de modo (Geral/Por Segmento/Por Loja). Ao trocar de modo, agora já seleciona uma `chave` padrão automaticamente (ACESSORIOS para segmento, AFRICANOS para loja) para a tela nunca ficar vazia esperando um clique. Os 5 "status cards" no topo (`grid-bridge`) vêm de `data.statuses`; clicar num deles ou numa barra do gráfico abre o drawer de drilldown.

### Gráfico waterfall (`BridgeWaterfallChart.tsx`)
Barra empilhada (`stack`) com um truque de "base invisível": primeiro dataset (`background: transparent`) define onde cada barra visível deve **começar** a flutuar (soma cumulativa da meta + status anteriores); segundo dataset é a barra colorida de fato, com altura = valor daquele status. Sequência de barras: `Meta (10%) → 5 status (empilhados a partir da meta) → Ruptura Atual` (barra independente, começando do zero, não da soma anterior). Um campo `extra` (fora do tipo padrão do Chart.js, lido via cast) carrega `{pp, valor}` de cada barra para o plugin `bridgeValueLabelsPlugin` desenhar o rótulo (`pp%` e valor em R$) acima de cada barra. Clicar numa barra de status (não na Meta nem na Ruptura Atual) dispara `onStatusClick`, que abre o mesmo drawer de drilldown.

---

## 8. Seção Ruptura Segmentos

**Endpoints:** `GET /api/segmentos/{segmento}` (detalhe) e `GET /api/segmentos/{segmento}/series?days=0|30|60&cd=bool`.

### 8.1 `get_segmento_detail(data, segmento)`
- `vals = get_segmentos_today(data)[seg]` (mesma função compartilhada da Overview) → `percentual`/`valor` do segmento no dia.
- `meta = SEG_METAS.get(seg)` (pode ser `None`); `acima_meta = meta is not None and percentual > meta`.
- `dde`: linha de `get_dde_segmento` casando por `norm_seg`.
- `dde_meta`: `get_dde_meta(seg, data)` (meta mensal, ver §2).
- `cor`: vermelho se acima da meta, senão `segmento_color(seg)`.
- `bridge`: reusa **inteiramente** `get_bridge(data, mode="segmento", chave=seg)` (mesma fórmula do §7, meta fixa em 10% para o waterfall).
- **`critico_estimado`**: `{pp: percentual × 0.614, valor: valor × 0.614}` — uma estimativa simplificada de "quanto da ruptura do segmento provavelmente é crítica", usando o fator herdado `CRIT_LEGACY_FACTOR` (sem base de cálculo documentada — ver ressalva no §2). **Este campo é calculado mas não é exibido em nenhum lugar da tela hoje** (`SegmentosPage.tsx` não o renderiza).
- `item_critico`: `_pick_item_critico` restrito às linhas de bridge **deste segmento** (mesma regra de "maior valor" do §4, só que filtrada).
- `top_fornecedores_ultimos_dias`: ver 8.3.

### 8.2 `get_segmento_series` — série do gráfico principal
Parâmetro `dias`:
- `dias=0` ("Mês", padrão): busca do dia 1 do mês de `data_referencia` até `data_referencia`. Se isso não trouxer nenhum ponto (mês sem dado ainda), cai para uma janela rolante de 31 dias antes de `data_referencia`.
- `dias=30` ou `dias=60`: janela rolante normal (`data_referencia − (dias−1)` até `data_referencia`).

Para o intervalo escolhido, busca `get_planilha_grafico_range`/`get_planilha_grafico_cd_range` (conforme `com_cd`) filtrado por `norm_seg(segmento)`, e junta `dde` por data via `get_dde_segmento_range`. Cada ponto: `{data, valor, percentual, dde}`.

### 8.3 `_top_fornecedores_ultimos_dias(seg, data, dias=3)`
Para os **3 últimos dias corridos** (`data`, `data-1`, `data-2`): agrega `get_planilha_geral` de cada dia filtrado pelo segmento (mesma técnica de média ponderada por valor do §6). Ranqueia os fornecedores pelo **valor do dia mais recente** (`data_referencia`), pega os 10 primeiros. `dde` é buscado uma única vez (não varia por dia, é o snapshot atual de `get_dde_fornecedor`) e anexado a cada fornecedor.

### 8.4 Como o gráfico é montado (`SegmentEvolutionChart.tsx`)
O gráfico mais complexo do sistema: combo barra+linha com **3 eixos**:
- `yP` (esquerda): % Ruptura — linhas "% s/ CD" e/ou "% c/ CD" (toggle independente, igual à Overview).
- `yV` (direita, ticks ocultos): Valor R$ — barras "Valor s/ CD"/"Valor c/ CD"; `max` calculado como `maior valor visível × 1.4` se ambos os toggles (s/CD e c/CD) estiverem ligados ao mesmo tempo, ou `× 1.1` se só um estiver ligado (dá mais "respiro" vertical quando há duas séries de barra disputando o mesmo espaço).
- `yD` (direita, **não exibido no eixo**, só serve de escala): linha "DDE", tracejada em cinza — sempre desenhada, independente dos toggles s/CD·c/CD.
- Sempre desenha também uma linha "Meta {X}%" tracejada (sem pontos).
- Mesmo plugin de rótulos da Overview (`seriesValueLabelsPlugin`), reconhecendo `datasetLabelKind: "dde-linha"` para desenhar "Xd" abaixo dos pontos da linha de DDE.

### 8.5 Painel lateral e tabela
- **5 cards de bridge** (`data.bridge`, mesmo formato do §7) com rótulo abreviado só para exibição (`BRIDGE_LABEL_SHORT`, ex. "Sit. Crítica c/ Pedido" → "Sit. c/ Pedido"), borda esquerda colorida por status.
- **Card "Top Item Crítico"**: `data.item_critico` (produto, loja, valor) — mesmo campo do detalhe (§8.1).
- **Tabela "Top 10 Fornecedores — Últimos 3 Dias"**: cabeçalho de 2 linhas (data → 3 sub-colunas %/R$/DDE cada), montada calculando a união de todas as datas presentes em `top_fornecedores_ultimos_dias[].dias[].data` (normalmente as mesmas 3 para todos, mas construída defensivamente caso algum fornecedor tenha um dia faltando), e por fornecedor busca o ponto de cada data (`diaFor`) ou mostra "—" se ausente.

---

## 9. Formatação de exibição (`frontend/src/lib/format.ts`)

O backend **nunca** formata nada para exibição — todo número chega cru (float) e toda data como ISO `YYYY-MM-DD`. O frontend formata na hora de renderizar:

- `formatCurrency(v)`: `R$ 1.2M` se `|v| ≥ 1e6`; `R$ 1.2K` se `|v| ≥ 1e3`; senão `R$ 123` (sem decimais).
- `formatPercent(v, decimals=2)`: `v.toFixed(decimals) + "%"`.
- `formatDde(v)`: `"—"` se `null`/`undefined`, senão `Math.round(v) + "d"`.
- `formatDateShort(iso)`: `"DD/MM"` — faz **substring** da string ISO (`split("-")`), não instancia `Date`, evitando o bug clássico de fuso-horário onde `new Date("YYYY-MM-DD")` é interpretado como UTC e pode exibir o dia errado dependendo do fuso do navegador.
- `formatDateFull(iso)`: `"DD/MM/YYYY"`, mesma técnica de substring.

---

## 10. Camada de gráficos compartilhada

- **`useChart.ts`**: hook fino sobre o Chart.js "puro" (não usa o wrapper `react-chartjs-2`) — recebe uma `ChartConfiguration` já memoizada (`useMemo`) e recria o gráfico (`chart.destroy()` + `new Chart()`) sempre que a config muda por referência. Escolhido deliberadamente em vez do wrapper porque todos os gráficos deste dashboard usam eixos múltiplos, tipos mistos (barra+linha no mesmo array de datasets) e plugins de desenho customizados — o mesmo padrão imperativo do `new Chart(ctx, {...})` do sistema legado.
- **`chartPlugins.ts`**: `tooltipBaseStyle` (visual do tooltip compartilhado por todos os gráficos), `gridStyle`/`tickColor` (cores de grid reutilizadas), `seriesValueLabelsPlugin` (rótulos sobre barras/linhas dos gráficos combo — Overview e Ruptura Segmentos), `bridgeValueLabelsPlugin` (rótulos do waterfall).
- Nenhum gráfico busca dados sozinho — todos recebem os pontos já prontos via props (o componente de página é quem chama os hooks de `api/queries.ts` e passa os dados adiante).

---

## 11. Mapa completo endpoint → função → views

| Endpoint | Função em `dashboard_service.py` | Views Oracle consultadas |
|---|---|---|
| `GET /api/dates` | `raw_data.get_available_dates` | `VW_DASH_DIA_A_DIA` |
| `GET /api/health` | (checagem de conexão) | — |
| `GET /api/overview` | `get_overview` | `VW_DASH_DDE`, `VW_DASH_DDE_FORNECEDOR`, `VW_DASH_PLANILHA_GRAFICO` (+ `VW_DASH_PLANILHA_GERAL` como fallback por segmento), `VW_DASH_LOJAS_BRIDGE`, `VW_DASH_DIA_A_DIA`, `VW_DASH_DIA_A_DIA_CD` |
| `GET /api/overview/series` | `get_series` | `VW_DASH_DIA_A_DIA` ou `VW_DASH_DIA_A_DIA_CD` (intervalo) |
| `GET /api/lojas` | `get_lojas` | `VW_DASH_LOJAS`, `VW_DASH_DDE_LOJAS` |
| `GET /api/lojas/{cod}` | `get_loja_detail` | (reusa `get_lojas`) + `VW_DASH_LOJAS_BRIDGE` |
| `GET /api/fornecedores` | `get_fornecedores` | `VW_DASH_PLANILHA_GERAL` (+ `VW_DASH_FORNECEDORES` como fallback), `VW_DASH_DDE_FORNECEDOR` |
| `GET /api/bridge` | `get_bridge` | `VW_DASH_DIA_A_DIA` ou `get_segmentos_today`/`get_lojas` conforme `mode`, + `VW_DASH_LOJAS_BRIDGE` |
| `GET /api/bridge/drilldown` | `get_bridge_drilldown` | `VW_DASH_LOJAS_BRIDGE` |
| `GET /api/segmentos/{seg}` | `get_segmento_detail` | `VW_DASH_PLANILHA_GRAFICO`/`GERAL`, `VW_DASH_DDE_SEGMENTO`, `VW_DASH_LOJAS_BRIDGE`, `VW_DASH_PLANILHA_GERAL` (fornecedores 3 dias) |
| `GET /api/segmentos/{seg}/series` | `get_segmento_series` | `VW_DASH_PLANILHA_GRAFICO`/`_CD` (intervalo), `VW_DASH_DDE_SEGMENTO` (intervalo) |

---

## 12. Resumo por seção — "de onde vem cada número"

| Card/elemento na tela | Cálculo | Fonte |
|---|---|---|
| Overview · % Ruptura / Valor (s/CD, c/CD) | 1ª linha do dia, normalizada | `VW_DASH_DIA_A_DIA[_CD]` |
| Overview · DDE Geral | 1ª linha do dia | `VW_DASH_DDE` |
| Overview · Top 3 fornecedores por DDE | filtro `0<dde≤400`, top 3 desc | `VW_DASH_DDE_FORNECEDOR` |
| Overview · Ruptura por Segmento | agregação por segmento + complementação entre views | `VW_DASH_PLANILHA_GRAFICO` + `GERAL` |
| Overview · Item Mais Crítico | maior valor entre itens válidos (país inteiro) | `VW_DASH_LOJAS_BRIDGE` |
| Lojas · tabela/cards | exclusão de CD/produção, status/cor por %, split ≤10/>10 | `VW_DASH_LOJAS` + `VW_DASH_DDE_LOJAS` |
| Lojas · drawer | itens/segmentos filtrados pela loja | `VW_DASH_LOJAS_BRIDGE` |
| Fornecedores · ranking/destaques | soma de valor + média ponderada de %, ordenado por valor | `VW_DASH_PLANILHA_GERAL` (fallback `VW_DASH_FORNECEDORES`) |
| Bridge · 5 status + waterfall | proporção interna aplicada sobre o valor/percentual oficial do recorte | `VW_DASH_LOJAS_BRIDGE` + (`DIA_A_DIA`/segmento/loja conforme modo) |
| Segmentos · header (%, valor, meta, DDE) | mesma agregação por segmento + metas fixas em código | `VW_DASH_PLANILHA_GRAFICO`/`GERAL` + `VW_DASH_DDE_SEGMENTO` |
| Segmentos · gráfico 3 eixos | série no intervalo (mês/30d/60d) + DDE por data | `VW_DASH_PLANILHA_GRAFICO[_CD]` (intervalo) + `VW_DASH_DDE_SEGMENTO` (intervalo) |
| Segmentos · Top Fornecedores 3 dias | mesma agregação de Fornecedores, repetida para 3 datas, ranqueado pelo dia mais recente | `VW_DASH_PLANILHA_GERAL` × 3 dias |
