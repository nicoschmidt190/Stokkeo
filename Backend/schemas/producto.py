from pydantic import BaseModel, Field
from typing import Optional

class ProductoCreate(BaseModel):
    nombre: str = Field(..., min_length=1)
    precioCosto: float = Field(..., ge=0)
    stock_minimo: int = Field(..., ge=0)
    codigo_barras: Optional[str] = None
    id_categoria: int = Field(..., gt=0)

class CategoriaNested(BaseModel):
    id_categoria: int
    nombre: str

    class Config:
        from_attributes = True

class ProductoResponse(BaseModel):
    id_producto: int
    nombre: str
    precioCosto: float
    stock_minimo: int
    codigo_barras: Optional[str] = None
    id_categoria: int
    categoria: Optional[CategoriaNested] = None

    class Config:
        from_attributes = True

class StockResponse(BaseModel):
    id_producto: int
    nombre: str
    categoria: Optional[CategoriaNested] = None
    cantidad: int
    stock_minimo: int
    estado: str  # "ok" | "bajo" | "sin_stock"
    