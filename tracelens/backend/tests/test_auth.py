"""Tests for user registration, login, and JWT authentication."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_and_login_flow(client: AsyncClient):
    """Test user registration, login, and fetching profile with JWT."""
    # 1. Register
    reg_res = await client.post(
        "/v1/auth/register",
        json={
            "email": "alice@example.com",
            "password": "SecurePassword123!",
            "full_name": "Alice Developer",
        },
    )
    assert reg_res.status_code == 201
    data = reg_res.json()
    assert "access_token" in data
    assert data["email"] == "alice@example.com"
    token = data["access_token"]

    # 2. Get profile with JWT
    me_res = await client.get(
        "/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "alice@example.com"

    # 3. Login
    login_res = await client.post(
        "/v1/auth/login",
        json={"email": "alice@example.com", "password": "SecurePassword123!"},
    )
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()


@pytest.mark.asyncio
async def test_invalid_login_rejected(client: AsyncClient):
    """Verify bad passwords return 401."""
    await client.post(
        "/v1/auth/register",
        json={"email": "bob@example.com", "password": "CorrectPassword1"},
    )

    bad_login = await client.post(
        "/v1/auth/login",
        json={"email": "bob@example.com", "password": "WrongPasswordX"},
    )
    assert bad_login.status_code == 401
    assert "Incorrect email or password" in bad_login.json()["detail"]


@pytest.mark.asyncio
async def test_duplicate_registration_rejected(client: AsyncClient):
    """Verify duplicate email returns 400."""
    await client.post(
        "/v1/auth/register",
        json={"email": "charlie@example.com", "password": "Password123"},
    )
    dup = await client.post(
        "/v1/auth/register",
        json={"email": "charlie@example.com", "password": "AnotherPassword"},
    )
    assert dup.status_code == 400
