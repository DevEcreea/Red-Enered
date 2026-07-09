#!/usr/bin/env python3
"""
Backend testing for GET /api/vehiculos/kpis endpoint
Tests KPI calculations, tenant isolation, and regression
"""
import os
import sys
import asyncio
import httpx
from datetime import datetime, timezone

# Backend URL - use internal URL for testing
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8001")
API_BASE = f"{BACKEND_URL}/api"

# Test credentials
ADMIN_EMAIL = "admin@enered.com"
ADMIN_PASSWORD = "admin123"
LIMA_EMAIL = "administrador@lima.com"
LIMA_PASSWORD = "demo123"
ANDINA_EMAIL = "administrador@andina.com"
ANDINA_PASSWORD = "demo123"

# Test results
test_results = []

def log_test(name, passed, details=""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    test_results.append({"name": name, "passed": passed, "details": details})
    print(f"{status}: {name}")
    if details:
        print(f"  → {details}")

async def login(email, password):
    """Login and return access token"""
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{API_BASE}/auth/login",
            json={"email": email, "password": password}
        )
        if resp.status_code != 200:
            raise Exception(f"Login failed for {email}: {resp.status_code} {resp.text}")
        data = resp.json()
        return data["access_token"]

async def test_1_structure_and_auth():
    """TEST 1: Structure and authentication"""
    print("\n" + "="*80)
    print("TEST 1: GET /api/vehiculos/kpis — Structure and Auth")
    print("="*80)
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Test without auth
        print("\n🔓 Testing without auth...")
        resp_no_auth = await client.get(f"{API_BASE}/vehiculos/kpis")
        if resp_no_auth.status_code == 401:
            log_test("Without auth returns 401", True)
        else:
            log_test("Without auth returns 401", False, f"Got {resp_no_auth.status_code}")
        
        # Test with admin_enered
        print("\n👑 Testing with admin_enered...")
        admin_token = await login(ADMIN_EMAIL, ADMIN_PASSWORD)
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        resp_admin = await client.get(f"{API_BASE}/vehiculos/kpis", headers=admin_headers)
        if resp_admin.status_code != 200:
            log_test("admin_enered returns 200", False, f"Status {resp_admin.status_code}: {resp_admin.text[:200]}")
            return
        log_test("admin_enered returns 200", True)
        
        admin_kpis = resp_admin.json()
        
        # Check all keys present
        expected_keys = [
            "total_vehiculos",
            "sin_gps",
            "en_taller",
            "docs_vehiculo_vencidos",
            "docs_chofer_vencidos",
            "vehiculos_con_infracciones",
            "vehiculos_con_cargas_invalidas"
        ]
        missing_keys = [k for k in expected_keys if k not in admin_kpis]
        if missing_keys:
            log_test("All 7 keys present", False, f"Missing: {missing_keys}")
        else:
            log_test("All 7 keys present", True)
        
        # Check all values are integers >= 0
        non_int_keys = []
        negative_keys = []
        for key in expected_keys:
            val = admin_kpis.get(key)
            if not isinstance(val, int):
                non_int_keys.append(f"{key}={val} (type={type(val).__name__})")
            elif val < 0:
                negative_keys.append(f"{key}={val}")
        
        if non_int_keys:
            log_test("All values are integers", False, f"Non-int: {non_int_keys}")
        else:
            log_test("All values are integers", True)
        
        if negative_keys:
            log_test("All values >= 0", False, f"Negative: {negative_keys}")
        else:
            log_test("All values >= 0", True)
        
        print(f"  Admin KPIs (all empresas): {admin_kpis}")
        
        # Test with Lima user (tenant isolation)
        print("\n🏢 Testing with Lima user (tenant isolation)...")
        lima_token = await login(LIMA_EMAIL, LIMA_PASSWORD)
        lima_headers = {"Authorization": f"Bearer {lima_token}"}
        
        resp_lima = await client.get(f"{API_BASE}/vehiculos/kpis", headers=lima_headers)
        if resp_lima.status_code != 200:
            log_test("Lima user returns 200", False, f"Status {resp_lima.status_code}: {resp_lima.text[:200]}")
            return
        log_test("Lima user returns 200", True)
        
        lima_kpis = resp_lima.json()
        print(f"  Lima KPIs (TRANSPORTES LIMA SAC only): {lima_kpis}")
        
        # Lima should have <= admin totals (tenant isolation)
        if lima_kpis["total_vehiculos"] > admin_kpis["total_vehiculos"]:
            log_test("Lima total_vehiculos <= admin total", False, f"Lima={lima_kpis['total_vehiculos']}, Admin={admin_kpis['total_vehiculos']}")
        else:
            log_test("Lima total_vehiculos <= admin total", True)
        
        # Test with Andina user
        print("\n🏢 Testing with Andina user (tenant isolation)...")
        andina_token = await login(ANDINA_EMAIL, ANDINA_PASSWORD)
        andina_headers = {"Authorization": f"Bearer {andina_token}"}
        
        resp_andina = await client.get(f"{API_BASE}/vehiculos/kpis", headers=andina_headers)
        if resp_andina.status_code != 200:
            log_test("Andina user returns 200", False, f"Status {resp_andina.status_code}: {resp_andina.text[:200]}")
            return
        log_test("Andina user returns 200", True)
        
        andina_kpis = resp_andina.json()
        print(f"  Andina KPIs (LOGISTICA ANDINA SA only): {andina_kpis}")
        
        # Check all keys present for Andina
        missing_keys_andina = [k for k in expected_keys if k not in andina_kpis]
        if missing_keys_andina:
            log_test("Andina response has all keys", False, f"Missing: {missing_keys_andina}")
        else:
            log_test("Andina response has all keys", True)
        
        # If Andina has no vehicles, most should be 0 (except possibly cargas_invalidas if there are orphaned consumptions)
        if andina_kpis["total_vehiculos"] == 0:
            # Check that vehicle-related KPIs are 0
            vehicle_kpis_zero = (
                andina_kpis["sin_gps"] == 0 and
                andina_kpis["en_taller"] == 0 and
                andina_kpis["docs_vehiculo_vencidos"] == 0 and
                andina_kpis["docs_chofer_vencidos"] == 0 and
                andina_kpis["vehiculos_con_infracciones"] == 0
            )
            if vehicle_kpis_zero:
                log_test("Andina with no vehicles: vehicle KPIs = 0", True, f"cargas_invalidas={andina_kpis['vehiculos_con_cargas_invalidas']} (may be non-zero due to orphaned consumptions)")
            else:
                log_test("Andina with no vehicles: vehicle KPIs = 0", False, f"Some non-zero: {andina_kpis}")

