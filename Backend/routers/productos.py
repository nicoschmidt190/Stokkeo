from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models.producto import Producto, Stock
from models.categoria import Categoria
from schemas.producto import ProductoCreate, ProductoResponse

router = APIRouter(prefix="/productos", tags=["productos"])

@router.get("", response_model=List[ProductoResponse])
def listar_productos(db: Session = Depends(get_db)):
    return db.query(Producto).all()

@router.post("", response_model=ProductoResponse, status_code=status.HTTP_201_CREATED)
def crear_producto(producto_in: ProductoCreate, db: Session = Depends(get_db)):
    # 1. Validar nombre duplicado
    nombre_limpio = producto_in.nombre.strip()
    existe = db.query(Producto).filter(Producto.nombre.ilike(nombre_limpio)).first()
    if existe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe un producto con ese nombre"
        )

    # 2. Validar que la categoría exista
    cat_existe = db.query(Categoria).filter(Categoria.id_categoria == producto_in.id_categoria).first()
    if not cat_existe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La categoría seleccionada no existe"
        )

    # 3. Guardar producto y su fila de stock inicial
    nuevo_prod = Producto(
        nombre=nombre_limpio,
        precioCosto=producto_in.precioCosto,
        stock_minimo=producto_in.stock_minimo,
        codigo_barras=producto_in.codigo_barras.strip() if producto_in.codigo_barras else None,
        id_categoria=producto_in.id_categoria
    )
    db.add(nuevo_prod)
    db.commit()
    db.refresh(nuevo_prod)

    # Inicializar stock en 0
    nuevo_stock = Stock(id_producto=nuevo_prod.id_producto, cantidad=0)
    db.add(nuevo_stock)
    db.commit()

    return nuevo_prod