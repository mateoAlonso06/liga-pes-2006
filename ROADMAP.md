# 🗺️ Migration Roadmap: Legacy to React + Express Architecture

Este documento define las etapas para la migración controlada del frontend legacy (HTML/JS imperativo) hacia la arquitectura moderna basada en React 19, TypeScript y la API REST en Express.

---

## 🎯 Principios de la Migración
1. **Vertical Slices:** Cada hito entrega una funcionalidad completa de punta a punta (Datos -> API -> Dominio -> UI) sin romper el resto del sistema.
2. **Dominio Agnóstico:** Las reglas de negocio se implementan como funciones puras en `src/domain/`, sin acoplamiento a React ni al DOM.
3. **Validación Continua:** Cada paso debe compilar limpiamente con `tsc -b` y pasar el linter.

---

## 📍 Hitos del Proyecto

### 🟢 Hito 1: Slice Vertical de Posiciones (Lectura) — *Completado*
Objetivo: Conectar la base de datos con la UI moderna para visualizar la tabla de posiciones con actualización reactiva.

- [x] Crear y versionar `ROADMAP.md`.
- [x] Construir capa de servicio (`src/services/api.ts`) para consumir `/equipos`, `/personas` y `/partidos`.
- [x] Implementar mappers de DTO (Backend) a Entidades de Dominio (`domain/types.ts`).
- [x] Reemplazar boilerplate de Vite en `App.tsx` para renderizar `StandingsTable.tsx` con datos reales.
- [x] Gestionar estados de carga (`loading`), error y fallback para cuando no haya datos.
- [x] Configurar proxy de desarrollo en `vite.config.ts` hacia el backend Express.
- [x] Verificar build limpio con `npm run build` y validación de ESLint en `frontend/client`.

---

### 🟢 Hito 2: Pantallas de Solo Lectura (Estadísticas y Fixture) — *Completado*
Objetivo: Migrar todas las vistas de consulta (posiciones, goleadores, rojas y fixture por fechas).

- [x] Definir algoritmo puro en `domain/stats.ts` para cómputo de goleadores y tarjetas rojas (`calculateTopScorers`, `calculateRedCards`).
- [x] Crear endpoint/consumo de incidencias vinculadas a personas y partidos en `services/api.ts` (`fetchIncidencias`).
- [x] Crear hooks y componentes: `useStats.ts`, `TopScorersTable.tsx` y `RedCardsTable.tsx`.
- [x] Implementar algoritmo de emparejamientos Round-Robin puro en `domain/fixture.ts` (`generatePairings`, `buildFixture`).
- [x] Crear hook `useFixture.ts` y componente `FixtureView.tsx` con filtro por participante y formato ida/vuelta.
- [x] Añadir navegación por pestañas en `App.tsx` (Posiciones, Goleadores, Tarjetas Rojas, Fechas/Fixture) con badges de conteo.
- [x] Verificar compilación TypeScript y ESLint sin errores.

---

### 🟢 Hito 3: Carga Colaborativa de Resultados (Propuestas) — *Completado*
Objetivo: Permitir que los participantes propongan resultados desde la nueva interfaz React.

- [x] Crear formulario tipado para cargar goles, goleadores y tarjetas de una fecha (`ProposalForm.tsx`).
- [x] Consumir endpoint público `POST /propuestas` en el backend (`services/api.ts` -> `submitProposal`).
- [x] Validaciones en cliente antes del envío (jugadores distintos, coherencia de goles en `domain/proposals.ts`).
- [x] Feedback visual de confirmación de envío con resumen del partido propuesto.

---

### 🟢 Hito 4: Panel de Moderación y Autenticación Admin — *Completado*
Objetivo: Permitir a los administradores iniciar sesión con JWT y aprobar/rechazar resultados propuestos.

- [x] Implementar contexto/estado de autenticación (`useAuth`, `AuthProvider`) con almacenamiento seguro del token JWT.
- [x] Modal/Pantalla de Login de administrador (`LoginModal.tsx` -> `POST /auth/login`).
- [x] Vista de bandeja de propuestas pendientes (`AdminModerationPanel.tsx` -> `GET /propuestas?estado=pendiente`).
- [x] Acciones de aprobación (`POST /propuestas/:id/aprobar`) y rechazo (`POST /propuestas/:id/rechazar`) con refresco automático de estadísticas.

---

### 🟢 Hito 5: Fixtures, Sorteo, Redirección de Deploy y Deprecación Definitiva del Legacy — *Completado*
Objetivo: Completar la paridad de funcionalidades con el cliente vanilla, aplicar estilizado retro PES, redirigir el deploy a la nueva carpeta y retirar los archivos legacy.

- [x] Generador y visualizador de fechas de fixture por semana (`domain/fixture.ts` -> `buildWeeklyFixture`, `FixtureView.tsx`).
- [x] Módulo de sorteo de equipos al azar (`domain/sorteo.ts`, `SorteoView.tsx`, suite de tests unitarios).
- [x] Paridad visual retro PES (fuentes Google Fonts `Bebas Neue`, `Rajdhani`, `Oswald`, pestañas sesgadas con skew arcade `-12deg`, badge de marca `RT` y scanlines/gradientes).
- [x] Redirección de deploy de producción hacia `frontend/client` (`vercel.json` y scripts en `package.json` raíz).
- [x] Retiro seguro de archivos legacy (`index.html`, `js/script.js`, `styles/styles.css`) y actualización final de documentación.

