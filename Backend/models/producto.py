from sqlalchemy import Column, Integer, String, Numeric, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class Producto(Base):
    __tablename__ = "producto"

    id_producto = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, unique=True, nullable=False)
    precioCosto = Column(Numeric(10, 2), nullable=False, default=0.00)
    stock_minimo = Column(Integer, nullable=False, default=0)
    codigo_barras = Column(String, unique=True, nullable=True)
    id_categoria = Column(Integer, ForeignKey("categoria.id_categoria"), nullable=False)

    categoria = relationship("Categoria")
    stock = relationship("Stock", back_populates="producto", uselist=False, cascade="all, delete-orphan")

class Stock(Base):
    __tablename__ = "stock"

    id_producto = Column(Integer, ForeignKey("producto.id_producto"), primary_key=True)
    cantidad = Column(Integer, nullable=False, default=0)

    producto = relationship("Producto", back_populates="stock")