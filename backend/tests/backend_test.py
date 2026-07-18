"""Backend API tests for Final Message app.

Covers:
  - Google Auth endpoints (session/me/logout)
  - Existing JWT email/password auth (register/login/me)
  - Backward compatibility for admin user (user_id backfill)
  - Existing endpoints (recipients, messages, checkin, subscription, admin)
  - MongoDB indexes
"""
import os
import uuid
import pytest
import requests
from pymongo import MongoClient

BASE_URL = (
    os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or os.environ.get("EXPO_BACKEND_URL")
    or "https://last-words-5.preview.emergentagent.com"
).rstrip("/")

ADMIN_EMAIL = "akin@symi.com.tr"
ADMIN_PASSWORD = "DorukNaz2010"


# --- Fixtures ------------------------------------------------------------
@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token(api):
    r = api.post(f"{BASE_URL}/api/auth/login",
                 json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def new_user(api):
    """Register a fresh user for testing."""
    unique = uuid.uuid4().hex[:8]
    payload = {
        "email": f"TEST_user_{unique}@example.com",
        "password": "TestPass123!",
        "full_name": "TEST User",
        "phone": "+15551234567",
    }
    r = api.post(f"{BASE_URL}/api/auth/register", json=payload)
    assert r.status_code == 200, f"Register failed: {r.status_code} {r.text}"
    data = r.json()
    return {"email": payload["email"], "password": payload["password"],
            "token": data["access_token"], "user": data["user"]}


# --- Existing JWT Auth ---------------------------------------------------
class TestJWTAuth:
    def test_admin_login_returns_token_and_user_id(self, api):
        r = api.post(f"{BASE_URL}/api/auth/login",
                     json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "access_token" in data
        assert data.get("token_type") == "bearer"
        user = data["user"]
        assert user["email"] == ADMIN_EMAIL
        # Backfill user_id check
        assert user.get("user_id"), "Admin user missing user_id after login (backfill failed)"
        assert user["user_id"].startswith("user_")

    def test_login_invalid_password(self, api):
        r = api.post(f"{BASE_URL}/api/auth/login",
                     json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_register_sets_user_id_and_auth_provider(self, new_user):
        u = new_user["user"]
        assert u.get("user_id", "").startswith("user_"), f"missing user_id: {u}"
        assert u.get("auth_provider") == "email"
        assert u.get("subscription_tier") == "free"

    def test_users_me_with_jwt(self, api, admin_token):
        r = api.get(f"{BASE_URL}/api/users/me",
                    headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200, r.text
        assert r.json()["email"] == ADMIN_EMAIL

    def test_auth_me_with_jwt(self, api, admin_token):
        r = api.get(f"{BASE_URL}/api/auth/me",
                    headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["email"] == ADMIN_EMAIL
        assert "password_hash" not in body

    def test_auth_me_no_token(self, api):
        r = api.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_auth_me_bad_token(self, api):
        r = api.get(f"{BASE_URL}/api/auth/me",
                    headers={"Authorization": "Bearer not-a-real-token"})
        assert r.status_code == 401


# --- Google Auth Endpoints ----------------------------------------------
class TestGoogleAuth:
    def test_google_session_missing_id(self, api):
        r = api.post(f"{BASE_URL}/api/auth/google/session", json={})
        assert r.status_code == 400, r.text
        assert "session_id" in r.text.lower()

    def test_google_session_invalid_id(self, api):
        r = api.post(f"{BASE_URL}/api/auth/google/session",
                     json={"session_id": "invalid_session_id_xyz_" + uuid.uuid4().hex})
        # Emergent auth should reject -> we return 401
        assert r.status_code == 401, f"Expected 401 for invalid session, got {r.status_code}: {r.text}"

    def test_logout_without_token(self, api):
        # Should succeed silently (no error), returns success
        r = api.post(f"{BASE_URL}/api/auth/logout")
        assert r.status_code == 200
        assert r.json().get("success") is True

    def test_logout_with_fake_token(self, api):
        r = api.post(f"{BASE_URL}/api/auth/logout",
                     headers={"Authorization": "Bearer fake_session_token"})
        assert r.status_code == 200
        assert r.json().get("success") is True


# --- Existing endpoints continue to work with JWT ------------------------
class TestExistingEndpointsWithJWT:
    def _hdr(self, tok):
        return {"Authorization": f"Bearer {tok}"}

    def test_recipients_list(self, api, admin_token):
        r = api.get(f"{BASE_URL}/api/recipients", headers=self._hdr(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_messages_list(self, api, admin_token):
        r = api.get(f"{BASE_URL}/api/messages", headers=self._hdr(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_subscription_plans_public(self, api):
        r = api.get(f"{BASE_URL}/api/subscriptions/plans")
        assert r.status_code == 200
        plans = r.json()
        assert isinstance(plans, list) and len(plans) >= 8

    def test_checkin(self, api, admin_token):
        r = api.post(f"{BASE_URL}/api/users/checkin", headers=self._hdr(admin_token))
        assert r.status_code == 200
        body = r.json()
        assert body.get("success") is True
        assert "streak" in body

    def test_checkin_history(self, api, admin_token):
        r = api.get(f"{BASE_URL}/api/users/checkin-history",
                    headers=self._hdr(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_stats(self, api, admin_token):
        r = api.get(f"{BASE_URL}/api/admin/stats", headers=self._hdr(admin_token))
        assert r.status_code == 200
        body = r.json()
        assert "total_users" in body

    def test_admin_users_list(self, api, admin_token):
        r = api.get(f"{BASE_URL}/api/admin/users", headers=self._hdr(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_new_user_token_works(self, api, new_user):
        r = api.get(f"{BASE_URL}/api/users/me",
                    headers=self._hdr(new_user["token"]))
        assert r.status_code == 200
        assert r.json()["email"] == new_user["email"]

    def test_new_user_auth_me_works(self, api, new_user):
        r = api.get(f"{BASE_URL}/api/auth/me",
                    headers=self._hdr(new_user["token"]))
        assert r.status_code == 200
        body = r.json()
        assert body["email"] == new_user["email"]
        assert body.get("auth_provider") == "email"


# --- MongoDB indexes ----------------------------------------------------
class TestMongoIndexes:
    @pytest.fixture(scope="class")
    def db(self):
        from dotenv import load_dotenv
        load_dotenv("/app/backend/.env")
        url = os.environ.get("MONGO_URL")
        name = os.environ.get("DB_NAME")
        if not url or not name:
            pytest.skip("MONGO_URL/DB_NAME not set")
        return MongoClient(url)[name]

    def test_users_email_unique(self, db):
        idx = db.users.index_information()
        found = any(
            v.get("unique") and v["key"] == [("email", 1)]
            for v in idx.values()
        )
        assert found, f"users.email unique index missing. Got: {list(idx.keys())}"

    def test_users_user_id_unique(self, db):
        idx = db.users.index_information()
        found = any(
            v.get("unique") and v["key"] == [("user_id", 1)]
            for v in idx.values()
        )
        assert found, f"users.user_id unique index missing. Got: {list(idx.keys())}"

    def test_user_sessions_token_unique(self, db):
        idx = db.user_sessions.index_information()
        found = any(
            v.get("unique") and v["key"] == [("session_token", 1)]
            for v in idx.values()
        )
        assert found, f"user_sessions.session_token unique index missing. Got: {list(idx.keys())}"

    def test_user_sessions_expires_ttl(self, db):
        idx = db.user_sessions.index_information()
        found = any(
            v.get("expireAfterSeconds") == 0 and v["key"] == [("expires_at", 1)]
            for v in idx.values()
        )
        assert found, f"user_sessions.expires_at TTL index missing. Got: {list(idx.keys())}"


# --- Cleanup ------------------------------------------------------------
@pytest.fixture(scope="session", autouse=True)
def _cleanup_test_users():
    yield
    try:
        from dotenv import load_dotenv
        load_dotenv("/app/backend/.env")
        url = os.environ.get("MONGO_URL")
        name = os.environ.get("DB_NAME")
        if url and name:
            db = MongoClient(url)[name]
            db.users.delete_many({"email": {"$regex": "^TEST_user_"}})
    except Exception:
        pass
