"""Tests for project creation and API key generation/revocation."""

import pytest
from httpx import AsyncClient


async def _get_auth_token(client: AsyncClient) -> str:
    res = await client.post(
        "/v1/auth/register",
        json={"email": "owner@project.com", "password": "OwnerPassword123"},
    )
    return res.json()["access_token"]


@pytest.mark.asyncio
async def test_project_crud_and_api_keys(client: AsyncClient):
    token = await _get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create project
    proj_res = await client.post(
        "/v1/projects",
        json={
            "name": "Analytics Bot",
            "description": "Observability for analytics bot",
        },
        headers=headers,
    )
    assert proj_res.status_code == 201
    proj_data = proj_res.json()
    project_id = proj_data["id"]
    assert proj_data["name"] == "Analytics Bot"

    # 2. List projects
    list_res = await client.get("/v1/projects", headers=headers)
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1

    # 3. Create API key
    key_res = await client.post(
        f"/v1/projects/{project_id}/api-keys",
        json={"name": "Dev Key"},
        headers=headers,
    )
    assert key_res.status_code == 201
    key_data = key_res.json()
    assert "raw_key" in key_data
    raw_key = key_data["raw_key"]
    key_id = key_data["id"]
    assert raw_key.startswith("tl_live_")

    # 4. List keys (raw key must NOT be present in list)
    keys_list_res = await client.get(
        f"/v1/projects/{project_id}/api-keys", headers=headers
    )
    assert keys_list_res.status_code == 200
    keys = keys_list_res.json()
    assert len(keys) == 1
    assert "raw_key" not in keys[0]

    # 5. Revoke key
    revoke_res = await client.delete(
        f"/v1/projects/{project_id}/api-keys/{key_id}", headers=headers
    )
    assert revoke_res.status_code == 204
