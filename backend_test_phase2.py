#!/usr/bin/env python3
"""
ENERED FASE 2 - Backend API Tests
Tests for subsidio as 4th service + Wialon iframe endpoint
"""
import requests
import json
from datetime import datetime

# Base URL - using localhost as per review request
BASE_URL = "http://localhost:8001/api"

# Test credentials
ADMIN_CREDS = {"email": "admin@enered.com", "password": "admin123"}
LIMA_CREDS = {"email": "administrador@lima.com", "password": "demo123"}
ANDINA_CREDS = {"email": "administrador@andina.com", "password": "demo123"}
CARGO_CREDS = {"email": "administrador@cargo.com", "password": "demo123"}

# Real Wialon token for TRANSPORTES LIMA SAC
WIALON_TOKEN_REAL = "f3a001e8ee89236df602c639476e01e13D335FD42E9A2C9FF6B59E3C87FF0FB4B18775F1"
WIALON_HOST = "hst-api.wialon.com"

def print_test(name):
    print(f"\n{'='*80}")
    print(f"TEST: {name}")
    print('='*80)

def print_result(passed, message):
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {message}")

def login(creds):
    """Login and return access token"""
    resp = requests.post(f"{BASE_URL}/auth/login", json=creds)
    if resp.status_code == 200:
        data = resp.json()
        return data.get("access_token"), data.get("user")
    return None, None

def test_1_auth_me_includes_subsidio():
    """Test 1: /auth/me now includes subsidio as 4th service key"""
    print_test("1) GET /auth/me — servicios includes subsidio")
    
    # Test admin_enered
    print("\n1.1) Admin (admin@enered.com) - should have all 4 services = true")
    token, user = login(ADMIN_CREDS)
    if not token:
        print_result(False, "Admin login failed")
        return False
    
    # GET /auth/me
    resp = requests.get(f"{BASE_URL}/auth/me", headers={"Authorization": f"Bearer {token}"})
    if resp.status_code != 200:
        print_result(False, f"GET /auth/me failed: {resp.status_code}")
        return False
    
    user = resp.json()
    servicios = user.get("servicios", {})
    
    # Verify all 4 keys exist
    required_keys = ["plataforma", "combustible", "gps", "subsidio"]
    for key in required_keys:
        if key not in servicios:
            print_result(False, f"Missing key '{key}' in servicios")
            return False
        if not isinstance(servicios[key], bool):
            print_result(False, f"servicios.{key} is not boolean: {type(servicios[key])}")
            return False
    
    # Admin should have all 4 services = true
    if not all([servicios["plataforma"], servicios["combustible"], servicios["gps"], servicios["subsidio"]]):
        print_result(False, f"Admin should have all 4 services = true: {servicios}")
        return False
    
    print_result(True, f"Admin servicios OK: {servicios}")
    
    # Test Lima user (has gps, should have subsidio=false by default)
    print("\n1.2) Lima user (administrador@lima.com) - should have subsidio key")
    token_lima, _ = login(LIMA_CREDS)
    if not token_lima:
        print_result(False, "Lima login failed")
        return False
    
    resp = requests.get(f"{BASE_URL}/auth/me", headers={"Authorization": f"Bearer {token_lima}"})
    if resp.status_code != 200:
        print_result(False, f"Lima GET /auth/me failed: {resp.status_code}")
        return False
    
    user_lima = resp.json()
    servicios_lima = user_lima.get("servicios", {})
    
    if "subsidio" not in servicios_lima:
        print_result(False, "Lima user missing 'subsidio' key in servicios")
        return False
    
    if not isinstance(servicios_lima["subsidio"], bool):
        print_result(False, f"Lima subsidio is not boolean: {type(servicios_lima['subsidio'])}")
        return False
    
    print_result(True, f"Lima servicios OK: {servicios_lima}")
    
    # Test Andina user (no gps, should have subsidio=false by default)
    print("\n1.3) Andina user (administrador@andina.com) - should have subsidio key")
    token_andina, _ = login(ANDINA_CREDS)
    if not token_andina:
        print_result(False, "Andina login failed")
        return False
    
    resp = requests.get(f"{BASE_URL}/auth/me", headers={"Authorization": f"Bearer {token_andina}"})
    if resp.status_code != 200:
        print_result(False, f"Andina GET /auth/me failed: {resp.status_code}")
        return False
    
    user_andina = resp.json()
    servicios_andina = user_andina.get("servicios", {})
    
    if "subsidio" not in servicios_andina:
        print_result(False, "Andina user missing 'subsidio' key in servicios")
        return False
    
    print_result(True, f"Andina servicios OK: {servicios_andina}")
    
    return True

