"""
Mobile Money Payment API Tests for HealthFusion
Tests: providers list, payment initiation, status check, sandbox confirmation
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://carezone-2.preview.emergentagent.com').rstrip('/')


class TestMobileMoneyProviders:
    """Test /api/payments/providers endpoint"""
    
    def test_get_providers_success(self):
        """Test that providers list returns successfully"""
        response = requests.get(f"{BASE_URL}/api/payments/providers")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "providers" in data, "Response should contain 'providers' key"
        assert "sandbox_mode" in data, "Response should contain 'sandbox_mode' key"
        assert data["sandbox_mode"] == True, "Should be in sandbox mode"
        
        providers = data["providers"]
        assert len(providers) == 3, f"Expected 3 providers, got {len(providers)}"
        
        # Verify provider IDs
        provider_ids = [p["id"] for p in providers]
        assert "orange_money" in provider_ids, "Orange Money should be available"
        assert "mtn_momo" in provider_ids, "MTN MoMo should be available"
        assert "moov" in provider_ids, "Moov should be available"
        
        print("✓ Providers list returned successfully with 3 providers")
    
    def test_provider_structure(self):
        """Test that each provider has required fields"""
        response = requests.get(f"{BASE_URL}/api/payments/providers")
        data = response.json()
        
        required_fields = ["id", "name", "description", "countries", "currency", "available"]
        
        for provider in data["providers"]:
            for field in required_fields:
                assert field in provider, f"Provider {provider.get('id', 'unknown')} missing field: {field}"
            assert provider["available"] == True, f"Provider {provider['id']} should be available"
        
        print("✓ All providers have required fields")


class TestPaymentInitiation:
    """Test /api/payments/initiate endpoint"""
    
    @pytest.fixture
    def valid_payment_data(self):
        return {
            "provider": "orange_money",
            "amount": 5000,
            "phone_number": "+237612345678",
            "email": "test@healthfusion.com",
            "customer_name": "Test User",
            "description": "Test payment",
            "service_type": "consultation"
        }
    
    def test_initiate_orange_money_payment(self, valid_payment_data):
        """Test initiating Orange Money payment"""
        response = requests.post(
            f"{BASE_URL}/api/payments/initiate",
            json=valid_payment_data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True, "Payment initiation should succeed"
        assert "reference_id" in data, "Response should contain reference_id"
        assert data["status"] == "PENDING", "Initial status should be PENDING"
        assert data["sandbox_mode"] == True, "Should be in sandbox mode"
        assert data["provider"] == "orange_money", "Provider should match"
        assert data["amount"] == 5000, "Amount should match"
        
        print(f"✓ Orange Money payment initiated: {data['reference_id']}")
        return data["reference_id"]
    
    def test_initiate_mtn_momo_payment(self, valid_payment_data):
        """Test initiating MTN MoMo payment"""
        valid_payment_data["provider"] = "mtn_momo"
        
        response = requests.post(
            f"{BASE_URL}/api/payments/initiate",
            json=valid_payment_data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True, "Payment initiation should succeed"
        assert data["provider"] == "mtn_momo", "Provider should match"
        
        print(f"✓ MTN MoMo payment initiated: {data['reference_id']}")
    
    def test_initiate_moov_payment(self, valid_payment_data):
        """Test initiating Moov Money payment"""
        valid_payment_data["provider"] = "moov"
        
        response = requests.post(
            f"{BASE_URL}/api/payments/initiate",
            json=valid_payment_data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True, "Payment initiation should succeed"
        assert data["provider"] == "moov", "Provider should match"
        
        print(f"✓ Moov Money payment initiated: {data['reference_id']}")
    
    def test_initiate_payment_invalid_provider(self, valid_payment_data):
        """Test payment initiation with invalid provider"""
        valid_payment_data["provider"] = "invalid_provider"
        
        response = requests.post(
            f"{BASE_URL}/api/payments/initiate",
            json=valid_payment_data
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid provider, got {response.status_code}"
        print("✓ Invalid provider correctly rejected")
    
    def test_initiate_payment_missing_fields(self):
        """Test payment initiation with missing required fields"""
        incomplete_data = {
            "provider": "orange_money",
            "amount": 5000
            # Missing phone_number, email, customer_name, etc.
        }
        
        response = requests.post(
            f"{BASE_URL}/api/payments/initiate",
            json=incomplete_data
        )
        
        assert response.status_code == 422, f"Expected 422 for missing fields, got {response.status_code}"
        print("✓ Missing fields correctly rejected with 422")


class TestPaymentStatus:
    """Test /api/payments/status/{reference_id} endpoint"""
    
    def test_get_payment_status_success(self):
        """Test getting status of an existing payment"""
        # First create a payment
        payment_data = {
            "provider": "orange_money",
            "amount": 3000,
            "phone_number": "+237612345678",
            "email": "status_test@healthfusion.com",
            "customer_name": "Status Test User",
            "description": "Status test payment",
            "service_type": "product"
        }
        
        init_response = requests.post(
            f"{BASE_URL}/api/payments/initiate",
            json=payment_data
        )
        assert init_response.status_code == 200
        reference_id = init_response.json()["reference_id"]
        
        # Now check status
        status_response = requests.get(
            f"{BASE_URL}/api/payments/status/{reference_id}?provider=orange_money"
        )
        
        assert status_response.status_code == 200, f"Expected 200, got {status_response.status_code}"
        
        data = status_response.json()
        assert data["success"] == True, "Status check should succeed"
        assert data["reference_id"] == reference_id, "Reference ID should match"
        assert "status" in data, "Response should contain status"
        assert data["amount"] == 3000, "Amount should match"
        assert data["provider"] == "orange_money", "Provider should match"
        
        print(f"✓ Payment status retrieved: {data['status']}")
    
    def test_get_payment_status_not_found(self):
        """Test getting status of non-existent payment"""
        fake_reference = "non-existent-reference-id-12345"
        
        response = requests.get(
            f"{BASE_URL}/api/payments/status/{fake_reference}"
        )
        
        assert response.status_code == 404, f"Expected 404 for non-existent payment, got {response.status_code}"
        print("✓ Non-existent payment correctly returns 404")


class TestPaymentSimulation:
    """Test /api/payments/simulate-confirmation/{reference_id} endpoint (Sandbox only)"""
    
    def test_simulate_confirmation_success(self):
        """Test simulating payment confirmation in sandbox mode"""
        # First create a payment
        payment_data = {
            "provider": "mtn_momo",
            "amount": 7500,
            "phone_number": "+237698765432",
            "email": "simulation_test@healthfusion.com",
            "customer_name": "Simulation Test User",
            "description": "Simulation test payment",
            "service_type": "consultation"
        }
        
        init_response = requests.post(
            f"{BASE_URL}/api/payments/initiate",
            json=payment_data
        )
        assert init_response.status_code == 200
        init_data = init_response.json()
        reference_id = init_data["reference_id"]
        
        # Verify initial response shows PENDING
        assert init_data["status"] == "PENDING", "Initial status from initiate should be PENDING"
        
        # Simulate confirmation (before checking status, as sandbox auto-confirms on status check)
        confirm_response = requests.post(
            f"{BASE_URL}/api/payments/simulate-confirmation/{reference_id}"
        )
        
        assert confirm_response.status_code == 200, f"Expected 200, got {confirm_response.status_code}"
        
        data = confirm_response.json()
        assert data["success"] == True, "Simulation should succeed"
        assert data["status"] == "SUCCESSFUL", "Status should be SUCCESSFUL after confirmation"
        assert "confirmed_at" in data, "Response should contain confirmed_at timestamp"
        
        # Verify status is SUCCESSFUL
        final_status = requests.get(
            f"{BASE_URL}/api/payments/status/{reference_id}?provider=mtn_momo"
        )
        assert final_status.json()["status"] == "SUCCESSFUL", "Final status should be SUCCESSFUL"
        
        print(f"✓ Payment simulation confirmed: {reference_id}")
    
    def test_simulate_confirmation_not_found(self):
        """Test simulating confirmation for non-existent payment"""
        fake_reference = "fake-reference-for-simulation"
        
        response = requests.post(
            f"{BASE_URL}/api/payments/simulate-confirmation/{fake_reference}"
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Non-existent payment simulation correctly returns 404")
    
    def test_simulate_confirmation_already_confirmed(self):
        """Test simulating confirmation for already confirmed payment"""
        # Create and confirm a payment
        payment_data = {
            "provider": "moov",
            "amount": 2000,
            "phone_number": "+229612345678",
            "email": "double_confirm@healthfusion.com",
            "customer_name": "Double Confirm Test",
            "description": "Double confirmation test",
            "service_type": "equipment"
        }
        
        init_response = requests.post(
            f"{BASE_URL}/api/payments/initiate",
            json=payment_data
        )
        reference_id = init_response.json()["reference_id"]
        
        # First confirmation
        requests.post(f"{BASE_URL}/api/payments/simulate-confirmation/{reference_id}")
        
        # Try to confirm again
        second_confirm = requests.post(
            f"{BASE_URL}/api/payments/simulate-confirmation/{reference_id}"
        )
        
        assert second_confirm.status_code == 400, f"Expected 400 for already confirmed, got {second_confirm.status_code}"
        print("✓ Already confirmed payment correctly rejected")


class TestFullPaymentFlow:
    """Test complete payment flow: providers -> initiate -> status -> confirm"""
    
    def test_complete_payment_flow_orange_money(self):
        """Test complete Orange Money payment flow"""
        print("\n=== Testing Complete Orange Money Payment Flow ===")
        
        # Step 1: Get providers
        providers_response = requests.get(f"{BASE_URL}/api/payments/providers")
        assert providers_response.status_code == 200
        providers = providers_response.json()["providers"]
        orange = next((p for p in providers if p["id"] == "orange_money"), None)
        assert orange is not None, "Orange Money should be available"
        print("Step 1: ✓ Orange Money provider available")
        
        # Step 2: Initiate payment
        payment_data = {
            "provider": "orange_money",
            "amount": 10000,
            "phone_number": "+221771234567",
            "email": "flow_test@healthfusion.com",
            "customer_name": "Flow Test User",
            "description": "Complete flow test - Orange Money",
            "service_type": "consultation"
        }
        
        init_response = requests.post(
            f"{BASE_URL}/api/payments/initiate",
            json=payment_data
        )
        assert init_response.status_code == 200
        init_data = init_response.json()
        reference_id = init_data["reference_id"]
        assert init_data["status"] == "PENDING", "Initial status from initiate should be PENDING"
        print(f"Step 2: ✓ Payment initiated with reference: {reference_id[:8]}... (status: PENDING)")
        
        # Step 3: Simulate confirmation (in sandbox, status check auto-confirms, so we confirm first)
        confirm_response = requests.post(
            f"{BASE_URL}/api/payments/simulate-confirmation/{reference_id}"
        )
        assert confirm_response.status_code == 200
        assert confirm_response.json()["status"] == "SUCCESSFUL"
        print("Step 3: ✓ Payment confirmed via simulation")
        
        # Step 4: Verify final status
        final_status = requests.get(
            f"{BASE_URL}/api/payments/status/{reference_id}?provider=orange_money"
        )
        assert final_status.status_code == 200
        final_data = final_status.json()
        assert final_data["status"] == "SUCCESSFUL"
        assert final_data["confirmed_at"] is not None
        print("Step 4: ✓ Final status is SUCCESSFUL with confirmation timestamp")
        
        print("=== Complete Orange Money Flow: SUCCESS ===\n")
    
    def test_complete_payment_flow_mtn_momo(self):
        """Test complete MTN MoMo payment flow"""
        print("\n=== Testing Complete MTN MoMo Payment Flow ===")
        
        # Initiate
        payment_data = {
            "provider": "mtn_momo",
            "amount": 15000,
            "phone_number": "+237655123456",
            "email": "mtn_flow@healthfusion.com",
            "customer_name": "MTN Flow Test",
            "description": "Complete flow test - MTN MoMo",
            "service_type": "product"
        }
        
        init_response = requests.post(f"{BASE_URL}/api/payments/initiate", json=payment_data)
        assert init_response.status_code == 200
        reference_id = init_response.json()["reference_id"]
        print(f"✓ MTN MoMo payment initiated: {reference_id[:8]}...")
        
        # Confirm
        confirm_response = requests.post(f"{BASE_URL}/api/payments/simulate-confirmation/{reference_id}")
        assert confirm_response.status_code == 200
        assert confirm_response.json()["status"] == "SUCCESSFUL"
        print("✓ MTN MoMo payment confirmed")
        
        print("=== Complete MTN MoMo Flow: SUCCESS ===\n")
    
    def test_complete_payment_flow_moov(self):
        """Test complete Moov Money payment flow"""
        print("\n=== Testing Complete Moov Money Payment Flow ===")
        
        # Initiate
        payment_data = {
            "provider": "moov",
            "amount": 8000,
            "phone_number": "+22997123456",
            "email": "moov_flow@healthfusion.com",
            "customer_name": "Moov Flow Test",
            "description": "Complete flow test - Moov Money",
            "service_type": "equipment"
        }
        
        init_response = requests.post(f"{BASE_URL}/api/payments/initiate", json=payment_data)
        assert init_response.status_code == 200
        reference_id = init_response.json()["reference_id"]
        print(f"✓ Moov Money payment initiated: {reference_id[:8]}...")
        
        # Confirm
        confirm_response = requests.post(f"{BASE_URL}/api/payments/simulate-confirmation/{reference_id}")
        assert confirm_response.status_code == 200
        assert confirm_response.json()["status"] == "SUCCESSFUL"
        print("✓ Moov Money payment confirmed")
        
        print("=== Complete Moov Money Flow: SUCCESS ===\n")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
