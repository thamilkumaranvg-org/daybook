from pathlib import Path
from starlette.testclient import TestClient
from backend.main import app
from backend.catalog import THEMES

client = TestClient(app)
ROOT = Path(__file__).resolve().parent.parent

EXPECTED_MENTORS = [
    "luffy", "zoro", "rayleigh",
    "asta", "yami",
    "urahara", "ichigo", "aizen",
    "naruto", "kakashi", "guy"
]

def test_all_11_mentor_assets_exist():
    assets_dir = ROOT / "assets" / "mentors"
    frontend_assets_dir = ROOT / "frontend" / "assets" / "mentors"
    
    assert assets_dir.is_dir()
    assert frontend_assets_dir.is_dir()

    for m in EXPECTED_MENTORS:
        asset_name = "might-guy" if m == "guy" else m
        # Check both webp and png
        assert (assets_dir / f"{asset_name}.webp").exists(), f"Missing {asset_name}.webp in assets"
        assert (assets_dir / f"{asset_name}.png").exists(), f"Missing {asset_name}.png in assets"
        assert (frontend_assets_dir / f"{asset_name}.webp").exists(), f"Missing {asset_name}.webp in frontend"

def test_static_asset_endpoint_serves_mentor_images():
    for m in ["luffy", "zoro", "asta", "ichigo", "naruto"]:
        res = client.get(f"/assets/mentors/{m}.webp")
        assert res.status_code == 200
        assert "image" in res.headers["content-type"] or "webp" in res.headers["content-type"]

def test_mentor_message_returns_quotes():
    # Login and start session
    login_res = client.post("/api/login", json={"username": "user1", "password": "demo1234"})
    assert login_res.status_code == 200
    token = login_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    sess_res = client.post(
        "/api/session/start",
        json={"theme": "onepiece", "mentor": "zoro"},
        headers=headers,
    )
    assert sess_res.status_code in (200, 409)

    msg_res = client.get("/api/mentor/message", headers=headers)
    assert msg_res.status_code == 200
    data = msg_res.json()
    assert data["mentor"] == "Zoro"
    assert data["mentor_id"] == "zoro"
    assert len(data["quotes"]) > 0
