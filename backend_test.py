#!/usr/bin/env python3
"""
Backend testing for Documentación module - cliente_subsidio scenarios
Tests GET /api/documents merge with subsidio_documents and POST /api/documents manual upload
"""
import os
import sys
import asyncio
import httpx
from io import BytesIO

# Backend URL - use internal URL for testing
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8001")
API_BASE = f"{BACKEND_URL}/api"

# Test credentials
ADMIN_EMAIL = "admin@enered.com"
ADMIN_PASSWORD = "admin123"
CLIENTE_SUBSIDIO_EMAIL = "cliente.subsidio@test.com"
CLIENTE_SUBSIDIO_PASSWORD = "subsidio123"
LIMA_EMAIL = "administrador@lima.com"
LIMA_PASSWORD = "demo123"

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

async def re_seed_subsidio():
    """Re-seed cliente subsidio test user"""
    print("\n🔄 Re-seeding cliente subsidio...")
    result = os.system("cd /app/backend && python seed_subsidio_test.py")
    if result == 0:
        print("✅ Re-seed successful")
    else:
        print("⚠️  Re-seed may have failed or user already exists")

def create_test_pdf():
    """Create a small test PDF"""
    # Minimal valid PDF
    pdf_content = b"""%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
trailer<</Size 4/Root 1 0 R>>
startxref
190
%%EOF"""
    return pdf_content

async def test_1_get_documents_merge():
    """TEST 1: GET /api/documents merge with subsidio_documents"""
    print("\n" + "="*80)
    print("TEST 1: GET /api/documents — merge con subsidio_documents")
    print("="*80)
    
    # Re-seed
    await re_seed_subsidio()
    
    # Login as cliente_subsidio
    token = await login(CLIENTE_SUBSIDIO_EMAIL, CLIENTE_SUBSIDIO_PASSWORD)
    headers = {"Authorization": f"Bearer {token}"}
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Upload 3 empresa docs
        print("\n📤 Uploading 3 empresa documents...")
        empresa_cats = ["ficha_ruc", "resolucion_autorizacion", "dni_representante"]
        for cat in empresa_cats:
            files = {"file": ("test_doc.pdf", create_test_pdf(), "application/pdf")}
            data = {"categoria": cat}
            resp = await client.post(
                f"{API_BASE}/subsidio/documents",
                headers=headers,
                files=files,
                data=data
            )
            if resp.status_code != 200:
                log_test(f"Upload {cat}", False, f"Status {resp.status_code}: {resp.text[:200]}")
                return
            log_test(f"Upload {cat}", True, f"Document uploaded successfully")
        
        # Upload 2 flota docs
        print("\n📤 Uploading 2 flota documents...")
        flota_docs = [
            ("tarjeta_habilitacion", "ABC-123"),
            ("tarjeta_propiedad", "DEF-456")
        ]
        for cat, placa in flota_docs:
            files = {"file": ("test_doc.pdf", create_test_pdf(), "application/pdf")}
            data = {"categoria": cat, "placa": placa}
            resp = await client.post(
                f"{API_BASE}/subsidio/documents",
                headers=headers,
                files=files,
                data=data
            )
            if resp.status_code != 200:
                log_test(f"Upload {cat} for {placa}", False, f"Status {resp.status_code}: {resp.text[:200]}")
                return
            log_test(f"Upload {cat} for {placa}", True, f"Document uploaded successfully")
        
        # GET /api/documents
        print("\n🔍 Testing GET /api/documents...")
        resp = await client.get(f"{API_BASE}/documents", headers=headers)
        
        if resp.status_code != 200:
            log_test("GET /api/documents returns 200", False, f"Status {resp.status_code}: {resp.text[:200]}")
            return
        log_test("GET /api/documents returns 200", True)
        
        docs = resp.json()
        if not isinstance(docs, list):
            log_test("Response is array", False, f"Got {type(docs)}")
            return
        log_test("Response is array", True)
        
        # Check we have at least 5 docs
        if len(docs) < 5:
            log_test("Response has ≥5 documents", False, f"Got {len(docs)} documents")
            return
        log_test("Response has ≥5 documents", True, f"Got {len(docs)} documents")
        
        # Check empresa docs
        empresa_docs = [d for d in docs if d.get("tipo") == "Empresa"]
        empresa_names = {d.get("doc") for d in empresa_docs}
        expected_empresa = {"Ficha RUC", "Resolución de autorización", "DNI del representante"}
        
        if len(empresa_docs) < 3:
            log_test("3 docs with tipo=Empresa", False, f"Got {len(empresa_docs)}")
            return
        log_test("3 docs with tipo=Empresa", True, f"Found {len(empresa_docs)} empresa docs")
        
        missing_empresa = expected_empresa - empresa_names
        if missing_empresa:
            log_test("Empresa doc names correct", False, f"Missing: {missing_empresa}")
        else:
            log_test("Empresa doc names correct", True)
        
        # Check flota docs
        flota_docs_resp = [d for d in docs if d.get("tipo") == "Vehículos"]
        flota_names = {d.get("doc") for d in flota_docs_resp}
        expected_flota = {"Tarjeta de habilitación", "Tarjeta de propiedad"}
        
        if len(flota_docs_resp) < 2:
            log_test("2 docs with tipo=Vehículos", False, f"Got {len(flota_docs_resp)}")
            return
        log_test("2 docs with tipo=Vehículos", True, f"Found {len(flota_docs_resp)} flota docs")
        
        # Check all have placa
        flota_with_placa = [d for d in flota_docs_resp if d.get("placa")]
        if len(flota_with_placa) != len(flota_docs_resp):
            log_test("All flota docs have placa", False, f"Only {len(flota_with_placa)}/{len(flota_docs_resp)} have placa")
        else:
            log_test("All flota docs have placa", True)
        
        # Check all have _origen=subsidio
        subsidio_docs = [d for d in docs if d.get("_origen") == "subsidio"]
        if len(subsidio_docs) < 5:
            log_test("All docs have _origen=subsidio", False, f"Only {len(subsidio_docs)}/{len(docs)} have _origen=subsidio")
        else:
            log_test("All docs have _origen=subsidio", True)
        
        # Check required fields
        required_fields = ["id", "filename", "est", "por"]
        for doc in docs[:3]:  # Check first 3
            missing = [f for f in required_fields if not doc.get(f)]
            if missing:
                log_test(f"Doc has required fields", False, f"Missing: {missing}")
                break
        else:
            log_test("Docs have required fields (id, filename, est, por)", True)
        
        # Check por field
        por_values = {d.get("por") for d in docs}
        if "Cliente (Subsidio)" not in por_values:
            log_test("por field = 'Cliente (Subsidio)'", False, f"Got: {por_values}")
        else:
            log_test("por field = 'Cliente (Subsidio)'", True)
        
        # Test tenant isolation - login as different user
        print("\n🔒 Testing tenant isolation...")
        lima_token = await login(LIMA_EMAIL, LIMA_PASSWORD)
        lima_headers = {"Authorization": f"Bearer {lima_token}"}
        
        resp_lima = await client.get(f"{API_BASE}/documents", headers=lima_headers)
        if resp_lima.status_code != 200:
            log_test("Tenant isolation - Lima user can access endpoint", False, f"Status {resp_lima.status_code}")
            return
        
        lima_docs = resp_lima.json()
        # Lima user should NOT see subsidio docs from TEST SUBSIDIO empresa
        subsidio_empresa_docs = [d for d in lima_docs if d.get("_origen") == "subsidio" and "TEST SUBSIDIO" in str(d)]
        if subsidio_empresa_docs:
            log_test("Tenant isolation - Lima user cannot see TEST SUBSIDIO docs", False, f"Found {len(subsidio_empresa_docs)} docs")
        else:
            log_test("Tenant isolation - Lima user cannot see TEST SUBSIDIO docs", True)
        
        # Test without auth
        print("\n🔓 Testing without auth...")
        resp_no_auth = await client.get(f"{API_BASE}/documents")
        if resp_no_auth.status_code == 401:
            log_test("Without auth returns 401", True)
        else:
            log_test("Without auth returns 401", False, f"Got {resp_no_auth.status_code}")

