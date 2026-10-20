from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from apscheduler.schedulers.background import BackgroundScheduler
import os
import traceback
import logging
from database import engine
from routers import auth, categorias, productos, stock, movimientos, precios_competidor

app = FastAPI()

# 1. Configuración de CORS (¡Debe ir PRIMERO que todo, antes de los routers y middlewares!)
# Si prefieres evitar problemas con las URLs de Railway, puedes usar allow_origins=["*"]
# o bien mantener la lectura de la variable de entorno con un fallback amplio:
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://spectacular-bravery-production-8431.up.railway.app",  # Tu frontend actual en Railway
]

# Si quieres leer dinámicamente desde Railway, puedes agregar FRONTEND_URL en las variables
frontend_env = os.getenv("FRONTEND_URL")
if frontend_env:
    for o in frontend_env.split(","):
        clean_url = o.strip().rstrip("/")
        if clean_url and clean_url not in ALLOWED_ORIGINS:
            ALLOWED_ORIGINS.append(clean_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # O usa allow_origins=["*"] para pruebas libres
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Comprime las respuestas JSON (gzip) antes de mandarlas por la red.
app.add_middleware(GZipMiddleware, minimum_size=500)

@app.middleware("http")
async def catch_exceptions(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"detail": str(e)})

# Incluir todos los routers después del CORS
app.include_router(categorias.router)
app.include_router(productos.router)
app.include_router(stock.router)
app.include_router(movimientos.router)
app.include_router(precios_competidor.router)
app.include_router(auth.router)

# CU-27: scraping automático
scheduler = BackgroundScheduler()

@app.on_event("startup")
def startup():
    try:
        with engine.connect() as connection:
            print("✅ Conexión a la base de datos exitosa")
    except Exception as e:
        print(f"❌ Error al conectar a la base de datos: {e}")

    from routers.precios_competidor import _ejecutar_scraping_en_segundo_plano
    from services import scraping_estado

    def job_scraping_diario():
        if scraping_estado.esta_en_progreso():
            logging.info("Scraping diario omitido: ya hay uno en curso.")
            return
        scraping_estado.marcar_inicio()
        _ejecutar_scraping_en_segundo_plano()

    scheduler.add_job(job_scraping_diario, "cron", hour=3, minute=0, id="scraping_diario")
    scheduler.start()

@app.on_event("shutdown")
def shutdown():
    scheduler.shutdown(wait=False)

@app.get("/health")
def health():
    return {"status": "ok"}