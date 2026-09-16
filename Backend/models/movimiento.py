from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class Movimiento(Base):
    __tablename__ = "movimiento"

    id_movimiento = Column(Integer, primary_key=True, index=True)
    id_producto = Column(Integer, ForeignKey("producto.id_producto"), nullable=False)
    tipo = Column(String, nullable=False)  # 'Entrada' o 'Salida'
    origen = Column(String, nullable=False)  # 'Scanner' o 'Manual'
    cantidad = Column(Numeric(10, 2), nullable=False)
    fecha_hora = Column(DateTime(timezone=True), server_default=func.now())

    producto = relationship("Producto")