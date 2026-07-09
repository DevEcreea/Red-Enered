"""
ENERED Backend API Tests
Coverage:
- Auth (login, me, logout, forgot-password, forbidden credentials)
- Dashboard (kpis, alerts)
- Consumptions listing + tenant isolation
- Empresas
- Users CRUD (admin_enered only)
- Invoices (role-based access)
- Control requests (role-based access)
- Courses (LMS) + submit
- Admin CSV upload
"""

import io
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://credit-optimizer-23.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = ("admin@enered.com", "admin123")
ADMINISTRADOR = ("administrador@lima.com", "demo123")
LOGISTICA = ("logistica@lima.com", "demo123")
CONTABILIDAD = ("contabilidad@lima.com", "demo123")


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    return r


def _headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ----------- Fixtures -----------
@pytest.fixture(scope="session")
def admin_token():
    r = _login(*ADMIN)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def logistica_token():
    r = _login(*LOGISTICA)
    assert r.status_code == 200, f"Logistica login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def contabilidad_token():
    r = _login(*CONTABILIDAD)
    assert r.status_code == 200
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def administrador_token():
    r = _login(*ADMINISTRADOR)
    assert r.status_code == 200
    return r.json()["access_token"]


# ----------- Auth -----------
class TestAuth:
    def test_login_admin_returns_user_and_token(self):
        r = _login(*ADMIN)
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data and isinstance(data["access_token"], str)
        assert data["user"]["email"] == ADMIN[0]
        assert data["user"]["role"] == "admin_enered"

    def test_login_logistica_tenant_on_token(self):
        r = _login(*LOGISTICA)
        assert r.status_code == 200
        u = r.json()["user"]
        assert u["role"] == "logistica"
        assert u["empresa"] == "TRANSPORTES LIMA SAC"

    def test_login_invalid(self):
        r = _login("admin@enered.com", "wrongpass")
        assert r.status_code == 401

    def test_me_returns_user(self, admin_token):
        r = requests.get(f"{API}/auth/me", headers=_headers(admin_token), timeout=30)
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN[0]

    def test_me_unauthenticated(self):
        r = requests.get(f"{API}/auth/me", timeout=30)
        assert r.status_code == 401

    def test_logout(self, admin_token):
        r = requests.post(f"{API}/auth/logout", headers=_headers(admin_token), timeout=30)
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_forgot_password_generic_message(self):
        r = requests.post(f"{API}/auth/forgot-password",
                          json={"email": "nonexistent@example.com"}, timeout=30)
        assert r.status_code == 200
        assert "message" in r.json()


# ----------- Dashboard -----------
class TestDashboard:
    def test_kpis_structure_admin(self, admin_token):
        r = requests.get(f"{API}/dashboard/kpis", headers=_headers(admin_token), timeout=30)
        assert r.status_code == 200
        d = r.json()
        # Updated contract: top-level keys (totals, series_semana, top_placas_consumo, consumo_ciudad, consumo_estacion)
        for k in ["totals", "series_semana", "top_placas_consumo", "consumo_ciudad", "consumo_estacion"]:
            assert k in d, f"missing key {k}"
        for sk in ["total_gal", "total_gasto", "total_ahorro", "cargas"]:
            assert sk in d["totals"], f"missing totals.{sk}"
        assert isinstance(d["top_placas_consumo"], list)
        assert d["totals"]["cargas"] > 0

    def test_kpis_tenant_isolation_logistica(self, logistica_token, admin_token):
        r_log = requests.get(f"{API}/dashboard/kpis", headers=_headers(logistica_token), timeout=30)
        r_adm = requests.get(f"{API}/dashboard/kpis", headers=_headers(admin_token), timeout=30)
        assert r_log.status_code == 200 and r_adm.status_code == 200
        assert r_log.json()["totals"]["cargas"] <= r_adm.json()["totals"]["cargas"]
        assert r_log.json()["totals"]["cargas"] > 0

    def test_alerts_returns_list(self, admin_token):
        r = requests.get(f"{API}/dashboard/alerts", headers=_headers(admin_token), timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ----------- Consumptions -----------
class TestConsumptions:
    def test_list_admin_sees_all(self, admin_token):
        r = requests.get(f"{API}/consumptions", headers=_headers(admin_token), timeout=30)
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list) and len(rows) > 0
        empresas = {r_["EMPRESA"] for r_ in rows}
        assert len(empresas) >= 2  # admin sees multiple empresas

    def test_tenant_isolation_logistica(self, logistica_token):
        r = requests.get(f"{API}/consumptions", headers=_headers(logistica_token), timeout=30)
        assert r.status_code == 200
        rows = r.json()
        assert len(rows) > 0
        assert all(r_["EMPRESA"] == "TRANSPORTES LIMA SAC" for r_ in rows)

    def test_filters(self, admin_token):
        r = requests.get(f"{API}/consumptions?ciudad=LIMA",
                         headers=_headers(admin_token), timeout=30)
        assert r.status_code == 200
        rows = r.json()
        if rows:
            assert all(r_["CIUDAD"] == "LIMA" for r_ in rows)