async def test_2_calculations():
    """TEST 2: Verify calculations are correct"""
    print("\n" + "="*80)
    print("TEST 2: GET /api/vehiculos/kpis — Correct Calculations")
    print("="*80)
    
    lima_token = await login(LIMA_EMAIL, LIMA_PASSWORD)
    lima_headers = {"Authorization": f"Bearer {lima_token}"}
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Get KPIs
        resp_kpis = await client.get(f"{API_BASE}/vehiculos/kpis", headers=lima_headers)
        if resp_kpis.status_code != 200:
            log_test("GET /api/vehiculos/kpis returns 200", False, f"Status {resp_kpis.status_code}")
            return
        
        kpis_before = resp_kpis.json()
        print(f"  KPIs before test vehicle: {kpis_before}")
        
        # Get all vehicles to verify total_vehiculos
        resp_vehiculos = await client.get(f"{API_BASE}/vehiculos", headers=lima_headers)
        if resp_vehiculos.status_code != 200:
            log_test("GET /api/vehiculos returns 200", False, f"Status {resp_vehiculos.status_code}")
            return
        log_test("GET /api/vehiculos returns 200", True)
        
        vehiculos = resp_vehiculos.json()
        actual_count = len(vehiculos)
        
        # Verify total_vehiculos matches
        if kpis_before["total_vehiculos"] == actual_count:
            log_test("total_vehiculos matches GET /api/vehiculos count", True, f"Both = {actual_count}")
        else:
            log_test("total_vehiculos matches GET /api/vehiculos count", False, f"KPI={kpis_before['total_vehiculos']}, Actual={actual_count}")
        
        # Count vehicles in TALLER state
        en_taller_actual = sum(1 for v in vehiculos if (v.get("estado") or "").strip().upper() == "TALLER")
        if kpis_before["en_taller"] == en_taller_actual:
            log_test("en_taller count matches actual", True, f"Both = {en_taller_actual}")
        else:
            log_test("en_taller count matches actual", False, f"KPI={kpis_before['en_taller']}, Actual={en_taller_actual}")
        
        # Count vehicles without GPS
        sin_gps_actual = sum(1 for v in vehiculos if not (v.get("gps") or v.get("device_gps") or v.get("imei")))
        if kpis_before["sin_gps"] == sin_gps_actual:
            log_test("sin_gps count matches actual", True, f"Both = {sin_gps_actual}")
        else:
            log_test("sin_gps count matches actual", False, f"KPI={kpis_before['sin_gps']}, Actual={sin_gps_actual}")
        
        # Create test vehicle with estado=TALLER
        print("\n🚗 Creating test vehicle with estado=TALLER...")
        test_vehiculo = {
            "placa": "TEST-01",
            "marca": "Test",
            "modelo": "X",
            "año": 2020,
            "estado": "TALLER",
            "empresa": "TRANSPORTES LIMA SAC"
        }
        
        resp_create = await client.post(
            f"{API_BASE}/vehiculos",
            headers=lima_headers,
            json=test_vehiculo
        )
        
        if resp_create.status_code != 200:
            log_test("Create test vehicle", False, f"Status {resp_create.status_code}: {resp_create.text[:200]}")
            return
        
        created_vehiculo = resp_create.json()
        vehiculo_id = created_vehiculo.get("id")
        log_test("Create test vehicle", True, f"id={vehiculo_id}")
        
        # Get KPIs again
        resp_kpis_after = await client.get(f"{API_BASE}/vehiculos/kpis", headers=lima_headers)
        if resp_kpis_after.status_code != 200:
            log_test("GET /api/vehiculos/kpis after create returns 200", False, f"Status {resp_kpis_after.status_code}")
            return
        
        kpis_after = resp_kpis_after.json()
        print(f"  KPIs after test vehicle: {kpis_after}")
        
        # Verify en_taller incremented by 1
        if kpis_after["en_taller"] == kpis_before["en_taller"] + 1:
            log_test("en_taller incremented by 1", True, f"Before={kpis_before['en_taller']}, After={kpis_after['en_taller']}")
        else:
            log_test("en_taller incremented by 1", False, f"Before={kpis_before['en_taller']}, After={kpis_after['en_taller']}")
        
        # Verify total_vehiculos incremented by 1
        if kpis_after["total_vehiculos"] == kpis_before["total_vehiculos"] + 1:
            log_test("total_vehiculos incremented by 1", True, f"Before={kpis_before['total_vehiculos']}, After={kpis_after['total_vehiculos']}")
        else:
            log_test("total_vehiculos incremented by 1", False, f"Before={kpis_before['total_vehiculos']}, After={kpis_after['total_vehiculos']}")
        
        # Verify sin_gps incremented by 1 (test vehicle has no GPS)
        if kpis_after["sin_gps"] == kpis_before["sin_gps"] + 1:
            log_test("sin_gps incremented by 1 (no GPS field)", True, f"Before={kpis_before['sin_gps']}, After={kpis_after['sin_gps']}")
        else:
            log_test("sin_gps incremented by 1 (no GPS field)", False, f"Before={kpis_before['sin_gps']}, After={kpis_after['sin_gps']}")
        
        # Clean up - delete test vehicle
        print("\n🗑️  Deleting test vehicle...")
        resp_delete = await client.delete(f"{API_BASE}/vehiculos/{vehiculo_id}", headers=lima_headers)
        if resp_delete.status_code == 200:
            log_test("Delete test vehicle", True)
        else:
            log_test("Delete test vehicle", False, f"Status {resp_delete.status_code}")
        
        # Verify KPIs returned to original values
        resp_kpis_final = await client.get(f"{API_BASE}/vehiculos/kpis", headers=lima_headers)
        if resp_kpis_final.status_code == 200:
            kpis_final = resp_kpis_final.json()
            if kpis_final["en_taller"] == kpis_before["en_taller"]:
                log_test("en_taller returned to original value after delete", True)
            else:
                log_test("en_taller returned to original value after delete", False, f"Expected={kpis_before['en_taller']}, Got={kpis_final['en_taller']}")

