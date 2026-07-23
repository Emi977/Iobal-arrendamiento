Arrendamiento de propiedades

Sistema de gestión de arrendamiento con propiedades, inquilinos, contratos, pagos y mensajes.

## Stack

- **Backend:** FastAPI · SQLAlchemy 2.0 async · Pydantic v2 · PostgreSQL 16
- **Frontend:** Bootstrap 5.3 · Bootstrap Icons · JavaScript vanilla (SPA)
- **Diseño responsivo:** menú hamburguesa en mobile, layout adaptable a cualquier pantalla

> Docker **no se usa durante el desarrollo local**. Los archivos de contenedor están en `deploy/docker/` y se utilizarán únicamente al subir a producción.

---

## Levantar el proyecto sin Docker (desarrollo local)

Esta es la forma recomendada para desarrollar: backend con `uvicorn` corriendo directo en tu máquina y PostgreSQL nativo (o cualquier Postgres al que tengas acceso). Docker se deja solo para producción (ver más abajo).

### 0. Checklist rápido

1. Instalar PostgreSQL 16 y crear la base de datos.
2. Configurar `backend/.env`.
3. Crear entorno virtual, instalar dependencias e iniciar `uvicorn`.
4. Ajustar la constante `API` en `frontend/app.js` (**paso fácil de olvidar**, ver nota abajo).
5. Servir `frontend/` con cualquier servidor estático.
6. Entrar con las credenciales sembradas automáticamente.

### 1. Requisitos previos

| Herramienta | Versión mínima |
|---|---|
| Python | 3.12 |
| PostgreSQL | 16 |
| pip | cualquiera reciente |

### 2. Crear base de datos

```bash
psql -U postgres -c "CREATE USER iobal WITH PASSWORD 'iobal123';"
psql -U postgres -c "CREATE DATABASE arrend_db OWNER iobal;"
```

> **¿Ya tenías una base de datos de una versión anterior del proyecto?** Aplica la migración incluida antes de arrancar el backend, o vas a ver errores 500 al abrir secciones como Contratos o Inquilinos:
> ```bash
> psql "postgresql://iobal:iobal123@localhost:5432/arrend_db" -f deploy/docker/migracion_contrato_aval.sql
> ```
> Si es una base nueva (recién creada arriba), no hace falta correr esto: las tablas se crean ya con el esquema completo.

### 3. Variables de entorno

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
| `DEBUG` | Si es `true`, los errores 500 regresan el detalle real (útil en desarrollo). Ponlo en `false` para producción | `true` |

### 4. Instalar dependencias e iniciar el backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Las tablas se crean automáticamente al iniciar (`create_all`, sin Alembic). Además del usuario admin, también se siembra una cuenta con rol `ti` — ambas solo se insertan si no existen ya.

**Documentación interactiva de la API**, ya disponible en cuanto arranca el backend:

| Interfaz | URL |
|---|---|
| Swagger UI | http://localhost:8000/docs |
| ReDoc | http://localhost:8000/redoc |
| Scalar | http://localhost:8000/scalar |

### 5. Servir el frontend

Cualquier servidor HTTP estático funciona. Ejemplo con Python:

```bash
cd frontend
python -m http.server 3000
```

Luego abre `http://localhost:3000` en el navegador.

> ⚠️ **Importante — ajusta la URL de la API:** `frontend/app.js` apunta a la API con una ruta **relativa** (`const API = "/api/v1"`), pensada para cuando Nginx sirve frontend y backend bajo el mismo dominio (como en producción con Docker). Si sirves el frontend en un puerto distinto al del backend (como en el ejemplo de arriba: frontend en `3000`, backend en `8000`), cambia esa línea al inicio de `frontend/app.js` a la URL completa del backend:
> ```js
> const API = "http://localhost:8000/api/v1";
> ```
> El backend ya acepta peticiones de cualquier origen (CORS abierto), así que basta con este cambio para que el frontend se conecte correctamente.

### 6. Credenciales por defecto

```
Admin
  Email:    admin@iobal.com
  Password: Admin123!

TI (superusuario, gestiona cuentas admin)
  Email:    ti@iobal.com
  Password: Ti123456!
```

Cambia ambas contraseñas después del primer login.

---

## Módulos

| Módulo | Descripción |
|---|---|
| **Propiedades** | Lista de casas/departamentos (vacante u ocupada) |
| **Inquilinos** | Alta directa (crea cuenta de acceso + perfil en un solo paso), estado vigente/baja |
| **Contratos** | Se crea solo si hay inquilino vigente; libera propiedad al finalizar; cobro recurrente genera adeudos automáticamente |
| **Pagos** | Cada mes con múltiples conceptos (renta, agua, luz, internet, mantenimiento) |
| **Mensajes** | Avisos u observaciones por propiedad |
| **Cuidados** | Posts generales para inquilinos |
| **Usuarios** | Cuentas con rol admin o propietario — visible solo para admin/ti (los inquilinos se gestionan en su propio módulo) |
| **TI** | Superusuario: administra las cuentas con rol admin — visible solo para rol `ti` |

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
| API / Swagger UI | http://localhost:8000/docs |
| API / ReDoc | http://localhost:8000/redoc |
| API / Scalar | http://localhost:8000/scalar |

> Nginx (puerto `3000`) solo sirve el frontend y hace proxy de `/api/` hacia el backend; la documentación interactiva vive en el backend directamente (puerto `8000`), que también está expuesto al host.

> Antes de subir a producción, cambia `SECRET_KEY` en `docker-compose.yml` y en tu `.env` por un valor seguro generado con `openssl rand -hex 32`.
