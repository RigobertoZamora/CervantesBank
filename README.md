# CervantesBank — Sistema Bancario Digital con Persistencia Políglota

![Stack](https://img.shields.io/badge/Stack-Node.js_22_%26_Vue_3-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Persistencia Políglota](https://img.shields.io/badge/Persistencia_Políglota-PostgreSQL_|_MongoDB_|_Redis-D97757?style=for-the-badge)
![Infraestructura](https://img.shields.io/badge/Infraestructura-Docker_Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Seguridad](https://img.shields.io/badge/Seguridad-JWT_HttpOnly_%26_Antifraude-6E40C9?style=for-the-badge&logo=jsonwebtokens&logoColor=white)

Plataforma bancaria web construida bajo una arquitectura de **Persistencia Políglota** que integra tres motores de bases de datos especializados (**PostgreSQL**, **MongoDB** y **Redis**) orquestados mediante un Web Service REST en **Node.js / Express** y una aplicación cliente en **Vue 3**, todo empaquetado con **Docker Compose**.

---

## Arquitectura y Stack Tecnológico

| Servicio Docker | Tecnología | Puerto Local | Responsabilidad |
| :--- | :--- | :---: | :--- |
| **`frontend`** | Vue 3 (`<script setup>`), Vite | `5173` | Interfaz bancaria para clientes (registro, login, consulta de saldo/CLABE y apelaciones de crédito) y consola unificada de administración. |
| **`api_core`** | Node.js 22 (ESM), Express, Sequelize, Mongoose | `3000` | API REST, autenticación JWT con cookies `HttpOnly`, motor de scoring crediticio y orquestación de transacciones entre bases de datos. |
| **`postgres_db`** | PostgreSQL | `5432` | Integridad relacional ACID: tablas `usuarios`, `cuentas` (débito) y `prestamos` (créditos otorgados). |
| **`mongo_db`** | MongoDB | `27017` | Persistencia documental: expedientes `expedientekycs` (verificación de identidad) y bitácora `auditoriatransaccions` (movimientos y apelaciones). |
| **`redis_cache`** | Redis | `6379` | Almacenamiento clave-valor en memoria: control de intentos fallidos de acceso, telemetría de sesión y bloqueo preventivo antifraude (`fraude:cuenta:{id}`). |

---

## Prerrequisitos

* **Docker Engine** y **Docker Compose** (v2 o superior)
* **Git**

*(No es necesario instalar Node.js, PostgreSQL, MongoDB ni Redis de forma local en el sistema anfitrión; todos los servicios se ejecutan aislados dentro de contenedores).*

---

## Instalación y Ejecución

### 1. Clonar el repositorio

```bash
git clone https://github.com/RigobertoZamora/CervantesBank.git
cd CervantesBank
  ```

### 2. Configurar variables de entorno (`.env`)

Crea un archivo `.env` en la raíz del proyecto (`CervantesBank/.env`) con la siguiente estructura, puedes usar el .env.example (uso del comando 'cp'):

```env
# PostgreSQL
POSTGRES_USER=wallet_admin
POSTGRES_PASSWORD=wallet_secret
POSTGRES_DB=digital_wallet

# MongoDB
MONGO_USER=wallet_admin
MONGO_PASSWORD=wallet_secret
MONGO_DB=digital_wallet_docs

# Redis
REDIS_PASSWORD=redis_secret

# Backend / Seguridad / CORS
FRONTEND_URL=http://localhost:5173
JWT_SECRET=cervantesbank_clave_jwt_2026
```

### 3. Construir y levantar los contenedores

Ejecuta Docker Compose desde la raíz del proyecto para construir las imágenes e iniciar los cinco servicios en segundo plano:

```bash
docker compose up -d --build
```

Verifica que los contenedores estén activos:

```bash
docker compose ps
```
### 4. Designar al Administrador Único

Por seguridad, todo registro realizado desde la interfaz web nace con rol de cliente (`isAdmin = 0`). Para habilitar la cuenta del **Administrador Único** tras registrar tu usuario en la plataforma, ejecuta:

```bash
docker compose exec postgres_db psql -U wallet_admin -d digital_wallet -c '
UPDATE usuarios SET "isAdmin" = 1 WHERE email = '\''correo_admin@ejemplo.com'\'';
'
```

---

## Verificación del Sistema

1. **Diagnóstico de salud del Backend y las 3 Bases de Datos:**
   Abrir `http://localhost:3000/api/health` en el navegador. Debe responder HTTP `200` con `"postgresql": "connected"`, `"mongodb": "connected"` y `"redis": "connected"`.
2. **Aplicación Web (Frontend):**
   Abrir `http://localhost:5173` para acceder a la pantalla de inicio de sesión y apertura de cuentas.

---

### Inspección rápida de las 3 Bases de Datos

* **PostgreSQL:**
  ```bash
  docker compose exec postgres_db psql -U wallet_admin -d digital_wallet -c 'SELECT id, nombre, rfc, email, "isAdmin", estatus, "isDeleted" FROM usuarios;'
  ```
* **MongoDB:**
  ```bash
  docker compose exec mongo_db sh -c 'mongosh -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin digital_wallet_docs --eval "db.expedientekycs.find().pretty()"'
  ```
* **Redis:**
  ```bash
  docker compose exec redis_cache redis-cli -a redis_secret KEYS "fraude:cuenta:*"
  ```

---

## Endpoints Principales de la API REST

| Método | Endpoint | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Público | Verifica conectividad con PostgreSQL, MongoDB y Redis. |
| `POST` | `/api/usuarios` | Público | Alta atómica políglota: usuario + cuenta débito (SQL), expediente KYC (MongoDB) y registro antifraude (Redis). |
| `GET` / `PATCH` / `DELETE` | `/api/usuarios` | Público | Consulta, edición permitida y borrado lógico (`isDeleted: true`) en cascada. |
| `POST` | `/api/auth/login` | Público | Autenticación con `bcryptjs`, emisión de JWT en cookie `HttpOnly` y bloqueo tras 3 intentos fallidos en Redis. |
| `GET` / `POST` | `/api/auth/me`, `/api/auth/logout` | Sesión | Verificación de sesión activa y cierre de sesión. |
| `GET` | `/api/prestamos/evaluacion` | Cliente | Calcula capacidad crediticia, score, préstamos activos (SQL) e historial de solicitudes (MongoDB). |
| `POST` | `/api/prestamos/solicitar` | Cliente | Evalúa solicitud: aprueba y abona saldo automáticamente si entra en rango, o rechaza en MongoDB. |
| `PATCH` | `/api/prestamos/:auditoriaId/apelar` | Cliente | Envía una solicitud rechazada como apelación prioritaria (`EN_APELACION`) al administrador. |
| `GET` | `/api/admin/resumen-poliglota` | Admin | Consolida KPIs, cola prioritaria de apelaciones, expedientes KYC y ranking de rendimiento/morosidad. |
| `PATCH` | `/api/admin/kyc/:usuarioId` | Admin | Dictamina expedientes documentales (`APROBADO` / `RECHAZADO`) en MongoDB. |
| `PATCH` | `/api/admin/cuentas/:usuarioId/estado` | Admin | Activa/suspende cuentas en SQL o limpia bloqueos antifraude en Redis. |
| `PATCH` | `/api/admin/apelaciones/:auditoriaId/resolver` | Admin | Resuelve apelaciones prioritarias creando el préstamo en SQL y abonando fondos al cliente. |