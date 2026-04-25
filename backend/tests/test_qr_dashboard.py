"""Tests for new QR bulk-upload endpoints and dashboard 'gasto' fields."""
import io
import uuid
import pytest
import requests

BASE_URL = "https://enered-insight.preview.emergentagent.com".rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = ("admin@enered.com", "admin123")
LIMA_USER = ("administrador@lima.com", "demo123")
ANDINA_USER = ("administrador@andina.com", "demo123")


def _login(email, password):
    return requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)


def _h(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def admin_token():
    r = _login(*ADMIN); assert r.status_code == 200
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def lima_token():
    r = _login(*LIMA_USER); assert r.status_code == 200
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def andina_token():
    r = _login(*ANDINA_USER); assert r.status_code == 200
    return r.json()["access_token"]


# Tiny valid PNG (1x1 transparent)
PNG_BYTES = bytes.fromhex(
    "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4"
    "890000000D49444154789C6300010000000500010D0A2DB40000000049454E44AE426082"
)


# ---------- Dashboard gasto fields ----------
class TestDashboardGasto:
    def test_consumo_ciudad_has_gasto(self, admin_token):
        r = requests.get(f"{API}/dashboard/kpis", headers=_h(admin_token), timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "consumo_ciudad" in d, "missing consumo_ciudad"
        assert isinstance(d["consumo_ciudad"], list) and len(d["consumo_ciudad"]) > 0
        for row in d["consumo_ciudad"]:
            assert "ciudad" in row and "galones" in row and "gasto" in row
            assert isinstance(row["gasto"], (int, float))

    def test_consumo_estacion_has_gasto(self, admin_token):
        r = requests.get(f"{API}/dashboard/kpis", headers=_h(admin_token), timeout=30)
        d = r.json()
        assert "consumo_estacion" in d
        assert len(d["consumo_estacion"]) > 0
        for row in d["consumo_estacion"]:
            assert "estacion" in row and "galones" in row and "gasto" in row
            assert isinstance(row["gasto"], (int, float))


# ---------- QR Bulk Upload ----------
class TestQRBulk:
    EMPRESA = "TRANSPORTES LIMA SAC"

    def test_non_admin_cannot_upload(self, lima_token):
        files = [("files", (f"TESTPL{uuid.uuid4().hex[:4].upper()}.png", io.BytesIO(PNG_BYTES), "image/png"))]
        r = requests.post(f"{API}/admin/qr/upload-bulk",
                          headers=_h(lima_token),
                          data={"empresa": self.EMPRESA},
                          files=files, timeout=30)
        assert r.status_code == 403

    def test_admin_bulk_upload(self, admin_token):
        placa1 = f"TST{uuid.uuid4().hex[:4].upper()}"
        placa2 = f"TST{uuid.uuid4().hex[:4].upper()}"
        files = [
            ("files", (f"{placa1}.png", io.BytesIO(PNG_BYTES), "image/png")),
            ("files", (f"{placa2}.png", io.BytesIO(PNG_BYTES), "image/png")),
            ("files", ("badname.txt", io.BytesIO(b"xx"), "text/plain")),  # should be skipped
        ]
        r = requests.post(f"{API}/admin/qr/upload-bulk",
                          headers=_h(admin_token),
                          data={"empresa": self.EMPRESA},
                          files=files, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["uploaded"] == 2
        placas = [s["placa"] for s in data["saved"]]
        assert placa1 in placas and placa2 in placas
        assert len(data["skipped"]) >= 1

        # Pass for use in subsequent tests
        TestQRBulk._test_placa = placa1
        TestQRBulk._other_placa = placa2

    def test_qr_list_admin_filtered_by_empresa(self, admin_token):
        r = requests.get(f"{API}/qr/list?empresa={self.EMPRESA}",
                         headers=_h(admin_token), timeout=30)
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list) and len(rows) >= 2
        placas = [x["placa"] for x in rows]
        assert TestQRBulk._test_placa in placas

    def test_qr_list_tenant_isolation(self, lima_token, andina_token):
        r1 = requests.get(f"{API}/qr/list", headers=_h(lima_token), timeout=30)
        assert r1.status_code == 200
        for row in r1.json():
            assert row["empresa"] == "TRANSPORTES LIMA SAC"
        # Andina tenant should NOT see Lima placa
        r2 = requests.get(f"{API}/qr/list", headers=_h(andina_token), timeout=30)
        assert r2.status_code == 200
        andina_placas = [x["placa"] for x in r2.json()]
        assert TestQRBulk._test_placa not in andina_placas

    def test_qr_download_lima_user(self, lima_token):
        placa = TestQRBulk._test_placa
        r = requests.get(f"{API}/qr/download/{placa}", headers=_h(lima_token), timeout=30)
        assert r.status_code == 200
        assert len(r.content) > 0

    def test_qr_download_other_tenant_404(self, andina_token):
        placa = TestQRBulk._test_placa
        # Andina user shouldn't find Lima's QR
        r = requests.get(f"{API}/qr/download/{placa}", headers=_h(andina_token), timeout=30)
        assert r.status_code == 404

    def test_admin_delete_qr(self, admin_token):
        placa = TestQRBulk._test_placa
        r = requests.delete(f"{API}/admin/qr/{placa}?empresa={self.EMPRESA}",
                            headers=_h(admin_token), timeout=30)
        assert r.status_code == 200

        # Verify gone
        r2 = requests.get(f"{API}/qr/list?empresa={self.EMPRESA}",
                          headers=_h(admin_token), timeout=30)
        placas = [x["placa"] for x in r2.json()]
        assert placa not in placas

        # Cleanup the second placa too
        requests.delete(f"{API}/admin/qr/{TestQRBulk._other_placa}?empresa={self.EMPRESA}",
                        headers=_h(admin_token), timeout=30)

    def test_delete_unknown_placa_404(self, admin_token):
        r = requests.delete(f"{API}/admin/qr/NOEXIST999?empresa={self.EMPRESA}",
                            headers=_h(admin_token), timeout=30)
        assert r.status_code == 404