def test_2_put_servicios_accepts_subsidio():
    """Test 2: PUT /admin/empresas/{empresa}/servicios accepts subsidio"""
    print_test("2) PUT /admin/empresas/{empresa}/servicios accepts subsidio")
    
    # Login as admin
    token, _ = login(ADMIN_CREDS)
    if not token:
        print_result(False, "Admin login failed")
        return False
    
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    # Test 2.1: Enable subsidio for TRANSPORTES LIMA SAC
    print("\n2.1) Enable subsidio for TRANSPORTES LIMA SAC")
    empresa = "TRANSPORTES LIMA SAC"
    payload = {
        "servicios": {
            "plataforma": True,
            "combustible": True,
            "gps": True,
            "subsidio": True
        },
        "tipo_cliente": "enered"
    }
    
    resp = requests.put(f"{BASE_URL}/admin/empresas/{empresa}/servicios", json=payload, headers=headers)
    if resp.status_code != 200:
        print_result(False, f"PUT /servicios failed: {resp.status_code} - {resp.text}")
        return False
    
    data = resp.json()
    if not data.get("ok"):
        print_result(False, f"Response not OK: {data}")
        return False
    
    if data.get("servicios", {}).get("subsidio") != True:
        print_result(False, f"subsidio not enabled in response: {data}")
        return False
    
    print_result(True, f"Subsidio enabled for Lima: {data}")
    
    # Verify by logging in as Lima user
    print("\n2.2) Verify Lima user now has subsidio=true")
    token_lima, user_lima = login(LIMA_CREDS)
    if not token_lima:
        print_result(False, "Lima login failed")
        return False
    
    if user_lima.get("servicios", {}).get("subsidio") != True:
        print_result(False, f"Lima user subsidio not true after update: {user_lima.get('servicios')}")
        return False
    
    print_result(True, f"Lima user subsidio verified: {user_lima.get('servicios')}")
    
    # Test 2.3: PUT with only 3 keys (without subsidio) - should default subsidio=false
    print("\n2.3) PUT with only 3 keys (without subsidio) - should normalize")
    payload_partial = {
        "servicios": {
            "plataforma": True,
            "combustible": True,
            "gps": True
        },
        "tipo_cliente": "enered"
    }
    
    resp = requests.put(f"{BASE_URL}/admin/empresas/LOGISTICA ANDINA SA/servicios", json=payload_partial, headers=headers)
    if resp.status_code != 200:
        print_result(False, f"PUT /servicios (partial) failed: {resp.status_code} - {resp.text}")
        return False
    
    data = resp.json()
    # Should have subsidio key with default value
    if "subsidio" not in data.get("servicios", {}):
        print_result(False, f"subsidio key missing after normalize: {data}")
        return False
    
    print_result(True, f"Partial servicios normalized OK: {data}")
    
    return True

def test_3_backfill_verification():
    """Test 3: Backfill retro-active verification"""
    print_test("3) Backfill retro-active verification")
    
    # Login as admin
    token, _ = login(ADMIN_CREDS)
    if not token:
        print_result(False, "Admin login failed")
        return False
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get all empresas_config
    print("\n3.1) GET /empresas-config - verify all have servicios.subsidio key")
    resp = requests.get(f"{BASE_URL}/empresas-config", headers=headers)
    if resp.status_code != 200:
        print_result(False, f"GET /empresas-config failed: {resp.status_code}")
        return False
    
    configs = resp.json()
    if not isinstance(configs, list):
        print_result(False, f"empresas-config not a list: {type(configs)}")
        return False
    
    print(f"Found {len(configs)} empresas in config")
    
    for cfg in configs:
        empresa = cfg.get("empresa")
        servicios = cfg.get("servicios", {})
        
        if "subsidio" not in servicios:
            print_result(False, f"Empresa '{empresa}' missing subsidio key: {servicios}")
            return False
        
        if not isinstance(servicios["subsidio"], bool):
            print_result(False, f"Empresa '{empresa}' subsidio not boolean: {type(servicios['subsidio'])}")
            return False
        
        print(f"  ✓ {empresa}: subsidio={servicios['subsidio']}")
    
    print_result(True, f"All {len(configs)} empresas have subsidio key")
    
    return True

