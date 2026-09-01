from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from schemas.producto import ProductoResponse


# Validamos que la cantidad ingresada sea mayor a 0
class MovimientoCreate(BaseModel):
    id_producto: int = Field(..., gt=0)
    tipo: str = Field(..., pattern="^(Entrada|Salida)$")
    origen: str = Field(default="Manual", pattern="^(Scanner|Manual)$")
    cantidad: int = Field(..., gt=0, description="La cantidad debe ser mayor a 0")

class MovimientoResponse(BaseModel):
    id_movimiento: int
    id_producto: int
    tipo: str
    origen: str
    cantidad: int
    fecha_hora: datetime
    producto: Optional[ProductoResponse] = None

    class Config:
        from_attributes = True