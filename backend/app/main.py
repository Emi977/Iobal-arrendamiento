from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

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

app = FastAPI(title="IOBAL Arrendamiento API", version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

app.include_router(auth_router)
app.include_router(usuarios_router)
app.include_router(propiedades_router)
app.include_router(inquilinos_router)
app.include_router(contratos_router)
app.include_router(pagos_router)
app.include_router(mensajes_router)
app.include_router(cuidados_router)
app.include_router(ti_router)

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncSession(engine) as db:
        # crear usuario TI por defecto
        r = await db.execute(select(Usuario).where(Usuario.email == "ti@iobal.com"))
        if not r.scalar_one_or_none():
            db.add(Usuario(nombre="TI", email="ti@iobal.com",
                           password_hash=hash_password("Ti123!"), rol="ti"))
        # crear admin por defecto
        r2 = await db.execute(select(Usuario).where(Usuario.email == "admin@iobal.com"))
        if not r2.scalar_one_or_none():
            db.add(Usuario(nombre="Admin", email="admin@iobal.com",
                           password_hash=hash_password("Admin123!"), rol="admin"))
        await db.commit()

@app.get("/")
async def root():
    return {"msg": "IOBAL Arrendamiento API v1.0"}
