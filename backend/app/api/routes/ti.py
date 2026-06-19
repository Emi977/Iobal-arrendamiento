from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import get_db
from app.models import Usuario
from app.schemas import UsuarioCreate, UsuarioOut, UsuarioUpdate
from app.core.security import hash_password
from app.core.permissions import require_ti

router = APIRouter(prefix="/api/v1/ti", tags=["ti"])

# solo TI puede ver y gestionar admins
@router.get("/admins", response_model=list[UsuarioOut])
async def listar_admins(db: AsyncSession = Depends(get_db), _=Depends(require_ti)):
    r = await db.execute(select(Usuario).where(Usuario.rol == "admin", Usuario.activo == True))
    return r.scalars().all()

@router.post("/admins", response_model=UsuarioOut)
async def crear_admin(body: UsuarioCreate, db: AsyncSession = Depends(get_db), _=Depends(require_ti)):
    r = await db.execute(select(Usuario).where(Usuario.email == body.email))
    if r.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email ya registrado")
    u = Usuario(nombre=body.nombre, email=body.email,
                password_hash=hash_password(body.password), rol="admin")
    db.add(u); await db.commit(); await db.refresh(u)
    return u

@router.patch("/admins/{id}", response_model=UsuarioOut)
async def actualizar_admin(id: int, body: UsuarioUpdate, db: AsyncSession = Depends(get_db), _=Depends(require_ti)):
    r = await db.execute(select(Usuario).where(Usuario.id == id, Usuario.rol == "admin"))
    u = r.scalar_one_or_none()
    if not u: raise HTTPException(status_code=404, detail="Admin no encontrado")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(u, k, v)
    await db.commit(); await db.refresh(u)
    return u

@router.delete("/admins/{id}")
async def desactivar_admin(id: int, db: AsyncSession = Depends(get_db), _=Depends(require_ti)):
    r = await db.execute(select(Usuario).where(Usuario.id == id, Usuario.rol == "admin"))
    u = r.scalar_one_or_none()
    if not u: raise HTTPException(status_code=404, detail="Admin no encontrado")
    u.activo = False; await db.commit()
    return {"ok": True}
