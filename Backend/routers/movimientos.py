from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import text, func
from typing import List, Optional
from datetime import date, datetime, time
from pydantic import BaseModel, Field
from database import get_db
from models.movimiento import Movimiento
from models.producto import Producto, Stock
from schemas.movimiento import MovimientoCreate, MovimientoResponse
from schemas.pagination import PaginatedResponse

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
@router.get("", response_model=PaginatedResponse[MovimientoResponse])
def listar_movimientos(
    page: int = Query(1, ge=1),
    page_size: int = Query(30, ge=1, le=200),
    desde: Optional[date] = Query(None, description="Filtra movimientos desde esta fecha (inclusive)"),
    hasta: Optional[date] = Query(None, description="Filtra movimientos hasta esta fecha (inclusive)"),
    search: Optional[str] = Query(None, description="Filtra por nombre de producto"),
    id_categoria: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    # Movimientos es la tabla que más crece con el tiempo (nunca se
    # "estabiliza" como el catálogo de productos), así que es la que más
    # necesita paginación server-side. MovimientoResponse anida producto ->
    # categoria y producto -> stock; sin joinedload, cada fila dispara 3
    # queries extra contra Supabase (N+1).
    query = db.query(Movimiento).options(
        joinedload(Movimiento.producto).joinedload(Producto.categoria),
        joinedload(Movimiento.producto).joinedload(Producto.stock),
    )

    if desde:
        query = query.filter(Movimiento.fecha_hora >= datetime.combine(desde, time.min))
    if hasta:
        query = query.filter(Movimiento.fecha_hora <= datetime.combine(hasta, time.max))
    if search or id_categoria:
        # join implícito vía el FK: solo cuando hace falta filtrar por algo
        # del producto (nombre o categoría), sin traer todos los
        # movimientos primero.
        query = query.join(Producto, Producto.id_producto == Movimiento.id_producto)
        if search:
            query = query.filter(Producto.nombre.ilike(f"%{search.strip()}%"))
        if id_categoria:
            query = query.filter(Producto.id_categoria == id_categoria)

    total = query.with_entities(func.count(Movimiento.id_movimiento)).scalar()

    items = (
        query.order_by(Movimiento.fecha_hora.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return PaginatedResponse(
        items=items, total=total, page=page, page_size=page_size, total_pages=total_pages
    )


@router.post("", response_model=MovimientoResponse, status_code=status.HTTP_201_CREATED)
def registrar_movimiento(movimiento_in: MovimientoCreate, db: Session = Depends(get_db)):
    if movimiento_in.cantidad <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La cantidad debe ser un número mayor a 0"
        )

    # joinedload trae producto + stock en 1 sola query en vez de 2 round-trips
    # separados contra Supabase.
    producto = (
        db.query(Producto)
        .options(joinedload(Producto.stock))
        .filter(Producto.id_producto == movimiento_in.id_producto)
        .first()
    )
    if not producto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Producto no encontrado"
        )

    stock = producto.stock
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
    # ---- Camino feliz: 1 sola sentencia para todo (antes eran 3: SELECT,
    # UPDATE y INSERT, más el COMMIT = 4 round-trips por escaneo). Este
    # encadenado de CTEs descuenta el stock, valida que no quede negativo,
    # inserta el movimiento y trae los datos del producto, todo en un único
    # viaje de ida y vuelta a Supabase.
    resultado = db.execute(
        text("""
            WITH decremento AS (
                UPDATE stock
                SET cantidad = cantidad - 1
                WHERE id_producto = :id_producto AND cantidad > 0
                RETURNING id_producto, cantidad
            ),
            registro AS (
                INSERT INTO movimiento (id_producto, tipo, origen, cantidad)
                SELECT id_producto, 'Salida', :origen, 1 FROM decremento
                RETURNING id_producto
            )
            SELECT p.id_producto, p.nombre, p.stock_minimo, d.cantidad AS stock_restante
            FROM decremento d
            JOIN producto p ON p.id_producto = d.id_producto
        """),
        {"id_producto": payload.id_producto, "origen": payload.origen},
    ).first()

    if resultado is None:
        # No se pudo descontar: o el producto no existe, o no tenía stock.
        # Esta rama solo se ejecuta en el caso raro (no en cada escaneo
        # exitoso), así que el costo extra de una segunda query acá no
        # afecta el flujo normal de venta.
        db.rollback()
        producto = db.query(Producto).filter(Producto.id_producto == payload.id_producto).first()
        if not producto:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Código o producto no registrado en el catálogo"
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sin stock disponible para este producto"
        )

    db.commit()

    nuevo_stock = float(resultado.stock_restante)
    stock_minimo = float(resultado.stock_minimo)
    nombre = resultado.nombre

    if nuevo_stock <= 0:
        estado = "sin_stock"
        mensaje = "Sin stock disponible para este producto (Quedan 0 unidades)"
    elif nuevo_stock <= stock_minimo:
        estado = "minimo_alcanzado"
        mensaje = f"Stock mínimo alcanzado - Quedan {nuevo_stock} unidades"
    else:
        estado = "ok"
        mensaje = f"{nombre} vendido - Stock restante: {nuevo_stock}"

    return VentaRapidaResponse(
        id_producto=resultado.id_producto,
        nombre=nombre,
        stock_restante=nuevo_stock,
        stock_minimo=stock_minimo,
        estado=estado,
        mensaje=mensaje
    )