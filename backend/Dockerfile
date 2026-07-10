# Empacota a API Python + Oracle Instant Client (modo "thick", necessario
# para conectar a um Oracle 11g ou mais antigo). O container conecta pela
# rede ao Oracle legado existente (ex: 192.168.0.43) - ele NAO roda o banco
# em si, so a aplicacao e suas dependencias de cliente.
FROM python:3.12-slim

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    ORACLE_CLIENT_LIB_DIR=/opt/oracle/instantclient

# --- Oracle Instant Client (Basic Lite, Linux x64) ---
# Versao 19.23: cliente 19c conecta a servidores Oracle 11.2.0.4+ (matriz de
# interoperabilidade da Oracle), cobrindo o banco legado 11g deste projeto.
RUN set -eux; \
    apt-get update && apt-get install -y --no-install-recommends curl unzip; \
    apt-get install -y --no-install-recommends libaio1 || apt-get install -y --no-install-recommends libaio1t64; \
    curl -fsSL -o /tmp/instantclient.zip \
        "https://download.oracle.com/otn_software/linux/instantclient/1923000/instantclient-basiclite-linux.x64-19.23.0.0.0dbru.zip"; \
    mkdir -p /opt/oracle; \
    unzip -q /tmp/instantclient.zip -d /opt/oracle; \
    mv /opt/oracle/instantclient_19_23 "$ORACLE_CLIENT_LIB_DIR"; \
    rm /tmp/instantclient.zip; \
    echo "$ORACLE_CLIENT_LIB_DIR" > /etc/ld.so.conf.d/oracle-instantclient.conf; \
    ldconfig; \
    # Debian trixie+ renomeou o pacote para libaio1t64, cuja lib fisica se
    # chama libaio.so.1t64.* em vez de libaio.so.1 - o Instant Client (binario
    # pre-compilado) so procura pelo nome antigo, entao criamos um symlink de
    # compatibilidade quando necessario.
    if ! ldconfig -p | grep -q 'libaio\.so\.1$'; then \
        libaio_path=$(find /usr/lib -name 'libaio.so.1t64*' | head -1); \
        if [ -n "$libaio_path" ]; then \
            ln -s "$(basename "$libaio_path")" "$(dirname "$libaio_path")/libaio.so.1"; \
            ldconfig; \
        fi; \
    fi; \
    apt-get purge -y curl unzip; \
    apt-get autoremove -y; \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
