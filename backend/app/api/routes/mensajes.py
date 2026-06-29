from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import get_db
from app.models import Mensaje
from app.schemas import MensajeCreate, MensajeOut
from app.core.permissions import get_current_user, TokenPayload

router = APIRouter(prefix="/api/v1/mensajes", tags=["mensajes"])

ESTADOS = ["pendiente", "visto", "parcial", "resuelto"]

@router.post("", response_model=MensajeOut)
async def crear(body: MensajeCreate, db: AsyncSession = Depends(get_db), me: TokenPayload = Depends(get_current_user)):
    m = Mensaje(usuario_id=me.usuario_id, **body.model_dump())
    db.add(m); await db.commit(); await db.refresh(m)
    return m

@router.get("", response_model=list[MensajeOut])
async def listar(propiedad_id: int | None = None, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    q = select(Mensaje)
    if propiedad_id:
        q = q.where(Mensaje.propiedad_id == propiedad_id)
    r = await db.execute(q.order_by(Mensaje.created_at.desc()))
    return r.scalars().all()

@router.patch("/{id}/estado")
async def cambiar_estado(id: int, estado: str, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    if estado not in ESTADOS:
        raise HTTPException(status_code=400, detail=f"Estado inválido. Opciones: {ESTADOS}")
    r = await db.execute(select(Mensaje).where(Mensaje.id == id))
    m = r.scalar_one_or_none()
    if not m: raise HTTPException(status_code=404, detail="No encontrado")
    m.estado = estado
    m.leido = estado != "pendiente"
    await db.commit()
    return {"ok": True}

@router.delete("/{id}")
async def eliminar(id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    r = await db.execute(select(Mensaje).where(Mensaje.id == id))
    m = r.scalar_one_or_none()
    if not m: raise HTTPException(status_code=404, detail="No encontrado")
    await db.delete(m); await db.commit()
    return {"ok": True}
