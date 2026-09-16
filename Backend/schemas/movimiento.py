
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from schemas.producto import ProductoResponse


class MovimientoCreate(BaseModel):
    id_producto: int = Field(..., gt=0)
    tipo: str = Field(..., pattern="^(Entrada|Salida)$")
    origen: str = Field(default="Manual", pattern="^(Scanner|Manual)$")
    cantidad: float = Field(..., gt=0, description="La cantidad debe ser mayor a 0")
    fecha_hora: Optional[datetime] = None  # si no se envía, el servidor usa la fecha/hora actual
    motivo: Optional[str] = Field(default=None, pattern="^(Donacion|Decomiso|Perdida|Rotura)$")
    observaciones: Optional[str] = None

class MovimientoResponse(BaseModel):
    id_movimiento: int
    id_producto: int
    tipo: str
    origen: str
    cantidad: float
    fecha_hora: datetime
    motivo: Optional[str] = None
    observaciones: Optional[str] = None
    producto: Optional[ProductoResponse] = None

    class Config:
        from_attributes = True