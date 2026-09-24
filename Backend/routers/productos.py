from fastapi import APIRouter, Depends, HTTPException, status, Response, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from database import get_db
from models.producto import Producto, Stock
from models.movimiento import Movimiento
from models.categoria import Categoria
from schemas.producto import ProductoCreate, ProductoResponse
from schemas.pagination import PaginatedResponse

router = APIRouter(prefix="/productos", tags=["productos"])

@router.get("", response_model=PaginatedResponse[ProductoResponse])
def listar_productos(
    page: int = Query(1, ge=1),
    page_size: int = Query(30, ge=1, le=5000),
    # El tope de 5000 (en vez de algo chico como 200) es a propósito:
    # VentaRápida y el formulario de Movimientos necesitan el catálogo
    # COMPLETO en memoria para poder buscar por nombre/código al vuelo
    # (igual que una caja registradora), así que piden page_size=5000 para
    # traer "todo" en una sola llamada. La tabla de administración de
    # Productos, en cambio, pide el page_size chico (30) por defecto.
    search: Optional[str] = Query(None, description="Filtra por nombre o código de barras"),
    id_categoria: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    # Paginación + filtro server-side: con ~1000 productos, traer todo de
    # una vez y filtrar en el navegador deja de ser lo mejor (payload grande
    # en wifi inestable + 1000 filas para renderizar). Acá el WHERE y el
    # LIMIT/OFFSET corren en Supabase, así que siempre viaja solo la página
    # que se está mostrando.
    query = db.query(Producto).options(
        joinedload(Producto.categoria), joinedload(Producto.stock)
    )

    if search:
        patron = f"%{search.strip()}%"
        query = query.filter(
            (Producto.nombre.ilike(patron)) | (Producto.codigo_barras.ilike(patron))
        )
    if id_categoria:
        query = query.filter(Producto.id_categoria == id_categoria)

    total = query.with_entities(func.count(Producto.id_producto)).scalar()

    items = (
        query.order_by(Producto.nombre.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return PaginatedResponse(
        items=items, total=total, page=page, page_size=page_size, total_pages=total_pages
    )

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

    # 2. Validar código de barras duplicado si fue provisto
    if producto_in.codigo_barras and producto_in.codigo_barras.strip():
        cod_limpio = producto_in.codigo_barras.strip()
        existe_cod = db.query(Producto).filter(Producto.codigo_barras == cod_limpio).first()
        if existe_cod:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El código de barras '{cod_limpio}' ya está asignado a otro producto"
            )

    # 3. Validar categoría
    cat_existe = db.query(Categoria).filter(Categoria.id_categoria == producto_in.id_categoria).first()
    if not cat_existe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La categoría seleccionada no existe"
        )

    # 4. Guardar producto
    nuevo_prod = Producto(
        nombre=nombre_limpio,
        precioCosto=producto_in.precioCosto,
        stock_minimo=producto_in.stock_minimo,
        codigo_barras=producto_in.codigo_barras.strip() if producto_in.codigo_barras else None,
        unidad_medida=producto_in.unidad_medida.strip() if producto_in.unidad_medida else "unidad",
        id_categoria=producto_in.id_categoria
    )
    db.add(nuevo_prod)
    db.commit()
    db.refresh(nuevo_prod)

    # 5. Inicializar stock con el valor ingresado
    cant_inicial = producto_in.stock_actual or 0
    nuevo_stock = Stock(id_producto=nuevo_prod.id_producto, cantidad=cant_inicial)
    db.add(nuevo_stock)

    # 6. Si se cargó stock inicial > 0, registrar la entrada en Movimientos
    if cant_inicial > 0:
        movimiento_inicial = Movimiento(
            id_producto=nuevo_prod.id_producto,
            tipo="Entrada",
            origen="Manual",
            cantidad=cant_inicial
        )
        db.add(movimiento_inicial)

    db.commit()
    db.refresh(nuevo_prod)
    return nuevo_prod

@router.put("/{id_producto}", response_model=ProductoResponse)
def editar_producto(id_producto: int, producto_in: ProductoCreate, db: Session = Depends(get_db)):
    producto = db.query(Producto).filter(Producto.id_producto == id_producto).first()
    if not producto:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")

    # Validar nombre duplicado excluyendo el actual
    nombre_limpio = producto_in.nombre.strip()
    existe = db.query(Producto).filter(
        Producto.nombre.ilike(nombre_limpio),
        Producto.id_producto != id_producto
    ).first()
    if existe:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ya existe un producto con ese nombre")

    # Validar código de barras duplicado excluyendo el actual
    if producto_in.codigo_barras and producto_in.codigo_barras.strip():
        cod_limpio = producto_in.codigo_barras.strip()
        existe_cod = db.query(Producto).filter(
            Producto.codigo_barras == cod_limpio,
            Producto.id_producto != id_producto
        ).first()
        if existe_cod:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El código de barras '{cod_limpio}' ya está asignado a otro producto"
            )

    # Validar categoría
    cat_existe = db.query(Categoria).filter(Categoria.id_categoria == producto_in.id_categoria).first()
    if not cat_existe:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La categoría seleccionada no existe")

    producto.nombre = nombre_limpio
    producto.precioCosto = producto_in.precioCosto
    producto.stock_minimo = producto_in.stock_minimo
    producto.codigo_barras = producto_in.codigo_barras.strip() if producto_in.codigo_barras else None
    producto.unidad_medida = producto_in.unidad_medida.strip() if producto_in.unidad_medida else "unidad"
    producto.id_categoria = producto_in.id_categoria

    db.commit()
    db.refresh(producto)
    return producto

@router.delete("/{id_producto}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_producto(id_producto: int, db: Session = Depends(get_db)):
    producto = db.query(Producto).filter(Producto.id_producto == id_producto).first()
    if not producto:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")

    # 1. Eliminar movimientos asociados
    db.query(Movimiento).filter(Movimiento.id_producto == id_producto).delete()

    # 2. Eliminar stock asociado
    db.query(Stock).filter(Stock.id_producto == id_producto).delete()

    # 3. Eliminar el producto
    db.delete(producto)
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)