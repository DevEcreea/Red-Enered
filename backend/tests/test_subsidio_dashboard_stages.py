"""Tests for new dashboard data + admin stage endpoints (iteration 3)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
SUBSIDIO_EMAIL = "cliente.subsidio@test.com"
SUBSIDIO_PASS = "subsidio123"
ADMIN_EMAIL = "admin@enered.com"
ADMIN_PASS = "admin123"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, r.text
    tok = r.json().get("access_token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def subsidio_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": SUBSIDIO_EMAIL, "password": SUBSIDIO_PASS})
    assert r.status_code == 200, r.text
    tok = r.json().get("access_token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def subsidio_user_id(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/admin/subsidio/expedientes")
    assert r.status_code == 200
    items = r.json()["items"]
    target = next((i for i in items if i["email"] == SUBSIDIO_EMAIL), None)
    assert target is not None, "test user not in expedientes list"
    return target["user_id"]


class TestDashboardData:
    def test_dashboard_data_shape(self, subsidio_session):
        r = subsidio_session.get(f"{BASE_URL}/api/subsidio/dashboard-data")
        assert r.status_code == 200, r.text
        body = r.json()
        # Fila 1
        assert "stages" in body and isinstance(body["stages"], list)
        assert len(body["stages"]) == 4
        keys = [s["key"] for s in body["stages"]]
        assert keys == ["solicitud_enviada", "evaluacion_atu", "aprobada", "abonado_en_cuenta"]
        for s in body["stages"]:
            assert s["status"] in ("done", "current", "pending")
        assert "current_stage" in body
        # Fila 2 — 6 KPIs nuevos
        for k in ["unidades_incluidas", "unidades_activas", "galones_reconocidos",
                  "gasto_total", "precio_promedio_galon", "costo_promedio_unidad"]:
            assert k in body["kpis"], f"missing kpi: {k}"
        # Fila 3
        assert "serie_semanal" in body and isinstance(body["serie_semanal"], list)
        # Fila 4
        assert "top_unidades" in body and isinstance(body["top_unidades"], list)
        assert "top_estaciones" in body and isinstance(body["top_estaciones"], list)
        # Fila 5
        assert "documentos_semaforo" in body
        sem = body["documentos_semaforo"]
        assert "items" in sem and "summary" in sem
        for k in ["active", "expiring", "expired", "missing"]:
            assert k in sem["summary"]
        # items must be 3 (empresa categorías)
        assert len(sem["items"]) == 3


class TestAdminStageEndpoint:
    def test_admin_can_update_stage(self, admin_session, subsidio_user_id):
        r = admin_session.put(
            f"{BASE_URL}/api/admin/subsidio/expedientes/{subsidio_user_id}/stage",
            json={"stage": "aprobada"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["expediente_stage"] == "aprobada"

    def test_admin_stage_reflects_in_list(self, admin_session, subsidio_user_id):
        r = admin_session.get(f"{BASE_URL}/api/admin/subsidio/expedientes")
        assert r.status_code == 200
        item = next(i for i in r.json()["items"] if i["user_id"] == subsidio_user_id)
        assert item["expediente_stage"] == "aprobada"

    def test_admin_stage_reflects_in_detail(self, admin_session, subsidio_user_id):
        r = admin_session.get(f"{BASE_URL}/api/admin/subsidio/expedientes/{subsidio_user_id}")
        assert r.status_code == 200
        assert r.json()["user"]["expediente_stage"] == "aprobada"

    def test_cliente_subsidio_cannot_update(self, subsidio_session, subsidio_user_id):
        r = subsidio_session.put(
            f"{BASE_URL}/api/admin/subsidio/expedientes/{subsidio_user_id}/stage",
            json={"stage": "evaluacion_atu"},
        )
        assert r.status_code == 403

    def test_invalid_stage_value_rejected(self, admin_session, subsidio_user_id):
        r = admin_session.put(
            f"{BASE_URL}/api/admin/subsidio/expedientes/{subsidio_user_id}/stage",
            json={"stage": "INVALID_STAGE"},
        )
        assert r.status_code == 422

    def test_unknown_user_404(self, admin_session):
        r = admin_session.put(
            f"{BASE_URL}/api/admin/subsidio/expedientes/non-existent-id/stage",
            json={"stage": "aprobada"},
        )
        assert r.status_code == 404

    def test_reset_back_to_evaluacion_atu(self, admin_session, subsidio_user_id):
        """Cleanup: leave the seed user in evaluacion_atu as documented."""
        r = admin_session.put(
            f"{BASE_URL}/api/admin/subsidio/expedientes/{subsidio_user_id}/stage",
            json={"stage": "evaluacion_atu"},
        )
        assert r.status_code == 200
        assert r.json()["expediente_stage"] == "evaluacion_atu"


class TestStageReflectsInDashboard:
    def test_current_stage_in_dashboard_matches_user(self, subsidio_session):
        r = subsidio_session.get(f"{BASE_URL}/api/subsidio/dashboard-data")
        assert r.status_code == 200
        body = r.json()
        assert body["current_stage"] == "evaluacion_atu"
        # corresponding stage must be marked current
        cur = next(s for s in body["stages"] if s["key"] == "evaluacion_atu")
        assert cur["status"] == "current"
