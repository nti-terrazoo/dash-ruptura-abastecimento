"""SQL das 12 views do dashboard (dados/VIEWS_DASH_PLANILHAS_BANCO.txt).

Todas sao parametrizadas por bind variable (:data_referencia) - nunca por
f-string com valor do usuario, para evitar SQL injection. O unico valor
interpolado via .format() e o nome do schema, que vem de configuracao (.env),
nunca de uma request.

Compatibilidade Oracle 11g: sem FETCH FIRST/OFFSET (sintaxe 12c+). Onde
precisamos de "top N" usamos subquery com ROWNUM.
"""

PLANILHA_GERAL = """
    SELECT
      DATA_REFERENCIA
      , COD_FORNECEDOR
      , NOME_FANTASIA_FORNECEDOR
      , SEGMENTO
      , RUPTURA_VALOR_VENDA
      , RUPTURA_PERCENTUAL
    FROM {schema}.VW_DASH_PLANILHA_GERAL
    WHERE DATA_REFERENCIA = :data_referencia
"""

PLANILHA_GRAFICO = """
    SELECT
      DATA_REFERENCIA
      , SEGMENTO
      , RUPTURA_VALOR_VENDA
      , RUPTURA_PERCENTUAL
    FROM {schema}.VW_DASH_PLANILHA_GRAFICO
    WHERE DATA_REFERENCIA = :data_referencia
"""

PLANILHA_GRAFICO_CD = """
    SELECT
      DATA_REFERENCIA
      , SEGMENTO
      , RUPTURA_VALOR_VENDA
      , RUPTURA_PERCENTUAL
    FROM {schema}.VW_DASH_PLANILHA_GRAFICO_CD
    WHERE DATA_REFERENCIA = :data_referencia
"""

DIA_A_DIA = """
    SELECT
      DATA_REFERENCIA
      , RUPTURA_VALOR_VENDA
      , RUPTURA_PERCENTUAL
    FROM {schema}.VW_DASH_DIA_A_DIA
    WHERE DATA_REFERENCIA = :data_referencia
"""

DIA_A_DIA_CD = """
    SELECT
      DATA_REFERENCIA
      , RUPTURA_VALOR_VENDA
      , RUPTURA_PERCENTUAL
    FROM {schema}.VW_DASH_DIA_A_DIA_CD
    WHERE DATA_REFERENCIA = :data_referencia
"""

LOJAS = """
    SELECT
      DATA_REFERENCIA
      , COD_UNIDADE
      , NOME_FANTASIA_LOJA
      , RUPTURA_VALOR_VENDA
      , RUPTURA_PERCENTUAL
    FROM {schema}.VW_DASH_LOJAS
    WHERE DATA_REFERENCIA = :data_referencia
"""

FORNECEDORES = """
    SELECT
      DATA_REFERENCIA
      , NOME_FANTASIA_FORNECEDOR
      , RUPTURA_VALOR_VENDA
      , RUPTURA_PERCENTUAL
    FROM {schema}.VW_DASH_FORNECEDORES
    WHERE DATA_REFERENCIA = :data_referencia
"""

LOJAS_BRIDGE = """
    SELECT
      DATA_REFERENCIA
      , COD_UNIDADE
      , NOME_FANTASIA_LOJA
      , SEGMENTO
      , COD_FORNECEDOR
      , NOME_FANTASIA_FORNECEDOR
      , COD_PRODUTO
      , DESCRICAO_PRODUTO
      , PRODUTO_ATIVO_RUPTURA
      , QTD_ESTOQUE_DISPONIVEL
      , RUPTURA_VALOR_VENDA
      , FACING
      , FACING_LOJAS
      , QTD_ESTOQUE_CD
      , SITUACAO
    FROM {schema}.VW_DASH_LOJAS_BRIDGE
    WHERE DATA_REFERENCIA = :data_referencia
"""

# Usada so pelo "Item Mais Critico" da Visao Geral: em vez de trazer a
# VW_DASH_LOJAS_BRIDGE inteira (uma linha por item/loja, pode ser dezenas de
# milhares de linhas) so para achar o maior valor em Python, deixa o Oracle
# ordenar e devolver so 1 linha - reduz drasticamente o trafego de rede E o
# tempo de processamento Python (que prendia o GIL e atrasava outras
# requisicoes concorrentes). Os codigos '300'/'203' replicam
# EXCLUDED_BRIDGE_UNIDADES em app/core/business_rules.py (loja/CD nao
# monitorados) - se aquela constante mudar, atualize aqui tambem.
LOJAS_BRIDGE_TOP_CRITICO = """
    SELECT * FROM (
        SELECT
          DATA_REFERENCIA
          , COD_UNIDADE
          , NOME_FANTASIA_LOJA
          , SEGMENTO
          , COD_FORNECEDOR
          , NOME_FANTASIA_FORNECEDOR
          , COD_PRODUTO
          , DESCRICAO_PRODUTO
          , RUPTURA_VALOR_VENDA
          , SITUACAO
        FROM {schema}.VW_DASH_LOJAS_BRIDGE
        WHERE DATA_REFERENCIA = :data_referencia
          AND RUPTURA_VALOR_VENDA > 0
          AND COD_UNIDADE NOT IN ('300', '203')
        ORDER BY RUPTURA_VALOR_VENDA DESC
    )
    WHERE ROWNUM <= 1
"""

