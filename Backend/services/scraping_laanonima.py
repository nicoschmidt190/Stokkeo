"""
Scraping de precios en La Anónima (www.laanonima.com.ar).

IMPORTANTE - Selectores sin verificar en vivo: los selectores CSS de acá
abajo (`[class*='producto']`, `.titulo, h2`, `.precio`) son los que ya
habían confirmado funcionando contra la página de CATEGORÍA en el
notebook original. La página de BÚSQUEDA (/buscar/{nombre}) probablemente
comparte la misma estructura de tarjetas de producto, pero no lo pude
confirmar desde este entorno: el sitio bloquea el acceso automatizado
que no viene de un navegador real (Selenium sí lo esquiva, un fetch
simple no). Antes de dejarlo corriendo en producción, correr
`buscar_producto` una vez contra un producto de prueba y revisar que
`nombre_encontrado`/`precio` salgan bien — si el sitio devuelve None
para todo, lo primero a mirar es si estos 3 selectores cambiaron.
"""
import re
import time
import random
import logging
import unicodedata
from typing import Optional
from urllib.parse import quote

from bs4 import BeautifulSoup
from rapidfuzz import fuzz
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.common.exceptions import WebDriverException, TimeoutException
from webdriver_manager.chrome import ChromeDriverManager

logger = logging.getLogger("scraping_laanonima")

SUPERMERCADO = "La Anonima"
BASE_URL_BUSQUEDA = "https://www.laanonima.com.ar/buscar/{query}"

# Umbral de similitud (0-100) por debajo del cual tratamos el resultado
# como "producto no encontrado" en vez de guardar un match dudoso. No es
# un requisito explícito de CU-27, pero evita guardar un precio de un
# producto completamente distinto solo porque fue el primer resultado.
UMBRAL_SIMILITUD_MINIMO = 55

# Delay entre búsquedas: nunca golpear el sitio en ráfaga. Rango amplio
# para no ser un patrón de timing perfectamente regular (más humano).
DELAY_MIN_SEG = 2.5
DELAY_MAX_SEG = 5.5


def _normalizar(texto: str) -> str:
    """minúsculas + sin tildes, para comparar nombres de forma más justa."""
    texto = texto.strip().lower()
    texto = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode("ascii")
    return texto


def _parsear_precio(texto_precio: str) -> Optional[float]:
    """'$ 1.234,56' -> 1234.56. Devuelve None si no puede parsear nada."""
    if not texto_precio:
        return None
    limpio = re.sub(r"[^\d,\.]", "", texto_precio)
    if not limpio:
        return None
    # Formato AR: punto = separador de miles, coma = decimal
    limpio = limpio.replace(".", "").replace(",", ".")
    try:
        return float(limpio)
    except ValueError:
        return None


