from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.db.database import get_db
from app.models import Propiedad
from app.schemas import PropiedadCreate, PropiedadOut, PropiedadUpdate
from app.core.permissions import require_admin, require_admin_o_propietario, get_current_user, TokenPayload

router = APIRouter(prefix="/api/v1/propiedades", tags=["propiedades"])

@router.post("", response_model=PropiedadOut)
async def crear(body: PropiedadCreate, db: AsyncSession = Depends(get_db), me: TokenPayload = Depends(require_admin)):
    p = Propiedad(**body.model_dump(), owner_id=me.usuario_id)
    db.add(p); await db.commit(); await db.refresh(p)
    return p

@router.get("", response_model=list[PropiedadOut])
async def listar(db: AsyncSession = Depends(get_db), me: TokenPayload = Depends(require_admin_o_propietario)):
    q = select(Propiedad)
    # admin/propietario solo ven sus propiedades (o las que no tienen dueño asignado); ti ve todas
    if me.rol in ("admin", "propietario"):
        q = q.where(or_(Propiedad.owner_id == me.usuario_id, Propiedad.owner_id == None))
    r = await db.execute(q)
    return r.scalars().all()

@router.get("/{id}", response_model=PropiedadOut)
async def obtener(id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    r = await db.execute(select(Propiedad).where(Propiedad.id == id))
    p = r.scalar_one_or_none()
    if not p: raise HTTPException(status_code=404, detail="No encontrada")
    return p

@router.patch("/{id}", response_model=PropiedadOut)
async def actualizar(id: int, body: PropiedadUpdate, db: AsyncSession = Depends(get_db), me: TokenPayload = Depends(require_admin)):
    r = await db.execute(select(Propiedad).where(Propiedad.id == id))
    p = r.scalar_one_or_none()
    if not p: raise HTTPException(status_code=404, detail="No encontrada")
    # solo el owner puede editar
    if p.owner_id and p.owner_id != me.usuario_id:
        raise HTTPException(status_code=403, detail="Solo el admin asignado puede editar esta propiedad")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(p, k, v)
    await db.commit(); await db.refresh(p)
    return p

@router.delete("/{id}")
async def eliminar(id: int, db: AsyncSession = Depends(get_db), me: TokenPayload = Depends(require_admin)):
    r = await db.execute(select(Propiedad).where(Propiedad.id == id))
    p = r.scalar_one_or_none()
    if not p: raise HTTPException(status_code=404, detail="No encontrada")
    if p.owner_id and p.owner_id != me.usuario_id:
        raise HTTPException(status_code=403, detail="Solo el admin asignado puede eliminar esta propiedad")
    await db.delete(p); await db.commit()
    return {"ok": True}
