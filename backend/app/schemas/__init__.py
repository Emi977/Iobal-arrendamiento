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
    owner_id: Optional[int]
    inquilino_id: Optional[int]
    created_at: datetime
    model_config = {"from_attributes": True}

class InquilinoCreate(BaseModel):
    nombre: str
    email: EmailStr
    password: str
    telefono: Optional[str] = None
    referencias: Optional[str] = None
    estado: str = "vigente"  # vigente, baja

class InquilinoUpdate(BaseModel):
    nombre: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    telefono: Optional[str] = None
    referencias: Optional[str] = None
    estado: Optional[str] = None  # vigente, baja

class InquilinoOut(BaseModel):
    id: int
    telefono: Optional[str]
    referencias: Optional[str]
    estado: str
    nombre: Optional[str] = None
    email: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}

class ContratoCreate(BaseModel):
    propiedad_id: int
    inquilino_id: int
    fecha_inicio: date
    fecha_fin: date
    monto_mensual: float
    descripcion: Optional[str] = None

    # cobro recurrente
    cobro_recurrente: bool = True
    dia_cobro: int = 1

    # datos del aval
    aval_nombre: Optional[str] = None
    aval_calle: Optional[str] = None
    aval_numero: Optional[str] = None
    aval_colonia: Optional[str] = None
    aval_ciudad: Optional[str] = None
    aval_estado: Optional[str] = None
    aval_cp: Optional[str] = None
    aval_no_predial: Optional[str] = None
    aval_email: Optional[EmailStr] = None
    aval_telefono_casa: Optional[str] = None
    aval_telefono_celular: Optional[str] = None

class ContratoUpdate(BaseModel):
    fecha_fin: Optional[date] = None
    monto_mensual: Optional[float] = None
    status: Optional[str] = None
    descripcion: Optional[str] = None

    cobro_recurrente: Optional[bool] = None
    dia_cobro: Optional[int] = None

    aval_nombre: Optional[str] = None
    aval_calle: Optional[str] = None
    aval_numero: Optional[str] = None
    aval_colonia: Optional[str] = None
    aval_ciudad: Optional[str] = None
    aval_estado: Optional[str] = None
    aval_cp: Optional[str] = None
    aval_no_predial: Optional[str] = None
    aval_email: Optional[EmailStr] = None
    aval_telefono_casa: Optional[str] = None
    aval_telefono_celular: Optional[str] = None

class ContratoOut(BaseModel):
    id: int
    propiedad_id: int
    inquilino_id: int
    fecha_inicio: date
    fecha_fin: date
    monto_mensual: float
    status: str
    descripcion: Optional[str] = None

    cobro_recurrente: bool
    dia_cobro: int

    aval_nombre: Optional[str] = None
    aval_calle: Optional[str] = None
    aval_numero: Optional[str] = None
    aval_colonia: Optional[str] = None
    aval_ciudad: Optional[str] = None
    aval_estado: Optional[str] = None
    aval_cp: Optional[str] = None
    aval_no_predial: Optional[str] = None
    aval_email: Optional[str] = None
    aval_telefono_casa: Optional[str] = None
    aval_telefono_celular: Optional[str] = None

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
    tipo: str = "puntual"  # recurrente, puntual
    conceptos: list[ConceptoCreate]

class PagoUpdate(BaseModel):
    status: Optional[str] = None
    tipo: Optional[str] = None

class PagoOut(BaseModel):
    id: int
    contrato_id: int
    mes: int
    anio: int
    total: float
    tipo: str
    status: str
    conceptos: list[ConceptoOut]
    created_at: datetime
    model_config = {"from_attributes": True}

class MensajeCreate(BaseModel):
    propiedad_id: Optional[int] = None
    tipo: str = "aviso"
    contenido: str
    estado: str = "pendiente"  # pendiente, visto, parcial, resuelto

class MensajeOut(BaseModel):
    id: int
    usuario_id: int
    propiedad_id: Optional[int]
    tipo: str
    contenido: str
    leido: bool
    estado: str
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

class AdeudoOut(BaseModel):
    pago_id: int
    contrato_id: int
    mes: int
    anio: int
    total: float
    tipo: str
    status: str
    conceptos: list[ConceptoOut]
    model_config = {"from_attributes": True}

class GenerarRecurrentesOut(BaseModel):
    generados: int
    pagos: list[PagoOut]
