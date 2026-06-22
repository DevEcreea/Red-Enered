"""ENERED Subsidio Admin Edit — Tests

Tests for:
- Editing legal representative
- Adding, editing, and deleting fleet vehicles (plates)
- Adding and editing fuel invoices manually
"""
import os
import pytest
import requests
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "enered_db")

SUBSIDIO_EMAIL = "cliente.subsidio@test.com"
ADMIN_EMAIL = "admin@enered.com"
ADMIN_PASS = "admin123"


@pytest.fixture(scope="module")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="module")
def db(event_loop):
    client = AsyncIOMotorClient(MONGO_URL)
    return client[DB_NAME]


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200
    tok = r.json().get("access_token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def test_user(db, event_loop):
    async def get_user():
        return await db.users.find_one({"email": SUBSIDIO_EMAIL})
    return event_loop.run_until_complete(get_user())


def test_edit_representante(admin_session, test_user):
    user_id = test_user["id"]
    
    # 1. Update representative
    r = admin_session.put(
        f"{BASE_URL}/api/admin/subsidio/expedientes/{user_id}/representante",
        json={"representante": "Nuevo Representante Test"}
    )
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["representante"] == "Nuevo Representante Test"

    # 2. Check in detail endpoint
    r2 = admin_session.get(f"{BASE_URL}/api/admin/subsidio/expedientes/{user_id}")
    assert r2.status_code == 200
    details = r2.json()
    assert details["user"]["contacto"] == "Nuevo Representante Test"
    assert details["user"]["representante"] == "Nuevo Representante Test"


def test_vehicles_crud(admin_session, test_user):
    user_id = test_user["id"]

    # 1. Add plate
    r_add = admin_session.post(
        f"{BASE_URL}/api/admin/subsidio/expedientes/{user_id}/vehicles",
        json={
            "placa": "XYZ-999",
            "categoria": "N3",
            "anio_fabricacion": 2022,
            "vigente_desde": "2026-01-01",
            "vigente_hasta": "2027-01-01"
        }
    )
    assert r_add.status_code == 200
    veh = r_add.json()["vehicle"]
    assert veh["placa"] == "XYZ-999"
    assert veh["categoria"] == "N3"
    assert veh["anio_fabricacion"] == 2022
    assert veh["vigente_desde"] == "2026-01-01"
    assert veh["vigente_hasta"] == "2027-01-01"
    
    vehicle_id = veh["id"]

    # 2. Edit plate
    r_edit = admin_session.put(
        f"{BASE_URL}/api/admin/subsidio/expedientes/{user_id}/vehicles/{vehicle_id}",
        json={
            "placa": "XYZ-999",
            "categoria": "N2",
            "anio_fabricacion": 2023,
            "vigente_desde": "2026-02-02",
            "vigente_hasta": "2027-02-02"
        }
    )
    assert r_edit.status_code == 200
    
    # Check details again
    r_det = admin_session.get(f"{BASE_URL}/api/admin/subsidio/expedientes/{user_id}")
    veh_updated = next(v for v in r_det.json()["vehicles"] if v["id"] == vehicle_id)
    assert veh_updated["categoria"] == "N2"
    assert veh_updated["anio_fabricacion"] == 2023
    assert veh_updated["vigente_desde"] == "2026-02-02"
    assert veh_updated["vigente_hasta"] == "2027-02-02"

    # 3. Delete plate
    r_del = admin_session.delete(f"{BASE_URL}/api/admin/subsidio/expedientes/{user_id}/vehicles/{vehicle_id}")
    assert r_del.status_code == 200

    # Verify deletion
    r_det2 = admin_session.get(f"{BASE_URL}/api/admin/subsidio/expedientes/{user_id}")
    assert not any(v["id"] == vehicle_id for v in r_det2.json()["vehicles"])


def test_invoices_crud(admin_session, test_user):
    user_id = test_user["id"]

    # 1. Create manual invoice
    r_add = admin_session.post(
        f"{BASE_URL}/api/admin/subsidio/expedientes/{user_id}/invoices",
        json={
            "numero_documento": "FFF1-000999",
            "fecha": "2026-06-20",
            "estacion": "GRIFO DE PRUEBA",
            "ruc_emisor": "20123456789",
            "ciudad": "Arequipa",
            "placa": "ABC-123",
            "galones": 15.5,
            "precio_unitario": 18.5,
            "importe_total": 286.75,
            "producto": "DIESEL B5"
        }
    )
    assert r_add.status_code == 200
    inv = r_add.json()["invoice"]
    assert inv["numero_documento"] == "FFF1-000999"
    assert inv["status"] == "confirmed"
    assert inv["galones"] == 15.5
    
    invoice_id = inv["id"]

    # 2. Edit manual invoice
    r_edit = admin_session.put(
        f"{BASE_URL}/api/admin/subsidio/expedientes/{user_id}/invoices/{invoice_id}",
        json={
            "numero_documento": "FFF1-000999",
            "fecha": "2026-06-21",
            "estacion": "GRIFO DE PRUEBA ACTUALIZADO",
            "ciudad": "Arequipa",
            "placa": "ABC-123",
            "galones": 20.0,
            "precio_unitario": 18.5,
            "importe_total": 370.0
        }
    )
    assert r_edit.status_code == 200

    # Verify edit in detail
    r_det = admin_session.get(f"{BASE_URL}/api/admin/subsidio/expedientes/{user_id}")
    inv_updated = next(i for i in r_det.json()["invoices"] if i["id"] == invoice_id)
    assert inv_updated["estacion"] == "GRIFO DE PRUEBA ACTUALIZADO"
    assert inv_updated["galones"] == 20.0
    assert inv_updated["fecha"] == "2026-06-21"

    # 3. Delete invoice
    r_del = admin_session.delete(f"{BASE_URL}/api/admin/subsidio/invoices/{invoice_id}")
    assert r_del.status_code == 200

    # Verify deletion
    r_det2 = admin_session.get(f"{BASE_URL}/api/admin/subsidio/expedientes/{user_id}")
    assert not any(i["id"] == invoice_id for i in r_det2.json()["invoices"])
