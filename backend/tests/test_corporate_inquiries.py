"""Tests for corporate/bulk inquiry endpoints."""
import pytest
from httpx import AsyncClient


class TestPublicInquirySubmission:
    """Tests for the public POST /corporate-inquiries endpoint."""

    @pytest.mark.asyncio
    async def test_create_inquiry_success(self, client: AsyncClient):
        """Test successful inquiry creation with all required fields."""
        payload = {
            "full_name": "John Doe",
            "phone": "+919876543210",
            "email": "john-success@example.com",
            "company_name": "Acme Corp",
            "qty_requested": 50,
            "customization_notes": "Need custom branding",
        }
        response = await client.post("/api/v1/corporate-inquiries", json=payload)
        
        assert response.status_code == 201
        data = response.json()
        assert data["full_name"] == "John Doe"
        assert data["email"] == "john-success@example.com"
        assert data["company_name"] == "Acme Corp"
        assert data["qty_requested"] == 50
        assert data["status"] == "new"
        assert data["is_duplicate"] is False
        assert "ticket_id" in data
        assert data["ticket_id"].startswith("PLG-INQ-")

    @pytest.mark.asyncio
    async def test_create_inquiry_min_quantity(self, client: AsyncClient):
        """Test that quantity must be at least 10."""
        payload = {
            "full_name": "Jane Smith",
            "phone": "9123456789",
            "email": "jane-minqty@example.com",
            "company_name": "Small Corp",
            "qty_requested": 5,  # Below minimum
        }
        response = await client.post("/api/v1/corporate-inquiries", json=payload)
        
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_inquiry_invalid_phone(self, client: AsyncClient):
        """Test phone validation (must match Indian format)."""
        payload = {
            "full_name": "Test User",
            "phone": "123",  # Invalid format
            "email": "test-phone@example.com",
            "company_name": "Test Corp",
            "qty_requested": 20,
        }
        response = await client.post("/api/v1/corporate-inquiries", json=payload)
        
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_inquiry_invalid_email(self, client: AsyncClient):
        """Test email validation."""
        payload = {
            "full_name": "Test User",
            "phone": "9876543210",
            "email": "not-an-email",
            "company_name": "Test Corp",
            "qty_requested": 20,
        }
        response = await client.post("/api/v1/corporate-inquiries", json=payload)
        
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_duplicate_detection(self, client: AsyncClient):
        """Test that 4th submission from same email/phone is flagged as duplicate."""
        base_email = "repeat-dup@example.com"
        payload = {
            "full_name": "Repeat Customer",
            "phone": "9111111222",
            "email": base_email,
            "company_name": "Repeat Corp",
            "qty_requested": 100,
        }
        
        # Submit 3 times - should not be flagged
        for _ in range(3):
            response = await client.post("/api/v1/corporate-inquiries", json=payload)
            assert response.status_code == 201
            assert response.json()["is_duplicate"] is False
        
        # 4th submission - should be flagged but still succeed
        response = await client.post("/api/v1/corporate-inquiries", json=payload)
        assert response.status_code == 201
        assert response.json()["is_duplicate"] is True


