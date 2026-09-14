# Regional T — Manager

Sistema de gestión para ligas de torneos de fútbol (ej. PES 2006 / torneos locales). Permite administrar planteles, fixtures, carga y moderación de partidos, tabla de posiciones y estadísticas (goleadores y tarjetas rojas).

> 🗺️ **Roadmap de migración:** El plan de etapas para la migración del cliente legacy hacia React está detallado y versionado en [ROADMAP.md](ROADMAP.md).

---

## 📐 Visión General de la Arquitectura

El repositorio contiene la evolución del sistema, transitando desde una aplicación monolítica del lado del cliente hacia una arquitectura desacoplada cliente-servidor:

```mermaid
graph TD
    subgraph Frontend Moderno ["Frontend (frontend/client)"]
        UI[Componentes React / UI] --> Hooks[Custom Hooks]
        Hooks --> Domain[Lógica de Dominio Pura\n(standings, stats, fixture, sorteo)]
        Hooks -.->|Fetch / HTTP| API[API REST Express]
    end

    subgraph Backend ["Backend API (api/)"]
        API --> AuthMW[Middleware Auth / JWT]
        API --> Routes[Rutas Express\n(equipos, personas, partidos, propuestas)]
        Routes --> LibSQL[Driver @libsql/client]
        LibSQL --> DB[(Base de Datos\nSQLite / Turso)]
    end
```

1. **Frontend Moderno (`frontend/client/`)**: React 19, TypeScript y Vite. Aplica principios de **Clean Architecture / Domain-Driven Design**: lógica de negocio pura desacoplada del framework de UI.
2. **Backend API (`api/`)**: Node.js (ESM), Express 4 y LibSQL (`@libsql/client`). Persistencia relacional (SQLite local o Turso en la nube), autenticación JWT para administración y flujo de propuestas colaborativas.

---

## 🗂️ Estructura del Repositorio

```text
.
├── api/                        # Backend REST (Node.js + Express)
│   ├── src/
│   │   ├── middleware/
│   │   │   └── auth.js         # Validación de JWT (requireAdmin)
│   │   ├── routes/
│   │   │   ├── auth.js         # /auth/login con firma de JWT
│   │   │   ├── equipos.js      # CRUD de equipos
│   │   │   ├── personas.js     # CRUD de jugadores/participantes
│   │   │   ├── partidos.js     # CRUD de partidos jugados
│   │   │   ├── incidencias.js  # Registro de goles y tarjetas rojas
│   │   │   └── propuestas.js   # Cola de moderación de partidos propuestos
│   │   ├── db.js               # Instancia de cliente LibSQL
│   │   ├── seed.js             # Inicialización de tablas y admin inicial
│   │   └── server.js           # Configuración de Express, CORS y middleware
│   ├── .env.example            # Variables de entorno modelo
│   ├── index.js                # Entry point HTTP del servidor
│   ├── package.json            # Scripts y dependencias de la API
│   └── schema.sql              # Definición de tablas DDL
│
├── frontend/
│   └── client/                 # SPA moderna (React 19 + TypeScript + Vite)
│       ├── src/
│       │   ├── domain/         # Capa de dominio (agnóstica de UI y React)
│       │   │   ├── types.ts    # Modelos del dominio
│       │   │   ├── standings.ts# Algoritmo de cálculo de posiciones
│       │   │   ├── stats.ts    # Goleadores y tarjetas rojas
│       │   │   ├── fixture.ts  # Generador de rondas y vista semanal
│       │   │   ├── proposals.ts# Reglas de validación de propuestas
│       │   │   └── sorteo.ts   # Sorteo aleatorio y asignación de planteles
│       │   ├── hooks/          # Custom hooks que integran dominio con React
│       │   ├── components/     # Componentes visuales y pantallas
│       │   ├── context/        # Estado de autenticación JWT
│       │   ├── services/       # Conexión HTTP contra API REST
│       │   ├── App.tsx         # Componente raíz con estética PES clásica
│       │   └── main.tsx        # Entry point Vite
│       ├── package.json        # Dependencias y scripts del frontend
│       └── vite.config.ts      # Configuración de empaquetador Vite
│
├── package.json                # Scripts raíz (delegan al frontend moderno)
├── vercel.json                 # Configuración de despliegue en Vercel
└── ROADMAP.md                  # Registro y estado de migración de hitos
```

