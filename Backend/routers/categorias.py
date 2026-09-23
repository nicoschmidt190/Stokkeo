from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from models.categoria import Categoria
from models.producto import Producto, Stock
from models.movimiento import Movimiento
from pydantic import BaseModel

router = APIRouter(prefix="/categorias", tags=["categorias"])

class CategoriaCreate(BaseModel):
    nombre: str

@router.get("/")
def listar_categorias(db: Session = Depends(get_db)):
    return db.query(Categoria).order_by(Categoria.nombre).all()

@router.post("/")
def crear_categoria(data: CategoriaCreate, db: Session = Depends(get_db)):
    nombre = data.nombre.strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="El nombre no puede estar vacío")
    existente = db.query(Categoria).filter(Categoria.nombre.ilike(nombre)).first()
    if existente:
        raise HTTPException(status_code=400, detail="Ya existe una categoría con ese nombre")
    categoria = Categoria(nombre=nombre)
    db.add(categoria)
    db.commit()
    db.refresh(categoria)
    return categoria

@router.put("/{id_categoria}")
def editar_categoria(id_categoria: int, data: CategoriaCreate, db: Session = Depends(get_db)):
    nombre = data.nombre.strip()
    categoria = db.query(Categoria).filter(Categoria.id_categoria == id_categoria).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    existente = db.query(Categoria).filter(
        Categoria.nombre.ilike(nombre),
        Categoria.id_categoria != id_categoria
    ).first()
    if existente:
        raise HTTPException(status_code=400, detail="Ya existe una categoría con ese nombre")
    categoria.nombre = nombre
    db.commit()
    db.refresh(categoria)
    return categoria

@router.delete("/{id_categoria}")
def eliminar_categoria(
    id_categoria: int,
    accion: Optional[str] = Query(None, description="'reasignar' o 'cascada' — solo si hay productos asociados"),
    nueva_categoria_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    categoria = db.query(Categoria).filter(Categoria.id_categoria == id_categoria).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")

    productos_query = db.query(Producto).filter(Producto.id_categoria == id_categoria)
    cantidad_productos = productos_query.count()

    if cantidad_productos > 0:
        if accion == "reasignar":
            if not nueva_categoria_id:
                raise HTTPException(status_code=400, detail="Tenés que indicar a qué categoría reasignar los productos")
            if nueva_categoria_id == id_categoria:
                raise HTTPException(status_code=400, detail="La categoría de destino no puede ser la misma que estás eliminando")
            nueva_cat = db.query(Categoria).filter(Categoria.id_categoria == nueva_categoria_id).first()
            if not nueva_cat:
                raise HTTPException(status_code=400, detail="La categoría de destino no existe")

            productos_query.update({Producto.id_categoria: nueva_categoria_id}, synchronize_session=False)
            db.commit()

        elif accion == "cascada":
            ids_productos = [p.id_producto for p in productos_query.all()]
            if ids_productos:
                db.query(Movimiento).filter(Movimiento.id_producto.in_(ids_productos)).delete(synchronize_session=False)
                db.query(Stock).filter(Stock.id_producto.in_(ids_productos)).delete(synchronize_session=False)
                productos_query.delete(synchronize_session=False)
            db.commit()

        else:
            raise HTTPException(
                status_code=409,
                detail={
                    "mensaje": f"Hay {cantidad_productos} producto(s) usando esta categoría",
                    "cantidad_productos": cantidad_productos,
                }
            )

    db.delete(categoria)
    db.commit()
    return {"mensaje": "Categoría eliminada correctamente"}