from pydantic import BaseModel, EmailStr
from datetime import datetime, date
from typing import Optional

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    usuario_id: int
    nombre: str
    rol: str

class UsuarioCreate(BaseModel):
    nombre: str
    email: EmailStr
    password: str
    rol: str = "inquilino"

class UsuarioUpdate(BaseModel):
    nombre: Optional[str] = None
    email: Optional[EmailStr] = None
    rol: Optional[str] = None
    activo: Optional[bool] = None

class UsuarioOut(BaseModel):
    id: int
    nombre: str
    email: str
    rol: str
    activo: bool
    created_at: datetime
    model_config = {"from_attributes": True}

class PropiedadCreate(BaseModel):
    nombre: str
    direccion: str
    tipo: str
    precio_renta: float

class PropiedadUpdate(BaseModel):
    nombre: Optional[str] = None
    direccion: Optional[str] = None
    tipo: Optional[str] = None
    precio_renta: Optional[float] = None
    status: Optional[str] = None
    inquilino_id: Optional[int] = None

class PropiedadOut(BaseModel):
    id: int
    nombre: str
    direccion: str
    tipo: str
    precio_renta: float
    status: str
    inquilino_id: Optional[int]
    created_at: datetime
    model_config = {"from_attributes": True}

class InquilinoCreate(BaseModel):
    usuario_id: int
    telefono: Optional[str] = None
    referencias: Optional[str] = None

class InquilinoUpdate(BaseModel):
    telefono: Optional[str] = None
    referencias: Optional[str] = None

class InquilinoOut(BaseModel):
    id: int
    usuario_id: int
    telefono: Optional[str]
    referencias: Optional[str]
    created_at: datetime
    model_config = {"from_attributes": True}

class ContratoCreate(BaseModel):
    propiedad_id: int
    inquilino_id: int
    fecha_inicio: date
    fecha_fin: date
    monto_mensual: float

class ContratoUpdate(BaseModel):
    fecha_fin: Optional[date] = None
    monto_mensual: Optional[float] = None
    status: Optional[str] = None

class ContratoOut(BaseModel):
    id: int
    propiedad_id: int
    inquilino_id: int
    fecha_inicio: date
    fecha_fin: date
    monto_mensual: float
    status: str
    created_at: datetime
    model_config = {"from_attributes": True}

class ConceptoCreate(BaseModel):
    tipo: str
    monto: float
    descripcion: Optional[str] = None

class ConceptoOut(BaseModel):
    id: int
    tipo: str
    monto: float
    descripcion: Optional[str]
    model_config = {"from_attributes": True}

class PagoCreate(BaseModel):
    contrato_id: int
    mes: int
    anio: int
    conceptos: list[ConceptoCreate]

class PagoUpdate(BaseModel):
    status: Optional[str] = None

class PagoOut(BaseModel):
    id: int
    contrato_id: int
    mes: int
    anio: int
    total: float
    status: str
    conceptos: list[ConceptoOut]
    created_at: datetime
    model_config = {"from_attributes": True}

class MensajeCreate(BaseModel):
    propiedad_id: Optional[int] = None
    tipo: str = "aviso"
    contenido: str

class MensajeOut(BaseModel):
    id: int
    usuario_id: int
    propiedad_id: Optional[int]
    tipo: str
    contenido: str
    leido: bool
    created_at: datetime
    model_config = {"from_attributes": True}

class CuidadoCreate(BaseModel):
    titulo: str
    contenido: str

class CuidadoUpdate(BaseModel):
    titulo: Optional[str] = None
    contenido: Optional[str] = None

class CuidadoOut(BaseModel):
    id: int
    usuario_id: int
    titulo: str
    contenido: str
    created_at: datetime
    model_config = {"from_attributes": True}
