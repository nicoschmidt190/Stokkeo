from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.categoria import Categoria
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
    existente = db.query(Categoria).filter(
        Categoria.nombre.ilike(nombre)
    ).first()
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
def eliminar_categoria(id_categoria: int, db: Session = Depends(get_db)):
    categoria = db.query(Categoria).filter(Categoria.id_categoria == id_categoria).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    db.delete(categoria)
    db.commit()
    return {"mensaje": "Categoría eliminada correctamente"}