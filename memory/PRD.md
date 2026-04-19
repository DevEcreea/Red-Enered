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
- 26/26 pytest backend tests PASSED (auth, dashboard, consumptions tenant isolation, CRUDs, role gating, CSV upload)

## Backlog / Future
- ~~**P1**: Integración directa Google Sheets via service account~~ ✅ COMPLETADO Feb 2026 — `/api/admin/sheets/sync` con modos replace/append, normalización robusta de columnas (tildes, paréntesis, strings "S/")
- **P1**: Brute force / rate limiting en login (playbook lo sugiere)
- **P2**: Aggregation pipeline en Mongo para dashboards a escala (>50k rows)
- **P2**: Modularizar server.py (actualmente ~900 líneas) en routers separados
- **P2**: Subida real de PDF de facturas con object storage
- **P3**: Notificaciones por email (forgot password actualmente solo loggea)
- **P3**: Reportes programados / enviados por correo

## Credenciales de prueba
Ver `/app/memory/test_credentials.md`.
