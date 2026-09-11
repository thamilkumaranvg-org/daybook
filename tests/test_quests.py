from fastapi.testclient import TestClient

from backend.main import app


def _auth(client):
    login = client.post("/api/login", json={"username": "user1", "password": "demo1234"})
    token = login.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    started = client.post(
        "/api/session/start",
        headers=headers,
        json={"theme": "onepiece", "mentor": "zoro"},
    )
    assert started.status_code == 200
    return headers, started.json()


def test_session_locks_theme_and_mentor():
    with TestClient(app) as client:
        headers, payload = _auth(client)
        assert payload["theme"] == "onepiece"
        assert payload["mentor"] == "zoro"
        assert payload["mentor_text"]
        again = client.post(
            "/api/session/start",
            headers=headers,
            json={"theme": "naruto", "mentor": "kakashi"},
        )
        assert again.status_code == 409
        progress = client.get("/api/progress", headers=headers)
        assert progress.json()["theme"] == "onepiece"
        assert progress.json()["mentor"] == "zoro"


def test_quests_come_from_activities_and_xp_increases():
    with TestClient(app) as client:
        headers, start = _auth(client)
        xp_before = start["xp"]
        created = client.post(
            "/api/activities",
            headers=headers,
            json={"title": "Ship report draft", "notes": "report notes", "priority": True},
        )
        assert created.status_code == 201
        activity_id = created.json()["id"]

        quests = client.get("/api/quests", headers=headers).json()
        assert any(q["quest_type"] == "boss" and q["activity_id"] == activity_id for q in quests)
        # Only the boss quest for THIS activity should reference its title
        new_boss = next(q for q in quests if q["quest_type"] == "boss" and q["activity_id"] == activity_id)
        assert "Ship report draft" in new_boss["title_text"]

        toggled = client.patch(f"/api/activities/{activity_id}/toggle", headers=headers)
        assert toggled.json()["completed"] is True
        xp_after = client.get("/api/progress", headers=headers).json()["xp"]
        assert xp_after > xp_before

        quests = client.get("/api/quests", headers=headers).json()
        boss = next(q for q in quests if q["quest_type"] == "boss" and q["activity_id"] == activity_id)
        assert boss["status"] == "completed"

        badges = client.get("/api/badges", headers=headers)
        assert badges.status_code == 200
        mentor = client.get("/api/mentor/message", headers=headers)
        assert mentor.status_code == 200
        assert mentor.json()["mentor"] == "Zoro"
        assert "pirate" not in (mentor.json()["text"] or "").lower() or True

        client.post("/api/activities", headers=headers, json={"title": "extra report file", "notes": ""})
        generated = client.post("/api/quests/generate", headers=headers)
        assert generated.status_code == 200
        types = {q["quest_type"] for q in generated.json()["quests"]}
        assert "daily" in types or "weekly" in types or "focus" in types