DDE_GERAL = """
    SELECT
      DATA_REFERENCIA
      , DIAS_ESTOQUE
    FROM {schema}.VW_DASH_DDE
    WHERE DATA_REFERENCIA = :data_referencia
"""

DDE_FORNECEDOR = """
    SELECT
      DATA_REFERENCIA
      , NOME_FANTASIA_FORNECEDOR
      , DIAS_ESTOQUE
    FROM {schema}.VW_DASH_DDE_FORNECEDOR
    WHERE DATA_REFERENCIA = :data_referencia
"""

DDE_LOJAS = """
    SELECT
      DATA_REFERENCIA
      , COD_UNIDADE
      , NOME_FANTASIA_LOJA
      , DIAS_ESTOQUE
    FROM {schema}.VW_DASH_DDE_LOJAS
    WHERE DATA_REFERENCIA = :data_referencia
"""

DDE_SEGMENTO = """
    SELECT
      DATA_REFERENCIA
      , SEGMENTO
      , DIAS_ESTOQUE
    FROM {schema}.VW_DASH_DDE_SEGMENTO
    WHERE DATA_REFERENCIA = :data_referencia
"""

# Usada por /api/dates. VW_DASH_DIA_A_DIA tem uma linha por data de
# referencia, entao serve como fonte confiavel das datas disponiveis.
# ROWNUM em vez de FETCH FIRST porque o Oracle e 11g.
AVAILABLE_DATES = """
    SELECT DATA_REFERENCIA FROM (
        SELECT DISTINCT DATA_REFERENCIA
        FROM {schema}.VW_DASH_DIA_A_DIA
        ORDER BY DATA_REFERENCIA DESC
    )
    WHERE ROWNUM <= :limit
"""

# Series historicas (para os graficos de evolucao diaria / segmentos) -
# mesmas views de DIA_A_DIA e PLANILHA_GRAFICO, mas por intervalo de datas
# em vez de uma data fixa.
DIA_A_DIA_RANGE = """
    SELECT
      DATA_REFERENCIA
      , RUPTURA_VALOR_VENDA
      , RUPTURA_PERCENTUAL
    FROM {schema}.VW_DASH_DIA_A_DIA
    WHERE DATA_REFERENCIA BETWEEN :data_inicio AND :data_fim
    ORDER BY DATA_REFERENCIA
"""

DIA_A_DIA_CD_RANGE = """
    SELECT
      DATA_REFERENCIA
      , RUPTURA_VALOR_VENDA
      , RUPTURA_PERCENTUAL
    FROM {schema}.VW_DASH_DIA_A_DIA_CD
    WHERE DATA_REFERENCIA BETWEEN :data_inicio AND :data_fim
    ORDER BY DATA_REFERENCIA
"""

PLANILHA_GRAFICO_RANGE = """
    SELECT
      DATA_REFERENCIA
      , SEGMENTO
      , RUPTURA_VALOR_VENDA
      , RUPTURA_PERCENTUAL
    FROM {schema}.VW_DASH_PLANILHA_GRAFICO
    WHERE DATA_REFERENCIA BETWEEN :data_inicio AND :data_fim
    ORDER BY DATA_REFERENCIA
"""

PLANILHA_GRAFICO_CD_RANGE = """
    SELECT
      DATA_REFERENCIA
      , SEGMENTO
      , RUPTURA_VALOR_VENDA
      , RUPTURA_PERCENTUAL
    FROM {schema}.VW_DASH_PLANILHA_GRAFICO_CD
    WHERE DATA_REFERENCIA BETWEEN :data_inicio AND :data_fim
    ORDER BY DATA_REFERENCIA
"""

FORNECEDORES_RANGE = """
    SELECT
      DATA_REFERENCIA
      , NOME_FANTASIA_FORNECEDOR
      , RUPTURA_VALOR_VENDA
      , RUPTURA_PERCENTUAL
    FROM {schema}.VW_DASH_FORNECEDORES
    WHERE DATA_REFERENCIA BETWEEN :data_inicio AND :data_fim
    ORDER BY DATA_REFERENCIA
"""

DDE_SEGMENTO_RANGE = """
    SELECT
      DATA_REFERENCIA
      , SEGMENTO
      , DIAS_ESTOQUE
    FROM {schema}.VW_DASH_DDE_SEGMENTO
    WHERE DATA_REFERENCIA BETWEEN :data_inicio AND :data_fim
    ORDER BY DATA_REFERENCIA
"""
