from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base

class PrecioCompetidor(Base):
    __tablename__ = "precio_competidor"

    id_precio_competidor = Column(Integer, primary_key=True, index=True)
    id_producto = Column(Integer, ForeignKey("producto.id_producto", ondelete="CASCADE"), nullable=False, index=True)
    nombre_producto = Column(String(100), nullable=False)
    supermercado = Column(String, nullable=False)
    fecha_scraping = Column(DateTime(timezone=True), server_default=func.now())
    precio = Column(Numeric, nullable=True)

    producto = relationship("Producto")