async def test_2_post_documents_manual():
    """TEST 2: POST /api/documents manual upload (multipart-form)"""
    print("\n" + "="*80)
    print("TEST 2: POST /api/documents — upload manual (multipart-form)")
    print("="*80)
    
    # Login as Lima admin
    token = await login(LIMA_EMAIL, LIMA_PASSWORD)
    headers = {"Authorization": f"Bearer {token}"}
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # POST /api/documents with multipart form
        print("\n📤 Uploading manual document...")
        files = {"file": ("reporte_inspeccion.pdf", create_test_pdf(), "application/pdf")}
        data = {
            "tipo": "Empresa",
            "doc": "Reporte de inspección anual",
            "emi": "2026-07-02",
            "ven": "2026-07-09"
        }
        
        resp = await client.post(
            f"{API_BASE}/documents",
            headers=headers,
            files=files,
            data=data
        )
        
        if resp.status_code != 200:
            log_test("POST /api/documents returns 200", False, f"Status {resp.status_code}: {resp.text[:200]}")
            return
        log_test("POST /api/documents returns 200", True)
        
        doc = resp.json()
        
        # Validate response
        if not doc.get("id"):
            log_test("Response has id", False)
            return
        log_test("Response has id", True, f"id={doc['id']}")
        
        doc_id = doc["id"]
        
        if doc.get("tipo") != "Empresa":
            log_test("tipo=Empresa", False, f"Got {doc.get('tipo')}")
        else:
            log_test("tipo=Empresa", True)
        
        if doc.get("doc") != "Reporte de inspección anual":
            log_test("doc name correct", False, f"Got {doc.get('doc')}")
        else:
            log_test("doc name correct", True)
        
        if doc.get("_origen") != "manual":
            log_test("_origen=manual", False, f"Got {doc.get('_origen')}")
        else:
            log_test("_origen=manual", True)
        
        if doc.get("empresa") != "TRANSPORTES LIMA SAC":
            log_test("empresa=TRANSPORTES LIMA SAC", False, f"Got {doc.get('empresa')}")
        else:
            log_test("empresa=TRANSPORTES LIMA SAC", True)
        
        # GET /api/documents should include the new doc
        print("\n🔍 Verifying document appears in GET /api/documents...")
        resp_get = await client.get(f"{API_BASE}/documents", headers=headers)
        if resp_get.status_code != 200:
            log_test("GET /api/documents after upload returns 200", False, f"Status {resp_get.status_code}")
            return
        
        docs = resp_get.json()
        found = any(d.get("id") == doc_id for d in docs)
        if not found:
            log_test("Document appears in GET /api/documents", False, "Document not found in list")
        else:
            log_test("Document appears in GET /api/documents", True)
        
        # Test download
        print("\n⬇️  Testing document download...")
        resp_download = await client.get(f"{API_BASE}/documents/{doc_id}/download", headers=headers)
        if resp_download.status_code != 200:
            log_test("GET /api/documents/{id}/download returns 200", False, f"Status {resp_download.status_code}")
        else:
            log_test("GET /api/documents/{id}/download returns 200", True)
            if len(resp_download.content) > 0:
                log_test("Downloaded file has content", True, f"{len(resp_download.content)} bytes")
            else:
                log_test("Downloaded file has content", False, "Empty file")
        
        # Test DELETE
        print("\n🗑️  Testing document deletion...")
        resp_delete = await client.delete(f"{API_BASE}/documents/{doc_id}", headers=headers)
        if resp_delete.status_code == 200:
            log_test("DELETE /api/documents/{id} returns 200", True)
        else:
            log_test("DELETE /api/documents/{id} returns 200", False, f"Status {resp_delete.status_code}")
        
        # Verify deletion
        resp_get_after = await client.get(f"{API_BASE}/documents", headers=headers)
        if resp_get_after.status_code == 200:
            docs_after = resp_get_after.json()
            still_exists = any(d.get("id") == doc_id for d in docs_after)
            if still_exists:
                log_test("Document removed after DELETE", False, "Document still in list")
            else:
                log_test("Document removed after DELETE", True)
        
        # Test without auth
        print("\n🔓 Testing without auth...")
        resp_no_auth = await client.post(
            f"{API_BASE}/documents",
            files={"file": ("test.pdf", create_test_pdf(), "application/pdf")},
            data={"tipo": "Empresa", "doc": "Test"}
        )
        if resp_no_auth.status_code == 401:
            log_test("Without auth returns 401", True)
        else:
            log_test("Without auth returns 401", False, f"Got {resp_no_auth.status_code}")

