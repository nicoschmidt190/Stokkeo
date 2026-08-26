from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models.producto import Producto, Stock
#, PrecioCompetidor (agregar cuando este el modulo terminado)
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

@router.put("/{id_producto}", response_model=ProductoResponse)
def editar_producto(id_producto: int, producto_in: ProductoCreate, db: Session = Depends(get_db)):
    producto = db.query(Producto).filter(Producto.id_producto == id_producto).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    nombre_limpio = producto_in.nombre.strip()
    existe = db.query(Producto).filter(
        Producto.nombre.ilike(nombre_limpio),
        Producto.id_producto != id_producto
    ).first()
    if existe:
        raise HTTPException(status_code=400, detail="Ya existe un producto con ese nombre")

    cat_existe = db.query(Categoria).filter(Categoria.id_categoria == producto_in.id_categoria).first()
    if not cat_existe:
        raise HTTPException(status_code=400, detail="La categoría seleccionada no existe")

    producto.nombre = nombre_limpio
    producto.precioCosto = producto_in.precioCosto
    producto.stock_minimo = producto_in.stock_minimo
    producto.codigo_barras = producto_in.codigo_barras.strip() if producto_in.codigo_barras else None
    producto.id_categoria = producto_in.id_categoria

    db.commit()
    db.refresh(producto)
    return producto

@router.delete("/{id_producto}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_producto(id_producto: int, db: Session = Depends(get_db)):
    producto = db.query(Producto).filter(Producto.id_producto == id_producto).first()
    if not producto:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")

    # 1. Eliminar precios competidores asociados (Agregar cuando este el modulo terminado)
    # db.query(PrecioCompetidor).filter(PrecioCompetidor.id_producto == id_producto).delete()

    # 2. Eliminar stock asociado
    db.query(Stock).filter(Stock.id_producto == id_producto).delete()

    # 3. Eliminar el producto
    db.delete(producto)
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)