def test_4_wialon_sid_endpoint():
    """Test 4: GET /api/wialon/sid — new iframe endpoint"""
    print_test("4) GET /api/wialon/sid — iframe embed on-demand")
    
    # First, reset Andina's gps to false (in case previous tests modified it)
    print("\n4.0) Reset Andina's gps to false for testing")
    token_admin, _ = login(ADMIN_CREDS)
    if token_admin:
        headers_admin = {"Authorization": f"Bearer {token_admin}", "Content-Type": "application/json"}
        payload = {
            "servicios": {
                "plataforma": True,
                "combustible": False,
                "gps": False,
                "subsidio": False
            },
            "tipo_cliente": "enered"
        }
        requests.put(f"{BASE_URL}/admin/empresas/LOGISTICA ANDINA SA/servicios", json=payload, headers=headers_admin)
        print("  ✓ Andina gps reset to false")
    
    # Test 4.1: Lima user (has gps + token) - should return 200 with sid
    print("\n4.1) Lima user (has gps + token) - should return 200 with sid")
    token_lima, _ = login(LIMA_CREDS)
    if not token_lima:
        print_result(False, "Lima login failed")
        return False
    
    headers = {"Authorization": f"Bearer {token_lima}"}
    resp = requests.get(f"{BASE_URL}/wialon/sid", headers=headers)
    
    if resp.status_code != 200:
        print_result(False, f"Lima GET /wialon/sid failed: {resp.status_code} - {resp.text}")
        return False
    
    data = resp.json()
    
    # Verify response structure
    required_fields = ["sid", "host", "base_url", "iframe_url", "total_unidades", "user"]
    for field in required_fields:
        if field not in data:
            print_result(False, f"Missing field '{field}' in response")
            return False
    
    # Verify sid is 32 chars
    sid = data.get("sid")
    if not isinstance(sid, str) or len(sid) != 32:
        print_result(False, f"sid should be 32 chars string, got: {sid} (len={len(sid) if isinstance(sid, str) else 'N/A'})")
        return False
    
    # Verify iframe_url contains hosting.wialon
    iframe_url = data.get("iframe_url")
    if "hosting.wialon" not in iframe_url:
        print_result(False, f"iframe_url should contain 'hosting.wialon', got: {iframe_url}")
        return False
    
    # Verify iframe_url contains sid
    if f"sid={sid}" not in iframe_url:
        print_result(False, f"iframe_url should contain 'sid={sid}', got: {iframe_url}")
        return False
    
    # Verify total_unidades > 0
    total_unidades = data.get("total_unidades")
    if not isinstance(total_unidades, int) or total_unidades <= 0:
        print_result(False, f"total_unidades should be > 0, got: {total_unidades}")
        return False
    
    print_result(True, f"Lima /wialon/sid OK: sid={sid[:8]}..., iframe_url={iframe_url[:60]}..., total_unidades={total_unidades}, user={data.get('user')}")
    
    # Test 4.2: Andina user (no gps) - should return 403
    print("\n4.2) Andina user (no gps) - should return 403")
    token_andina, _ = login(ANDINA_CREDS)
    if not token_andina:
        print_result(False, "Andina login failed")
        return False
    
    headers = {"Authorization": f"Bearer {token_andina}"}
    resp = requests.get(f"{BASE_URL}/wialon/sid", headers=headers)
    
    if resp.status_code != 403:
        print_result(False, f"Andina should get 403, got: {resp.status_code}")
        return False
    
    if "GPS no habilitado" not in resp.text:
        print_result(False, f"Expected 'GPS no habilitado' in error, got: {resp.text}")
        return False
    
    print_result(True, f"Andina correctly rejected with 403: {resp.json().get('detail')}")
    
    # Test 4.3: Cargo user (no gps by default) - should return 403
    print("\n4.3) Cargo user (no gps by default) - should return 403")
    token_cargo, _ = login(CARGO_CREDS)
    if not token_cargo:
        print_result(False, "Cargo login failed")
        return False
    
    headers = {"Authorization": f"Bearer {token_cargo}"}
    resp = requests.get(f"{BASE_URL}/wialon/sid", headers=headers)
    
    if resp.status_code != 403:
        print_result(False, f"Cargo should get 403, got: {resp.status_code}")
        return False
    
    print_result(True, f"Cargo correctly rejected with 403: {resp.json().get('detail')}")
    
    # Test 4.4: Admin (admin_enered) - should return 400
    print("\n4.4) Admin (admin_enered) - should return 400")
    token_admin, _ = login(ADMIN_CREDS)
    if not token_admin:
        print_result(False, "Admin login failed")
        return False
    
    headers = {"Authorization": f"Bearer {token_admin}"}
    resp = requests.get(f"{BASE_URL}/wialon/sid", headers=headers)
    
    if resp.status_code != 400:
        print_result(False, f"Admin should get 400, got: {resp.status_code}")
        return False
    
    if "admin_enered no está asociado" not in resp.text:
        print_result(False, f"Expected 'admin_enered no está asociado' in error, got: {resp.text}")
        return False
    
    print_result(True, f"Admin correctly rejected with 400: {resp.json().get('detail')}")
    
    # Test 4.5: No token - should return 401
    print("\n4.5) No token - should return 401")
    resp = requests.get(f"{BASE_URL}/wialon/sid")
    
    if resp.status_code != 401:
        print_result(False, f"No token should get 401, got: {resp.status_code}")
        return False
    
    print_result(True, f"No token correctly rejected with 401")
    
    return True

