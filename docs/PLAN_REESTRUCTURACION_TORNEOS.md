# 🏆 Plan de Reestructuración: Arquitectura Multi-Torneo, Formatos Dinámicos y Prode

Este documento establece la hoja de ruta técnica y arquitectónica para transformar el sistema monotorneo actual en una plataforma modular multitorneo adaptada a torneos de videojuegos (PES 6 vainilla, parches comunitarios, etc.).

---

## 🧭 1. Visión y Principios de Diseño

1. **Torneo como Aggregate Root:** Todo evento deportivo (partido, incidencia, propuesta, participante y pronóstico) pertenece y se resuelve dentro del contexto de un `Torneo`.
2. **Integridad de Datos y Máquina de Estados:** Un torneo atraviesa estados estrictos (`borrador` $\rightarrow$ `en_curso` $\rightarrow$ `finalizado`). Las reglas y formatos solo son mutables antes del pitazo inicial.
3. **Patrón Estrategia (Strategy Pattern):** El formato del torneo (Liga, Llaves de eliminación directa o Fase de Grupos) es un comportamiento desacoplado. Agregar un nuevo formato no debe modificar el código existente (Principio Abierto/Cerrado - OCP).
4. **Retrocompatibilidad y Cero Pérdida:** Los datos de la liga actual se migran automáticamente a un "Torneo Inicial" para no alterar el historial existente.

---

## 🔄 2. Máquina de Estados del Torneo

```
       [ Crear Torneo ]
              │
              ▼
       ┌──────────────┐
       │   BORRADOR   │ ◄── Permite editar: Formato, Juego/Parche,
       └──────┬───────┘     participantes y asignación de equipos (sorteo).
              │
      [ Iniciar Torneo ] (Genera Fixture y bloquea reglas)
              │
              ▼
       ┌──────────────┐
       │   EN CURSO   │ ◄── Se juegan partidos, aprueban propuestas,
       └──────┬───────┘     computan posiciones/llaves y pronósticos de Prode.
              │
     [ Finalizar Torneo ] (Consagración del campeón)
              │
              ▼
       ┌──────────────┐
       │  FINALIZADO  │ ◄── Modo solo lectura. Pasa al historial histórico.
       └──────────────┘
```

---

## 🗄️ 3. Modelo de Datos (SQLite)

### 3.1. Nuevas Tablas

```sql
-- 1. Entidad Principal: Torneo
CREATE TABLE IF NOT EXISTS torneo (
  id_torneo INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  juego TEXT NOT NULL DEFAULT 'PES 6 Original', -- e.g. 'PES 6 Original', 'Parche Qatar 2022', etc.
  formato TEXT NOT NULL CHECK(formato IN ('liga_ida', 'liga_ida_vuelta', 'eliminacion_directa', 'grupos_eliminacion')),
  estado TEXT NOT NULL DEFAULT 'borrador' CHECK(estado IN ('borrador', 'en_curso', 'finalizado')),
  id_organizador INTEGER NOT NULL REFERENCES usuario(id_usuario),
  campeon_id INTEGER NULL REFERENCES persona(id_persona),
  configuracion_json TEXT NOT NULL DEFAULT '{}', -- Reglas específicas (e.g. tiempo de juego, puntos por victoria)
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Participantes del Torneo (relación N:M contextualizada)
CREATE TABLE IF NOT EXISTS torneo_participante (
  id_torneo INTEGER NOT NULL REFERENCES torneo(id_torneo) ON DELETE CASCADE,
  id_persona INTEGER NOT NULL REFERENCES persona(id_persona),
  id_equipo INTEGER NOT NULL REFERENCES equipo(id_equipo),
  grupo TEXT NULL, -- e.g. 'A', 'B' (para fase de grupos)
  sembrado INTEGER NULL, -- Orden de llave para eliminación directa
  PRIMARY KEY (id_torneo, id_persona)
);

-- 3. Módulo de Prode (Pronósticos de la comunidad)
CREATE TABLE IF NOT EXISTS prode_pronostico (
  id_pronostico INTEGER PRIMARY KEY AUTOINCREMENT,
  id_torneo INTEGER NOT NULL REFERENCES torneo(id_torneo) ON DELETE CASCADE,
  id_partido INTEGER NOT NULL REFERENCES partido(id_partido) ON DELETE CASCADE,
  id_usuario INTEGER NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  goles_local INTEGER NOT NULL,
  goles_visitante INTEGER NOT NULL,
  puntos_obtenidos INTEGER NULL, -- Calculado al cerrarse el partido
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(id_partido, id_usuario)
);
```

### 3.2. Adaptación de Tablas Existentes

```sql
-- Partido: Soporta tanto fechas regulares de liga como llaves eliminatorias
ALTER TABLE partido ADD COLUMN id_torneo INTEGER REFERENCES torneo(id_torneo);
ALTER TABLE partido ADD COLUMN etapa TEXT NOT NULL DEFAULT 'fecha'; -- 'fecha', 'octavos', 'cuartos', 'semifinal', 'final'
ALTER TABLE partido ADD COLUMN penales_local INTEGER NULL;
ALTER TABLE partido ADD COLUMN penales_visitante INTEGER NULL;
ALTER TABLE partido ADD COLUMN siguiente_partido_id INTEGER NULL REFERENCES partido(id_partido);

-- En llaves de eliminación, local o visitante pueden ser NULL hasta definir clasificado
-- (Se flexibilizan constraints en la capa de datos/API).

-- Propuestas de partido: Vinculadas al torneo correspondiente
ALTER TABLE propuesta_partido ADD COLUMN id_torneo INTEGER REFERENCES torneo(id_torneo);
```

---

## 🧩 4. Arquitectura de Dominio (Strategy Pattern)

