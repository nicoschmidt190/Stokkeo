from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime, time
from pydantic import BaseModel, Field
from database import get_db
from models.movimiento import Movimiento
from models.producto import Producto, Stock
from schemas.movimiento import MovimientoCreate, MovimientoResponse

router = APIRouter(prefix="/movimientos", tags=["movimientos"])


# --- ESQUEMAS PYDANTIC PARA VENTA RÁPIDA ---
class VentaRapidaRequest(BaseModel):
    id_producto: int
    origen: str = Field(default="Manual", pattern="^(Manual|Scanner)$")

class VentaRapidaResponse(BaseModel):
    id_producto: int
    nombre: str
    stock_restante: float
    stock_minimo: float
    estado: str  # 'ok', 'minimo_alcanzado', 'sin_stock'
    mensaje: str


# --- ENDPOINTS ---
@router.get("", response_model=List[MovimientoResponse])
def listar_movimientos(
    desde: Optional[date] = Query(None, description="Filtra movimientos desde esta fecha (inclusive)"),
    hasta: Optional[date] = Query(None, description="Filtra movimientos hasta esta fecha (inclusive)"),
    db: Session = Depends(get_db)
):
    query = db.query(Movimiento)

    if desde:
        query = query.filter(Movimiento.fecha_hora >= datetime.combine(desde, time.min))
    if hasta:
        query = query.filter(Movimiento.fecha_hora <= datetime.combine(hasta, time.max))

    return query.order_by(Movimiento.fecha_hora.desc()).all()


@router.post("", response_model=MovimientoResponse, status_code=status.HTTP_201_CREATED)
def registrar_movimiento(movimiento_in: MovimientoCreate, db: Session = Depends(get_db)):
    if movimiento_in.cantidad <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La cantidad debe ser un número mayor a 0"
        )

    producto = db.query(Producto).filter(Producto.id_producto == movimiento_in.id_producto).first()
    if not producto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Producto no encontrado"
        )

    stock = db.query(Stock).filter(Stock.id_producto == movimiento_in.id_producto).first()
    if not stock:
        stock = Stock(id_producto=movimiento_in.id_producto, cantidad=0)
        db.add(stock)

    cantidad_actual = float(stock.cantidad)

    if movimiento_in.tipo == "Entrada":
        stock.cantidad = cantidad_actual + movimiento_in.cantidad
    elif movimiento_in.tipo == "Salida":
        if cantidad_actual < movimiento_in.cantidad:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Stock insuficiente. Stock actual: {cantidad_actual}"
            )
        stock.cantidad = cantidad_actual - movimiento_in.cantidad

    # motivo y observaciones solo tienen sentido en una Salida
    motivo = movimiento_in.motivo if movimiento_in.tipo == "Salida" else None
    observaciones = movimiento_in.observaciones if movimiento_in.tipo == "Salida" else None

    datos_movimiento = dict(
        id_producto=movimiento_in.id_producto,
        tipo=movimiento_in.tipo,
        origen=movimiento_in.origen,
        cantidad=movimiento_in.cantidad,
        motivo=motivo,
        observaciones=observaciones,
    )

    # Si el cliente mandó una fecha, la usamos. Si no, dejamos que el server_default
    # de la columna (func.now()) ponga la fecha/hora actual — por eso NO asignamos
    # la clave "fecha_hora" en absoluto cuando viene vacía, en vez de asignarle None.
    if movimiento_in.fecha_hora is not None:
        datos_movimiento["fecha_hora"] = movimiento_in.fecha_hora

    nuevo_movimiento = Movimiento(**datos_movimiento)
    db.add(nuevo_movimiento)
    db.commit()
    db.refresh(nuevo_movimiento)

    return nuevo_movimiento


@router.post("/venta-rapida", response_model=VentaRapidaResponse)
def registrar_venta_rapida(payload: VentaRapidaRequest, db: Session = Depends(get_db)):
    producto = db.query(Producto).filter(Producto.id_producto == payload.id_producto).first()
    if not producto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Código o producto no registrado en el catálogo"
        )

    stock = db.query(Stock).filter(Stock.id_producto == payload.id_producto).first()
    stock_actual = float(stock.cantidad) if stock else 0.0

    if stock_actual <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sin stock disponible para este producto"
        )

    stock.cantidad = stock_actual - 1
    nuevo_stock = float(stock.cantidad)

    movimiento = Movimiento(
        id_producto=payload.id_producto,
        tipo="Salida",
        origen=payload.origen,
        cantidad=1
    )
    db.add(movimiento)
    db.commit()

    stock_minimo = float(producto.stock_minimo)

    if nuevo_stock <= 0:
        estado = "sin_stock"
        mensaje = "Sin stock disponible para este producto (Quedan 0 unidades)"
    elif nuevo_stock <= stock_minimo:
        estado = "minimo_alcanzado"
        mensaje = f"Stock mínimo alcanzado - Quedan {nuevo_stock} unidades"
    else:
        estado = "ok"
        mensaje = f"{producto.nombre} vendido - Stock restante: {nuevo_stock}"

    return VentaRapidaResponse(
        id_producto=producto.id_producto,
        nombre=producto.nombre,
        stock_restante=nuevo_stock,
        stock_minimo=stock_minimo,
        estado=estado,
        mensaje=mensaje
    )