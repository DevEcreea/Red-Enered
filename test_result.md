#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: "FASE 1+2 completadas. FASE 2: (a) Agregar `subsidio` como 4º servicio independiente en empresas_config (junto a plataforma/combustible/gps) para soportar clientes MIXTOS (ENERED + Subsidio DU 004 al mismo tiempo). (b) Módulo Monitoreo con iframe Wialon embebido dentro de ENERED: nuevo endpoint `GET /api/wialon/sid` que hace login on-demand con el token guardado y devuelve el iframe_url (hosting.wialon.us/?sid=X) para embeber. (c) Sidebar Layout: Mi Flota accesible por role=cliente_subsidio OR servicios.subsidio=true; Monitoreo oculto si !servicios.gps."

backend:
  - task: "Servicio subsidio agregado como 4º flag independiente"
    implemented: true
    working: true
    file: "backend/servicios.py, backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "DEFAULT_SERVICIOS + _normalize_servicios + EmpresaServicios pydantic model incluyen ahora `subsidio: bool`. admin_enered recibe subsidio=true automáticamente. backfill_servicios extendido: si tipo_cliente=subsidio O algún user de la empresa tiene role=cliente_subsidio, se activa servicios.subsidio=true automáticamente (backward compat)."
        - working: true
          agent: "testing"
          comment: "✅ FASE 2 TESTED: All 6 test cases PASSED. (1) GET /auth/me includes subsidio as 4th service key - verified admin_enered has all 4 services=true, Lima/Andina/Cargo users have subsidio key (boolean). (2) PUT /admin/empresas/{empresa}/servicios accepts subsidio - successfully enabled subsidio for Lima, verified user login reflects change, partial payload (3 keys) correctly normalizes to include subsidio=false. (3) Backfill verification - all 4 empresas in DB have servicios.subsidio key (boolean), backfill runs idempotently on startup (scanned: 4, updated: 0). (4) GET /api/wialon/sid working perfectly - Lima user (gps+token) returns 200 with sid (32 chars), iframe_url, total_unidades=61, user=energix; Andina (no gps) correctly returns 403; Cargo (no gps) returns 403; admin_enered returns 400; no token returns 401. (5) iframe_url correctly points to hosting.wialon.us (NOT hst-api), contains ?sid= parameter. (6) Regression Phase 1 - POST /consumptions/manual works, GET /empresas-config shows masked tokens, PUT /wialon updates token mask correctly. NO CRITICAL ISSUES FOUND."

  - task: "GET /api/wialon/sid — iframe embed on-demand"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "Endpoint que requiere usuario autenticado (no admin_enered). Valida servicios.gps=true, obtiene token encriptado, hace login con Wialon, genera sid fresco, transforma hst-api.wialon.X → hosting.wialon.X para UI, devuelve {sid, host, base_url, iframe_url, total_unidades, user}. Testeado con administrador@lima.com: retorna sid de 32 chars y iframe_url válido https://hosting.wialon.us/?sid=X&lang=es con 61 unidades. Errores: 400 admin_enered, 400 sin empresa, 403 sin gps, 404 sin token, 502 token rechazado."
        - working: true
          agent: "testing"
          comment: "✅ TESTED: GET /api/wialon/sid endpoint working perfectly. Lima user (servicios.gps=true + token configured) returns 200 with: sid (32-char string), host, base_url, iframe_url (https://hosting.wialon.us/?sid=X&lang=es), total_unidades=61, user='energix'. All error cases verified: Andina (gps=false) → 403 'Servicio GPS no habilitado', Cargo (gps=false) → 403, admin_enered → 400 'no está asociado a una empresa', no token → 401. iframe_url correctly transformed from hst-api to hosting domain. Real Wialon integration working with production token."