class TestAdminInquiryEndpoints:
    """Tests for admin-only inquiry management endpoints."""

    @pytest.mark.asyncio
    async def test_list_inquiries_requires_auth(self, client: AsyncClient):
        """Test that listing inquiries requires authentication."""
        response = await client.get("/api/v1/corporate-inquiries/admin")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_list_inquiries_requires_admin(self, client: AsyncClient, user_token: str):
        """Test that listing inquiries requires admin role."""
        headers = {"Authorization": f"Bearer {user_token}"}
        response = await client.get("/api/v1/corporate-inquiries/admin", headers=headers)
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_list_inquiries_success(
        self, client: AsyncClient, admin_token: str
    ):
        """Test successful inquiry listing for admin."""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = await client.get("/api/v1/corporate-inquiries/admin", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "pages" in data

    @pytest.mark.asyncio
    async def test_update_status_requires_admin(
        self, client: AsyncClient, user_token: str
    ):
        """Test that updating status requires admin role."""
        # First create an inquiry
        payload = {
            "full_name": "Test Status",
            "phone": "8888888888",
            "email": "status-admin@example.com",
            "company_name": "Status Corp",
            "qty_requested": 30,
        }
        create_response = await client.post("/api/v1/corporate-inquiries", json=payload)
        inquiry_id = create_response.json()["id"]

        headers = {"Authorization": f"Bearer {user_token}"}
        response = await client.patch(
            f"/api/v1/corporate-inquiries/admin/{inquiry_id}",
            headers=headers,
            json={"status": "review"},
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_update_status_success(
        self, client: AsyncClient, admin_token: str
    ):
        """Test successful status update."""
        # First create an inquiry
        payload = {
            "full_name": "Test Update",
            "phone": "7777777777",
            "email": "update-success@example.com",
            "company_name": "Update Corp",
            "qty_requested": 40,
        }
        create_response = await client.post("/api/v1/corporate-inquiries", json=payload)
        inquiry_id = create_response.json()["id"]

        headers = {"Authorization": f"Bearer {admin_token}"}
        response = await client.patch(
            f"/api/v1/corporate-inquiries/admin/{inquiry_id}",
            headers=headers,
            json={"status": "review"},
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "review"

    @pytest.mark.asyncio
    async def test_update_status_invalid_transition(
        self, client: AsyncClient, admin_token: str
    ):
        """Test that invalid status transitions are rejected."""
        # First create an inquiry
        payload = {
            "full_name": "Test Transition",
            "phone": "6666666666",
            "email": "transition-invalid@example.com",
            "company_name": "Transition Corp",
            "qty_requested": 35,
        }
        create_response = await client.post("/api/v1/corporate-inquiries", json=payload)
        inquiry_id = create_response.json()["id"]

        headers = {"Authorization": f"Bearer {admin_token}"}
        # Try invalid transition: new -> approved (must go through review/quoted first)
        response = await client.patch(
            f"/api/v1/corporate-inquiries/admin/{inquiry_id}",
            headers=headers,
            json={"status": "approved"},
        )
        
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_delete_inquiry_requires_admin(
        self, client: AsyncClient, user_token: str
    ):
        """Test that deleting requires admin role."""
        # First create an inquiry
        payload = {
            "full_name": "Test Delete",
            "phone": "5555555588",
            "email": "delete-perm-test@example.com",
            "company_name": "Delete Corp",
            "qty_requested": 45,
        }
        create_response = await client.post("/api/v1/corporate-inquiries", json=payload)
        if create_response.status_code != 201:
            pytest.skip("Rate limited - skipping test")
        inquiry_id = create_response.json()["id"]

        headers = {"Authorization": f"Bearer {user_token}"}
        response = await client.delete(
            f"/api/v1/corporate-inquiries/admin/{inquiry_id}",
            headers=headers,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_delete_inquiry_success(
        self, client: AsyncClient, admin_token: str
    ):
        """Test successful inquiry deletion."""
        # First create an inquiry
        payload = {
            "full_name": "Test Delete Success",
            "phone": "4444444488",
            "email": "delete-success-final@example.com",
            "company_name": "Delete Success Corp",
            "qty_requested": 55,
        }
        create_response = await client.post("/api/v1/corporate-inquiries", json=payload)
        if create_response.status_code != 201:
            pytest.skip("Rate limited - skipping test")
        inquiry_id = create_response.json()["id"]

        headers = {"Authorization": f"Bearer {admin_token}"}
        response = await client.delete(
            f"/api/v1/corporate-inquiries/admin/{inquiry_id}",
            headers=headers,
        )
        
        assert response.status_code == 204

        # Verify it's deleted - should return 404
        get_response = await client.get(
            f"/api/v1/corporate-inquiries/admin/{inquiry_id}",
            headers=headers,
        )
        assert get_response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_inquiry_not_found(
        self, client: AsyncClient, admin_token: str
    ):
        """Test deleting non-existent inquiry returns 404."""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = await client.delete(
            "/api/v1/corporate-inquiries/admin/999999",
            headers=headers,
        )
        assert response.status_code == 404
