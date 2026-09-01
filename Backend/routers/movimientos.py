from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models.movimiento import Movimiento
from models.producto import Producto, Stock
from schemas.movimiento import MovimientoCreate, MovimientoResponse

router = APIRouter(prefix="/movimientos", tags=["movimientos"])

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