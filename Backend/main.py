from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from apscheduler.schedulers.background import BackgroundScheduler
import traceback
import logging
from database import engine
from routers import auth, categorias, productos, stock, movimientos, precios_competidor



app = FastAPI()
app.include_router(categorias.router)
app.include_router(productos.router)
app.include_router(stock.router)
app.include_router(movimientos.router)
app.include_router(precios_competidor.router)



# 1. Configuración de CORS (debe ir antes de los routers y otros middlewares)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Comprime las respuestas JSON (gzip) antes de mandarlas por la red.
# Con wifi lento/inestable esto es una de las mejoras de mayor impacto:
# menos bytes viajando = menos chance de que un paquete se pierda o
# haya que retransmitir, y la respuesta llega antes aunque el ancho de
# banda sea chico. minimum_size evita comprimir respuestas ya diminutas.
app.add_middleware(GZipMiddleware, minimum_size=500)

@app.middleware("http")
async def catch_exceptions(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"detail": str(e)})

app.include_router(auth.router)

# CU-27: scraping automático "si el sistema está configurado para
# ejecutarlo en un horario determinado". Corre 1 vez por día a las 3 AM
# (poco tráfico, y una lectura diaria alcanza y sobra para precios de
# supermercado). El botón "Actualizar precios" del dashboard sigue
# funcionando igual para disparar una corrida manual en cualquier momento.
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