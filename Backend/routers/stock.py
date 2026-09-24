from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, case
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from database import get_db
from models.producto import Producto, Stock
from schemas.producto import StockResponse
from schemas.pagination import PaginatedResponse

router = APIRouter(prefix="/stock", tags=["stock"])

@router.get("", response_model=PaginatedResponse[StockResponse])
def listar_stock(
    page: int = Query(1, ge=1),
    page_size: int = Query(30, ge=1, le=200),
    search: Optional[str] = Query(None, description="Filtra por nombre de producto"),
    id_categoria: Optional[int] = Query(None),
    estado: Optional[str] = Query(None, description="Filtra por 'sin_stock', 'bajo' u 'ok'"),
    db: Session = Depends(get_db)
):
    cantidad_expr = func.coalesce(Stock.cantidad, 0)
    # El estado depende de comparar dos columnas (cantidad vs stock_minimo,
    # que varía por producto), así que lo calculamos con un CASE en SQL en
    # vez de en Python — si lo hiciéramos después de traer la página, el
    # filtro por estado combinado con LIMIT/OFFSET rompería el conteo total
    # y podía devolver páginas con menos productos de los que en realidad hay.
    estado_expr = case(
        (cantidad_expr <= 0, "sin_stock"),
        (cantidad_expr <= Producto.stock_minimo, "bajo"),
        else_="ok",
    )

    query = (
        db.query(Producto)
        .options(joinedload(Producto.categoria), joinedload(Producto.stock))
        .outerjoin(Stock, Stock.id_producto == Producto.id_producto)
    )

    if search:
        query = query.filter(Producto.nombre.ilike(f"%{search.strip()}%"))
    if id_categoria:
        query = query.filter(Producto.id_categoria == id_categoria)
    if estado:
        query = query.filter(estado_expr == estado)

    total = query.with_entities(func.count(Producto.id_producto)).scalar()

    productos = (
        query.order_by(Producto.nombre.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    resultado = []
    for p in productos:
        cantidad = float(p.stock.cantidad) if p.stock else 0.0
        stock_minimo = float(p.stock_minimo)

        if cantidad <= 0:
            estado_calc = "sin_stock"
        elif cantidad <= stock_minimo:
            estado_calc = "bajo"
        else:
            estado_calc = "ok"

        resultado.append(StockResponse(
            id_producto=p.id_producto,
            nombre=p.nombre,
            categoria=p.categoria,
            cantidad=cantidad,
            stock_minimo=stock_minimo,
            unidad_medida=p.unidad_medida,
            estado=estado_calc,
        ))

    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return PaginatedResponse(
        items=resultado, total=total, page=page, page_size=page_size, total_pages=total_pages
    )