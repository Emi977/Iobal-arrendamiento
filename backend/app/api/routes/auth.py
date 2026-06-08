from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import get_db
from app.schemas import LoginRequest, TokenResponse
from app.core.security import verify_password, create_token
from app.core.rate_limit import limiter
from app.models import Usuario

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(request: Request, body: LoginRequest, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Usuario).where(Usuario.email == body.email, Usuario.activo == True))
    u = r.scalar_one_or_none()
    if not u or not verify_password(body.password, u.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    token = create_token({"sub": str(u.id), "rol": u.rol})
    return TokenResponse(access_token=token, usuario_id=u.id, nombre=u.nombre, rol=u.rol)
