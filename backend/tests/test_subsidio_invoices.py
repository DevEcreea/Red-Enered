"""
ENERED Subsidio DU 004-2026 — invoice OCR/upload/preview/update/confirm tests.

Notes:
- OCR may fail due to EMERGENT_LLM_KEY budget — the system must still create
  the draft with ocr_ok=false and ocr_error populated. We assert this.
"""
import base64
import io
import os
import struct
import time
import uuid
import zlib

import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://role-manager-52.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = ("admin@enered.com", "admin123")
SUBSIDIO = ("cliente.subsidio@test.com", "subsidio123")
REGULAR = ("administrador@lima.com", "demo123")


def _login(email, password):
    return requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)


def _headers(token, json=True):
    h = {"Authorization": f"Bearer {token}"}
    if json:
        h["Content-Type"] = "application/json"
    return h


def _png_bytes():
    """Return a tiny valid 2x2 PNG."""
    # Minimal valid PNG file (2x2 transparent)
    sig = b"\x89PNG\r\n\x1a\n"
    def _chunk(t, data):
        return struct.pack(">I", len(data)) + t + data + struct.pack(">I", zlib.crc32(t + data) & 0xffffffff)
    ihdr = struct.pack(">IIBBBBB", 2, 2, 8, 6, 0, 0, 0)
    raw = b"\x00" + b"\xff\x00\x00\xff" * 2 + b"\x00" + b"\x00\xff\x00\xff" * 2
    idat = zlib.compress(raw)
    return sig + _chunk(b"IHDR", ihdr) + _chunk(b"IDAT", idat) + _chunk(b"IEND", b"")


# ----------------- Fixtures -----------------
@pytest.fixture(scope="session")
def admin_token():
    r = _login(*ADMIN)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def subsidio_login_data():
    r = _login(*SUBSIDIO)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="session")
def subsidio_token(subsidio_login_data):
    return subsidio_login_data["access_token"]


@pytest.fixture(scope="session")
def regular_token():
    r = _login(*REGULAR)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session", autouse=True)
def _cleanup_drafts(subsidio_token):
    """Before tests, delete any existing drafts so we start clean."""
    r = requests.get(f"{API}/subsidio/invoices/preview", headers=_headers(subsidio_token), timeout=30)
    if r.status_code == 200:
        for it in r.json().get("items", []):
            requests.delete(f"{API}/subsidio/invoices/{it['id']}", headers=_headers(subsidio_token), timeout=30)
    # Reset expediente_status to uploading so subsequent tests can validate transitions
    # We can't do it through API directly; leaving for upload to set verifying.
    yield