def test_5_iframe_url_portal():
    """Test 5: Verify iframe_url points to portal UI (hosting.wialon, not hst-api)"""
    print_test("5) Verify iframe_url points to portal UI")
    
    # Login as Lima user
    token_lima, _ = login(LIMA_CREDS)
    if not token_lima:
        print_result(False, "Lima login failed")
        return False
    
    headers = {"Authorization": f"Bearer {token_lima}"}
    resp = requests.get(f"{BASE_URL}/wialon/sid", headers=headers)
    
    if resp.status_code != 200:
        print_result(False, f"GET /wialon/sid failed: {resp.status_code}")
        return False
    
    data = resp.json()
    iframe_url = data.get("iframe_url", "")
    
    # Verify starts with https://hosting.wialon.
    if not iframe_url.startswith("https://hosting.wialon."):
        print_result(False, f"iframe_url should start with 'https://hosting.wialon.', got: {iframe_url}")
        return False
    
    # Verify does NOT contain hst-api
    if "hst-api" in iframe_url:
        print_result(False, f"iframe_url should NOT contain 'hst-api', got: {iframe_url}")
        return False
    
    # Verify contains ?sid=
    if "?sid=" not in iframe_url:
        print_result(False, f"iframe_url should contain '?sid=', got: {iframe_url}")
        return False
    
    print_result(True, f"iframe_url correctly points to portal: {iframe_url}")
    
    return True

