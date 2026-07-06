# ENERED — Test Credentials

## Local development (current Emergent env)
- **Admin**: `admin@enered.com` / `admin123`
- **Demo users** (password = `demo123`):
  - `administrador@lima.com` (rol: administrador, empresa: TRANSPORTES LIMA SAC) → servicios: **combustible + gps** (con token Wialon real configurado)
  - `logistica@lima.com` (rol: logistica, empresa: TRANSPORTES LIMA SAC)
  - `contabilidad@lima.com` (rol: contabilidad, empresa: TRANSPORTES LIMA SAC)
  - `administrador@andina.com` (rol: administrador, empresa: LOGISTICA ANDINA SA) → servicios: **solo plataforma** (para probar carga manual sin ahorro)
  - `administrador@cargo.com` (rol: administrador, empresa: CARGO PERU EIRL) → servicios: defaults (combustible=true, gps=false)

## Servicios por empresa (nuevo — Jul 2026)
Se agregó el campo `servicios={plataforma, combustible, gps}` + `tipo_cliente={enered|subsidio}` en `empresas_config`.
Configurable desde `/admin/empresas` (solo `admin_enered`).
El token Wialon se encripta con Fernet derivado de `JWT_SECRET`.

## Subsidio DU 004-2026 (cliente_subsidio)
- **Cliente subsidio (expediente sin completar)**: `cliente.subsidio@test.com` / `subsidio123`
  - Empresa: TRANSPORTES TEST SUBSIDIO SAC, RUC: 20999888777
  - Flota pre-cargada: ABC-123 (N2), DEF-456 (N2), GHI-789 (N3)
  - Estado inicial: `expediente_status = uploading`, `documentos_completos = false`
  - Para "desbloquear" módulos: subir facturas → /subsidio/verificar → confirmar todas
  - Re-seed: `cd /app/backend && python seed_subsidio_test.py` (idempotente)

## Production (Render — to be set in env vars on first deploy)
- **Admin email**: `admin@enered.com`
- **Admin password**: SET IN RENDER (suggested strong: `69#VhZUUO19D+yzy6JVI`)
- **JWT_SECRET** (suggested): `NwuU07TukidrgTPSntvZlHJbHpCjtQx4RxPIuIIRvzdRAOfVrGcezeV3CpV_VE_bZX2h6MB7P3jEzAG9xX18-w`
- These are NOT committed to git — set them in Render dashboard.
