import io
import logging
import smtplib
from email.message import EmailMessage

import pandas as pd

from app.config import get_settings
from app.db.oracle import get_connection
from app.db.queries import ENVIO_EMAIL_BRIDGE
from openpyxl.utils import get_column_letter

logger = logging.getLogger("app.jobs.daily_email")

def generate_and_send_email():
    settings = get_settings()
    
    if not settings.email_user or not settings.email_password:
        logger.error("Credenciais de e-mail não configuradas no .env. Cancelando envio.")
        return

    logger.info("Iniciando geração do relatório diário de ruptura para envio por e-mail...")

    try:
        #busca de dados
        with get_connection() as conn:
            query = ENVIO_EMAIL_BRIDGE.format(schema=settings.oracle_schema)
            df = pd.read_sql(query, con=conn)
            
        if df.empty:
            logger.warning("Nenhum dado retornado da view. E-mail não enviado.")
            return

        #renomear colunas
        colunas_renomeadas = {
            'CODIGO': 'Código',
            'UNIDADE': 'Unidade',
            'SEGMENTO': 'Segmento',
            'CODIGO_FORNECEDOR': 'Código Fornecedor',
            'NOME_FORNECEDOR': 'Nome Fornecedor',
            'CODIGO_PRODUTO': 'Código Produto',
            'PRODUTO': 'Produto',
            'PRODUTO_ATIVO': 'Produto Ativo',
            'ESTOQUE_DISPONIVEL': 'Qtd Disponível + Faturamento',
            'RUPTURA_VALOR_VENDA': 'Ruptura × Preço Venda',
            'FACING': 'Facing Manual',
            'STATUS_BRIDGE': 'Status Bridge'
        }
        df = df.rename(columns=colunas_renomeadas)

        colunas_finais = [
            'Código', 'Unidade', 'Segmento', 'Código Fornecedor', 'Nome Fornecedor',
            'Código Produto', 'Produto', 'Produto Ativo', 'Qtd Disponível + Faturamento',
            'Ruptura × Preço Venda', 'Facing Manual', 'Status Bridge'
        ]
        df_final = df[colunas_finais]

        excel_buffer = io.BytesIO()
        with pd.ExcelWriter(excel_buffer, engine='openpyxl') as writer:
            # Salvamos definindo um nome específico para a aba (sheet)
            df_final.to_excel(writer, index=False, sheet_name='Ruptura')
            
            #acessar a aba gerada pelo openpyxl
            worksheet = writer.sheets['Ruptura']

            #ajustar a largura
            for i, col in enumerate(df_final.columns):
                tamanho_maximo = max(
                    df_final[col].astype(str).map(len).max(), 
                    len(str(col))
                )
                
                letra_coluna = get_column_letter(i + 1)
                
                worksheet.column_dimensions[letra_coluna].width = tamanho_maximo + 2
                
        excel_buffer.seek(0)

        #disparo de email
        msg = EmailMessage()
        msg['Subject'] = 'Relatório Diário de Ruptura do Abastecimento'
        msg['From'] = settings.email_user
        msg['To'] = 'abastecimento@terrazoo.com.br, compras@terrazoo.com.br' # 'abastecimento@terrazoo.com.br, compras@terrazoo.com.br'
        
        msg.set_content(
            "Bom dia,\n\n"
            "Segue em anexo o relatório diário de ruptura do abastecimento contendo "
            "as classificações da Bridge.\n\n"
            "Atenciosamente,\nSetor de TI"
        )
        
        msg.add_attachment(
            excel_buffer.read(), 
            maintype='application', 
            subtype='vnd.openxmlformats-officedocument.spreadsheetml.sheet', 
            filename='relatorio_ruptura_bridge.xlsx'
        )
        
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp:
            smtp.login(settings.email_user, settings.email_password)
            smtp.send_message(msg)
            
        logger.info("E-mail com relatório enviado com sucesso.")
        
    except Exception as e:
        logger.exception(f"Erro na rotina de geração e envio de e-mail: {e}")