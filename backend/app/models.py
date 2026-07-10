from sqlalchemy import String, Boolean, DateTime, Float, ForeignKey, Integer, Text, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from typing import Optional
from app.db.database import Base

class Usuario(Base):
    __tablename__ = "usuarios"
    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(150), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    rol: Mapped[str] = mapped_column(String(20), default="inquilino")  # admin, propietario, inquilino
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
    inquilino: Mapped[Optional["Inquilino"]] = relationship(back_populates="usuario")
    mensajes: Mapped[list["Mensaje"]] = relationship(back_populates="usuario")
    cuidados: Mapped[list["Cuidado"]] = relationship(back_populates="usuario")

class Propiedad(Base):
    __tablename__ = "propiedades"
    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(150))
    direccion: Mapped[str] = mapped_column(String(255))
    tipo: Mapped[str] = mapped_column(String(50))  # casa, departamento, local
    precio_renta: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(20), default="vacante")  # vacante, ocupada
    owner_id: Mapped[Optional[int]] = mapped_column(ForeignKey("usuarios.id"), nullable=True)  # admin responsable
    inquilino_id: Mapped[Optional[int]] = mapped_column(ForeignKey("inquilinos.id"), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
    inquilino: Mapped[Optional["Inquilino"]] = relationship(back_populates="propiedad")
    contratos: Mapped[list["Contrato"]] = relationship(back_populates="propiedad")
    mensajes: Mapped[list["Mensaje"]] = relationship(back_populates="propiedad")

class Inquilino(Base):
    __tablename__ = "inquilinos"
    id: Mapped[int] = mapped_column(primary_key=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"), unique=True)
    telefono: Mapped[Optional[str]] = mapped_column(String(20))
    referencias: Mapped[Optional[str]] = mapped_column(Text)
    estado: Mapped[str] = mapped_column(String(10), default="vigente")  # vigente, baja
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
    usuario: Mapped["Usuario"] = relationship(back_populates="inquilino")
    propiedad: Mapped[Optional["Propiedad"]] = relationship(back_populates="inquilino")
    contratos: Mapped[list["Contrato"]] = relationship(back_populates="inquilino")

class Contrato(Base):
    __tablename__ = "contratos"
    id: Mapped[int] = mapped_column(primary_key=True)
    propiedad_id: Mapped[int] = mapped_column(ForeignKey("propiedades.id"))
    inquilino_id: Mapped[int] = mapped_column(ForeignKey("inquilinos.id"))
    fecha_inicio: Mapped[Date] = mapped_column(Date)
    fecha_fin: Mapped[Date] = mapped_column(Date)
    monto_mensual: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(20), default="activo")  # activo, finalizado, cancelado
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # cobro recurrente
    cobro_recurrente: Mapped[bool] = mapped_column(Boolean, default=True)
    dia_cobro: Mapped[int] = mapped_column(Integer, default=1)  # día del mes (1-28) en que se genera el cobro

    # datos del aval
    aval_nombre: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    aval_calle: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    aval_numero: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    aval_colonia: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    aval_ciudad: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    aval_estado: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    aval_cp: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    aval_no_predial: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    aval_email: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    aval_telefono_casa: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    aval_telefono_celular: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
    propiedad: Mapped["Propiedad"] = relationship(back_populates="contratos")
    inquilino: Mapped["Inquilino"] = relationship(back_populates="contratos")
    pagos: Mapped[list["Pago"]] = relationship(back_populates="contrato")

class Pago(Base):
    __tablename__ = "pagos"
    id: Mapped[int] = mapped_column(primary_key=True)
    contrato_id: Mapped[int] = mapped_column(ForeignKey("contratos.id"))
    mes: Mapped[int] = mapped_column(Integer)
    anio: Mapped[int] = mapped_column(Integer)
    total: Mapped[float] = mapped_column(Float, default=0)
    tipo: Mapped[str] = mapped_column(String(20), default="puntual")  # recurrente, puntual
    status: Mapped[str] = mapped_column(String(20), default="pendiente")  # pendiente, pagado, atrasado, parcial
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
    contrato: Mapped["Contrato"] = relationship(back_populates="pagos")
    conceptos: Mapped[list["ConceptoPago"]] = relationship(back_populates="pago", cascade="all, delete-orphan")

class ConceptoPago(Base):
    __tablename__ = "conceptos_pago"
    id: Mapped[int] = mapped_column(primary_key=True)
    pago_id: Mapped[int] = mapped_column(ForeignKey("pagos.id"))
    tipo: Mapped[str] = mapped_column(String(50))  # renta, agua, luz, internet, mantenimiento
    monto: Mapped[float] = mapped_column(Float)
    descripcion: Mapped[Optional[str]] = mapped_column(String(255))
    pago: Mapped["Pago"] = relationship(back_populates="conceptos")

class Mensaje(Base):
    __tablename__ = "mensajes"
    id: Mapped[int] = mapped_column(primary_key=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"))
    propiedad_id: Mapped[Optional[int]] = mapped_column(ForeignKey("propiedades.id"), nullable=True)
    tipo: Mapped[str] = mapped_column(String(20), default="aviso")  # aviso, observacion
    contenido: Mapped[str] = mapped_column(Text)
    leido: Mapped[bool] = mapped_column(Boolean, default=False)
    estado: Mapped[str] = mapped_column(String(20), default="pendiente")  # pendiente, visto, parcial, resuelto
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
    usuario: Mapped["Usuario"] = relationship(back_populates="mensajes")
    propiedad: Mapped[Optional["Propiedad"]] = relationship(back_populates="mensajes")

class Cuidado(Base):
    __tablename__ = "cuidados"
    id: Mapped[int] = mapped_column(primary_key=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"))
    titulo: Mapped[str] = mapped_column(String(150))
    contenido: Mapped[str] = mapped_column(Text)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
    usuario: Mapped["Usuario"] = relationship(back_populates="cuidados")
