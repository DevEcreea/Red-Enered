# ENERED - Product Requirements Document

## Problem Statement (original)
Construir una plataforma web y mobile responsive tipo dashboard fintech para ENERED, enfocada en visualización de consumo de combustible para empresas de transporte. Multi-tenant con 4 roles, 6 módulos principales (Dashboard, Reportes, Facturación, Control Integral, Capacitación, Soporte) + administración. Integración con Google Sheets para datos consolidados de consumo.

## Architecture
- **Backend**: FastAPI + MongoDB (Motor async). Todas las rutas prefijo `/api`.
- **Frontend**: React 19 + React Router 7 + Recharts + jsPDF + xlsx
- **Auth**: JWT custom (access 8h + refresh 7d), httpOnly cookies + Bearer token fallback, bcrypt password hashing
- **Multi-tenant**: campo EMPRESA en consumos, filtrado automático por `user.empresa` (admin_enered ve todo)
- **Diseño**: Light theme, Swiss/high-contrast, primary #9933FF, fonts Cabinet Grotesk + Manrope

## Roles & Access
| Módulo | admin_enered | administrador | logistica | contabilidad |
|---|---|---|---|---|
| Dashboard | ✓ | ✓ | ✓ | ✓ |
| Reportes | ✓ | ✓ | ✓ | ✓ |
| Facturación | ✓ | ✓ | ✗ | ✓ |
| Control Integral | ✓ | ✓ | ✓ | ✗ |
| Capacitación | ✓ | ✓ | ✓ | ✓ |
| Soporte | ✓ | ✓ | ✓ | ✓ |
| Admin Users/Upload | ✓ | ✗ | ✗ | ✗ |

## Implemented (Feb 2026)
- JWT auth endpoints: login, logout, me, refresh, forgot/reset password, with brute force notes
- Users CRUD (admin only)
- Consumption ingestion: CSV/Excel upload + seed data (451 registros demo, 3 empresas, 60 días)
- Dashboard KPIs: total gal, gasto S/, ahorro S/, cargas + 5 gráficos Recharts (top placas, ciudades, productos dona, ahorro estaciones, tendencia semanal)
- Alertas inteligentes: 4 tipos (cargas incrementadas, estación dormida, caída de uso, estación nueva por placa)
- Reportes: tabla con 6 filtros + búsqueda + export Excel + export PDF (jsPDF)
- Facturación: CRUD + export Excel + PDF por factura (generado cliente)
- Control Integral: 6 tipos de restricciones, flujo solicitud/realizada/rechazada
- Capacitación (LMS): cursos con video embed, evaluación multiple choice, certificado PDF descargable
- Soporte: 3 contactos estáticos + WhatsApp (wa.me) + horario/oficina
- Layout: Sidebar colapsable mobile, header sticky con blur, responsive completo

## Verified (backend)
- 36/36 pytest backend tests PASSED (auth, dashboard contract, consumptions tenant isolation, CRUDs, role gating, CSV upload, QR bulk-upload/list/download/delete, multi-tenant QR isolation, dashboard gasto fields)

## Implemented Iteration 2 (Apr 2026 - UI Major Refactor)
- **Sidebar reorg**: nuevo logo ENERED (purple), módulo "Flotas" dividido en 3 ítems independientes:
  - Control Integral → `/reportes` (administración de placas, vista existente reusada)
  - Reportes Consumo → `/reportes-consumo` (NUEVA: tabla detallada paginada, KPIs, export CSV, filtros placa/semana/estación/producto/empresa)
  - Descarga tus QR → `/qr` (NUEVA: grid de QR por placa, descarga directa, multi-tenant)
- **Dashboard refactor radical**: eliminados todos los gráficos excepto los 4 principales:
  - Consumo en el tiempo (line chart)
  - Top 5 placas por consumo (bar horizontal)
  - Consumo por ciudad (bar vertical)
  - Consumo por estación (bar horizontal)
  - Cada gráfico con toggle Galones/Soles **multi-select** (ambos a la vez, mín 1 activo)
- **Analítica extendida**: todos los gráficos quitados del Dashboard se movieron aquí (Gasto, Ahorro, Operativos, Producto, Comportamiento) — ahora Analítica concentra Pareto + Heatmap + Participación + 13 gráficos extra.
- **Carga masiva de QR (admin)**: `/admin/qr` con drag&drop multi-archivo. Filename `[PLACA].png/jpg/svg/webp` se asocia automáticamente. Endpoint `POST /api/admin/qr/upload-bulk` (multipart). Storage: `/app/backend/uploads/qr/{empresa}/{placa}.{ext}` + Mongo `qr_codes`. Endpoints `GET /api/qr/list`, `GET /api/qr/download/{placa}`, `DELETE /api/admin/qr/{placa}` con tenant isolation.
- **Backend dashboard contract**: agregado campo `gasto` (S/) a `consumo_ciudad` y `consumo_estacion` para soportar el toggle Soles. Filtro `semana` agregado a `/api/consumptions`.

## Implemented Iteration 3 (Feb 2026 - Soporte rediseñado + fix línea de crédito)
- Soporte (`/soporte`): 4 cards con imágenes Pexels (Pedidos / Liberación / Programación / Estado de Cuenta) que abren WhatsApp con mensaje pre-llenado.
- Tarjeta morada full-width con WhatsApp +51 972 228 870 + Correo comercial@enered.pe (estilo mockup, decoración SVG, texto cian).
- Pie con soporte@enered.pe, (01) 203-7300 y 996 207 533.
- FAQ con buscador y acordeón por categorías (General, Pedidos, Liberación, Programación, Estado de Cuenta).
- Botón flotante WhatsApp (FAB).
- Sin tabla de horarios de Terminales (eliminada por pedido del usuario).
- **Dashboard /api/dashboard/overview**: la `linea_credito.utilizada` ahora suma facturas pendientes (saldo) + notas de despacho (consumos `ESTADO != "FACTURADO"`), alineado con `/api/account-state`. Antes solo contaba facturas no pagadas y quedaba en 0 cuando no había facturas todavía.

## Backlog / Future
- **P1**: Brute force / rate limiting en login (playbook lo sugiere)
- **P2**: Magic-byte validation en upload de QR (rechazar payloads disfrazados)
- **P2**: Aggregation pipeline en Mongo para dashboards a escala (>50k rows)
- **P2**: Modularizar server.py (actualmente ~1609 líneas) en routers separados (auth/dashboard/qr/consumptions/admin)
- **P2**: Subida real de PDF de facturas con object storage
- **P2**: Tooltips explicativos en KPIs (hover interactions)
- **P2**: Export Dashboard a PDF
- **P2**: Benchmarks comparativos (unidad vs promedio flota)
- **P3**: Notificaciones por email (forgot password actualmente solo loggea)
- **P3**: Reportes programados / enviados por correo

## Credenciales de prueba
Ver `/app/memory/test_credentials.md`.
