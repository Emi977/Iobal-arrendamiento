from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import get_db
from app.models import Cuidado
from app.schemas import CuidadoCreate, CuidadoOut, CuidadoUpdate
from app.core.permissions import require_admin, get_current_user, TokenPayload

router = APIRouter(prefix="/api/v1/cuidados", tags=["cuidados"])

@router.post("", response_model=CuidadoOut)
async def crear(body: CuidadoCreate, db: AsyncSession = Depends(get_db), me: TokenPayload = Depends(require_admin)):
    c = Cuidado(usuario_id=me.usuario_id, **body.model_dump())
    db.add(c); await db.commit(); await db.refresh(c)
    return c

@router.get("", response_model=list[CuidadoOut])
async def listar(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    r = await db.execute(select(Cuidado).order_by(Cuidado.created_at.desc()))
    return r.scalars().all()

@router.get("/{id}", response_model=CuidadoOut)
async def obtener(id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    r = await db.execute(select(Cuidado).where(Cuidado.id == id))
    c = r.scalar_one_or_none()
    if not c: raise HTTPException(status_code=404, detail="No encontrado")
    return c

@router.patch("/{id}", response_model=CuidadoOut)
async def actualizar(id: int, body: CuidadoUpdate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    r = await db.execute(select(Cuidado).where(Cuidado.id == id))
    c = r.scalar_one_or_none()
    if not c: raise HTTPException(status_code=404, detail="No encontrado")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(c, k, v)
    await db.commit(); await db.refresh(c)
    return c

@router.delete("/{id}")
async def eliminar(id: int, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    r = await db.execute(select(Cuidado).where(Cuidado.id == id))
    c = r.scalar_one_or_none()
    if not c: raise HTTPException(status_code=404, detail="No encontrado")
    await db.delete(c); await db.commit()
    return {"ok": True}
