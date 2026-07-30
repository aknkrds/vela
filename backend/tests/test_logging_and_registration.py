import os
import pytest
from httpx import AsyncClient, ASGITransport
from backend.server import app, access_log_file, error_log_file

@pytest.fixture
def anyio_backend():
    return "asyncio"

@pytest.mark.anyio
async def test_health_check_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data

@pytest.mark.anyio
async def test_access_log_created_on_request():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        await ac.get("/api/health")
        assert os.path.exists(access_log_file)

@pytest.mark.anyio
async def test_registration_validation_error_logging():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post("/api/auth/register", json={"email": "invalid-email"})
        assert res.status_code == 422
        assert os.path.exists(error_log_file)
