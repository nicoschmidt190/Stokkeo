from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import traceback
from database import engine
from routers import auth
from routers import auth, categorias
from routers import auth, categorias, productos, movimientos
from routers import stock


app = FastAPI()
app.include_router(categorias.router)
app.include_router(productos.router)
app.include_router(stock.router)
app.include_router(movimientos.router)



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

@app.middleware("http")
async def catch_exceptions(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"detail": str(e)})

app.include_router(auth.router)

@app.on_event("startup")
def startup():
    try:
        with engine.connect() as connection:
            print("✅ Conexión a la base de datos exitosa")
    except Exception as e:
        print(f"❌ Error al conectar a la base de datos: {e}")

@app.get("/health")
def health():
    return {"status": "ok"}