Para que el sistema procese distintos formatos sin sentencias condicionales dispersas:

```typescript
export interface TournamentStrategy {
  readonly code: string;
  
  // Genera el fixture inicial al pasar a estado "en_curso"
  generateFixture(
    tournamentId: number,
    participants: TournamentParticipant[]
  ): InitialMatchPlan[];

  // Calcula tabla(s) de posiciones (si aplica al formato)
  calculateStandings?(
    matches: Match[],
    participants: TournamentParticipant[]
  ): StandingsTable[];

  // Avanza ganadores a la siguiente ronda (para formatos con llaves)
  advanceNextStage?(
    completedMatch: Match,
    allMatches: Match[]
  ): NextMatchAssignment | null;
}
```

- **`LeagueStrategy`**: Emparejamiento Round-Robin (algoritmo Berger), tabla única acumulada por puntos.
- **`KnockoutStrategy`**: Llaves binarias por potencia de 2 ($4, 8, 16$), gestión de tiempo suplementario/penales y avance a la siguiente llave.
- **`GroupKnockoutStrategy`**: Subtablas por grupo clasificatorio y pasaje de clasificados a cuadro de llaves.

---

## 🎨 5. Experiencia de Usuario e Interfaz (UI/UX)

1. **Header & Contexto Global (`TournamentContext`):**
   - Selector desplegable de Torneo Activo en la barra superior con badge distintivo del juego/parche: `[RT] Torneo Clausura 2026 (PES 6 Parche Clásico)`.
   - Indicador del rol actual (`Organizador del Torneo` / `Admin Global` / `Usuario`).
2. **Vistas Polimórficas por Formato:**
   - **Torneo Formato Liga:** Pestañas clásicas (`Posiciones`, `Goleadores`, `Rojas`, `Fixture`).
   - **Torneo Formato Eliminación:** Nueva pestaña interactiva `Cuadro de Llaves (BracketView)` que reemplaza la tabla de posiciones tradicional.
   - **Torneo Formato Mixto:** Visualización dual de Grupos + Fase Final.
3. **Pestaña de Prode:**
   - Tarjetas de partidos pendientes del torneo seleccionado.
   - Input de pronóstico numérico (habilitado hasta el horario pactado de inicio).
   - Tabla general de clasificación del Prode para ese torneo con puntos por acierto exacto o ganador.
4. **Panel del Organizador:**
   - Creación y configuración de torneos.
   - Herramienta de Sorteo / Asignación de equipos para los participantes del torneo.
   - Botón *"Iniciar Torneo"* para congelar reglas y generar el fixture oficial.

---

## 🚀 6. Fases de Implementación

### 🟢 Fase 1: Capa de Datos y Migración Inicial (Backend) — *Completado*
- [x] Crear script SQL con las nuevas tablas (`torneo`, `torneo_participante`, `prode_pronostico`).
- [x] Migrar esquema de `partido` y `propuesta_partido` con columna `id_torneo`.
- [x] Ejecutar script de seed/migración para empaquetar los datos actuales en un "Torneo Histórico / Liga 2026" sin downtime.
- [x] Validar integridad de foreign keys y consultas existentes.

### 🟢 Fase 2: Servicios API y Gestión de Torneos (Backend) — *Completado*
- [x] Endpoints `/api/torneos` (CRUD, participantes, sorteo, inicio y finalización).
- [x] Adaptar `/api/partidos`, `/api/incidencias` y `/api/propuestas` para filtrar por `id_torneo`.
- [x] Reglas de negocio y estados (`borrador` -> `en_curso` -> `finalizado`) protegidas y testeadas.
- [x] Suite de pruebas automatizadas de integración (`api/test/torneos.test.js`).

### 🟢 Fase 3: Contexto de Navegación y Hub de Torneos (Frontend) — *Completado*
- [x] Crear `TournamentContext` en React para manejar el torneo seleccionado con persistencia local (`localStorage`).
- [x] Componente `TournamentSelector` en el Header con selector de torneo, badges de juego, formato y estado.
- [x] Modal interactivo `CreateTournamentModal` para crear nuevos torneos con validaciones.
- [x] Refactorizar carga de datos (`fetchTournamentData`) para operar reactivamente con el torneo seleccionado.
- [x] Banners contextuales de estado (`borrador` y `finalizado`) con acción directa para que el organizador inicie el torneo.
- [x] Adaptar formularios de carga y moderación para vincular propuestas al torneo activo.
- [x] Sorteador adaptado para asignar participantes al torneo en borrador sin borrar la base de datos global.

### 🟢 Fase 4: Motor de Llaves y Formato Eliminación Directa — *Completado*
- [x] Implementar `KnockoutStrategy` en `src/domain/knockout.ts` para diagramar emparejamientos y ascensos de ronda.
- [x] Componente `BracketView.tsx` estilizado con la estética arcade retro de PES para visualizar el árbol de llaves.
- [x] Soporte para registrar penales y definir ganadores de partidos empatados en copas.
- [x] Suite de 27 pruebas de dominio unitarias (`src/domain/knockout.test.ts`).

### 🟢 Fase 5: Módulo de Prode y Pulido Final — *Completado*
- [x] Componente de carga de pronósticos en partidos pendientes (`ProdeView.tsx`).
- [x] Motor de cálculo y liquidación de puntos tras aprobación o registro de resultados (`api/src/domain/prode.js`).
- [x] Tabla de posiciones de la comunidad del Prode por torneo y ranking global.
- [x] Generador de fixture oficial (`fixtureGenerator.js` y `POST /torneos/:id/generar-fixture`).
- [x] Suite de pruebas automatizadas de integración y dominio del Prode (`api/test/prode.test.js`).
- [x] Verificación de build de producción (`vite build` y `node --test`).
