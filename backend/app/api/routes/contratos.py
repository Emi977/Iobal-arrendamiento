from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import get_db
from app.models import Contrato, Propiedad
from app.schemas import ContratoCreate, ContratoOut, ContratoUpdate
from app.core.permissions import require_admin, get_current_user

router = APIRouter(prefix="/api/v1/contratos", tags=["contratos"])

@router.post("", response_model=ContratoOut)
async def crear(body: ContratoCreate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    # marcar propiedad como ocupada
    r = await db.execute(select(Propiedad).where(Propiedad.id == body.propiedad_id))
    p = r.scalar_one_or_none()
    if not p: raise HTTPException(status_code=404, detail="Propiedad no encontrada")
    if p.status == "ocupada":
        raise HTTPException(status_code=409, detail="Propiedad ya tiene inquilino activo")
    c = Contrato(**body.model_dump())
    db.add(c)
    p.status = "ocupada"
    p.inquilino_id = body.inquilino_id
    await db.commit(); await db.refresh(c)
    return c

@router.get("", response_model=list[ContratoOut])
async def listar(db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    r = await db.execute(select(Contrato))
    return r.scalars().all()

@router.get("/{id}", response_model=ContratoOut)
async def obtener(id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    r = await db.execute(select(Contrato).where(Contrato.id == id))
    c = r.scalar_one_or_none()
    if not c: raise HTTPException(status_code=404, detail="No encontrado")
    return c

@router.patch("/{id}", response_model=ContratoOut)
async def actualizar(id: int, body: ContratoUpdate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    r = await db.execute(select(Contrato).where(Contrato.id == id))
    c = r.scalar_one_or_none()
    if not c: raise HTTPException(status_code=404, detail="No encontrado")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(c, k, v)
    # si se cancela o finaliza, liberar propiedad
    if body.status in ("finalizado", "cancelado"):
        rp = await db.execute(select(Propiedad).where(Propiedad.id == c.propiedad_id))
        p = rp.scalar_one_or_none()
        if p:
            p.status = "vacante"
            p.inquilino_id = None
    await db.commit(); await db.refresh(c)
    return c
