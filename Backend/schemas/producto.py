from pydantic import BaseModel, Field
from typing import Optional
from decimal import Decimal

# Sub-esquemas anidados
class CategoriaNested(BaseModel):
    id_categoria: int
    nombre: str

    class Config:
        from_attributes = True

class StockSimple(BaseModel):
    cantidad: float  # antes int — Stock.cantidad ahora es Numeric (admite decimales)

    class Config:
        from_attributes = True

# Esquema para crear y editar productos
class ProductoCreate(BaseModel):
    nombre: str = Field(..., min_length=1)
    precioCosto: Decimal = Field(..., ge=0)
    stock_minimo: float = Field(..., ge=0)
    unidad_medida: str = Field(default="unidad")
    codigo_barras: Optional[str] = None
    id_categoria: int = Field(..., gt=0)
    stock_actual: Optional[float] = Field(default=0, ge=0)

# Esquema de respuesta para producto
class ProductoResponse(BaseModel):
    id_producto: int
    nombre: str
    precioCosto: Decimal
    stock_minimo: float  # antes int — Producto.stock_minimo ahora es Numeric
    unidad_medida: str = "unidad"
    codigo_barras: Optional[str] = None
    id_categoria: int
    categoria: Optional[CategoriaNested] = None
    stock: Optional[StockSimple] = None

    class Config:
        from_attributes = True

# Esquema para el listado del módulo Stock
class StockResponse(BaseModel):
    id_producto: int
    nombre: str
    categoria: Optional[CategoriaNested] = None
    cantidad: float       # antes int
    stock_minimo: float   # antes int
    unidad_medida: str    # nuevo — lo usa Stock.jsx para mostrar "4,00 kg" en vez de "4"
    estado: str  # "ok" | "bajo" | "sin_stock"