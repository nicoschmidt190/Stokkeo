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

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()