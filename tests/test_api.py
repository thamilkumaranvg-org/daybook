from fastapi.testclient import TestClient

from backend.main import app


def test_login_rejects_bad_credentials():
    with TestClient(app) as client:
        res = client.post("/api/login", json={"username": "user1", "password": "wrong"})
        assert res.status_code == 401


def test_protected_routes_require_auth():
    with TestClient(app) as client:
        assert client.get("/api/activities").status_code == 401


def test_full_activity_flow():
    with TestClient(app) as client:
        login = client.post("/api/login", json={"username": "user1", "password": "demo1234"})
        assert login.status_code == 200
        token = login.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        listed = client.get("/api/activities", headers=headers)
        assert listed.status_code == 200
        assert isinstance(listed.json(), list)

        created = client.post(
            "/api/activities",
            headers=headers,
            json={"title": "API test task", "notes": "from tests"},
        )
        assert created.status_code == 201
        activity = created.json()
        assert activity["title"] == "API test task"
        assert activity["completed"] is False
        activity_id = activity["id"]

        empty = client.post("/api/activities", headers=headers, json={"title": "", "notes": ""})
        assert empty.status_code == 422

        toggled = client.patch(f"/api/activities/{activity_id}/toggle", headers=headers)
        assert toggled.status_code == 200
        assert toggled.json()["completed"] is True
        assert toggled.json()["time"]

        updated = client.put(
            f"/api/activities/{activity_id}",
            headers=headers,
            json={"title": "API test task updated", "notes": "edited"},
        )
        assert updated.status_code == 200
        assert updated.json()["title"] == "API test task updated"

        searched = client.get("/api/activities", headers=headers, params={"q": "API test task updated"})
        assert searched.status_code == 200
        assert any(a["id"] == activity_id for a in searched.json())

        deleted = client.delete(f"/api/activities/{activity_id}", headers=headers)
        assert deleted.status_code == 200

        leftover = client.get("/api/activities", headers=headers)
        assert all(a["id"] != activity_id for a in leftover.json())

        logout = client.post("/api/logout", headers=headers)
        assert logout.status_code == 200
        assert client.get("/api/activities", headers=headers).status_code == 401
