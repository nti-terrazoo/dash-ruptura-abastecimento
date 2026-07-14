# Backend - Dashboard Ruptura de Abastecimento

API em Python (FastAPI) que substitui o dashboard HTML legado (que lia uma
planilha Google Sheets) por consultas diretas as 12 views Oracle, com toda a
logica de negocio (metas, DDE, bridge, KPIs) calculada no servidor e cacheada
por data de referencia.

## 1. Rodando via Docker (recomendado)

A imagem ja embute o **Oracle Instant Client** (modo "thick", necessario
porque o Oracle e 11g ou mais antigo - o driver `python-oracledb` so roda em
modo "thin" 100% Python para Oracle 12.1+). Voce nao precisa instalar nada
no host, nem Python, nem Instant Client - so o Docker.

```bash
# na raiz do projeto (onde esta o docker-compose.yml)
cp backend/.env.example backend/.env   # se ainda nao tiver um .env
# edite backend/.env com usuario/senha/DSN do Oracle

docker compose up -d --build backend
```

- Docs interativos: http://localhost:8000/docs
- Health check: http://localhost:8000/api/health
- Logs: `docker compose logs -f backend`
- Parar: `docker compose down`

O `Dockerfile` baixa o Instant Client 19.23 (compativel com servidores
Oracle 11.2.0.4+) durante o build e configura o `ldconfig` para ele -
nao ha necessidade de Docker separado para o Oracle em si: o banco de dados
legado continua rodando onde ja esta (ex: `192.168.0.43`), o container so
roda a API e se conecta a ele pela rede.

Se um dia o Oracle for atualizado para 12c+, e possivel remover essa
dependencia de Instant Client inteiramente deixando `ORACLE_CLIENT_LIB_DIR`
vazio no `.env` - o backend cai automaticamente para o modo "thin" (driver
100% Python, sem client nenhum).

## 2. Rodando sem Docker (alternativa)

Precisa de Python 3.11+ e do Oracle Instant Client instalado manualmente no
host:

1. Baixar o "Instant Client Basic" (Linux x86-64) em
   https://www.oracle.com/database/technologies/instant-client/linux-x86-64-downloads.html
   (aceite de licenca da Oracle, feito manualmente).
2. Extrair, ex: `unzip instantclient-basic-linux.x64-*.zip -d /opt/oracle/`
3. `sudo apt install libaio1` (Debian/Ubuntu) ou `libaio1t64` em versoes mais novas
   (se o binario reclamar de `libaio.so.1` faltando, crie um symlink para o
   `.so` real do `libaio1t64`, mesmo ajuste feito no `Dockerfile`).
4. No `.env`, aponte `ORACLE_CLIENT_LIB_DIR` para a pasta extraida (ex:
   `/opt/oracle/instantclient_19_23`, diferente do caminho usado dentro do
   Docker).

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edite o .env com usuario/senha/DSN do Oracle e o caminho do Instant Client
uvicorn app.main:app --reload --port 8000
```

## 3. Testes

```bash
pytest
```

Os testes em `tests/test_calculations.py` cobrem as regras de negocio
(calculo de bridge, metas de DDE, normalizacao de segmento, thresholds de
status) e nao dependem de conexao com o Oracle - podem rodar antes mesmo do
`.env` estar preenchido.

## 4. Endpoints

Todos sob `/api`, aceitam `?date=YYYY-MM-DD` (default = data mais recente
disponivel):

| Endpoint | Descricao |
|---|---|
| `GET /api/dates` | Ultimas 15 datas de referencia disponiveis |
| `GET /api/health` | Testa a conexao com o Oracle |
| `GET /api/overview` | KPIs da Visao Geral |
| `GET /api/overview/series?days=15\|30\|60&cd=true\|false` | Serie da Evolucao Diaria |
| `GET /api/lojas` | Ranking de lojas |
| `GET /api/lojas/{cod_unidade}` | Detalhe de uma loja (drawer) |
| `GET /api/fornecedores?segmento=TODOS` | Ranking de fornecedores |
| `GET /api/bridge?mode=geral\|segmento\|loja&chave=...` | Waterfall de status da bridge |
| `GET /api/bridge/drilldown?mode=...&chave=...&status_label=...` | Itens de um status da bridge |
| `GET /api/segmentos/{segmento}` | Aba "Ruptura Segmentos" completa |
| `POST /api/admin/warm-cache` | Dispara manualmente o warm-up diario do cache (ver secao 6) |

## 5. Notas sobre fidelidade as regras de negocio

- `app/core/business_rules.py` contem as constantes portadas do HTML antigo
  (`SEG_METAS`, `SEG_ALIAS`, `DDE_META_SEG`) e o fator `CRIT_LEGACY_FACTOR`
  (0.614) - um valor herdado do fallback da bridge sem justificativa de
  negocio documentada no sistema antigo. Mantido por fidelidade, mas vale
  validar com o time antes de usa-lo em decisao operacional.
- O calculo de bridge (`app/core/calculations.py`) reparte o valor/percentual
  oficial de cada nivel (geral/loja/segmento) proporcionalmente aos itens
  reais da bridge, com o ultimo status fechando o resto por subtracao -
  identico ao HTML legado.
- Fora de escopo desta fase (decisao pendente do negocio): aba "Tendencia"
  (existia so como codigo morto no HTML, sem botao visivel), o modal
  "Briefing 9h" (tinha uma senha fixa no JS - inseguro, sera substituido por
  autenticacao real quando entrarmos nessa etapa) e exportacao Excel/PDF
  (nao existia no dashboard antigo).

## 6. Performance

- Pool de conexoes Oracle criado uma vez no startup (`app/db/oracle.py`) -
  evita o custo de abrir sessao a cada request.
- Cache em memoria por `(view, data_referencia)`, com deduplicacao: se duas
  requisicoes concorrentes pedem a mesma chave e nenhuma esta em cache ainda,
  a segunda espera a primeira em vez de repetir a consulta (`app/cache.py`).
- **TTL de 24h para dados de uma data especifica** (`CACHE_TTL_SECONDS`,
  default 86400). Isso e seguro porque o ETL do Oracle escreve os dados de
  cada `DATA_REFERENCIA` uma unica vez - uma vez calculado, o resultado de um
  dia especifico nao muda mais. A lista de "datas disponiveis" usa um TTL
  curto e separado (`DATES_CACHE_TTL_SECONDS`, default 10 min) para o backend
  perceber rapido quando o ETL publica um novo dia.
- **Warm-up diario agendado** (`app/jobs/cache_warmup.py`, via APScheduler)
  roda todo dia as `CACHE_WARMUP_HOUR:CACHE_WARMUP_MINUTE` (default 01:00 -
  ajuste para logo depois do horario do ETL noturno do Oracle) e pre-carrega
  o cache com a visao padrao de cada aba (Visao Geral, Lojas, Fornecedores,
  Bridge geral, Ruptura Segmentos para os 9 segmentos) para a data mais
  recente. Sem isso, a primeira pessoa a abrir o dashboard de manha pagaria
  o custo da consulta mais lenta do sistema (a bridge geral, que varre a
  `VW_DASH_LOJAS_BRIDGE` inteira e pode levar dezenas de segundos com cache
  frio). Pode ser disparado manualmente (ex: logo apos um deploy) com:
  ```bash
  curl -X POST http://localhost:8000/api/admin/warm-cache
  ```
  (a resposta so volta quando o warm-up termina, entao pode levar um tempo).
