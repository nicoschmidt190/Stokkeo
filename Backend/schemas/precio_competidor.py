from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional, List


class ComparacionPrecioResponse(BaseModel):
    # CU-26: una fila por cada producto que es "conveniente" comprar en el
    # supermercado (diferencia >= 20%). El nombre del producto y el precio
    # del negocio salen de Producto; el precio del supermercado y la fecha
    # salen de PrecioCompetidor.
    id_producto: int
    nombre_producto: str
    precio_negocio: float
    precio_supermercado: float
    supermercado: str
    fecha_scraping: Optional[datetime]
    diferencia_porcentual: float  # (precio_negocio - precio_supermercado) / precio_negocio * 100

    model_config = ConfigDict(from_attributes=True)


class ComparacionPreciosListResponse(BaseModel):
    # Distingue los 3 estados que pide CU-26: nunca se corrió el scraping,
    # se corrió pero nada superó el 20%, o hay resultados para mostrar.
    nunca_ejecutado: bool
    items: List[ComparacionPrecioResponse]


class EstadoScrapingResponse(BaseModel):
    en_progreso: bool
    ultima_actualizacion: Optional[datetime]
    mensaje: Optional[str] = None
    supermercados_ok: List[str] = []
    supermercados_fallidos: List[str] = []


class IniciarScrapingResponse(BaseModel):
    iniciado: bool
    mensaje: str