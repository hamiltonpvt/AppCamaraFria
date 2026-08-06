from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import psycopg2
from psycopg2.extras import RealDictCursor

app = FastAPI(title="API Câmara Fria")

# 1. Configuração de CORS (Liberado para Netlify e headers do ngrok)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Configuração de Conexão com o Banco de Dados PostgreSQL
DB_CONFIG = {
    "dbname": "postgres",
    "user": "postgres",
    "password": "1973",  # <-- Confirme se é a sua senha do PostgreSQL
    "host": "localhost",
    "port": 5432
}


def get_db_connection():
    try:
        conn = psycopg2.connect(**DB_CONFIG, cursor_factory=RealDictCursor)
        # Define o encoding do cliente para a codificação padrão do Windows (Latin-1 / ISO-8859-1)
        conn.set_client_encoding('WIN1252')
        return conn
    except Exception:
        try:
            # Fallback caso WIN1252 não seja suportado diretamente pelo servidor
            conn = psycopg2.connect(**DB_CONFIG, cursor_factory=RealDictCursor)
            conn.set_client_encoding('LATIN1')
            return conn
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Erro no banco: {str(e)}")


# 3. Schemas de Dados
class EntradaPayload(BaseModel):
    cliente_id: int
    espaco_id: int
    nome_produto: str
    temperatura_ideal: float
    espaco_ocupado_m2: float
    validade: str


class SaidaPayload(BaseModel):
    espaco_id: int


class ProrrogarPayload(BaseModel):
    espaco_id: int
    nova_validade: str


# 4. Rotas da Aplicação

@app.get("/")
def home():
    return {"status": "API da Câmara Fria ativa!"}


@app.get("/camara-fria/layout")
def obter_layout():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM v_camara_fria_layout;")
        resultado = cursor.fetchall()
        return resultado
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao consultar layout: {str(e)}")
    finally:
        cursor.close()
        conn.close()


@app.post("/camara-fria/entrada")
def registrar_entrada(payload: EntradaPayload):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO produtos_estocados 
            (cliente_id, espaco_id, nome_produto, temperatura_ideal, espaco_ocupado_m2, validade)
            VALUES (%s, %s, %s, %s, %s, %s);
        """, (
            payload.cliente_id,
            payload.espaco_id,
            payload.nome_produto,
            payload.temperatura_ideal,
            payload.espaco_ocupado_m2,
            payload.validade
        ))

        cursor.execute("UPDATE espacos SET status = 'ocupado' WHERE id = %s;", (payload.espaco_id,))
        conn.commit()
        return {"mensagem": "Entrada registrada com sucesso!"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=f"Erro ao registrar entrada: {str(e)}")
    finally:
        cursor.close()
        conn.close()


@app.post("/camara-fria/saida")
def dar_baixa(payload: SaidaPayload):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM produtos_estocados WHERE espaco_id = %s;", (payload.espaco_id,))
        cursor.execute("UPDATE espacos SET status = 'disponivel' WHERE id = %s;", (payload.espaco_id,))
        conn.commit()
        return {"mensagem": "Espaço liberado com sucesso!"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=f"Erro ao dar baixa: {str(e)}")
    finally:
        cursor.close()
        conn.close()


@app.post("/camara-fria/prorrogar")
def prorrogar_permanencia(payload: ProrrogarPayload):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("UPDATE produtos_estocados SET validade = %s WHERE espaco_id = %s;",
                       (payload.nova_validade, payload.espaco_id))
        conn.commit()
        return {"mensagem": "Validade updated com sucesso!"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=f"Erro ao prorrogar: {str(e)}")
    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    import uvicorn
    # Executa o servidor localmente na porta 8000
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
