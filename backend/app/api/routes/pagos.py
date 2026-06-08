from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import get_db
from app.models import Pago, ConceptoPago
from app.schemas import PagoCreate, PagoOut, PagoUpdate
from app.core.permissions import require_admin, get_current_user

router = APIRouter(prefix="/api/v1/pagos", tags=["pagos"])

@router.post("", response_model=PagoOut)
async def crear(body: PagoCreate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    total = sum(c.monto for c in body.conceptos)
    p = Pago(contrato_id=body.contrato_id, mes=body.mes, anio=body.anio, total=total)
    db.add(p); await db.flush()
    for c in body.conceptos:
        db.add(ConceptoPago(pago_id=p.id, **c.model_dump()))
    await db.commit(); await db.refresh(p)
    # cargar conceptos
    await db.refresh(p, ["conceptos"])
    return p

@router.get("", response_model=list[PagoOut])
async def listar(contrato_id: int | None = None, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    q = select(Pago)
    if contrato_id:
        q = q.where(Pago.contrato_id == contrato_id)
    r = await db.execute(q)
    pagos = r.scalars().all()
    for p in pagos:
        await db.refresh(p, ["conceptos"])
    return pagos

@router.get("/{id}", response_model=PagoOut)
async def obtener(id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    r = await db.execute(select(Pago).where(Pago.id == id))
    p = r.scalar_one_or_none()
    if not p: raise HTTPException(status_code=404, detail="No encontrado")
    await db.refresh(p, ["conceptos"])
    return p

@router.patch("/{id}", response_model=PagoOut)
async def actualizar(id: int, body: PagoUpdate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    r = await db.execute(select(Pago).where(Pago.id == id))
    p = r.scalar_one_or_none()
    if not p: raise HTTPException(status_code=404, detail="No encontrado")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(p, k, v)
    await db.commit(); await db.refresh(p, ["conceptos"])
    return p