def test_6_regression_phase1():
    """Test 6: Regression - Phase 1 features still working"""
    print_test("6) Regression - Phase 1 features still working")
    
    # Test 6.1: POST /consumptions/manual with Andina user
    print("\n6.1) POST /consumptions/manual with Andina user")
    token_andina, user_andina = login(ANDINA_CREDS)
    if not token_andina:
        print_result(False, "Andina login failed")
        return False
    
    headers = {"Authorization": f"Bearer {token_andina}"}
    
    # Create a small PDF
    pdf_content = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 44 >>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(Test Invoice) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000317 00000 n\ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n410\n%%EOF"
    
    files = {
        "factura": ("test_invoice.pdf", pdf_content, "application/pdf")
    }
    
    data = {
        "placa": "TEST-999",
        "fecha": "2024-07-04",
        "hora": "10:30",
        "estacion": "PRIMAX TEST",
        "ciudad": "LIMA",
        "producto": "DIESEL B5",
        "galones": 50.0,
        "precio_unitario": 15.50,
        "importe_total": 775.0,
        "kilometraje": 12345,
        "conductor": "Test Driver",
        "numero_factura": f"TEST-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    }
    
    resp = requests.post(f"{BASE_URL}/consumptions/manual", data=data, files=files, headers=headers)
    
    if resp.status_code != 200:
        print_result(False, f"POST /consumptions/manual failed: {resp.status_code} - {resp.text}")
        return False
    
    result = resp.json()
    if not result.get("ok"):
        print_result(False, f"Manual consumption not OK: {result}")
        return False
    
    consumo_id = result.get("consumo", {}).get("id")
    if not consumo_id:
        print_result(False, f"No consumo_id in response: {result}")
        return False
    
    print_result(True, f"Manual consumption created: {consumo_id}")
    
    # Test 6.2: GET /empresas-config with admin (token masking)
    print("\n6.2) GET /empresas-config with admin (token masking)")
    token_admin, _ = login(ADMIN_CREDS)
    if not token_admin:
        print_result(False, "Admin login failed")
        return False
    
    headers = {"Authorization": f"Bearer {token_admin}"}
    resp = requests.get(f"{BASE_URL}/empresas-config", headers=headers)
    
    if resp.status_code != 200:
        print_result(False, f"GET /empresas-config failed: {resp.status_code}")
        return False
    
    configs = resp.json()
    
    # Find Lima config
    lima_cfg = None
    for cfg in configs:
        if cfg.get("empresa") == "TRANSPORTES LIMA SAC":
            lima_cfg = cfg
            break
    
    if not lima_cfg:
        print_result(False, "TRANSPORTES LIMA SAC not found in configs")
        return False
    
    # Verify wialon.token_mask is masked
    wialon = lima_cfg.get("wialon", {})
    token_mask = wialon.get("token_mask", "")
    
    if not token_mask:
        print_result(False, "token_mask is empty")
        return False
    
    # Should contain bullets (•) and not be the full token
    if "•" not in token_mask:
        print_result(False, f"token_mask should contain bullets, got: {token_mask}")
        return False
    
    if len(token_mask) == len(WIALON_TOKEN_REAL):
        # Could be masked, verify it's not the plain token
        if token_mask == WIALON_TOKEN_REAL:
            print_result(False, f"token_mask is plain text token!")
            return False
    
    print_result(True, f"Token masking OK: {token_mask}")
    
    # Test 6.3: PUT /admin/empresas/.../wialon with new token
    print("\n6.3) PUT /admin/empresas/.../wialon with token (verify mask updates)")
    
    # Use the same token (idempotent)
    payload = {
        "token": WIALON_TOKEN_REAL,
        "host": WIALON_HOST
    }
    
    resp = requests.put(f"{BASE_URL}/admin/empresas/TRANSPORTES LIMA SAC/wialon", json=payload, headers=headers)
    
    if resp.status_code != 200:
        print_result(False, f"PUT /wialon failed: {resp.status_code} - {resp.text}")
        return False
    
    result = resp.json()
    if not result.get("ok"):
        print_result(False, f"PUT /wialon not OK: {result}")
        return False
    
    # Verify token_mask in response
    new_mask = result.get("token_mask", "")
    if not new_mask or "•" not in new_mask:
        print_result(False, f"New token_mask invalid: {new_mask}")
        return False
    
    print_result(True, f"PUT /wialon OK, new mask: {new_mask}")
    
    # Verify next GET reflects the mask
    resp = requests.get(f"{BASE_URL}/empresas-config", headers=headers)
    if resp.status_code != 200:
        print_result(False, f"GET /empresas-config after PUT failed: {resp.status_code}")
        return False
    
    configs = resp.json()
    lima_cfg = None
    for cfg in configs:
        if cfg.get("empresa") == "TRANSPORTES LIMA SAC":
            lima_cfg = cfg
            break
    
    if not lima_cfg:
        print_result(False, "TRANSPORTES LIMA SAC not found after PUT")
        return False
    
    updated_mask = lima_cfg.get("wialon", {}).get("token_mask", "")
    if updated_mask != new_mask:
        print_result(False, f"Mask not updated in GET: expected {new_mask}, got {updated_mask}")
        return False
    
    print_result(True, f"GET after PUT reflects new mask: {updated_mask}")
    
    return True

def main():
    print("\n" + "="*80)
    print("ENERED FASE 2 - BACKEND API TESTS")
    print("="*80)
    
    results = {}
    
    # Run all tests
    results["Test 1: /auth/me includes subsidio"] = test_1_auth_me_includes_subsidio()
    results["Test 2: PUT /servicios accepts subsidio"] = test_2_put_servicios_accepts_subsidio()
    results["Test 3: Backfill verification"] = test_3_backfill_verification()
    results["Test 4: GET /wialon/sid endpoint"] = test_4_wialon_sid_endpoint()
    results["Test 5: iframe_url points to portal"] = test_5_iframe_url_portal()
    results["Test 6: Regression Phase 1"] = test_6_regression_phase1()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        return 1

if __name__ == "__main__":
    exit(main())
