from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models.producto import Producto
from schemas.producto import StockResponse

router = APIRouter(prefix="/stock", tags=["stock"])

@router.get("", response_model=List[StockResponse])
def listar_stock(db: Session = Depends(get_db)):
    productos = db.query(Producto).all()
    resultado = []

    for p in productos:
        cantidad = p.stock.cantidad if p.stock else 0

        if cantidad == 0:
            estado = "sin_stock"
        elif cantidad <= p.stock_minimo:
            estado = "bajo"
        else:
            estado = "ok"

        resultado.append(StockResponse(
            id_producto=p.id_producto,
            nombre=p.nombre,
            categoria=p.categoria,
            cantidad=cantidad,
            stock_minimo=p.stock_minimo,
            estado=estado,
        ))

    return resultado