from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_redoc_html, get_swagger_ui_html
from fastapi.responses import JSONResponse
from scalar_fastapi import get_scalar_api_reference
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import traceback

from app.core.config import settings
from app.core.rate_limit import limiter
from app.db.database import engine, Base
from app.core.security import hash_password
from app.models import Usuario
from app.api.routes.auth import router as auth_router
from app.api.routes.usuarios import router as usuarios_router
from app.api.routes.propiedades import router as propiedades_router
from app.api.routes.inquilinos import router as inquilinos_router
from app.api.routes.contratos import router as contratos_router
from app.api.routes.pagos import router as pagos_router
from app.api.routes.mensajes import router as mensajes_router
from app.api.routes.cuidados import router as cuidados_router
from app.api.routes.ti import router as ti_router

DESCRIPCION = """
API para la administración de propiedades en arrendamiento: propietarios, inquilinos,
contratos (con cobro recurrente y datos de aval), pagos/adeudos, mensajes y bitácora de
cuidados de las propiedades.

**Autenticación:** la mayoría de los endpoints requieren un token Bearer (JWT) obtenido en
`POST /api/v1/auth/login`. Usa el botón **Authorize** e ingresa `Bearer <token>`.
"""

TAGS_METADATA = [
    {"name": "auth", "description": "Inicio de sesión y emisión de tokens JWT."},
    {"name": "usuarios", "description": "Cuentas de acceso con rol admin o propietario (los inquilinos se gestionan en `inquilinos`)."},
    {"name": "propiedades", "description": "Alta y consulta de las propiedades administradas."},
    {"name": "inquilinos", "description": "Alta y gestión de inquilinos: crea en un solo paso la cuenta de acceso y el perfil (nombre, correo, contraseña, estado vigente/baja)."},
    {"name": "contratos", "description": "Contratos de arrendamiento: datos generales, cobro recurrente (día de cobro) y datos del aval."},
    {"name": "pagos", "description": "Pagos y adeudos de los contratos. Los cobros recurrentes se generan automáticamente según el día marcado en el contrato."},
    {"name": "mensajes", "description": "Mensajería entre administración e inquilinos."},
    {"name": "cuidados", "description": "Bitácora de mantenimiento/cuidados de las propiedades."},
    {"name": "ti", "description": "Superusuario (rol `ti`): gestiona las cuentas con rol admin. Hereda todos los permisos de admin en el resto de la API."},
]

app = FastAPI(
    title="IOBAL Arrendamiento API",
    description=DESCRIPCION,
    version="1.0.0",
    contact={"name": "IOBAL"},
    openapi_tags=TAGS_METADATA,
    # se desactivan los docs por defecto para servirlos desde rutas propias más abajo
    docs_url=None,
    redoc_url=None,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.exception_handler(Exception)
async def manejador_errores_no_controlados(request: Request, exc: Exception):
    """Evita que un error interno regrese texto plano (ej. 'Internal Server Error');
    siempre responde JSON para que el frontend pueda mostrar el detalle."""
    if settings.DEBUG:
        return JSONResponse(status_code=500, content={
            "detail": f"{type(exc).__name__}: {exc}",
            "traceback": traceback.format_exc().splitlines()[-12:],
        })
    return JSONResponse(status_code=500, content={"detail": "Error interno del servidor"})

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

def _traducir_error_validacion(e: dict) -> str:
    """Traduce los mensajes de Pydantic (siempre en inglés) a español."""
    tipo = e.get("type", "")
    msg = e.get("msg", "")
    ctx = e.get("ctx", {}) or {}

    if tipo == "missing":
        return "Este campo es obligatorio"
    if tipo == "string_too_short":
        return f"Debe tener al menos {ctx.get('min_length', '?')} caracteres"
    if tipo == "string_too_long":
        return f"Debe tener máximo {ctx.get('max_length', '?')} caracteres"
    if tipo in ("int_parsing", "int_type"):
        return "Debe ser un número entero"
    if tipo in ("float_parsing", "float_type"):
        return "Debe ser un número"
    if tipo in ("bool_parsing", "bool_type"):
        return "Debe ser verdadero o falso (true/false)"
    if tipo in ("date_parsing", "date_from_datetime_parsing"):
        return "La fecha no tiene un formato válido (usa AAAA-MM-DD)"
    if tipo == "greater_than_equal":
        return f"Debe ser mayor o igual a {ctx.get('ge')}"
    if tipo == "less_than_equal":
        return f"Debe ser menor o igual a {ctx.get('le')}"
    if tipo == "json_invalid":
        return "El formato enviado no es JSON válido"
    if "email" in msg.lower() or "@-sign" in msg.lower():
        return "El correo electrónico no tiene un formato válido (debe incluir @ y un dominio)"
    return msg  # si no reconocemos el tipo, se muestra el mensaje original de Pydantic

@app.exception_handler(RequestValidationError)
async def manejador_validacion(request: Request, exc: RequestValidationError):
    """Traduce los errores 422 (datos con formato inválido) al español antes de responder."""
    errores = []
    for e in exc.errors():
        campo = ".".join(str(x) for x in e.get("loc", []) if x != "body")
        errores.append({"campo": campo, "mensaje": _traducir_error_validacion(e)})
    detalle = " · ".join(f"{er['campo']}: {er['mensaje']}" if er["campo"] else er["mensaje"] for er in errores)
    return JSONResponse(status_code=422, content={"detail": detalle or "Datos inválidos", "errores": errores})

app.include_router(auth_router)
app.include_router(usuarios_router)
app.include_router(propiedades_router)
app.include_router(inquilinos_router)
app.include_router(contratos_router)
app.include_router(pagos_router)
app.include_router(mensajes_router)
app.include_router(cuidados_router)
app.include_router(ti_router)

# ---------------------------------------------------------------------------
# Documentación interactiva: Swagger UI, ReDoc y Scalar, las tres a partir
# del mismo esquema OpenAPI generado automáticamente (/openapi.json).
# ---------------------------------------------------------------------------

@app.get("/docs", include_in_schema=False)
async def swagger_docs():
    return get_swagger_ui_html(openapi_url=app.openapi_url, title=f"{app.title} · Swagger")

@app.get("/redoc", include_in_schema=False)
async def redoc_docs():
    return get_redoc_html(openapi_url=app.openapi_url, title=f"{app.title} · ReDoc")

@app.get("/scalar", include_in_schema=False)
async def scalar_docs():
    return get_scalar_api_reference(openapi_url=app.openapi_url, title=f"{app.title} · Scalar")

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncSession(engine) as db:
        r = await db.execute(select(Usuario).where(Usuario.email == "admin@iobal.com"))
        if not r.scalar_one_or_none():
            db.add(Usuario(nombre="Admin", email="admin@iobal.com",
                           password_hash=hash_password("Admin123!"), rol="admin"))
            await db.commit()
        r2 = await db.execute(select(Usuario).where(Usuario.email == "ti@iobal.com"))
        if not r2.scalar_one_or_none():
            db.add(Usuario(nombre="TI", email="ti@iobal.com",
                           password_hash=hash_password("Ti123456!"), rol="ti"))
            await db.commit()

@app.get("/")
async def root():
    return {"msg": "IOBAL Arrendamiento API v1.0", "docs": "/docs", "redoc": "/redoc", "scalar": "/scalar"}
