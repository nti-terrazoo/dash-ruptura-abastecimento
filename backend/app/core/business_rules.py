"""Constantes de regra de negocio portadas do dashboard legado
(dados/dash 26.06.html). Mantidas fielmente ao original - ver relatorio de
analise do HTML para a origem de cada uma. Sao constantes de codigo por
enquanto (nao vem de tabela/config no banco); se o negocio pedir para
alterar metas com frequencia, isso deve virar uma tabela administravel.
"""

from datetime import date

# % de ruptura meta por segmento.
SEG_METAS: dict[str, float] = {
    "FOOD": 8,
    "FARMACIA": 5,
    "JARDINAGEM": 15,
    "AGROPECUARIA": 12,
    "HIGIENE E BELEZA": 13,
    "ACESSORIOS": 20,
    "FAUNA": 20,
    "AQUARISMO": 15,
    "LAZER": 20,
}

VALID_SEGMENTOS: list[str] = list(SEG_METAS.keys())

# Aliases de nome de segmento vindos da fonte de dados -> nome canonico.
SEG_ALIAS: dict[str, str] = {
    "PETFOOD": "FOOD",
    "PET FOOD": "FOOD",
    "FARMÁCIA": "FARMACIA",
    "PET FARMACIA": "FARMACIA",
    "PETFARMACIA": "FARMACIA",
    "HIGIENE E BELEZA": "HIGIENE E BELEZA",
    "PET HIGIENE E BELEZA": "HIGIENE E BELEZA",
    "PETHIGIENE E BELEZA": "HIGIENE E BELEZA",
    "PET ACESSORIOS": "ACESSORIOS",
    "PETACESSORIOS": "ACESSORIOS",
    "PET FAUNA": "FAUNA",
    "PETFAUNA": "FAUNA",
    "PET AQUARISMO": "AQUARISMO",
    "PETAQUARISMO": "AQUARISMO",
    "AGROPECUÁRIA": "AGROPECUARIA",
    "JARDINAGEM": "JARDINAGEM",
    "LAZER": "LAZER",
}

# Meta mensal de DDE (dias de estoque) por segmento - "Proposta DDE 180+".
# Indice 0 = marco/2026 ... indice 9 = dezembro/2026 (10 meses).
DDE_META_SEG: dict[str, list[int]] = {
    "FARMACIA": [118, 117, 115, 113, 111, 110, 108, 108, 108, 108],
    "FOOD": [62, 61, 61, 60, 59, 59, 58, 58, 58, 58],
    "JARDINAGEM": [131, 128, 124, 121, 117, 113, 110, 110, 110, 110],
    "AGROPECUARIA": [105, 102, 99, 96, 93, 90, 87, 87, 87, 87],
    "ACESSORIOS": [381, 366, 351, 336, 321, 306, 291, 291, 291, 291],
    "HIGIENE E BELEZA": [88, 86, 85, 84, 82, 81, 80, 80, 80, 80],
    "FAUNA": [95, 93, 91, 88, 86, 84, 82, 82, 82, 82],
    "AQUARISMO": [168, 163, 158, 152, 147, 142, 136, 136, 136, 136],
    "LAZER": [85, 83, 82, 80, 79, 77, 76, 76, 76, 76],
}
DDE_META_SEG_FIRST_MONTH = 3  # marco


def get_dde_meta(segmento: str, referencia: date) -> float | None:
    """Meta de DDE do segmento no mes da data de referencia, com clamp para
    fora do intervalo mar-dez (usa o primeiro/ultimo valor da serie)."""
    metas = DDE_META_SEG.get(segmento)
    if not metas:
        return None
    mes = referencia.month
    if mes < DDE_META_SEG_FIRST_MONTH:
        return metas[0]
    if mes > DDE_META_SEG_FIRST_MONTH + len(metas) - 1:
        return metas[-1]
    return metas[mes - DDE_META_SEG_FIRST_MONTH]


# Definicao dos 5 status da "bridge" (waterfall Meta -> Ruptura Atual).
# "keys" sao substrings (case-insensitive) usadas para casar com o texto
# livre de SITUACAO vindo da view - a primeira categoria cujo array bate e
# usada (ordem importa).
BRIDGE_STATUS_DEFS: list[dict] = [
    {
        "label": "Sit. Crítica c/ Pedido",
        "keys": ["PEDIDO PENDENTE", "SITUAÇÃO CRÍTICA - PEDIDO", "SITUACAO CRITICA - PEDIDO", "- PEDIDO"],
        "color": "#ff4444",
    },
    {
        "label": "Sit. Crítica s/ Pedido",
        "keys": ["SEM PEDIDO", "SITUAÇÃO CRÍTICA - SEM", "SITUACAO CRITICA - SEM", "- SEM"],
        "color": "#ff9999",
    },
    {
        "label": "CD Insuficiente",
        "keys": ["CD INSUFICIENTE", "INSUFICIENTE P/", "CD INSUF"],
        "color": "#f4a030",
    },
    {
        "label": "CD Atende Loja",
        "keys": ["CD ATENDE LOJA", "CD ATENDE", "ATENDE LOJA", "PRENOTA"],
        "color": "#34c97a",
    },
    {
        "label": "Estoque Negativo",
        "keys": ["ESTOQUE NEGATIVO", "NEGATIVO"],
        "color": "#ffd166",
    },
]