async def test_3_cargas_invalidas():
    """TEST 3: Verify cargas inválidas detection (optional)"""
    print("\n" + "="*80)
    print("TEST 3: GET /api/vehiculos/kpis — Cargas Inválidas (Optional)")
    print("="*80)
    
    lima_token = await login(LIMA_EMAIL, LIMA_PASSWORD)
    lima_headers = {"Authorization": f"Bearer {lima_token}"}
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Get KPIs before
        resp_kpis_before = await client.get(f"{API_BASE}/vehiculos/kpis", headers=lima_headers)
        if resp_kpis_before.status_code != 200:
            log_test("GET /api/vehiculos/kpis returns 200", False, f"Status {resp_kpis_before.status_code}")
            return
        
        kpis_before = resp_kpis_before.json()
        print(f"  vehiculos_con_cargas_invalidas before: {kpis_before['vehiculos_con_cargas_invalidas']}")
        
        # Note: We would need direct MongoDB access to insert a test consumption
        # For now, just verify the field exists and is an integer
        if isinstance(kpis_before["vehiculos_con_cargas_invalidas"], int):
            log_test("vehiculos_con_cargas_invalidas is integer", True, f"Value={kpis_before['vehiculos_con_cargas_invalidas']}")
        else:
            log_test("vehiculos_con_cargas_invalidas is integer", False, f"Type={type(kpis_before['vehiculos_con_cargas_invalidas'])}")
        
        print("  ℹ️  Note: Full cargas inválidas test requires direct MongoDB access to insert test consumption")