# ----------- Empresas -----------
class TestEmpresas:
    def test_admin_sees_empresas(self, admin_token):
        r = requests.get(f"{API}/empresas", headers=_headers(admin_token), timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert "TRANSPORTES LIMA SAC" in data


# ----------- Users CRUD -----------
class TestUsersCRUD:
    def test_list_users_requires_admin(self, logistica_token):
        r = requests.get(f"{API}/users", headers=_headers(logistica_token), timeout=30)
        assert r.status_code == 403

    def test_create_update_delete_user(self, admin_token):
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        # CREATE
        create_r = requests.post(f"{API}/users",
                                 headers=_headers(admin_token),
                                 json={"email": email, "password": "testpass123",
                                       "name": "TEST User", "role": "logistica",
                                       "empresa": "TRANSPORTES LIMA SAC"},
                                 timeout=30)
        assert create_r.status_code == 200, create_r.text
        uid = create_r.json()["id"]
        assert create_r.json()["email"] == email

        # GET list contains user
        list_r = requests.get(f"{API}/users", headers=_headers(admin_token), timeout=30)
        assert list_r.status_code == 200
        assert any(u["id"] == uid for u in list_r.json())

        # UPDATE
        upd_r = requests.put(f"{API}/users/{uid}",
                             headers=_headers(admin_token),
                             json={"name": "TEST Updated"}, timeout=30)
        assert upd_r.status_code == 200
        assert upd_r.json()["name"] == "TEST Updated"

        # DELETE
        del_r = requests.delete(f"{API}/users/{uid}",
                                headers=_headers(admin_token), timeout=30)
        assert del_r.status_code == 200

        # Verify deletion
        list_r2 = requests.get(f"{API}/users", headers=_headers(admin_token), timeout=30)
        assert not any(u["id"] == uid for u in list_r2.json())


# ----------- Invoices -----------
class TestInvoices:
    def test_logistica_forbidden(self, logistica_token):
        r = requests.get(f"{API}/invoices", headers=_headers(logistica_token), timeout=30)
        assert r.status_code == 403

    def test_admin_list(self, admin_token):
        r = requests.get(f"{API}/invoices", headers=_headers(admin_token), timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_administrador_tenant_filter(self, administrador_token):
        r = requests.get(f"{API}/invoices", headers=_headers(administrador_token), timeout=30)
        assert r.status_code == 200
        rows = r.json()
        for inv in rows:
            assert inv["empresa"] == "TRANSPORTES LIMA SAC"

    def test_create_update_delete_invoice(self, admin_token):
        payload = {
            "empresa": "TRANSPORTES LIMA SAC",
            "numero": f"TEST-{uuid.uuid4().hex[:6]}",
            "fecha_emision": "2026-01-01",
            "fecha_vencimiento": "2026-01-30",
            "monto": 1234.56,
            "estado": "pendiente",
        }
        cr = requests.post(f"{API}/invoices", headers=_headers(admin_token),
                           json=payload, timeout=30)
        assert cr.status_code == 200, cr.text
        inv_id = cr.json()["id"]

        ur = requests.put(f"{API}/invoices/{inv_id}", headers=_headers(admin_token),
                          json={"estado": "pagada"}, timeout=30)
        assert ur.status_code == 200
        assert ur.json()["estado"] == "pagada"

        dr = requests.delete(f"{API}/invoices/{inv_id}",
                             headers=_headers(admin_token), timeout=30)
        assert dr.status_code == 200


# ----------- Control Requests -----------
class TestControlRequests:
    def test_contabilidad_forbidden(self, contabilidad_token):
        r = requests.get(f"{API}/control-requests",
                         headers=_headers(contabilidad_token), timeout=30)
        assert r.status_code == 403

    def test_logistica_can_list_and_create(self, logistica_token):
        lr = requests.get(f"{API}/control-requests",
                          headers=_headers(logistica_token), timeout=30)
        assert lr.status_code == 200
        cr = requests.post(f"{API}/control-requests",
                           headers=_headers(logistica_token),
                           json={"tipo": "tope_mensual_galones",
                                 "detalle": "TEST solicitud",
                                 "valor": "500"}, timeout=30)
        assert cr.status_code == 200, cr.text
        doc = cr.json()
        assert doc["empresa"] == "TRANSPORTES LIMA SAC"
        assert doc["estado"] == "pendiente"


# ----------- Courses -----------
class TestCourses:
    def test_list_courses(self, admin_token):
        r = requests.get(f"{API}/courses", headers=_headers(admin_token), timeout=30)
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_submit_course(self, logistica_token):
        r = requests.get(f"{API}/courses", headers=_headers(logistica_token), timeout=30)
        assert r.status_code == 200
        courses = r.json()
        assert len(courses) > 0
        cid = courses[0]["id"]
        preguntas = courses[0].get("preguntas", [])
        respuestas = [q.get("correcta", 0) for q in preguntas]
        sr = requests.post(f"{API}/courses/{cid}/submit",
                           headers=_headers(logistica_token),
                           json={"respuestas": respuestas}, timeout=30)
        assert sr.status_code == 200, sr.text
        result = sr.json()
        assert result["puntaje"] == 100.0
        assert result["aprobado"] is True


# ----------- CSV Upload -----------
class TestUpload:
    def test_upload_csv_inserts(self, admin_token):
        csv_content = (
            "FECHA,EMPRESA,PLACA,CIUDAD,ESTACION,PRODUCTO,CANTIDAD_GL,IMPORTE_TOTAL\n"
            "2026-01-15,TRANSPORTES LIMA SAC,TEST-001,LIMA,PRIMAX TEST,DIESEL B5,20.5,300.00\n"
            "2026-01-16,TRANSPORTES LIMA SAC,TEST-002,LIMA,PRIMAX TEST,DIESEL B5,15.0,220.00\n"
        )
        files = {"file": ("test.csv", io.BytesIO(csv_content.encode()), "text/csv")}
        headers = {"Authorization": f"Bearer {admin_token}"}
        r = requests.post(f"{API}/admin/consumptions/upload",
                          headers=headers, files=files, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["inserted"] == 2

        # Cleanup uploaded rows
        verify = requests.get(f"{API}/consumptions?placa=TEST-001",
                              headers=_headers(admin_token), timeout=30)
        assert verify.status_code == 200
        assert len(verify.json()) >= 1

    def test_upload_requires_admin(self, logistica_token):
        csv_content = "FECHA,EMPRESA,PLACA,CIUDAD,ESTACION,PRODUCTO,CANTIDAD_GL,IMPORTE_TOTAL\n"
        files = {"file": ("test.csv", io.BytesIO(csv_content.encode()), "text/csv")}
        headers = {"Authorization": f"Bearer {logistica_token}"}
        r = requests.post(f"{API}/admin/consumptions/upload",
                          headers=headers, files=files, timeout=30)
        assert r.status_code == 403
