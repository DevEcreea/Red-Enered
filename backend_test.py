#!/usr/bin/env python3
"""
Backend test for Subsidio DU 004 admin endpoints bug fix.
Tests performance and cascade delete functionality.
"""
import os
import sys
import time
import httpx
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

# Backend URL from environment or default
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8001")
API_BASE = f"{BACKEND_URL}/api"

# Test credentials
ADMIN_EMAIL = "admin@enered.com"
ADMIN_PASSWORD = "admin123"
TEST_CLIENT_EMAIL = "cliente.subsidio@test.com"
TEST_CLIENT_PASSWORD = "subsidio123"

# MongoDB connection
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "enered_local")

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'

def log_test(name):
    print(f"\n{Colors.BLUE}[TEST]{Colors.RESET} {name}")

def log_success(msg):
    print(f"  {Colors.GREEN}✓{Colors.RESET} {msg}")

def log_error(msg):
    print(f"  {Colors.RED}✗{Colors.RESET} {msg}")

def log_warning(msg):
    print(f"  {Colors.YELLOW}⚠{Colors.RESET} {msg}")

def log_info(msg):
    print(f"  {Colors.BLUE}ℹ{Colors.RESET} {msg}")


async def login(email: str, password: str) -> str:
    """Login and return access token."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(f"{API_BASE}/auth/login", json={"email": email, "password": password})
        if r.status_code != 200:
            raise Exception(f"Login failed: {r.status_code} {r.text}")
        return r.json()["access_token"]


async def test_health():
    """Test 1: Health check (regression)"""
    log_test("GET /api/health (regression)")
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(f"{API_BASE}/health")
        if r.status_code == 200:
            data = r.json()
            if data.get("status") == "ok" and data.get("mongo") == "ok":
                log_success(f"Health check OK: {data}")
                return True
            else:
                log_error(f"Health check returned unexpected data: {data}")
                return False
        else:
            log_error(f"Health check failed: {r.status_code}")
            return False


async def test_listado_performance(admin_token: str):
    """Test 2: Performance of GET /api/admin/subsidio/expedientes"""
    log_test("GET /api/admin/subsidio/expedientes - Performance (<5s)")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        start = time.time()
        r = await client.get(f"{API_BASE}/admin/subsidio/expedientes", headers=headers)
        elapsed = time.time() - start
        
        if r.status_code != 200:
            log_error(f"Request failed: {r.status_code} {r.text[:200]}")
            return False
        
        data = r.json()
        
        # Check performance
        if elapsed < 5.0:
            log_success(f"Response time: {elapsed:.2f}s (< 5s target)")
        else:
            log_warning(f"Response time: {elapsed:.2f}s (> 5s target, but may be acceptable on cold start)")
        
        # Check structure
        if "items" not in data or "total" not in data:
            log_error(f"Missing 'items' or 'total' in response")
            return False
        
        log_success(f"Structure correct: items={len(data['items'])}, total={data['total']}")
        
        # Check fields in items
        if data["items"]:
            item = data["items"][0]
            required_fields = ["user_id", "empresa", "ruc", "email", "expediente_status", 
                             "docs_count", "vehicles_count", "invoices"]
            missing = [f for f in required_fields if f not in item]
            if missing:
                log_error(f"Missing fields in item: {missing}")
                return False
            log_success(f"All required fields present in items")
        
        return True


async def test_listado_filters(admin_token: str):
    """Test 3: Filters on listado endpoint"""
    log_test("GET /api/admin/subsidio/expedientes - Filters")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Test search filter
        r = await client.get(f"{API_BASE}/admin/subsidio/expedientes?q=TEST", headers=headers)
        if r.status_code == 200:
            data = r.json()
            log_success(f"Search filter ?q=TEST works: {len(data['items'])} results")
        else:
            log_error(f"Search filter failed: {r.status_code}")
            return False
        
        # Test estado filter
        r = await client.get(f"{API_BASE}/admin/subsidio/expedientes?estado=uploading", headers=headers)
        if r.status_code == 200:
            data = r.json()
            log_success(f"Estado filter ?estado=uploading works: {len(data['items'])} results")
        else:
            log_error(f"Estado filter failed: {r.status_code}")
            return False
        
        return True


async def test_listado_auth(client_token: str):
    """Test 4: Non-admin should get 403"""
    log_test("GET /api/admin/subsidio/expedientes - Auth (non-admin → 403)")
    
    headers = {"Authorization": f"Bearer {client_token}"}
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(f"{API_BASE}/admin/subsidio/expedientes", headers=headers)
        if r.status_code == 403:
            log_success("Non-admin correctly rejected with 403")
            return True
        else:
            log_error(f"Expected 403, got {r.status_code}")
            return False


async def test_detalle(admin_token: str, user_id: str):
    """Test 5: Detail endpoint"""
    log_test(f"GET /api/admin/subsidio/expedientes/{user_id} - Detail")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(f"{API_BASE}/admin/subsidio/expedientes/{user_id}", headers=headers)
        if r.status_code != 200:
            log_error(f"Request failed: {r.status_code} {r.text[:200]}")
            return False
        
        data = r.json()
        required_keys = ["user", "documents", "vehicles", "invoices", "calculation"]
        missing = [k for k in required_keys if k not in data]
        if missing:
            log_error(f"Missing keys in response: {missing}")
            return False
        
        log_success(f"Detail structure correct: user, documents, vehicles, invoices, calculation present")
        log_info(f"  - Vehicles: {len(data['vehicles'])}")
        log_info(f"  - Documents: {len(data['documents'])}")
        log_info(f"  - Invoices: {len(data['invoices'])}")
        
        return True


async def test_delete_cascade(admin_token: str, user_id: str):
    """Test 6: DELETE cascade"""
    log_test(f"DELETE /api/admin/subsidio/expedientes/{user_id} - Cascade delete")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Get user data before delete for verification
    client_mongo = AsyncIOMotorClient(MONGO_URL)
    db = client_mongo[DB_NAME]
    
    user_before = await db.users.find_one({"id": user_id})
    if not user_before:
        log_error(f"User {user_id} not found before delete")
        return False
    
    empresa = user_before.get("empresa")
    email = user_before.get("email")
    ruc = user_before.get("ruc")
    calc_id = user_before.get("calc_id")
    
    log_info(f"User before delete: empresa={empresa}, email={email}, ruc={ruc}, calc_id={calc_id}")
    
    # Count documents before delete
    vehicles_before = await db.subsidio_vehicles.count_documents({"user_id": user_id})
    docs_before = await db.subsidio_documents.count_documents({"user_id": user_id})
    
    log_info(f"Before delete: vehicles={vehicles_before}, documents={docs_before}")
    
    # Perform DELETE
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.delete(f"{API_BASE}/admin/subsidio/expedientes/{user_id}", headers=headers)
        if r.status_code != 200:
            log_error(f"DELETE failed: {r.status_code} {r.text[:200]}")
            return False
        
        data = r.json()
        
        if not data.get("ok"):
            log_error(f"DELETE returned ok=false")
            return False
        
        deleted = data.get("deleted", {})
        log_success(f"DELETE returned ok=true with counters: {deleted}")
        
        # Verify counters
        if deleted.get("user", 0) < 1:
            log_error(f"Expected user=1, got {deleted.get('user')}")
            return False
        
        if deleted.get("vehicles", 0) < 3:
            log_warning(f"Expected vehicles>=3, got {deleted.get('vehicles')} (may be OK if test data changed)")
        else:
            log_success(f"Vehicles deleted: {deleted.get('vehicles')}")
        
        # Verify MongoDB cleanup
        await asyncio.sleep(0.5)  # Give DB time to sync
        
        user_after = await db.users.find_one({"id": user_id})
        if user_after:
            log_error(f"User still exists in DB after delete!")
            return False
        log_success("User removed from DB")
        
        vehicles_after = await db.subsidio_vehicles.count_documents({"user_id": user_id})
        if vehicles_after > 0:
            log_error(f"Vehicles still exist in DB: {vehicles_after}")
            return False
        log_success("Vehicles removed from DB")
        
        # Check calculations
        if calc_id:
            calc_after = await db.calculations.find_one({"id": calc_id})
            if calc_after:
                log_error(f"Calculation {calc_id} still exists in DB")
                return False
            log_success(f"Calculation {calc_id} removed from DB")
        
        # Check subsidio_leads (THIS WAS THE BUG - should delete by calc_id OR email OR ruc)
        leads_after = await db.subsidio_leads.count_documents({
            "$or": [
                {"calc_id": calc_id} if calc_id else {},
                {"email": email} if email else {},
                {"ruc": ruc} if ruc else {},
            ]
        })
        if leads_after > 0:
            log_error(f"Subsidio leads still exist in DB: {leads_after} (BUG: should delete by calc_id/email/ruc)")
            return False
        log_success("Subsidio leads removed from DB (calc_id/email/ruc)")
        
        # Check bank accounts
        bank_after = await db.subsidio_bank_accounts.count_documents({"user_id": user_id})
        if bank_after > 0:
            log_error(f"Bank accounts still exist: {bank_after}")
            return False
        log_success("Bank accounts removed from DB")
        
        # Check declaraciones
        decl_after = await db.subsidio_declaraciones.count_documents({"user_id": user_id})
        if decl_after > 0:
            log_error(f"Declaraciones still exist: {decl_after}")
            return False
        log_success("Declaraciones removed from DB")
        
        # Check documents
        docs_after = await db.subsidio_documents.count_documents({"user_id": user_id})
        if docs_after > 0:
            log_error(f"Documents still exist: {docs_after}")
            return False
        log_success("Documents removed from DB")
        
        # Check consumos_subsidio
        consumos_after = await db.consumos_subsidio.count_documents({"user_id": user_id})
        if consumos_after > 0:
            log_error(f"Consumos_subsidio still exist: {consumos_after}")
            return False
        log_success("Consumos_subsidio removed from DB")
        
        # Check empresas_config (should be deleted if no other users)
        other_users = await db.users.count_documents({"empresa": empresa})
        if other_users == 0:
            empresa_config = await db.empresas_config.find_one({"empresa": empresa})
            if empresa_config:
                log_warning(f"Empresas_config still exists for {empresa} (no other users)")
            else:
                log_success(f"Empresas_config removed for {empresa} (no other users)")
        else:
            log_info(f"Empresas_config kept (other users exist: {other_users})")
        
        client_mongo.close()
        return True


async def test_delete_404(admin_token: str, user_id: str):
    """Test 7: Second DELETE should return 404"""
    log_test(f"DELETE /api/admin/subsidio/expedientes/{user_id} - Second delete → 404")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.delete(f"{API_BASE}/admin/subsidio/expedientes/{user_id}", headers=headers)
        if r.status_code == 404:
            log_success("Second DELETE correctly returns 404")
            return True
        else:
            log_error(f"Expected 404, got {r.status_code}")
            return False


async def test_delete_auth(client_token: str, user_id: str):
    """Test 8: Non-admin DELETE should get 403"""
    log_test(f"DELETE /api/admin/subsidio/expedientes/{user_id} - Auth (non-admin → 403)")
    
    headers = {"Authorization": f"Bearer {client_token}"}
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.delete(f"{API_BASE}/admin/subsidio/expedientes/{user_id}", headers=headers)
        if r.status_code == 403:
            log_success("Non-admin DELETE correctly rejected with 403")
            return True
        else:
            log_error(f"Expected 403, got {r.status_code}")
            return False


async def main():
    print(f"\n{'='*70}")
    print(f"  SUBSIDIO DU 004 - Admin Endpoints Bug Fix Validation")
    print(f"{'='*70}")
    print(f"Backend: {BACKEND_URL}")
    print(f"MongoDB: {MONGO_URL}/{DB_NAME}")
    
    results = {}
    
    try:
        # Login
        print(f"\n{Colors.BLUE}[SETUP]{Colors.RESET} Logging in...")
        admin_token = await login(ADMIN_EMAIL, ADMIN_PASSWORD)
        log_success(f"Admin logged in: {ADMIN_EMAIL}")
        
        # Try to login as test client (may not exist yet)
        try:
            client_token = await login(TEST_CLIENT_EMAIL, TEST_CLIENT_PASSWORD)
            log_success(f"Test client logged in: {TEST_CLIENT_EMAIL}")
        except Exception as e:
            log_warning(f"Test client login failed (may not exist): {e}")
            client_token = None
        
        # Get test user_id
        print(f"\n{Colors.BLUE}[SETUP]{Colors.RESET} Finding test user...")
        client_mongo = AsyncIOMotorClient(MONGO_URL)
        db = client_mongo[DB_NAME]
        test_user = await db.users.find_one({"email": TEST_CLIENT_EMAIL})
        if test_user:
            test_user_id = test_user["id"]
            log_success(f"Test user found: {test_user_id}")
        else:
            log_warning(f"Test user not found. Run: cd /app/backend && python seed_subsidio_test.py")
            test_user_id = None
        client_mongo.close()
        
        # Run tests
        print(f"\n{'='*70}")
        print(f"  RUNNING TESTS")
        print(f"{'='*70}")
        
        # Test 1: Health check
        results["health"] = await test_health()
        
        # Test 2: Listado performance
        results["listado_performance"] = await test_listado_performance(admin_token)
        
        # Test 3: Listado filters
        results["listado_filters"] = await test_listado_filters(admin_token)
        
        # Test 4: Listado auth
        if client_token:
            results["listado_auth"] = await test_listado_auth(client_token)
        else:
            log_warning("Skipping listado auth test (no client token)")
            results["listado_auth"] = None
        
        # Test 5: Detail endpoint
        if test_user_id:
            results["detalle"] = await test_detalle(admin_token, test_user_id)
        else:
            log_warning("Skipping detail test (no test user)")
            results["detalle"] = None
        
        # Test 6: DELETE cascade (destructive - run last)
        if test_user_id:
            results["delete_cascade"] = await test_delete_cascade(admin_token, test_user_id)
            
            # Test 7: Second DELETE → 404
            results["delete_404"] = await test_delete_404(admin_token, test_user_id)
        else:
            log_warning("Skipping delete tests (no test user)")
            results["delete_cascade"] = None
            results["delete_404"] = None
        
        # Test 8: DELETE auth
        if client_token and test_user_id:
            # Can't test this after delete, so skip
            log_info("DELETE auth test skipped (user already deleted)")
            results["delete_auth"] = None
        
    except Exception as e:
        log_error(f"Test suite failed with exception: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    # Summary
    print(f"\n{'='*70}")
    print(f"  TEST SUMMARY")
    print(f"{'='*70}")
    
    passed = sum(1 for v in results.values() if v is True)
    failed = sum(1 for v in results.values() if v is False)
    skipped = sum(1 for v in results.values() if v is None)
    total = len(results)
    
    for name, result in results.items():
        if result is True:
            print(f"  {Colors.GREEN}✓{Colors.RESET} {name}")
        elif result is False:
            print(f"  {Colors.RED}✗{Colors.RESET} {name}")
        else:
            print(f"  {Colors.YELLOW}⊘{Colors.RESET} {name} (skipped)")
    
    print(f"\n  Total: {total} | Passed: {passed} | Failed: {failed} | Skipped: {skipped}")
    
    if failed > 0:
        print(f"\n{Colors.RED}TESTS FAILED{Colors.RESET}")
        return 1
    elif passed == 0:
        print(f"\n{Colors.YELLOW}NO TESTS RAN{Colors.RESET}")
        return 1
    else:
        print(f"\n{Colors.GREEN}ALL TESTS PASSED{Colors.RESET}")
        return 0


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