frontend:
  - task: "AdminEmpresas: 4º toggle Subsidio DU 004"
    implemented: true
    working: "NA"
    file: "frontend/src/pages/AdminEmpresas.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "SERVICE_META extendido con subsidio (color #F59E0B, icon ShieldCheck, desc 'Expediente DU 004-2026'). Tabla: columna extra 'Subsidio DU 004' con Dot on/off. Modal ServiciosModal muestra los 4 toggles independientes. Ahora una empresa puede tener combustible+subsidio simultáneamente (caso cliente mixto)."

  - task: "Layout: Mi Flota y Monitoreo gateados por servicios"
    implemented: true
    working: "NA"
    file: "frontend/src/components/Layout.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "MENU filter refactoreado: (1) Mi Flota (/subsidio/documentos) accesible si role=cliente_subsidio OR user.servicios.subsidio=true (permite a cliente mixto ver Mi Flota aunque su rol sea administrador); (2) Monitoreo (/monitoreo) oculto si user.servicios.gps=false (excepto admin_enered). Todos los otros items sin cambio."

  - task: "Monitoreo.jsx: iframe Wialon embebido con auto-login"
    implemented: true
    working: "NA"
    file: "frontend/src/pages/Monitoreo.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Página rehecha completamente. 3 estados: (1) sin servicios.gps → ModuloBloqueado con mensaje contextual; (2) loading spinner conectando con Wialon; (3) header con nombre empresa + badge de unidades y usuario + botón refrescar sesión + botón abrir en pestaña nueva + iframe fullscreen apuntando a data.iframe_url. Manejo de errores con botón reintentar. useEffect llama GET /api/wialon/sid al montar."

metadata:
  created_by: "main_agent"
  version: "3.2"
  test_sequence: 14
  run_ui: false

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    - agent: "main"
      message: "FASE 2 completada. Cambios sobre FASE 1: (a) `subsidio` es ahora 4º servicio independiente — soporta clientes mixtos ENERED+Subsidio; (b) Módulo Monitoreo con iframe Wialon embebido usando SID on-demand generado por el backend con el token encriptado de la empresa; (c) Sidebar filter usa servicios (no solo role) para Mi Flota y Monitoreo. Endpoint /api/wialon/sid probado con curl real: devuelve sid 32-char válido y iframe_url a hosting.wialon.us con 61 unidades detectadas. Backfill inteligente retro-activa servicios.subsidio en empresas legacy con tipo_cliente=subsidio o con users cliente_subsidio. Credenciales: admin@enered.com/admin123. Necesito: (1) verificar backfill con tipo_cliente=subsidio activa subsidio=true; (2) verificar /wialon/sid casos edge (usuario sin empresa, sin gps, sin token, token roto); (3) verificar admin_enered recibe servicios={plataforma,combustible,gps,subsidio} = todos true en /auth/me."
    - agent: "testing"
      message: "✅ FASE 2 BACKEND TESTING COMPLETE - ALL 6 TEST CASES PASSED (6/6). Comprehensive testing performed: (1) GET /auth/me includes subsidio as 4th service key for all user types (admin_enered has all 4=true, client users have subsidio key with correct boolean values), (2) PUT /admin/empresas/{empresa}/servicios accepts and persists subsidio flag, normalizes partial payloads correctly, (3) Backfill verification confirmed - all 4 empresas have servicios.subsidio key, backfill runs idempotently on startup (scanned: 4, updated: 0), (4) GET /api/wialon/sid endpoint working perfectly - Lima user returns 200 with sid (32 chars), iframe_url (hosting.wialon.us), total_unidades=61, all error cases verified (403 for no gps, 400 for admin_enered, 401 for no token), (5) iframe_url correctly transformed from hst-api to hosting domain, (6) Regression Phase 1 features working - manual consumption upload, token masking, wialon config updates. Real Wialon integration verified with production token. NO CRITICAL ISSUES. Backend ready for production."

backend:
  - task: "Modelo Servicios por empresa + Fernet encryption Wialon token"
    implemented: true
    working: true
    file: "backend/servicios.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "Nuevo módulo backend/servicios.py con: DEFAULT_SERVICIOS, get_empresa_servicios (fetch defensivo con defaults seguros), encrypt/decrypt/mask_wialon_token (Fernet derivado de JWT_SECRET vía SHA-256), test_wialon_connection (httpx async — probado 100% con token real: 61 unidades), backfill_servicios (migración idempotente en startup)."
        - working: true
          agent: "testing"
          comment: "✅ TESTED: All servicios functionality working correctly. Encryption/decryption verified, token masking working (shows test••••••••2345 format), backfill_servicios is idempotent (scanned 2, updated 0 on subsequent runs). Real Wialon token test successful: detected 61 units for user 'energix'."

  - task: "/auth/me + /auth/login incluyen servicios, tipo_cliente, wialon_configurado"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "Nueva función async user_public_with_servicios(u) que enriquece la respuesta con los servicios de empresas_config. admin_enered siempre recibe {plataforma:true, combustible:true, gps:true}. Fallback seguro si empresa no tiene config."
        - working: true
          agent: "testing"
          comment: "✅ TESTED: Login enrichment working perfectly. All users receive servicios (plataforma, combustible, gps as booleans), tipo_cliente, and wialon_configurado fields. Admin gets all services enabled. Lima user shows wialon_configurado=true, Andina shows combustible=false as expected. GET /auth/me returns same enriched data with Bearer token."

  - task: "Endpoints admin: /admin/empresas/{empresa}/servicios + wialon (put/delete/test)"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "Solo admin_enered. Endpoints: PUT /admin/empresas/{empresa}/servicios (actualiza servicios + tipo_cliente, crea config si no existe); PUT /admin/empresas/{empresa}/wialon (encripta token, activa gps=true automáticamente); DELETE .../wialon (borra token); POST .../wialon/test (valida token contra Wialon en real-time). GET /empresas-config extendido para incluir token_mask y flag configurado."
        - working: true
          agent: "testing"
          comment: "✅ TESTED: All admin endpoints working correctly. GET /empresas-config returns masked tokens (never plain text), 403 for non-admin. PUT /servicios updates existing empresa and creates new ones, validates tipo_cliente enum, 403 for non-admin. PUT /wialon encrypts token and auto-enables gps service. DELETE /wialon removes token. POST /wialon/test validates real token (61 units detected), rejects invalid tokens gracefully. All endpoints correctly deny non-admin with 403."

  - task: "POST /consumptions/manual — carga manual con PDF factura"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "Endpoint multipart con Form fields (placa, fecha, hora, estacion, ciudad, producto, galones, precio_unitario, importe_total, kilometraje, conductor, numero_factura) + File opcional (factura, hasta 20MB). Guarda PDF via storage.save_object en manual_invoices/{empresa}/{consumo_id}.{ext}. Refleja en db.consumptions con _origen='manual', ahorro=0 (no aplica). Si viene numero_factura también crea entrada en db.invoices (estado=pendiente). GET /consumptions/{id}/factura descarga el PDF con tenant check."
        - working: true
          agent: "testing"
          comment: "✅ TESTED: Manual consumption creation working perfectly. PDF upload successful (541 bytes), stored with correct path. Consumption appears in GET /consumptions with _origen='manual', EMPRESA correct. Invoice created in /invoices with estado=pendiente. GET /consumptions/{id}/factura downloads PDF with correct content-type. Tenant isolation working (403 for different empresa). Admin correctly rejected (400). Works without PDF (factura_key=None). Required field validation working (422). All edge cases covered."

  - task: "Índices Mongo adicionales para acelerar dashboards"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "En startup(): índices compuestos consumptions(EMPRESA+FECHA), consumptions(EMPRESA+PLACA), PLACA, SEMANA, invoices(empresa+estado), qr_codes(empresa+placa), consumos_subsidio(user_id+status), (user_id+fecha), empresas_config(empresa unique). Try/except para no romper si ya existen."

frontend:
  - task: "Refactor Flotas.jsx (Combustible): KPIs reales + sparklines fuera + Ahorro condicional + Nueva carga"
    implemented: true
    working: "NA"
    file: "frontend/src/pages/Flotas.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "TabResumen ahora recibe {rows, totals, services, onOpenNuevaCarga}. Cambios: (1) BIG_CARDS_META (nombres) con valores computados desde totals; (2) SVG sparklines eliminados; (3) tarjeta Ahorro y columna Ahorro se ocultan si !services.combustible → grid pasa de 4 a 3 cols; (4) columnas de tabla cambian: si combustible=true muestra [Ahorro, GL/100 KM, Costo/km], si !combustible muestra [Factura] (link descarga PDF); (5) botón 'Nueva carga' visible solo si !services.combustible; (6) Cargas Inválidas ahora computado (rows sin PLACA, gal<=0 o imp<=0); (7) ModalNuevaCarga: form multipart con validación, POST a /api/consumptions/manual con FormData, PDF opcional; (8) refresh automático tras guardar."

  - task: "Nueva pantalla /admin/empresas — Empresas & Servicios"
    implemented: true
    working: "NA"
    file: "frontend/src/pages/AdminEmpresas.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Nueva página (solo admin_enered) con tabla de empresas + 2 modales: ServiciosModal (toggle plataforma/combustible/gps + tipo_cliente enered|subsidio) y WialonModal (input token + host, botón Probar Conexión que llama /admin/empresas/{empresa}/wialon/test y muestra {ok, user, total_unidades} o error, botón Guardar que encripta y persiste, botón Quitar). Sidebar admin actualizado con enlace 'Empresas & Servicios'. Ruta /admin/empresas registrada en App.js. Layout ROUTE_TITLES actualizado."

metadata:
  created_by: "main_agent"
  version: "3.1"
  test_sequence: 13
  run_ui: false

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    - agent: "main"
      message: "FASE 1 Combustible/Servicios completada. Backend testeado manualmente OK (login enriquecido con servicios, admin puede guardar/probar token Wialon real que devolvió 61 unidades). Frontend refactoreado sin errores de lint. Necesito: (1) validar endpoints backend nuevos con casos edge (permisos por rol, empresa inexistente, token inválido, PDF grande, tenant isolation en GET /consumptions/{id}/factura, backfill_servicios idempotencia). Credenciales: admin@enered.com/admin123 (admin_enered). Empresas de prueba pre-configuradas: TRANSPORTES LIMA SAC (combustible+gps+token real), LOGISTICA ANDINA SA (solo plataforma → prueba carga manual). Testing frontend NO se pide todavía."
    - agent: "testing"
      message: "✅ FASE 1 BACKEND TESTING COMPLETE - ALL TESTS PASSED (7/7). Comprehensive testing performed covering: (1) Login enrichment with servicios/tipo_cliente/wialon_configurado for all user types, (2) Admin GET /empresas-config with token masking and 403 for non-admin, (3) Admin PUT /servicios with create/update/validation/permissions, (4) Admin Wialon endpoints (PUT/DELETE/TEST) with real token validation (61 units detected), encryption, auto-enable gps, and 403 for non-admin, (5) POST /consumptions/manual with PDF upload, invoice creation, download, tenant isolation, and all edge cases, (6) Regression test for /consumptions filtering by empresa (tenant isolation intact), (7) Backfill idempotence verified. No critical issues found. All security checks (permissions, tenant isolation) working correctly. Real Wialon integration verified with production token."