---

## ⚙️ Backend (`api/`)

### Stack Tecnológico
- **Runtime:** Node.js (módulos ECMAScript nativos).
- **Framework:** Express 4.
- **Base de Datos:** LibSQL (`@libsql/client`) compatible con SQLite local y Turso DB remoto.
- **Seguridad:** JWT (`jsonwebtoken`) para tokens de sesión de 12 horas y `bcryptjs` para hashing de contraseñas.

### Modelo de Datos Relacional (`api/schema.sql`)
- **`equipo`**: `id_equipo`, `nombre`.
- **`persona`**: Participante humano (`id_persona`, `nombre`, `id_equipo` FK opcional).
- **`partido`**: Registro oficial de encuentro disputado (`id_partido`, `goles_local`, `goles_visitante`, `numero_fecha`, `estado`, `id_local` FK, `id_visitante` FK).
- **`incidencia`**: Eventos dentro del partido (`id_incidencia`, `jugador_virtual`, `tipo` [\x27G\x27 (gol) o \x27R\x27 (roja)], `id_persona` FK, `id_partido` FK).
- **`admin`**: Credenciales de operadores (`id_admin`, `username`, `password_hash`).
- **`propuesta_partido`**: Cola de moderación comunitaria. Permite a los participantes cargar un resultado (`goles_local`, `goles_visitante`, `goleadores_json`, `rojas_json`, `nombre_solicitante`). El administrador la revisa y, al aprobarla, el backend inserta el `partido` y sus `incidencias` oficiales de forma automática.

### Endpoints Principales

| Método | Endpoint | Protegido | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | No | Healthcheck del servicio |
| `POST` | `/auth/login` | No | Genera JWT para el usuario administrador |
| `GET` / `POST` | `/equipos` | POST (Admin) | Listar y crear equipos |
| `PUT` / `DELETE` | `/equipos/:id` | Sí (Admin) | Actualizar y eliminar equipo |
| `GET` / `POST` | `/personas` | POST (Admin) | Listar y registrar personas (filtro `?id_equipo=`) |
| `PUT` / `DELETE` | `/personas/:id` | Sí (Admin) | Modificar y eliminar persona |
| `GET` / `POST` | `/partidos` | POST (Admin) | Listar y cargar partidos (filtro `?numero_fecha=`) |
| `PUT` / `DELETE` | `/partidos/:id` | Sí (Admin) | Modificar y anular partido |
| `GET` / `POST` | `/incidencias` | POST (Admin) | Consultar (por `?id_partido=`) o crear incidencias |
| `DELETE` | `/incidencias/:id` | Sí (Admin) | Eliminar una incidencia |
| `POST` | `/propuestas` | No | Cualquier jugador propone un resultado |
| `GET` | `/propuestas` | Sí (Admin) | Listar propuestas (filtro opcional `?estado=`) |
| `POST` | `/propuestas/:id/aprobar` | Sí (Admin) | Aprueba y migra a partido + incidencias |
| `POST` | `/propuestas/:id/rechazar`| Sí (Admin) | Rechaza la propuesta |
| `DELETE` | `/propuestas/:id` | Sí (Admin) | Elimina una propuesta |

### Autenticación
Los endpoints protegidos requieren el header:
```http
Authorization: Bearer <TOKEN_JWT>
```

---

## 🎨 Frontend Moderno (`frontend/client/`)

### Stack Tecnológico
- **Framework:** React 19.
- **Tipado:** TypeScript 6.
- **Build Tool:** Vite 8.
- **Linter:** ESLint 10 con plugins de React Hooks.

