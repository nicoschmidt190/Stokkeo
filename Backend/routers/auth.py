from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database import get_db
from models.usuario import Usuario
from schemas.usuario import LoginRequest, LoginResponse
from passlib.context import CryptContext
from jose import jwt, JWTError
from datetime import datetime, timedelta

router = APIRouter(prefix="/auth", tags=["auth"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

SECRET_KEY = "stokkeo_secret_key_2026"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 8

security = HTTPBearer()

def verificar_password(password_plano, password_hash):
    return pwd_context.verify(password_plano[:72], password_hash)

def crear_token(data: dict):
    datos = data.copy()
    expiracion = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    datos.update({"exp": expiracion})
    return jwt.encode(datos, SECRET_KEY, algorithm=ALGORITHM)

# Dependencia que protege los endpoints: valida el JWT del header
# "Authorization: Bearer <token>" y confirma que el usuario sigue existiendo.
# Si falta el token, es inválido, expiró o el usuario fue borrado, corta con
# 401 antes de que se ejecute el endpoint.
def obtener_usuario_actual(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> Usuario:
    excepcion_credenciales = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudo validar la sesión. Volvé a iniciar sesión.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        id_usuario = payload.get("sub")
        if id_usuario is None:
            raise excepcion_credenciales
    except JWTError:
        raise excepcion_credenciales

    usuario = db.query(Usuario).filter(Usuario.id_usuario == int(id_usuario)).first()
    if not usuario:
        raise excepcion_credenciales

    return usuario

@router.post("/login", response_model=LoginResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.email == request.email).first()
    
    if not usuario or not verificar_password(request.password, usuario.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos"
        )
    
    token = crear_token({"sub": str(usuario.id_usuario), "email": usuario.email})
    
    return LoginResponse(
        access_token=token,
        token_type="bearer",
        nombre=usuario.nombre
    )