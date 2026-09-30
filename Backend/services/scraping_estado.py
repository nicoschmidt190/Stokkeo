"""
Estado del scraping en memoria del proceso.

Alcanza para el MVP porque Stokkeo corre como un único proceso backend.
Si en el futuro se corre con varios workers (ej. gunicorn -w 4), esto deja
de servir porque cada worker tendría su propio estado — en ese caso habría
que pasar esto a una tabla o a Redis. Por ahora, simple y suficiente.
"""
import threading
from datetime import datetime
from typing import Optional, List

_lock = threading.Lock()

_estado = {
    "en_progreso": False,
    "ultima_actualizacion": None,   # datetime de la última corrida (exitosa o parcial)
    "mensaje": None,
    "supermercados_ok": [],
    "supermercados_fallidos": [],
}


def esta_en_progreso() -> bool:
    with _lock:
        return _estado["en_progreso"]


def marcar_inicio():
    with _lock:
        _estado["en_progreso"] = True
        _estado["mensaje"] = None


def marcar_fin(mensaje: str, ok: List[str], fallidos: List[str]):
    with _lock:
        _estado["en_progreso"] = False
        _estado["ultima_actualizacion"] = datetime.now()
        _estado["mensaje"] = mensaje
        _estado["supermercados_ok"] = ok
        _estado["supermercados_fallidos"] = fallidos


def obtener_estado() -> dict:
    with _lock:
        return dict(_estado)