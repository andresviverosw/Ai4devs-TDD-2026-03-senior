# Prompts — conversación inicial del proyecto de pruebas (Jest / TypeScript)

Transcripción ordenada del intercambio entre el usuario y el asistente en torno a pruebas con Jest, `ts-jest`, y luego las pruebas de alta de candidatos en el backend.

---

## Mensaje 1 (usuario)

Quiero ejecutar tests unitarios con `npm test`. El código está en TypeScript y quiero usar `ts-jest`. Instala todas las dependencias necesarias para esta tarea.

## Respuesta 1 (asistente)

- Se comprobó la raíz del repo: `npm test` fallaba (`Missing script: "test"`).
- Se instalaron en la raíz: `jest`, `ts-jest`, `@types/jest`, `typescript`.
- Se generó `jest.config.js` con `ts-jest` y se añadió `"test": "jest"` en `package.json`.
- Verificación: Jest ejecuta correctamente; sin archivos de test devolvía «No tests found».

---

## Mensaje 2 (usuario)

`sí` *(respuesta afirmativa a la propuesta de añadir un ejemplo mínimo de test para que `npm test` pase)*

## Respuesta 2 (asistente)

- Se añadieron `src/add.ts`, `src/add.test.ts` (ejemplo trivial `add`).
- TypeScript no reconocía `describe`/`it`/`expect` hasta añadir `tsconfig.json` en la raíz con `"types": ["jest"]`, `strict`, `esModuleInterop`, etc.
- `npm test` pasó con 1 test verde.

---

## Mensaje 3 (usuario) — especificación amplia del suite sobre candidatos

Eres experto en pruebas con Jest. La misión es crear una suite de tests unitarios en Jest para la funcionalidad de **insertar candidatos en la base de datos**, usando el contexto del proyecto. Buenas prácticas: `describe`/`it` con nombres descriptivos, patrón **given–when–then**, mocks solo cuando sea estrictamente necesario. Añadir todos los corner cases necesarios y **comentarios** que aclaren el **criterio de aceptación** de cada test.

Dos familias principales:

1. **Recepción de datos del formulario**
2. **Guardado en la base de datos**

Planificar antes de ejecutar, hacer seguimiento del progreso y generar un **informe de cobertura** final.

Si los tests modifican BD, lo ideal es **mockear** la BD para no alterar datos reales.

- Archivo de tests: `backend/src/tests/tests-iniciales.test.ts`
- Archivo de conversación: `prompts/prompts-iniciales.md` con **toda** la conversación (este documento).

## Respuesta 3 (asistente) — plan ejecutado

1. **Plan**
   - Revisión del flujo: `POST /candidates` (`candidateRoutes`) → `addCandidate` (`candidateService`) → `validateCandidateData` (`validator`) → modelos de dominio con Prisma (`Candidate`, `Education`, `WorkExperience`, `Resume`).
   - **Familia receptor de formulario**: tests directos sobre `validateCandidateData` (reglas alineadas con el cliente/BD sin tocar Postgres) más tests HTTP con `supertest` mockeando solo el **servicio** para no crear registros.
   - **Familia persistencia**: tests de `addCandidate` con **modelos de dominio mockeados** (sin `PrismaClient` ni inserciones reales).
   - **Mocks**: modelo de BD mockeado en tests de persistencia; servicio mockeado en tests HTTP; sin dependencia del `DATABASE_URL` real.

2. **Cambios en el proyecto**
   - Backend: dependencias dev `supertest`, `@types/supertest`; `jest.config.js` con `preset: 'ts-jest'`, `collectCoverageFrom`, exclusión de `src/index.ts` del informe por arranque de servidor; script `npm run test:coverage`.
   - `backend/tsconfig.json`: `"types": ["node", "jest"]` para globales Jest.

3. **Archivo principal de tests**: `backend/src/tests/tests-iniciales.test.ts`
   - Familia A (validación): nombres, email, teléfono opcional/prefijo, dirección larga, educación (título largo, fechas), trabajo (descripción larga), CV vacío vs incompleto, payload con `id` (saltar validaciones de alta).
   - Familia B (`addCandidate`): éxito mínimo, varias educaciones, experiencias, CV con datos vs `{}`, email duplicado `P2002`, error genérico, validación que impide llamar `save`.
   - Familia A HTTP: `jest.resetModules` + `jest.doMock` del servicio, import dinámico de rutas; comprobaciones de delegación del body, `201`, `400` con `{ message }`, `500` ante throws no–`Error`.

4. **Cobertura (ejemplo de comando y salida esperada)**

   Desde `backend`:

   ```bash
   npm run test:coverage
   ```

   Tras la implementación inicial de esta suite (valores orientativos; pueden variar ligeramente al evolucionar código):

   - **Sentencias**: ~52–53 %
   - **Ramas**: ~45–46 %
   - **Funciones**: ~47–48 %
   - **Líneas**: ~52–53 %
   - `candidateRoutes.ts`: 100 % líneas cubiertas por los escenarios POST.
   - `candidateService.ts`: 100 % en la rama de alta mockeada.
   - `validator.ts`: ~91–92 % líneas.
   - Modelos Prisma/documentos de dominio: baja cobertura (diseño intencionado del unit test con mocks).

   Informes HTML/LCOV: directorio `backend/coverage/` (generado por Jest `--coverage`).

---

*Fin de la conversación inicial reflejada en este archivo.*
