import logging
import socket
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db, SessionLocal
from models.producto import Producto
from models.precio_competidor import PrecioCompetidor
from schemas.precio_competidor import (
    ComparacionPreciosListResponse,
    ComparacionPrecioResponse,
    EstadoScrapingResponse,
    IniciarScrapingResponse,
)
from services import scraping_estado
from services.scraping_laanonima import scrapear_supermercado, SUPERMERCADO

logger = logging.getLogger("precios_competidor")
router = APIRouter(prefix="/precios-competidor", tags=["precios-competidor"])

DIFERENCIA_MINIMA_CONVENIENTE = 20.0  # % - umbral fijo de CU-26


def _hay_internet(timeout: float = 3.0) -> bool:
    """Chequeo liviano de conectividad, sin depender de que el sitio del
    supermercado esté online (esa es una falla distinta, ver CU-27)."""
    try:
        socket.setdefaulttimeout(timeout)
        socket.socket(socket.AF_INET, socket.SOCK_STREAM).connect(("8.8.8.8", 53))
        return True
    except OSError:
        return False


def _ejecutar_scraping_en_segundo_plano():
    """
    Corre en BackgroundTasks: abre SU PROPIA sesión de DB (la del request
    ya se cerró para cuando esto arranca) y va actualizando scraping_estado
    para que el frontend pueda hacer polling del progreso.
    """
    db: Session = SessionLocal()
    ok_list = []
    fallidos_list = []
    try:
        productos = db.query(Producto).all()
        resultado = scrapear_supermercado(productos)

        if resultado["ok"]:
            ok_list.append(SUPERMERCADO)
        else:
            fallidos_list.append(SUPERMERCADO)
            logger.warning("Scraping de %s no se completó: %s", SUPERMERCADO, resultado.get("error"))

        # Upsert manual (no ON CONFLICT) por id_producto + supermercado,
        # que es la clave natural real aunque la constraint de la tabla
        # hoy sea distinta (ver nota que le pasé a Ivan sobre esto).
        for id_producto, encontrado in resultado["resultados"].items():
            fila = (
                db.query(PrecioCompetidor)
                .filter(
                    PrecioCompetidor.id_producto == id_producto,
                    PrecioCompetidor.supermercado == SUPERMERCADO,
                )
                .first()
            )
            if fila:
                fila.precio = encontrado["precio"]
                fila.nombre_producto = encontrado["nombre_encontrado"]
                fila.fecha_scraping = func.now()
            else:
                db.add(PrecioCompetidor(
                    id_producto=id_producto,
                    nombre_producto=encontrado["nombre_encontrado"],
                    supermercado=SUPERMERCADO,
                    precio=encontrado["precio"],
                ))
        db.commit()

        if fallidos_list and not ok_list:
            mensaje = f"No pudimos consultar {', '.join(fallidos_list)}."
        elif fallidos_list:
            mensaje = f"No pudimos consultar {', '.join(fallidos_list)}. Los demás precios fueron actualizados correctamente"
        else:
            from datetime import datetime
            mensaje = f"Precios actualizados correctamente. Última actualización: {datetime.now().strftime('%d/%m/%Y %H:%M')}"

    except Exception as e:
        logger.exception("Error inesperado en el scraping")
        fallidos_list = [SUPERMERCADO]
        mensaje = f"No pudimos consultar {SUPERMERCADO}."
    finally:
        db.close()
        scraping_estado.marcar_fin(mensaje, ok_list, fallidos_list)


@router.post("/actualizar", response_model=IniciarScrapingResponse)
def actualizar_precios(background_tasks: BackgroundTasks):
    if scraping_estado.esta_en_progreso():
        return IniciarScrapingResponse(iniciado=False, mensaje="Ya hay una actualización de precios en curso.")

    if not _hay_internet():
        return IniciarScrapingResponse(
            iniciado=False,
            mensaje="Sin conexión a internet. Conéctate para actualizar los precios"
        )

    scraping_estado.marcar_inicio()
    background_tasks.add_task(_ejecutar_scraping_en_segundo_plano)
    return IniciarScrapingResponse(iniciado=True, mensaje="Actualización de precios iniciada.")


@router.get("/estado", response_model=EstadoScrapingResponse)
def estado_scraping():
    e = scraping_estado.obtener_estado()
    return EstadoScrapingResponse(
        en_progreso=e["en_progreso"],
        ultima_actualizacion=e["ultima_actualizacion"],
        mensaje=e["mensaje"],
        supermercados_ok=e["supermercados_ok"],
        supermercados_fallidos=e["supermercados_fallidos"],
    )


@router.get("/comparacion", response_model=ComparacionPreciosListResponse)
def comparacion_precios(db: Session = Depends(get_db)):
    nunca_ejecutado = db.query(PrecioCompetidor).count() == 0
    if nunca_ejecutado:
        return ComparacionPreciosListResponse(nunca_ejecutado=True, items=[])

    # Si un producto tiene precio de varios supermercados, nos quedamos con
    # el más bajo (CU-27). row_number() particionado por producto y
    # ordenado por precio ascendente: la fila con rn=1 es la más barata.
    ranking = (
        db.query(
            PrecioCompetidor.id_producto,
            PrecioCompetidor.precio,
            PrecioCompetidor.supermercado,
            PrecioCompetidor.fecha_scraping,
            func.row_number().over(
                partition_by=PrecioCompetidor.id_producto,
                order_by=PrecioCompetidor.precio.asc(),
            ).label("rn"),
        )
        .filter(PrecioCompetidor.precio.isnot(None))
        .subquery()
    )

    diferencia_expr = (
        (Producto.precioCosto - ranking.c.precio) / func.nullif(Producto.precioCosto, 0) * 100
    )

    filas = (
        db.query(
            Producto.id_producto,
            Producto.nombre.label("nombre_producto"),
            Producto.precioCosto.label("precio_negocio"),
            ranking.c.precio.label("precio_supermercado"),
            ranking.c.supermercado,
            ranking.c.fecha_scraping,
            diferencia_expr.label("diferencia_porcentual"),
        )
        .join(ranking, ranking.c.id_producto == Producto.id_producto)
        .filter(ranking.c.rn == 1)
        .filter(diferencia_expr >= DIFERENCIA_MINIMA_CONVENIENTE)
        .order_by(diferencia_expr.desc())
        .all()
    )

    items = [
        ComparacionPrecioResponse(
            id_producto=f.id_producto,
            nombre_producto=f.nombre_producto,
            precio_negocio=float(f.precio_negocio),
            precio_supermercado=float(f.precio_supermercado),
            supermercado=f.supermercado,
            fecha_scraping=f.fecha_scraping,
            diferencia_porcentual=round(float(f.diferencia_porcentual), 2),
        )
        for f in filas
    ]

    return ComparacionPreciosListResponse(nunca_ejecutado=False, items=items)