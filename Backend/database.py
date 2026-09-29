from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# pool_pre_ping evita usar conexiones que Supabase ya cerró por inactividad:
# sin esto, la primera query después de un rato sin uso puede fallar o
# demorar de más mientras SQLAlchemy detecta la conexión muerta y reconecta.
# pool_recycle cierra y renueva conexiones cada 30 min por las dudas.
engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=1800)

# expire_on_commit=False: por defecto, SQLAlchemy "invalida" todos los
# atributos de un objeto apenas se hace commit(), así que la próxima vez
# que se lee cualquier campo (incluidas relaciones como categoria/stock)
# dispara un SELECT nuevo a Supabase, aunque el dato ya se tenía en Python.
# Como cada request usa una sesión propia y corta (ver get_db más abajo),
# no hay riesgo real de trabajar con datos desactualizados dentro del
# mismo request — así que desactivarlo ahorra varios round-trips por
# operación de guardado en toda la app.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, expire_on_commit=False)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()