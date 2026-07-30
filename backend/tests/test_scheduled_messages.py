import os
import pytest
from datetime import datetime, timedelta
from httpx import AsyncClient, ASGITransport
from backend.server import app, db, access_log_file

@pytest.fixture
def anyio_backend():
    return "asyncio"

@pytest.mark.anyio
async def test_scheduled_message_flow():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        email = f"test_scheduled_{datetime.utcnow().timestamp()}@example.com"
        payload = {
            "email": email,
            "password": "Password123!",
            "full_name": "Scheduled Test User",
            "phone": f"+90555111{int(datetime.utcnow().timestamp()) % 10000:04d}"
        }
        res = await ac.post("/api/auth/register", json=payload)
        data = res.json()
        assert res.status_code == 200, f"Register failed: {data}"
        token = data["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Validation test: missing scheduled_at
        res1 = await ac.post(
            "/api/messages",
            headers=headers,
            json={
                "recipient_id": "507f1f77bcf86cd799439011",
                "message_type": "text",
                "content": "encrypted-test-content",
                "encryption_password": "pass",
                "delivery_mode": "scheduled_date"
            }
        )
        assert res1.status_code == 400
        assert "tarih ve saat" in res1.json()["detail"]

        # 2. Validation test: past date
        past_date = (datetime.utcnow() - timedelta(days=1)).isoformat()
        res2 = await ac.post(
            "/api/messages",
            headers=headers,
            json={
                "recipient_id": "507f1f77bcf86cd799439011",
                "message_type": "text",
                "content": "encrypted-test-content",
                "encryption_password": "pass",
                "delivery_mode": "scheduled_date",
                "scheduled_at": past_date
            }
        )
        assert res2.status_code == 400
        assert "gelecekteki" in res2.json()["detail"]

        # 3. Successful scheduled message creation
        future_date = (datetime.utcnow() + timedelta(days=30)).isoformat()
        res3 = await ac.post(
            "/api/messages",
            headers=headers,
            json={
                "recipient_id": "507f1f77bcf86cd799439011",
                "message_type": "text",
                "content": "encrypted-scheduled-content",
                "encryption_password": "pass",
                "delivery_mode": "scheduled_date",
                "scheduled_at": future_date,
                "delivery_channel": "both"
            }
        )
        assert res3.status_code == 200
        msg_data = res3.json()
        assert msg_data["delivery_mode"] == "scheduled_date"
        assert msg_data["status"] == "pending"

        # 4. List messages
        res_list = await ac.get("/api/messages", headers=headers)
        assert res_list.status_code == 200
        items = res_list.json()
        assert len(items) >= 1
        found = [m for m in items if m["_id"] == msg_data["_id"]]
        assert len(found) == 1
        assert found[0]["delivery_mode"] == "scheduled_date"
