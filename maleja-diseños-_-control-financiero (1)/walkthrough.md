# Security Summary

Esta auditoría integral pre-publicación en **Maleja Diseños | Control Financiero** validó y corrigió los controles de autenticación, autorización en base de datos, protección de secretos, coherencia contable y preparación para despliegue en Render.

## 1. Secretos y Proxy Server-Side para IA
- **Eliminación total de claves en el navegador**: Se removieron todas las importaciones de `@google/genai` y referencias a `process.env.GEMINI_API_KEY` en `src/` (`src/components/AiAssistantModal.tsx` y `src/components/AiAdvisorModal.tsx`).
- **Proxy autenticado en Express (`server.ts`)**: Todas las consultas a Gemini (`gemini-4-hydrogen`) pasan por `POST /api/ai/chat` y `POST /api/ai/analyze` en el servidor usando `process.env.GEMINI_API_KEY` con `User-Agent: 'aistudio-build'`.
- **Verificación de token en backend**: Cada ruta `/api/ai/*` exige un Firebase ID Token (`Authorization: Bearer <token>`), valida el token ante Firebase Auth (`accounts:lookup`), exige `emailVerified === true` y verifica autorización del negocio (`ALLOWED_ADMIN_EMAILS` / `malejacalcas@gmail.com` o documento activo en `/authorizedUsers/{uid}`).
- **Cabeceras de seguridad HTTP**: El servidor configura `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()` y desactiva `X-Powered-By`.

## 2. Reglas de Seguridad y RBAC en Cloud Firestore
- **`firestore.rules` desplegado en producción** (validado con `npx eslint firestore.rules` sin advertencias ni errores y publicado en Firebase `gen-lang-client-0724072617` / `ai-studio-malejadiseoscont-e53d8b0d-eb04-4b54-9c99-aaedf465dba3`):
  - Denegación por defecto (`allow read, write: if false`).
  - Acceso exclusivo a usuarios con correo verificado (`isVerifiedUser()`) y pertenencia a la lista blanca (`isAuthorizedUser()`: propietaria `malejacalcas@gmail.com` o registro con `active == true` en `/authorizedUsers/{uid}`).
  - Solo la propietaria principal puede crear, editar o revocar accesos en `/authorizedUsers/{uid}`.
  - Validación estricta de esquema, rangos numéricos (`discount <= subtotal`, `amountPaid <= total`, `amount > 0`, longitudes máximas de texto e integridad de `id == docId`), e inmutabilidad de `/auditLogs/{logId}` (`allow update: if false`).
- **Pantallas de bloqueo en cliente (`src/App.tsx` y `src/components/AuthView.tsx`)**: Bloquean el uso si el correo no está verificado (`unverified`) o si la cuenta no está autorizada (`unauthorized`), con envío de correo de verificación y recarga de estado.

## 3. Persistencia Atómica y Coherencia Financiera
- **Escritura en Firestore antes del estado local**: `src/services/firebaseService.ts` (`saveDocumentStrict` / `deleteDocumentStrict`) y `src/App.tsx` (`persistDocOrThrow` / `persistDeleteOrThrow`) confirman primero el guardado/borrado en Firestore antes de confirmar al usuario o registrar auditoría. En `saveDocumentStrict` se utiliza sobrescritura completa (`merge: false`) para que los campos opcionales vaciados al editar se eliminen correctamente.
- **Sincronización segura desde la nube**: `initCloudSync` en `src/App.tsx` respeta colecciones sincronizadas desde Firestore sin rellenarlas con datos obsoletos de `localStorage`.
- **Coherencia contable y fechas locales**:
  - `DashboardView.tsx` incluye gastos `Extraordinario` junto a `Variable` para que `Fijos + Var/Ext === Total Gastos`, y aplica proporción real de descuento en ventas por categoría.
  - `ExportUtils` y `SettingsView` utilizan fechas locales (`getTodayString()`) evitando desfases UTC nocturnos en Colombia.
  - Deducción única de costos de producción (`PC-*`) sobre utilidad bruta y neta estimada, validación anti-duplicados y bloqueo de abonos superiores al saldo pendiente.

## 4. Preparación para Render y Riesgos Residuales
- **Despliegue en Render (`render.yaml` y `package.json`)**: Build `npm install && npm run build`, arranque `npm start` (`node server.ts` sobre Node v22.23.5 con TypeScript borrable nativo), healthcheck `GET /api/health` y servicio de `dist/` + fallback SPA en `NODE_ENV=production`.
- **Riesgos conocidos / pasos pendientes fuera del código**:
  1. Configurar la variable secreta `GEMINI_API_KEY` en el panel Environment de Render para habilitar el Asistente IA.
  2. Agregar el dominio público de Render (`*.onrender.com`) en Firebase Authentication > Settings > Authorized Domains.
  3. Mantener control sobre dependencias externas (`xlsx@0.18.5` tiene avisos de seguridad conocidos para lectura de archivos no confiables; en esta app solo se usa `XLSX.writeFile` para exportaciones salientes, nunca para importar archivos externos).

---

## PoC Verification

Comprobaciones ejecutadas tras los últimos cambios:

1. **Verificación de secretos en código cliente**:
   ```
   grep -rnE '@google/genai|GEMINI_API_KEY|__GEMINI_API_KEY__' src server.ts
   ```
   Resultado: todas las coincidencias pertenecen exclusivamente a `server.ts`; cero coincidencias en `src/`.

2. **Compilación y validación de tipos**:
   - `npm run lint` (`tsc --noEmit`): completado con código `0` (sin errores).
   - `npm run build` (`vite build`): compilado correctamente en `dist/`.

3. **Suite automatizada de validaciones y matemática financiera (`npx tsx -e ...`)**:
   - Validación de fechas calendario reales (años bisiestos vs inválidas como `2026-02-29`).
   - Bloqueo de ventas/gastos/compras con montos negativos, cero o campos vacíos.
   - Control de abonos parciales y rechazo de abonos mayores al saldo pendiente o sobre ventas inexistentes.
   - Prevención de costos de producción duplicados por referencia de orden + producto, y cálculo unitario/margen bruto.
   - Coherencia de reportes (Fijo + Variable + Extraordinario, deducción única de costos de producción, cartera pendiente, metas mensuales, copias de seguridad JSON).
   - Salida obtenida: `ALL_FINANCIAL_AND_VALIDATION_CHECKS_PASSED`.

4. **Prueba de arranque de producción para Render (`PORT=3199 NODE_ENV=production node server.ts`)**:
   - `GET /api/health` -> `HTTP/1.1 200 OK` con `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` y JSON `{ "status": "ok", "environment": "production", ... }`.
   - `GET /` -> `200 text/html; charset=UTF-8` sirviendo `dist/index.html`.
   - `POST /api/ai/chat` sin token -> `HTTP:401` (`Sesión no autorizada`).
   - `POST /api/ai/analyze` sin token -> `HTTP:401` (`Sesión no autorizada`).
   - `GET /api/unknown` -> `HTTP:404`.
