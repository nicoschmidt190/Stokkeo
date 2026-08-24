from sqlalchemy import Column, Integer, String
from database import Base

class Categoria(Base):
    __tablename__ = "categoria"

    id_categoria = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False, unique=True)