# Fallback usado apenas quando nao ha itens reais de bridge para o dia (sem
# ranking possivel) - proporcoes fixas herdadas do dashboard antigo.
BRIDGE_FALLBACK_PROPORTIONS: list[float] = [0.400, 0.214, 0.102, 0.252, 0.032]

# Fator aplicado sobre %/valor do segmento para estimar a fatia "critica"
# (Sit. Critica c/Pedido + Sit. Critica s/Pedido) quando nao ha bridge real
# por segmento. Igual a soma das duas primeiras proporcoes do fallback
# (0.400 + 0.214 = 0.614). Herdado do HTML original sem justificativa de
# negocio documentada - manter por fidelidade, mas validar com o time antes
# de tomar decisao operacional em cima dele.
CRIT_LEGACY_FACTOR = 0.614

# Lojas/filiais que nao sao pontos de venda reais (CD, producao) - excluidas
# de qualquer ranking/agregacao de loja. Comparacao por prefixo (startswith),
# case-insensitive.
EXCLUDED_STORE_PREFIXES: list[str] = ["TERRAZOO CD", "LYNKZ BR", "RV PRODUÇÃO", "LYNKZ IMPERATRI", "CD "]

# Codigos de unidade sempre descartados dos itens de bridge.
EXCLUDED_BRIDGE_UNIDADES: set[str] = {"300", "203"}


# Paleta de cores por segmento (ciclo por indice em VALID_SEGMENTOS) -
# array "GS" recuperado literalmente do HTML legado (dash 26.06.html, linha
# 717). Uma tentativa anterior deste arquivo usava uma paleta placeholder por
# acreditar que o array original estivesse irrecuperavel; nao estava.
SEGMENTO_COLOR_PALETTE: list[str] = [
    "#5ed9a0", "#4cbf8a", "#3ca574", "#2e8b5e", "#7ff5b8",
    "#9aebb2", "#c4e8ce", "#6bb5ff", "#f4a85d",
]


def segmento_color(segmento: str) -> str:
    try:
        idx = VALID_SEGMENTOS.index(segmento)
    except ValueError:
        idx = 0
    return SEGMENTO_COLOR_PALETTE[idx % len(SEGMENTO_COLOR_PALETTE)]


def norm_seg(segmento: str | None) -> str:
    """Normaliza nome de segmento (alias -> canonico; remove prefixo 'PET')."""
    if not segmento:
        return ""
    up = segmento.strip().upper()
    if up in SEG_ALIAS:
        return SEG_ALIAS[up]
    if up.startswith("PET "):
        return segmento.strip()[4:].strip()
    if up.startswith("PET"):
        return segmento.strip()[3:].strip()
    return segmento.strip()


def is_excluded_store(nome_loja: str) -> bool:
    up = (nome_loja or "").strip().upper()
    return any(up.startswith(prefix.upper()) for prefix in EXCLUDED_STORE_PREFIXES)


def loja_status(percentual: float) -> str:
    """Badge de status da loja pelo % de ruptura."""
    if percentual <= 10:
        return "OK"
    if percentual <= 15:
        return "Atenção"
    if percentual <= 25:
        return "Alerta"
    return "Crítico"


def loja_color(percentual: float) -> str:
    return "#2d6b4a" if percentual <= 10 else "#e05555"


def fornecedor_color(percentual: float) -> str:
    """Cores identicas as usadas na tabela de fornecedores do HTML legado
    (dash 26.06.html, linha 2270: `f.p>30?'#ff6b6b':f.p>15?'#ffd166':'#5ed9a0'`)."""
    if percentual > 30:
        return "#ff6b6b"
    if percentual > 15:
        return "#ffd166"
    return "#5ed9a0"


def segmento_is_over_meta(segmento: str, percentual: float) -> bool:
    meta = SEG_METAS.get(norm_seg(segmento))
    return meta is not None and percentual > meta


def match_bridge_status(situacao: str) -> dict | None:
    """Retorna a primeira definicao de status cujas keys casam (substring,
    case-insensitive) com o texto de SITUACAO, ou None se nada casar."""
    up = (situacao or "").strip().upper()
    for status_def in BRIDGE_STATUS_DEFS:
        if any(key in up for key in status_def["keys"]):
            return status_def
    return None