def _crear_driver() -> webdriver.Chrome:
    opciones = Options()
    opciones.add_argument("--headless=new")
    opciones.add_argument("--no-sandbox")
    opciones.add_argument("--disable-dev-shm-usage")
    opciones.add_argument("--disable-blink-features=AutomationControlled")
    opciones.add_argument(
        "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
    servicio = Service(ChromeDriverManager().install())
    return webdriver.Chrome(service=servicio, options=opciones)


class SupermercadoNoDisponibleError(Exception):
    """El sitio no respondió o cambió de estructura de forma irrecuperable."""
    pass


def buscar_producto(driver: webdriver.Chrome, nombre_producto: str) -> Optional[dict]:
    """
    Busca `nombre_producto` en La Anónima y devuelve el mejor match como
    {"nombre_encontrado": str, "precio": float}, o None si no encontró
    nada suficientemente parecido (esto es "producto no encontrado" según
    CU-27, no un error del sitio).

    Levanta SupermercadoNoDisponibleError si el sitio no respondió — esto
    SÍ corta el scraping de este supermercado (CU-27: "si el sitio no está
    disponible, omite ese supermercado").
    """
    url = BASE_URL_BUSQUEDA.format(query=quote(nombre_producto))
    try:
        driver.set_page_load_timeout(20)
        driver.get(url)
    except TimeoutException:
        raise SupermercadoNoDisponibleError(f"Timeout cargando {url}")
    except WebDriverException as e:
        raise SupermercadoNoDisponibleError(f"Error de navegador cargando {url}: {e}")

    soup = BeautifulSoup(driver.page_source, "html.parser")
    candidatas = soup.select("[class*='producto']")

    # [class*='producto'] matchea tanto cada tarjeta individual como
    # cualquier contenedor padre cuya clase también contenga "producto"
    # (ej. "listado-productos" contiene la substring "producto"). Sin este
    # filtro, ese contenedor se cuela como una tarjeta más y duplica el
    # primer resultado real que encuentra adentro. Nos quedamos solo con
    # las tarjetas que NO envuelven a ninguna otra tarjeta ya matcheada.
    tarjetas = [
        t for t in candidatas
        if not any(otro is not t and otro in t.descendants for otro in candidatas)
    ]

    candidatos = []
    for tarjeta in tarjetas:
        titulo_el = tarjeta.select_one(".titulo, h2")
        precio_el = tarjeta.select_one(".precio")
        if not titulo_el or not precio_el:
            continue
        titulo = titulo_el.get_text(strip=True)
        precio = _parsear_precio(precio_el.get_text(strip=True))
        if not titulo or precio is None:
            continue
        score = fuzz.token_sort_ratio(_normalizar(nombre_producto), _normalizar(titulo))
        candidatos.append((score, titulo, precio))

    if not candidatos:
        return None

    candidatos.sort(key=lambda c: c[0], reverse=True)
    mejor_score, mejor_titulo, mejor_precio = candidatos[0]

    if mejor_score < UMBRAL_SIMILITUD_MINIMO:
        logger.info(
            "'%s' -> mejor match '%s' con score %d, por debajo del umbral. Se descarta.",
            nombre_producto, mejor_titulo, mejor_score
        )
        return None

    return {"nombre_encontrado": mejor_titulo, "precio": mejor_precio}


def scrapear_supermercado(productos: list) -> dict:
    """
    Recorre `productos` (lista de objetos Producto) buscando cada uno en
    La Anónima. Devuelve {"ok": True, "resultados": {id_producto: {...}}}
    o {"ok": False, "error": "..."} si el sitio no estuvo disponible desde
    el arranque o se cayó a mitad de camino sin haber podido procesar
    ningún producto más.

    `resultados` solo trae entradas para los productos que SÍ se
    encontraron — los no encontrados simplemente no aparecen ahí, y quien
    llama a esta función no debe tocar la fila existente de esos (CU-27).
    """
    resultados = {}
    driver = None
    try:
        driver = _crear_driver()
    except Exception as e:
        logger.error("No se pudo iniciar el navegador para %s: %s", SUPERMERCADO, e)
        return {"ok": False, "error": str(e), "resultados": resultados}

    try:
        for i, producto in enumerate(productos):
            try:
                encontrado = buscar_producto(driver, producto.nombre)
                if encontrado:
                    resultados[producto.id_producto] = encontrado
            except SupermercadoNoDisponibleError as e:
                logger.error("%s no disponible durante el scraping: %s", SUPERMERCADO, e)
                # Si ya veníamos encontrando resultados, los guardamos igual
                # (parcial es mejor que nada) pero marcamos el supermercado
                # como no disponible para el mensaje final.
                return {"ok": False, "error": str(e), "resultados": resultados}

            # Nunca en ráfaga — ni siquiera para el último producto, por
            # las dudas de que el sitio mida el ritmo en vez de solo contar.
            if i < len(productos) - 1:
                time.sleep(random.uniform(DELAY_MIN_SEG, DELAY_MAX_SEG))
    finally:
        if driver:
            driver.quit()

    return {"ok": True, "resultados": resultados}