async def test_4_docs_vencidos():
    """TEST 4: Verify docs vencidos detection (optional)"""
    print("\n" + "="*80)
    print("TEST 4: GET /api/vehiculos/kpis — Docs Vencidos (Optional)")
    print("="*80)
    
    lima_token = await login(LIMA_EMAIL, LIMA_PASSWORD)
    lima_headers = {"Authorization": f"Bearer {lima_token}"}
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Get KPIs before
        resp_kpis_before = await client.get(f"{API_BASE}/vehiculos/kpis", headers=lima_headers)
        if resp_kpis_before.status_code != 200:
            log_test("GET /api/vehiculos/kpis returns 200", False, f"Status {resp_kpis_before.status_code}")
            return
        
        kpis_before = resp_kpis_before.json()
        print(f"  docs_vehiculo_vencidos before: {kpis_before['docs_vehiculo_vencidos']}")
        print(f"  docs_chofer_vencidos before: {kpis_before['docs_chofer_vencidos']}")
        
        # Verify fields exist and are integers
        if isinstance(kpis_before["docs_vehiculo_vencidos"], int):
            log_test("docs_vehiculo_vencidos is integer", True, f"Value={kpis_before['docs_vehiculo_vencidos']}")
        else:
            log_test("docs_vehiculo_vencidos is integer", False, f"Type={type(kpis_before['docs_vehiculo_vencidos'])}")
        
        if isinstance(kpis_before["docs_chofer_vencidos"], int):
            log_test("docs_chofer_vencidos is integer", True, f"Value={kpis_before['docs_chofer_vencidos']}")
        else:
            log_test("docs_chofer_vencidos is integer", False, f"Type={type(kpis_before['docs_chofer_vencidos'])}")
        
        print("  ℹ️  Note: Full docs vencidos test requires direct MongoDB access to insert test documents")