# ----------------- Tests -----------------
class TestSubsidioLogin:
    def test_login_returns_subsidio_user(self, subsidio_login_data):
        u = subsidio_login_data["user"]
        assert u["email"] == SUBSIDIO[0]
        assert u["role"] == "cliente_subsidio"
        # documentos_completos must be False initially
        assert u.get("documentos_completos") in (False, None)
        # expediente_status must be present in user_public
        assert "expediente_status" in u

    def test_me_includes_expediente_status(self, subsidio_token):
        r = requests.get(f"{API}/auth/me", headers=_headers(subsidio_token), timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["role"] == "cliente_subsidio"
        assert "expediente_status" in d


class TestSubsidioStatusAndPreview:
    def test_status_endpoint(self, subsidio_token):
        r = requests.get(f"{API}/subsidio/status", headers=_headers(subsidio_token), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "documentos_completos" in d

    def test_preview_returns_items_and_vehicles(self, subsidio_token):
        r = requests.get(f"{API}/subsidio/invoices/preview", headers=_headers(subsidio_token), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "items" in d and isinstance(d["items"], list)
        assert "vehicles" in d and isinstance(d["vehicles"], list)
        placas = {v["placa"] for v in d["vehicles"]}
        # The user should have ABC-123, DEF-456, GHI-789 pre-loaded
        for p in ("ABC-123", "DEF-456", "GHI-789"):
            assert p in placas, f"placa {p} not in vehicles: {placas}"

    def test_dashboard_data_empty(self, subsidio_token):
        r = requests.get(f"{API}/subsidio/dashboard-data", headers=_headers(subsidio_token), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "kpis" in d
        kpis = d["kpis"]
        # facturas_confirmadas debe ser 0 al inicio
        assert kpis["facturas_confirmadas"] == 0
        # subsidio_estimado debe estar presente (3200 si hay calc; o 0 si calc no existe)
        assert "subsidio_estimado" in kpis
        assert isinstance(kpis["subsidio_estimado"], (int, float))


class TestSubsidioInvoicesFlow:
    """Upload → preview draft → update → confirm → verify expediente_status=confirmed"""

    def test_full_flow(self, subsidio_token):
        # 1) Upload one image (OCR may fail by budget; draft still must be created)
        png = _png_bytes()
        files = [("files", ("factura1.png", io.BytesIO(png), "image/png"))]
        r = requests.post(
            f"{API}/subsidio/invoices/upload",
            headers={"Authorization": f"Bearer {subsidio_token}"},
            files=files,
            timeout=120,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["uploaded"] == 1
        assert len(body["items"]) == 1
        item = body["items"][0]
        # ocr can be ok=true or false (budget exhausted is acceptable)
        assert "id" in item
        if not item["ok"]:
            assert item.get("error"), "When OCR fails, error must be present"
        invoice_id = item["id"]

        # 2) Preview should now return at least one draft
        pv = requests.get(f"{API}/subsidio/invoices/preview", headers=_headers(subsidio_token), timeout=30)
        assert pv.status_code == 200
        items = pv.json()["items"]
        assert any(it["id"] == invoice_id for it in items)
        draft = next(it for it in items if it["id"] == invoice_id)
        assert draft["status"] == "draft"
        assert draft["user_id"]  # owned by the user

        # 3) Update fields manually (OCR may have left them null)
        upd_payload = {
            "placa": "abc-123",  # lowercase to verify it's uppercased server-side
            "galones": 12.5,
            "importe_total": 175.50,
            "fecha": "2026-01-15",
        }
        ur = requests.put(
            f"{API}/subsidio/invoices/{invoice_id}",
            headers=_headers(subsidio_token),
            json=upd_payload,
            timeout=30,
        )
        assert ur.status_code == 200, ur.text
        updated_item = ur.json()["item"]
        assert updated_item["placa"] == "ABC-123"
        assert float(updated_item["galones"]) == 12.5
        assert float(updated_item["importe_total"]) == 175.50
        assert updated_item["fecha"] == "2026-01-15"
        assert updated_item["status"] == "draft"

        # 4) Confirm all drafts
        cr = requests.post(f"{API}/subsidio/invoices/confirm", headers=_headers(subsidio_token), timeout=30)
        assert cr.status_code == 200, cr.text
        cd = cr.json()
        assert cd.get("ok") is True
        assert cd.get("confirmed", 0) >= 1

        # 5) /auth/me should now return expediente_status=confirmed
        me = requests.get(f"{API}/auth/me", headers=_headers(subsidio_token), timeout=30)
        assert me.status_code == 200
        assert me.json().get("expediente_status") == "confirmed"

        # 6) Confirmed list should contain the invoice
        cf = requests.get(f"{API}/subsidio/invoices/confirmed", headers=_headers(subsidio_token), timeout=30)
        assert cf.status_code == 200
        confirmed = cf.json()
        assert any(c["id"] == invoice_id for c in confirmed)

        # 7) Dashboard-data should reflect confirmed invoice
        dd = requests.get(f"{API}/subsidio/dashboard-data", headers=_headers(subsidio_token), timeout=30)
        assert dd.status_code == 200
        kpis = dd.json()["kpis"]
        assert kpis["facturas_confirmadas"] >= 1
        assert kpis["galones_confirmados"] >= 12.5

    def test_delete_draft(self, subsidio_token):
        # Upload a new draft
        png = _png_bytes()
        files = [("files", ("factura_to_delete.png", io.BytesIO(png), "image/png"))]
        r = requests.post(
            f"{API}/subsidio/invoices/upload",
            headers={"Authorization": f"Bearer {subsidio_token}"},
            files=files,
            timeout=120,
        )
        assert r.status_code == 200, r.text
        invoice_id = r.json()["items"][0]["id"]

        # Delete it
        dr = requests.delete(
            f"{API}/subsidio/invoices/{invoice_id}",
            headers=_headers(subsidio_token),
            timeout=30,
        )
        assert dr.status_code == 200, dr.text

        # Verify it no longer appears in preview
        pv = requests.get(f"{API}/subsidio/invoices/preview", headers=_headers(subsidio_token), timeout=30)
        assert pv.status_code == 200
        assert not any(it["id"] == invoice_id for it in pv.json()["items"])

    def test_delete_nonexistent_returns_404(self, subsidio_token):
        r = requests.delete(
            f"{API}/subsidio/invoices/does-not-exist-{uuid.uuid4().hex[:6]}",
            headers=_headers(subsidio_token),
            timeout=30,
        )
        assert r.status_code == 404


class TestSubsidioAccessControl:
    """Verify only cliente_subsidio can access /api/subsidio/* endpoints."""

    def test_admin_cannot_access_subsidio_endpoints(self, admin_token):
        r = requests.get(f"{API}/subsidio/dashboard-data", headers=_headers(admin_token), timeout=30)
        assert r.status_code in (403, 401), r.text

    def test_regular_user_cannot_access_subsidio_endpoints(self, regular_token):
        r = requests.get(f"{API}/subsidio/invoices/preview", headers=_headers(regular_token), timeout=30)
        assert r.status_code in (403, 401), r.text


class TestRegressionAdminAndRegular:
    """Make sure existing roles still work after the refactor."""

    def test_admin_dashboard_overview_or_kpis(self, admin_token):
        # /api/dashboard/overview may not exist — use kpis as canonical
        r = requests.get(f"{API}/dashboard/kpis", headers=_headers(admin_token), timeout=30)
        assert r.status_code == 200, r.text

    def test_admin_users(self, admin_token):
        r = requests.get(f"{API}/users", headers=_headers(admin_token), timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_regular_login_and_me(self, regular_token):
        r = requests.get(f"{API}/auth/me", headers=_headers(regular_token), timeout=30)
        assert r.status_code == 200
        assert r.json()["role"] == "administrador"
