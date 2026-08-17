from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.db.database import get_db
from app.models import Inquilino, Usuario
from app.schemas import InquilinoCreate, InquilinoOut, InquilinoUpdate
from app.core.security import hash_password
from app.core.permissions import require_admin, get_current_user

router = APIRouter(prefix="/api/v1/inquilinos", tags=["inquilinos"])


def _to_out(i: Inquilino) -> InquilinoOut:
    return InquilinoOut(
        id=i.id, telefono=i.telefono, referencias=i.referencias, estado=i.estado,
        nombre=i.usuario.nombre if i.usuario else None,
        email=i.usuario.email if i.usuario else None,
        created_at=i.created_at,
    )

@router.post("", response_model=InquilinoOut)
async def crear(body: InquilinoCreate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    r = await db.execute(select(Usuario).where(Usuario.email == body.email))
    if r.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Ese correo ya está registrado")

    # se crea la cuenta de acceso (rol inquilino) y el perfil de inquilino en un solo paso
    u = Usuario(nombre=body.nombre, email=body.email,
                password_hash=hash_password(body.password), rol="inquilino")
    db.add(u); await db.flush()

    i = Inquilino(usuario_id=u.id, telefono=body.telefono,
                  referencias=body.referencias, estado=body.estado)
    db.add(i)
    await db.commit()
    await db.refresh(i, ["usuario"])
    return _to_out(i)

@router.get("", response_model=list[InquilinoOut])
async def listar(estado: str | None = None, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    q = select(Inquilino).options(selectinload(Inquilino.usuario))
    if estado:
        q = q.where(Inquilino.estado == estado)
    r = await db.execute(q)
    return [_to_out(i) for i in r.scalars().all()]

@router.get("/me", response_model=InquilinoOut)
async def mi_perfil(db: AsyncSession = Depends(get_db), me=Depends(get_current_user)):
    r = await db.execute(select(Inquilino).options(selectinload(Inquilino.usuario)).where(Inquilino.usuario_id == me.usuario_id))
    i = r.scalar_one_or_none()
    if not i: raise HTTPException(status_code=404, detail="No tienes un perfil de inquilino asociado")
    return _to_out(i)

@router.get("/{id}", response_model=InquilinoOut)
async def obtener(id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    r = await db.execute(select(Inquilino).options(selectinload(Inquilino.usuario)).where(Inquilino.id == id))
    i = r.scalar_one_or_none()
    if not i: raise HTTPException(status_code=404, detail="No encontrado")
    return _to_out(i)

@router.patch("/{id}", response_model=InquilinoOut)
async def actualizar(id: int, body: InquilinoUpdate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    r = await db.execute(select(Inquilino).options(selectinload(Inquilino.usuario)).where(Inquilino.id == id))
    i = r.scalar_one_or_none()
    if not i: raise HTTPException(status_code=404, detail="No encontrado")

    datos = body.model_dump(exclude_none=True)

    # campos propios del perfil de inquilino
    for k in ("telefono", "referencias", "estado"):
        if k in datos:
            setattr(i, k, datos.pop(k))

    # campos de la cuenta de acceso vinculada
    nueva_pass = datos.pop("password", None)
    nuevo_email = datos.pop("email", None)
    if nuevo_email and nuevo_email != i.usuario.email:
        r2 = await db.execute(select(Usuario).where(Usuario.email == nuevo_email, Usuario.id != i.usuario_id))
        if r2.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Ese correo ya está registrado")
        i.usuario.email = nuevo_email
    if "nombre" in datos:
        i.usuario.nombre = datos.pop("nombre")
    if nueva_pass:
        i.usuario.password_hash = hash_password(nueva_pass)

    await db.commit(); await db.refresh(i, ["usuario"])
    return _to_out(i)
