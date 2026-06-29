from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import get_db
from app.models import Pago, ConceptoPago, Contrato
from app.schemas import PagoCreate, PagoOut, PagoUpdate, AdeudoOut
from app.core.permissions import require_admin, get_current_user, TokenPayload

router = APIRouter(prefix="/api/v1/pagos", tags=["pagos"])

@router.post("", response_model=PagoOut)
async def crear(body: PagoCreate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    total = sum(c.monto for c in body.conceptos)
    p = Pago(contrato_id=body.contrato_id, mes=body.mes, anio=body.anio,
             total=total, tipo=body.tipo)
    db.add(p); await db.flush()
    for c in body.conceptos:
        db.add(ConceptoPago(pago_id=p.id, **c.model_dump()))
    await db.commit(); await db.refresh(p)
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

@router.get("/mis-adeudos", response_model=list[AdeudoOut])
async def mis_adeudos(db: AsyncSession = Depends(get_db), me: TokenPayload = Depends(get_current_user)):
    # buscar contratos del inquilino
    from app.models import Inquilino
    r = await db.execute(select(Inquilino).where(Inquilino.usuario_id == me.usuario_id))
    inq = r.scalar_one_or_none()
    if not inq:
        return []
    r2 = await db.execute(select(Contrato).where(Contrato.inquilino_id == inq.id, Contrato.status == "activo"))
    contratos = r2.scalars().all()
    adeudos = []
    for c in contratos:
        r3 = await db.execute(select(Pago).where(
            Pago.contrato_id == c.id,
            Pago.status.in_(["pendiente", "atrasado", "parcial"])
        ))
        pagos = r3.scalars().all()
        for p in pagos:
            await db.refresh(p, ["conceptos"])
            adeudos.append(AdeudoOut(
                pago_id=p.id, contrato_id=p.contrato_id,
                mes=p.mes, anio=p.anio, total=p.total,
                tipo=p.tipo, status=p.status, conceptos=p.conceptos
            ))
    return adeudos

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