async def test_5_regression():
    """TEST 5: Regression tests"""
    print("\n" + "="*80)
    print("TEST 5: Regression — Verify other endpoints still work")
    print("="*80)
    
    lima_token = await login(LIMA_EMAIL, LIMA_PASSWORD)
    lima_headers = {"Authorization": f"Bearer {lima_token}"}
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Test GET /api/vehiculos still works
        print("\n🚗 Testing GET /api/vehiculos...")
        resp_vehiculos = await client.get(f"{API_BASE}/vehiculos", headers=lima_headers)
        if resp_vehiculos.status_code == 200:
            log_test("GET /api/vehiculos still works", True)
        else:
            log_test("GET /api/vehiculos still works", False, f"Status {resp_vehiculos.status_code}")
        
        # Test GET /api/vehiculos/{id} with non-existent id
        # Note: There's no GET endpoint for individual vehicles, only PUT and DELETE
        # So we expect 405 (Method Not Allowed) rather than 404
        print("\n🔍 Testing GET /api/vehiculos/{non_existent_id} (no GET endpoint exists)...")
        resp_not_found = await client.get(f"{API_BASE}/vehiculos/non-existent-id-12345", headers=lima_headers)
        if resp_not_found.status_code == 405:
            log_test("GET /api/vehiculos/{id} returns 405 (no GET endpoint)", True, "Expected - only PUT/DELETE exist for individual vehicles")
        else:
            log_test("GET /api/vehiculos/{id} returns 405 (no GET endpoint)", False, f"Status {resp_not_found.status_code}")
        
        # Verify "kpis" is not matched as vehiculo_id
        print("\n🔍 Testing that /api/vehiculos/kpis is NOT matched as vehiculo_id...")
        resp_kpis = await client.get(f"{API_BASE}/vehiculos/kpis", headers=lima_headers)
        if resp_kpis.status_code == 200:
            data = resp_kpis.json()
            # Should return KPI object, not a vehicle object
            if "total_vehiculos" in data:
                log_test("/api/vehiculos/kpis returns KPI object (not vehicle)", True)
            else:
                log_test("/api/vehiculos/kpis returns KPI object (not vehicle)", False, f"Got: {list(data.keys())[:5]}")
        else:
            log_test("/api/vehiculos/kpis accessible", False, f"Status {resp_kpis.status_code}")
        
        # Test GET /api/health
        print("\n🏥 Testing GET /api/health...")
        resp_health = await client.get(f"{API_BASE}/health")
        if resp_health.status_code == 200:
            log_test("GET /api/health returns 200", True)
        else:
            log_test("GET /api/health returns 200", False, f"Status {resp_health.status_code}")

async def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("BACKEND TESTING: GET /api/vehiculos/kpis")
    print("="*80)
    print(f"Backend URL: {BACKEND_URL}")
    print(f"API Base: {API_BASE}")
    
    try:
        await test_1_structure_and_auth()
        await test_2_calculations()
        await test_3_cargas_invalidas()
        await test_4_docs_vencidos()
        await test_5_regression()
    except Exception as e:
        print(f"\n❌ FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    passed = sum(1 for t in test_results if t["passed"])
    total = len(test_results)
    print(f"Passed: {passed}/{total}")
    
    if passed == total:
        print("\n✅ ALL TESTS PASSED")
        return 0
    else:
        print("\n❌ SOME TESTS FAILED")
        failed = [t for t in test_results if not t["passed"]]
        print("\nFailed tests:")
        for t in failed:
            print(f"  - {t['name']}")
            if t['details']:
                print(f"    {t['details']}")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
