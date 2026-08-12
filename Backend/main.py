from fastapi import FastAPI
from database import engine

app = FastAPI()

@app.on_event("startup")
def startup():
    try:
        with engine.connect() as connection:
            print("✅ Conexión a la base de datos exitosa")
    except Exception as e:
        print(f"❌ Error al conectar a la base de datos: {e}")

@app.get("/health")
def health():
    return {"status": "ok"}

