import pytest
import os
import asyncio
import motor.motor_asyncio
import backend.server as server_mod

@pytest.fixture(autouse=True)
def reset_motor_client():
    mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.getenv('DB_NAME', 'veladb')
    server_mod.client = motor.motor_asyncio.AsyncIOMotorClient(mongo_url)
    server_mod.db = server_mod.client[db_name]
