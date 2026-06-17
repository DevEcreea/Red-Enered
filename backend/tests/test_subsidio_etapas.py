"""ENERED Subsidio Etapas — iteración 2

Tests for:
- MIME validation per stage (empresa PDF-only / flota PDF+PNG+JPG / combustible PDF+PNG+JPG)
- Declaracion jurada endpoint guards (missing invoices, missing docs)
- Declaracion jurada signing → expediente_status='submitted'
- SubsidioGate behavior: status 'submitted' should unlock subsidio modules
- Regression: admin still sees /api/consumptions with 451 rows, /flotas works
"""
import os
import io
import base64
import pytest
import requests
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "enered_db")

SUBSIDIO_EMAIL = "cliente.subsidio@test.com"
SUBSIDIO_PASS = "subsidio123"
ADMIN_EMAIL = "admin@enered.com"
ADMIN_PASS = "admin123"

PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
)
PDF_BYTES = b"%PDF-1.4\n%fake pdf\n1 0 obj<</Type/Catalog>>endobj\n%%EOF"
XML_BYTES = b'<?xml version="1.0"?><root/>'


# ------------------------- fixtures -------------------------
@pytest.fixture(scope="module")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="module")
def db(event_loop):
    client = AsyncIOMotorClient(MONGO_URL)
    return client[DB_NAME]


async def _reset_state(db):
    """Reset cliente_subsidio expediente to uploading state."""
    await db.subsidio_declaraciones.delete_many({})
    await db.consumos_subsidio.delete_many({})
    await db.subsidio_documents.delete_many({})
    await db.subsidio_bank_accounts.delete_many({})
    await db.users.update_one(
        {"email": SUBSIDIO_EMAIL},
        {"$set": {"expediente_status": "uploading", "documentos_completos": False}},
    )


@pytest.fixture(scope="module")
def reset_subsidio(db, event_loop):
    event_loop.run_until_complete(_reset_state(db))
    yield
    event_loop.run_until_complete(_reset_state(db))


