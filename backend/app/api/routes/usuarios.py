from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import get_db
from app.models import Usuario
from app.schemas import UsuarioCreate, UsuarioOut, UsuarioUpdate
from app.core.security import hash_password
from app.core.permissions import require_admin, get_current_user

router = APIRouter(prefix="/api/v1/usuarios", tags=["usuarios"])

@router.post("", response_model=UsuarioOut)
async def crear(body: UsuarioCreate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    r = await db.execute(select(Usuario).where(Usuario.email == body.email))
    if r.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email ya registrado")
    u = Usuario(nombre=body.nombre, email=body.email,
                password_hash=hash_password(body.password), rol=body.rol)
    db.add(u); await db.commit(); await db.refresh(u)
    return u

@router.get("", response_model=list[UsuarioOut])
async def listar(db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    r = await db.execute(select(Usuario).where(Usuario.activo == True))
    return r.scalars().all()

@router.get("/{id}", response_model=UsuarioOut)
async def obtener(id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    r = await db.execute(select(Usuario).where(Usuario.id == id))
    u = r.scalar_one_or_none()
    if not u: raise HTTPException(status_code=404, detail="No encontrado")
    return u

@router.patch("/{id}", response_model=UsuarioOut)
async def actualizar(id: int, body: UsuarioUpdate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    r = await db.execute(select(Usuario).where(Usuario.id == id))
    u = r.scalar_one_or_none()
    if not u: raise HTTPException(status_code=404, detail="No encontrado")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(u, k, v)
    await db.commit(); await db.refresh(u)
    return u

@router.delete("/{id}")
async def desactivar(id: int, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    r = await db.execute(select(Usuario).where(Usuario.id == id))
    u = r.scalar_one_or_none()
    if not u: raise HTTPException(status_code=404, detail="No encontrado")
    u.activo = False; await db.commit()
    return {"ok": True}
