import pytest
from datetime import datetime
from httpx import AsyncClient, ASGITransport
from backend.server import app

@pytest.fixture
def anyio_backend():
    return "asyncio"

@pytest.mark.anyio
async def test_avatar_and_pin_reset_flow():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        email = f"test_avatar_{datetime.utcnow().timestamp()}@example.com"
        password = "Password123!"
        payload = {
            "email": email,
            "password": password,
            "full_name": "Avatar Test User",
            "phone": f"+90555222{int(datetime.utcnow().timestamp()) % 10000:04d}"
        }
        res = await ac.post("/api/auth/register", json=payload)
        data = res.json()
        assert res.status_code == 200, f"Register failed: {data}"
        token = data["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Upload Avatar
        dummy_base64 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD..."
        res_avatar = await ac.post(
            "/api/users/avatar",
            headers=headers,
            json={"picture": dummy_base64}
        )
        assert res_avatar.status_code == 200
        user_data = res_avatar.json()
        assert user_data["picture"] == dummy_base64

        # 2. Delete Avatar
        res_del = await ac.delete("/api/users/avatar", headers=headers)
        assert res_del.status_code == 200
        user_del_data = res_del.json()
        assert "picture" not in user_del_data or user_del_data.get("picture") is None

        # 3. Password Verification for PIN Reset
        res_login = await ac.post("/api/auth/login", json={"email": email, "password": password})
        assert res_login.status_code == 200
        assert "access_token" in res_login.json()
