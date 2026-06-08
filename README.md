# IOBAL — Arrendamiento de propiedades

Sistema de gestión de arrendamiento con propiedades, inquilinos, contratos, pagos y mensajes.

## Stack
- FastAPI + SQLAlchemy 2.0 async + Pydantic v2 + PostgreSQL 16 + Nginx + Docker

## Levantar

```bash
docker-compose up --build
```

| Servicio | URL |
|---|---|
| Frontend | http://localhost:3000 |
| API docs | http://localhost:3000/docs |

## Credenciales por defecto

```
Email:    admin@iobal.com
Password: Admin123!
```

## Módulos

- **Propiedades** — lista de casas/departamentos (vacante u ocupada)
- **Inquilinos** — registro de inquilinos vinculados a usuarios
- **Contratos** — se crea solo si hay inquilino activo; libera propiedad al finalizar
- **Pagos** — cada mes con múltiples conceptos (renta, agua, luz, internet, mantenimiento)
- **Mensajes** — avisos u observaciones por propiedad
- **Cuidados** — posts generales para inquilinos
- **Usuarios** — CRUD de roles (admin, propietario, inquilino)
