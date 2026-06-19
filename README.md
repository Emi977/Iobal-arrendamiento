# IOBAL — Arrendamiento de propiedades

Sistema de gestión de arrendamiento con propiedades, inquilinos, contratos, pagos y mensajes.

## Stack

- **Backend:** FastAPI · SQLAlchemy 2.0 async · Pydantic v2 · PostgreSQL 16
- **Frontend:** Bootstrap 5.3 · Bootstrap Icons · JavaScript vanilla (SPA)
- **Diseño responsivo:** menú hamburguesa en mobile, layout adaptable a cualquier pantalla

> Docker **no se usa durante el desarrollo local**. Los archivos de contenedor están en `deploy/docker/` y se utilizarán únicamente al subir a producción.

---

## Desarrollo local

### Requisitos previos

| Herramienta | Versión mínima |
|---|---|
| Python | 3.12 |
| PostgreSQL | 16 |
| pip | cualquiera reciente |

### Variables de entorno

Crea el archivo `backend/.env` a partir del ejemplo incluido:

```bash
cp backend/.env.example backend/.env
```

Edita los valores según tu entorno local:

| Variable | Descripción | Ejemplo |
|---|---|---|
| `DATABASE_URL` | Cadena de conexión asyncpg a PostgreSQL | `postgresql+asyncpg://iobal:iobal123@localhost:5432/arrend_db` |
| `SECRET_KEY` | Clave secreta para firmar JWT (cámbiala) | `mi-clave-segura-local` |
| `ALGORITHM` | Algoritmo de firma JWT | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Duración del token en minutos | `480` |

### Crear base de datos

```bash
psql -U postgres -c "CREATE USER iobal WITH PASSWORD 'iobal123';"
psql -U postgres -c "CREATE DATABASE arrend_db OWNER iobal;"
```

### Instalar dependencias e iniciar el backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Las tablas se crean automáticamente al iniciar. El usuario admin se inserta si no existe.

### Servir el frontend

Cualquier servidor HTTP estático funciona. Ejemplo con Python:

```bash
cd frontend
python -m http.server 3000
```

O abre `frontend/index.html` directamente en el navegador si el backend corre en `localhost:8000` y configuras un proxy, o ajusta la constante `API` en `app.js`.

### Credenciales por defecto

```
Email:    admin@iobal.com
Password: Admin123!
```

---

## Módulos

| Módulo | Descripción |
|---|---|
| **Propiedades** | Lista de casas/departamentos (vacante u ocupada) |
| **Inquilinos** | Registro de inquilinos vinculados a usuarios |
| **Contratos** | Se crea solo si hay inquilino activo; libera propiedad al finalizar |
| **Pagos** | Cada mes con múltiples conceptos (renta, agua, luz, internet, mantenimiento) |
| **Mensajes** | Avisos u observaciones por propiedad |
| **Cuidados** | Posts generales para inquilinos |
| **Usuarios** | CRUD de roles (admin, propietario, inquilino) — solo visible para admin |

---

## Estructura del proyecto

```
iobal-arrendamiento/
├── backend/
│   ├── app/
│   │   ├── api/routes/      # Endpoints por módulo
│   │   ├── core/            # Seguridad, permisos, rate limit, configuración
│   │   ├── db/              # Conexión async a PostgreSQL
│   │   ├── models.py        # Modelos SQLAlchemy
│   │   ├── schemas/         # Schemas Pydantic
│   │   └── main.py          # Punto de entrada FastAPI
│   ├── requirements.txt
│   └── .env.example         # Plantilla de variables de entorno
├── frontend/
│   ├── index.html           # SPA con layout responsivo y menú hamburguesa
│   ├── app.js               # Lógica de la aplicación
│   └── style.css            # Estilos con soporte mobile-first
├── deploy/
│   └── docker/              # Configuración Docker (solo para producción)
│       ├── docker-compose.yml
│       ├── Dockerfile.backend
│       └── nginx/
│           └── default.conf
└── README.md
```

---

## Producción con Docker

Los archivos de Docker se encuentran en `deploy/docker/`. Para desplegar:

```bash
cd deploy/docker
docker compose up --build
```

| Servicio | URL |
|---|---|
| Frontend | http://localhost:3000 |
| API docs | http://localhost:3000/docs |

> Antes de subir a producción, cambia `SECRET_KEY` en `docker-compose.yml` y en tu `.env` por un valor seguro generado con `openssl rand -hex 32`.