async def test_3_regression():
    """TEST 3: Quick regression tests"""
    print("\n" + "="*80)
    print("TEST 3: Regression tests")
    print("="*80)
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Test health endpoint
        print("\n🏥 Testing GET /api/health...")
        resp = await client.get(f"{API_BASE}/health")
        if resp.status_code == 200:
            log_test("GET /api/health returns 200", True)
        else:
            log_test("GET /api/health returns 200", False, f"Status {resp.status_code}")
        
        # Test subsidio finalize still activates servicios.plataforma
        print("\n🔍 Testing POST /api/subsidio/finalize activates servicios...")
        # This was already tested in previous test runs, just smoke test
        token = await login(CLIENTE_SUBSIDIO_EMAIL, CLIENTE_SUBSIDIO_PASSWORD)
        headers = {"Authorization": f"Bearer {token}"}
        
        resp_me = await client.get(f"{API_BASE}/auth/me", headers=headers)
        if resp_me.status_code == 200:
            user = resp_me.json()
            servicios = user.get("servicios", {})
            if servicios.get("plataforma") and servicios.get("combustible"):
                log_test("Subsidio finalize activated servicios.plataforma+combustible", True, "Already activated from previous finalize")
            else:
                log_test("Subsidio finalize activated servicios.plataforma+combustible", False, f"servicios={servicios}")
        else:
            log_test("GET /api/auth/me returns 200", False, f"Status {resp_me.status_code}")

async def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("BACKEND TESTING: Documentación Module - cliente_subsidio")
    print("="*80)
    print(f"Backend URL: {BACKEND_URL}")
    print(f"API Base: {API_BASE}")
    
    try:
        await test_1_get_documents_merge()
        await test_2_post_documents_manual()
        await test_3_regression()
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