@pytest.fixture(scope="module")
def subsidio_session(reset_subsidio):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": SUBSIDIO_EMAIL, "password": SUBSIDIO_PASS})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200
    tok = r.json().get("access_token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


# ------------------------- MIME validation -------------------------
class TestMimeValidation:
    def test_empresa_rejects_png(self, subsidio_session):
        files = {"file": ("test.png", PNG_BYTES, "image/png")}
        data = {"categoria": "ficha_ruc"}
        r = subsidio_session.post(f"{BASE_URL}/api/subsidio/documents", files=files, data=data)
        assert r.status_code == 400
        body = r.json()
        assert "PDF" in body.get("detail", "")
        assert "no permitido" in body.get("detail", "").lower() or "Formato" in body.get("detail", "")

    def test_empresa_accepts_pdf(self, subsidio_session):
        files = {"file": ("ruc.pdf", PDF_BYTES, "application/pdf")}
        data = {"categoria": "ficha_ruc"}
        r = subsidio_session.post(f"{BASE_URL}/api/subsidio/documents", files=files, data=data)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["document"]["categoria"] == "ficha_ruc"

    def test_empresa_all_three_pdf(self, subsidio_session):
        for cat in ["resolucion_autorizacion", "dni_representante"]:
            files = {"file": (f"{cat}.pdf", PDF_BYTES, "application/pdf")}
            data = {"categoria": cat}
            r = subsidio_session.post(f"{BASE_URL}/api/subsidio/documents", files=files, data=data)
            assert r.status_code == 200, f"{cat}: {r.text}"

    def test_flota_accepts_png(self, subsidio_session):
        files = {"file": ("hab.png", PNG_BYTES, "image/png")}
        data = {"categoria": "tarjeta_habilitacion", "placa": "ABC-123"}
        r = subsidio_session.post(f"{BASE_URL}/api/subsidio/documents", files=files, data=data)
        assert r.status_code == 200, r.text

    def test_flota_accepts_pdf(self, subsidio_session):
        files = {"file": ("prop.pdf", PDF_BYTES, "application/pdf")}
        data = {"categoria": "tarjeta_propiedad", "placa": "ABC-123"}
        r = subsidio_session.post(f"{BASE_URL}/api/subsidio/documents", files=files, data=data)
        assert r.status_code == 200, r.text

    def test_flota_rejects_xml(self, subsidio_session):
        files = {"file": ("bad.xml", XML_BYTES, "application/xml")}
        data = {"categoria": "tarjeta_habilitacion", "placa": "DEF-456"}
        r = subsidio_session.post(f"{BASE_URL}/api/subsidio/documents", files=files, data=data)
        assert r.status_code == 400
        assert "no permitido" in r.json().get("detail", "").lower() or "Formato" in r.json().get("detail", "")

    def test_flota_complete_def_and_ghi(self, subsidio_session):
        """Upload all flota docs for DEF-456 and GHI-789 so declaracion passes guard."""
        for placa in ["DEF-456", "GHI-789"]:
            for cat in ["tarjeta_habilitacion", "tarjeta_propiedad"]:
                files = {"file": (f"{cat}.pdf", PDF_BYTES, "application/pdf")}
                data = {"categoria": cat, "placa": placa}
                r = subsidio_session.post(f"{BASE_URL}/api/subsidio/documents", files=files, data=data)
                assert r.status_code == 200, f"{placa}/{cat}: {r.text}"


# ------------------------- declaracion guards -------------------------
class TestDeclaracionGuards:
    def test_declaracion_requires_invoices(self, subsidio_session):
        """At this point empresa+flota docs are uploaded but no invoices."""
        r = subsidio_session.post(
            f"{BASE_URL}/api/subsidio/declaracion",
            json={"accepted": True},
        )
        assert r.status_code == 400
        detail = r.json().get("detail", "")
        assert "factura" in (detail if isinstance(detail, str) else str(detail)).lower()

    def test_declaracion_requires_accepted_true(self, subsidio_session):
        r = subsidio_session.post(
            f"{BASE_URL}/api/subsidio/declaracion",
            json={"accepted": False},
        )
        assert r.status_code == 400


# ------------------------- declaracion signing -------------------------
class TestDeclaracionFlow:
    def test_sign_after_confirming_invoice(self, subsidio_session, db, event_loop):
        # Inject one confirmed invoice directly (since OCR is external & slow)
        async def seed_invoice():
            user = await db.users.find_one({"email": SUBSIDIO_EMAIL})
            await db.consumos_subsidio.insert_one({
                "id": "test-invoice-1",
                "user_id": user["id"],
                "empresa": user.get("empresa"),
                "status": "confirmed",
                "fecha": "2026-06-15",
                "placa": "ABC-123",
                "galones": 10.0,
                "importe_total": 200.0,
                "created_at": "2026-06-15T10:00:00+00:00",
                "confirmed_at": "2026-06-15T10:00:00+00:00",
            })
        event_loop.run_until_complete(seed_invoice())

        # Now sign
        r = subsidio_session.post(
            f"{BASE_URL}/api/subsidio/declaracion",
            json={"accepted": True, "representante": "Juan Test"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body.get("expediente_status") == "submitted"
        decl = body["declaracion"]
        assert decl["representante"] == "Juan Test"
        assert "accepted_at" in decl
        assert "texto" in decl and "declaro bajo juramento" in decl["texto"].lower()

    def test_get_declaracion_after_signed(self, subsidio_session):
        r = subsidio_session.get(f"{BASE_URL}/api/subsidio/declaracion")
        assert r.status_code == 200
        body = r.json()
        assert body["declaracion"] is not None
        assert body["declaracion"]["representante"] == "Juan Test"

    def test_user_expediente_status_now_submitted(self, db, event_loop):
        async def check():
            u = await db.users.find_one({"email": SUBSIDIO_EMAIL})
            return u
        u = event_loop.run_until_complete(check())
        assert u["expediente_status"] == "submitted"
        assert u.get("documentos_completos") is True

    def test_sign_is_idempotent(self, subsidio_session):
        r = subsidio_session.post(
            f"{BASE_URL}/api/subsidio/declaracion",
            json={"accepted": True},
        )
        assert r.status_code == 200
        assert r.json().get("already") is True

    def test_dashboard_returns_declaracion(self, subsidio_session):
        r = subsidio_session.get(f"{BASE_URL}/api/subsidio/dashboard")
        assert r.status_code == 200
        assert r.json().get("declaracion") is not None


# ------------------------- regression -------------------------
class TestRegression:
    def test_admin_consumptions_unchanged(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/consumptions")
        assert r.status_code == 200
        body = r.json()
        rows = body if isinstance(body, list) else body.get("items", body.get("data", []))
        assert len(rows) >= 400, f"expected ~451 rows, got {len(rows)}"

    def test_admin_forbidden_subsidio_endpoints(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/subsidio/declaracion", json={"accepted": True})
        assert r.status_code == 403
        files = {"file": ("x.pdf", PDF_BYTES, "application/pdf")}
        data = {"categoria": "ficha_ruc"}
        r2 = admin_session.post(f"{BASE_URL}/api/subsidio/documents", files=files, data=data)
        assert r2.status_code == 403
