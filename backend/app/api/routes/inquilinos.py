from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import get_db
from app.models import Inquilino
from app.schemas import InquilinoCreate, InquilinoOut, InquilinoUpdate
from app.core.permissions import require_admin, get_current_user

router = APIRouter(prefix="/api/v1/inquilinos", tags=["inquilinos"])

@router.post("", response_model=InquilinoOut)
async def crear(body: InquilinoCreate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    i = Inquilino(**body.model_dump())
    db.add(i); await db.commit(); await db.refresh(i)
    return i

@router.get("", response_model=list[InquilinoOut])
async def listar(db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    r = await db.execute(select(Inquilino))
    return r.scalars().all()

@router.get("/{id}", response_model=InquilinoOut)
async def obtener(id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    r = await db.execute(select(Inquilino).where(Inquilino.id == id))
    i = r.scalar_one_or_none()
    if not i: raise HTTPException(status_code=404, detail="No encontrado")
    return i

@router.patch("/{id}", response_model=InquilinoOut)
async def actualizar(id: int, body: InquilinoUpdate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    r = await db.execute(select(Inquilino).where(Inquilino.id == id))
    i = r.scalar_one_or_none()
    if not i: raise HTTPException(status_code=404, detail="No encontrado")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(i, k, v)
    await db.commit(); await db.refresh(i)
    return i
