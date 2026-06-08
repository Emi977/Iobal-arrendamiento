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
    status: Mapped[str] = mapped_column(String(20), default="pendiente")  # pendiente, pagado, atrasado
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
