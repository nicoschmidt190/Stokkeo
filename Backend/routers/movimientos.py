from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
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
    stock_restante: int
    stock_minimo: int
    estado: str  # 'ok', 'minimo_alcanzado', 'sin_stock'
    mensaje: str


# --- ENDPOINTS EXISTENTES ---

@router.get("", response_model=List[MovimientoResponse])
def listar_movimientos(db: Session = Depends(get_db)):
    return db.query(Movimiento).order_by(Movimiento.fecha_hora.desc()).all()


@router.post("", response_model=MovimientoResponse, status_code=status.HTTP_201_CREATED)
def registrar_movimiento(movimiento_in: MovimientoCreate, db: Session = Depends(get_db)):
    # 1. Validar que la cantidad sea mayor a 0
    if movimiento_in.cantidad <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La cantidad debe ser un número mayor a 0"
        )

    # 2. Validar que el producto exista
    producto = db.query(Producto).filter(Producto.id_producto == movimiento_in.id_producto).first()
    if not producto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Producto no encontrado"
        )

    # 3. Obtener o inicializar el registro de stock
    stock = db.query(Stock).filter(Stock.id_producto == movimiento_in.id_producto).first()
    if not stock:
        stock = Stock(id_producto=movimiento_in.id_producto, cantidad=0)
        db.add(stock)

    # 4. Actualizar la cantidad según el tipo de movimiento
    if movimiento_in.tipo == "Entrada":
        stock.cantidad += movimiento_in.cantidad
    elif movimiento_in.tipo == "Salida":
        if stock.cantidad < movimiento_in.cantidad:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Stock insuficiente. Stock actual: {stock.cantidad}"
            )
        stock.cantidad -= movimiento_in.cantidad

    # 5. Registrar el movimiento en el historial
    nuevo_movimiento = Movimiento(
        id_producto=movimiento_in.id_producto,
        tipo=movimiento_in.tipo,
        origen=movimiento_in.origen,
        cantidad=movimiento_in.cantidad
    )
    db.add(nuevo_movimiento)
    db.commit()
    db.refresh(nuevo_movimiento)

    return nuevo_movimiento


# --- NUEVO ENDPOINT: VENTA RÁPIDA (DESCUENTO DE 1 UNIDAD) ---

@router.post("/venta-rapida", response_model=VentaRapidaResponse)
def registrar_venta_rapida(payload: VentaRapidaRequest, db: Session = Depends(get_db)):
    # 1. Buscar el producto
    producto = db.query(Producto).filter(Producto.id_producto == payload.id_producto).first()
    if not producto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Código o producto no registrado en el catálogo"
        )

    # 2. Consultar stock disponible
    stock = db.query(Stock).filter(Stock.id_producto == payload.id_producto).first()
    stock_actual = stock.cantidad if stock else 0

    # 3. Bloquear si el stock es 0 o negativo
    if stock_actual <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sin stock disponible para este producto"
        )

    # 4. Descontar exactamente 1 unidad
    stock.cantidad -= 1
    nuevo_stock = stock.cantidad

    # 5. Registrar el movimiento de salida
    movimiento = Movimiento(
        id_producto=payload.id_producto,
        tipo="Salida",
        origen=payload.origen,
        cantidad=1
    )
    db.add(movimiento)
    db.commit()

    # 6. Determinar estado visual y mensaje para la alerta
    if nuevo_stock == 0:
        estado = "sin_stock"
        mensaje = f"Sin stock disponible para este producto (Quedan 0 unidades)"
    elif nuevo_stock <= producto.stock_minimo:
        estado = "minimo_alcanzado"
        mensaje = f"Stock mínimo alcanzado - Quedan {nuevo_stock} unidades"
    else:
        estado = "ok"
        mensaje = f"{producto.nombre} vendido - Stock restante: {nuevo_stock}"

    return VentaRapidaResponse(
        id_producto=producto.id_producto,
        nombre=producto.nombre,
        stock_restante=nuevo_stock,
        stock_minimo=producto.stock_minimo,
        estado=estado,
        mensaje=mensaje
    )