### Patrón de Arquitectura: Separación de Dominio
Para garantizar mantenibilidad, testabilidad y desacoplamiento, el frontend separa estrictamente la lógica de negocio de la capa de componentes:

1. **Capa de Dominio (`src/domain/`)**:
   - `types.ts`: Define las entidades del negocio (`Team`, `Player`, `Match`, `GoalEvent`, `RedCardEvent`, `StandingRow`).
   - `standings.ts`: Contiene la función pura `calculateStandings(players, teams, matches)`. No importa React, no usa hooks ni interactúa con el DOM. Se puede probar de forma unitaria instantáneamente.
2. **Capa de Integración / Hooks (`src/hooks/`)**:
   - `useStandings.ts`: Expone la lógica de dominio al ciclo de vida de React utilizando `useMemo` para optimizar re-cálculos.
3. **Capa de Presentación (`src/components/`)**:
   - Componentes orientados a renderizado como `StandingsTable.tsx`. Reciben datos tipados por props y no manipulan reglas de negocio internamente.

---

## 🚀 Guía de Inicio Rápido para Desarrollo

### 1. Requisitos Previos
- Node.js (versión 20 o superior recomendada).
- npm o pnpm.

### 2. Configurar y Levantar el Backend

```bash
# Entrar a la carpeta del backend
cd api

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Edita .env según tus necesidades (por defecto apunta a file:local.db)

# Ejecutar seed (crea tablas e inserta usuario admin inicial si está configurado en .env)
npm run db:init

# Iniciar servidor en modo desarrollo con auto-reload
npm run dev
```
La API quedará escuchando en `http://localhost:3001`.

### 3. Configurar y Levantar el Frontend

En una terminal separada:

```bash
# Entrar a la carpeta del frontend
cd frontend/client

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo Vite
npm run dev
```
La aplicación web estará accesible en `http://localhost:5173`.

> 💡 **Comandos directos desde la raíz:**
> Gracias a `package.json` en la raíz del proyecto, podés ejecutar directamente:
> - `npm run dev` — Inicia el frontend Vite.
> - `npm run build` — Compila TypeScript y construye los assets estáticos de producción.
> - `npm test` — Corre los 20 tests unitarios del dominio (`proposals`, `sorteo`, etc.).
> - `npm run lint` — Ejecuta ESLint en todo el frontend.

### 4. Despliegue en Vercel

El repositorio está configurado mediante `vercel.json` en la raíz para delegar la compilación y publicación a la aplicación moderna:
- **Build Command:** `npm run build --prefix frontend/client`
- **Output Directory:** `frontend/client/dist`
- **Framework:** `vite`

Al hacer push a la rama de producción en GitHub conectada a Vercel, el deploy se compila automáticamente y sirve la SPA de React con optimización de assets.

---

## 🛠️ Cómo Extender y Aplicar Cambios

### Agregar una nueva entidad o regla de negocio
1. **Base de Datos:** Si requiere persistencia, agrega la tabla o campo en `api/schema.sql`.
2. **Rutas Backend:** Implementa el router en `api/src/routes/` y móntalo en `api/src/server.js`. Si la acción es sensible, utiliza el middleware `requireAdmin`.
3. **Modelo Frontend:** Agrega la interfaz en `frontend/client/src/domain/types.ts`.
4. **Lógica Pura:** Escribe la función de cálculo o transformación en `frontend/client/src/domain/`.
5. **Conexión React:** Crea un custom hook en `frontend/client/src/hooks/` y consúmelo en los componentes de `frontend/client/src/components/`.

### Convenciones de Trabajo
- **Commits:** Usa Conventional Commits (ej. `feat: ...`, `fix: ...`, `refactor: ...`). Sin atribuciones de IA ni `Co-Authored-By`.
- **Independencia del Dominio:** Mantén los archivos dentro de `domain/` libres de dependencias de React o librerías de UI.
