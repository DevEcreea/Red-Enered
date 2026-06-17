"""
ENERED Subsidio DU 004-2026 — Integration tests for the latest changes:
- OCR upload with EMERGENT_LLM_KEY configured (must NOT raise "key no configurada")
- After confirm, /api/consumptions returns UPPERCASE schema for cliente_subsidio
- /api/dashboard/filter-options for cliente_subsidio reads consumos_subsidio
- Regular admin still reads from db.consumptions

Reset state via direct Mongo to ensure idempotency.
"""
import io
import os
import struct
import zlib
import asyncio

import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = ("admin@enered.com", "admin123")
SUBSIDIO = ("cliente.subsidio@test.com", "subsidio123")

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "enered")


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


def _hdr(tok, json=True):
    h = {"Authorization": f"Bearer {tok}"}
    if json:
        h["Content-Type"] = "application/json"
    return h


def _png():
    sig = b"\x89PNG\r\n\x1a\n"
    def _c(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    ihdr = struct.pack(">IIBBBBB", 2, 2, 8, 6, 0, 0, 0)
    raw = b"\x00" + b"\xff\x00\x00\xff" * 2 + b"\x00" + b"\x00\xff\x00\xff" * 2
    idat = zlib.compress(raw)
    return sig + _c(b"IHDR", ihdr) + _c(b"IDAT", idat) + _c(b"IEND", b"")


def _reset_state():
    """Reset cliente_subsidio expediente_status + drop all invoices via Mongo."""
    async def _do():
        cli = AsyncIOMotorClient(MONGO_URL)
        db = cli[DB_NAME]
        await db.users.update_one(
            {"email": SUBSIDIO[0]},
            {"$set": {"expediente_status": "uploading", "documentos_completos": False}},
        )
        await db.consumos_subsidio.delete_many({"user_email": SUBSIDIO[0]})
        # Also clean by user_id (different collections may use either)
        u = await db.users.find_one({"email": SUBSIDIO[0]})
        if u:
            await db.consumos_subsidio.delete_many({"user_id": u.get("id")})
        cli.close()
    asyncio.get_event_loop().run_until_complete(_do()) if not asyncio.get_event_loop().is_running() else None
    # Simpler synchronous reset using a fresh loop
    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(_do())
    finally:
        loop.close()


@pytest.fixture(scope="module")
def subsidio_token():
    _reset_state()
    return _login(*SUBSIDIO)["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(*ADMIN)["access_token"]


# ---------------- 1) OCR upload with key configured ----------------
class TestOCRUpload:
    def test_upload_returns_200_and_no_key_error(self, subsidio_token):
        # Clean prior drafts to start fresh
        pv = requests.get(f"{API}/subsidio/invoices/preview", headers=_hdr(subsidio_token), timeout=30)
        if pv.status_code == 200:
            for it in pv.json().get("items", []):
                requests.delete(f"{API}/subsidio/invoices/{it['id']}", headers=_hdr(subsidio_token), timeout=30)

        files = [("files", ("test.png", io.BytesIO(_png()), "image/png"))]
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
        assert "id" in item
        # KEY ASSERTION: ocr_error must NOT mention missing EMERGENT_LLM_KEY
        err = (item.get("error") or "") + " " + (item.get("ocr_error") or "")
        assert "EMERGENT_LLM_KEY no configurada" not in err, f"OCR key error present: {err}"
        # ocr_ok field should exist on the persisted draft (preview)
        pv = requests.get(f"{API}/subsidio/invoices/preview", headers=_hdr(subsidio_token), timeout=30)
        assert pv.status_code == 200
        drafts = [d for d in pv.json()["items"] if d["id"] == item["id"]]
        assert len(drafts) == 1
        assert "ocr_ok" in drafts[0]


# ---------------- 2) Full flow + consumptions UPPERCASE schema ----------------
class TestConfirmAndConsumptionsSchema:
    def test_confirm_then_consumptions_uppercase(self, subsidio_token):
        # ensure at least one draft exists
        pv = requests.get(f"{API}/subsidio/invoices/preview", headers=_hdr(subsidio_token), timeout=30)
        items = pv.json().get("items", [])
        if not items:
            files = [("files", ("f.png", io.BytesIO(_png()), "image/png"))]
            up = requests.post(
                f"{API}/subsidio/invoices/upload",
                headers={"Authorization": f"Bearer {subsidio_token}"},
                files=files,
                timeout=120,
            )
            assert up.status_code == 200
            items = up.json()["items"]
        inv_id = items[0]["id"]

        # Update fields
        upd = requests.put(
            f"{API}/subsidio/invoices/{inv_id}",
            headers=_hdr(subsidio_token),
            json={"placa": "ABC-123", "galones": 10, "importe_total": 200, "fecha": "2026-01-15"},
            timeout=30,
        )
        assert upd.status_code == 200, upd.text

        # Confirm
        cf = requests.post(f"{API}/subsidio/invoices/confirm", headers=_hdr(subsidio_token), timeout=30)
        assert cf.status_code == 200, cf.text
        assert cf.json().get("ok") is True

        # /auth/me => expediente_status == confirmed
        me = requests.get(f"{API}/auth/me", headers=_hdr(subsidio_token), timeout=30)
        assert me.status_code == 200
        assert me.json().get("expediente_status") == "confirmed"

        # /api/consumptions => uppercase schema
        cons = requests.get(f"{API}/consumptions", headers=_hdr(subsidio_token), timeout=30)
        assert cons.status_code == 200, cons.text
        rows = cons.json()
        assert isinstance(rows, list) and len(rows) >= 1
        # check uppercase keys on first row
        row = rows[0]
        for k in ("CANTIDAD_GL", "IMPORTE_TOTAL", "PLACA", "FECHA", "EMPRESA", "AHORRO", "SEMANA"):
            assert k in row, f"Missing uppercase key {k} in row: {row}"
        # Find row corresponding to our placa
        ours = [r for r in rows if r.get("PLACA") == "ABC-123"]
        assert len(ours) >= 1, f"No row with PLACA=ABC-123. Rows: {rows}"
        r0 = ours[0]
        # AHORRO = galones * 1.5
        assert abs(float(r0["AHORRO"]) - 10 * 1.5) < 0.01, f"AHORRO mismatch: {r0['AHORRO']}"
        assert abs(float(r0["CANTIDAD_GL"]) - 10) < 0.01
        assert abs(float(r0["IMPORTE_TOTAL"]) - 200) < 0.01
        assert r0["FECHA"]  # not empty
        assert r0["SEMANA"]  # derived from FECHA


# ---------------- 3) Filter options sourced from consumos_subsidio ----------------
class TestFilterOptionsSubsidio:
    def test_filter_options_for_subsidio(self, subsidio_token):
        r = requests.get(f"{API}/dashboard/filter-options", headers=_hdr(subsidio_token), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        # Must contain expected keys
        for k in ("placas", "estaciones", "productos", "semanas"):
            assert k in d, f"Filter-options missing key '{k}': {d}"
        # placas should include ABC-123 (we confirmed an invoice with that placa)
        assert "ABC-123" in d["placas"], f"ABC-123 not in placas: {d['placas']}"


# ---------------- 4) Regular admin still reads from db.consumptions ----------------
class TestAdminUnaffected:
    def test_admin_consumptions_db_consumptions(self, admin_token):
        r = requests.get(f"{API}/consumptions", headers=_hdr(admin_token), timeout=30)
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        # admin should see seeded demo rows — > 50 is a reasonable lower bound (~451 expected)
        assert len(rows) > 50, f"admin consumptions too few: {len(rows)} — should be reading db.consumptions"

    def test_admin_filter_options(self, admin_token):
        r = requests.get(f"{API}/dashboard/filter-options", headers=_hdr(admin_token), timeout=30)
        assert r.status_code == 200
        d = r.json()
        for k in ("placas", "estaciones", "productos", "semanas"):
            assert k in d
        # admin sees many placas
        assert len(d["placas"]) > 5
