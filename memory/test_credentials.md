# ENERED — Test Credentials

## Local development (current Emergent env)
- **Admin**: `admin@enered.com` / `admin123`
- **Demo users** (password = `demo123`):
  - `administrador@lima.com` (rol: administrador, empresa: TRANSPORTES LIMA SAC)
  - `logistica@lima.com` (rol: logistica, empresa: TRANSPORTES LIMA SAC)
  - `contabilidad@lima.com` (rol: contabilidad, empresa: TRANSPORTES LIMA SAC)
  - `administrador@andina.com` (rol: administrador, empresa: LOGISTICA ANDINA SA)
  - `administrador@cargo.com` (rol: administrador, empresa: CARGO PERU EIRL)

## Subsidio DU 004-2026 (cliente_subsidio)
- **Cliente subsidio (expediente sin completar)**: `cliente.subsidio@test.com` / `subsidio123`
  - Empresa: TRANSPORTES TEST SUBSIDIO SAC, RUC: 20999888777
  - Flota pre-cargada: ABC-123 (N2), DEF-456 (N2), GHI-789 (N3)
  - Estado inicial: `expediente_status = uploading`, `documentos_completos = false`
  - Para "desbloquear" módulos: subir facturas → /subsidio/verificar → confirmar todas

## Production (Render — to be set in env vars on first deploy)
- **Admin email**: `admin@enered.com`
- **Admin password**: SET IN RENDER (suggested strong: `69#VhZUUO19D+yzy6JVI`)
- **JWT_SECRET** (suggested): `NwuU07TukidrgTPSntvZlHJbHpCjtQx4RxPIuIIRvzdRAOfVrGcezeV3CpV_VE_bZX2h6MB7P3jEzAG9xX18-w`
- These are NOT committed to git — set them in Render dashboard.
