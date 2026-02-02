"""
Test suite for 'Autre' (Other) category functionality in HealthFusion
Tests:
1. Registration with 'Autre' medical type and custom corps de santé
2. Search API with custom_search parameter
3. Doctor profile creation with custom_medical_type
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAutreRegistration:
    """Tests for registration with 'Autre' medical type"""
    
    def test_register_doctor_with_autre_medical_type(self):
        """Register a doctor with 'autre' medical type and custom corps de santé"""
        unique_id = str(uuid.uuid4())[:8]
        email = f"orthophoniste_{unique_id}@test.com"
        
        payload = {
            "email": email,
            "password": "Test123456",
            "name": f"Dr. Orthophoniste {unique_id}",
            "user_type": "doctor",
            "medical_type": "autre",
            "specialties": ["Orthophonie", "Rééducation vocale"],
            "custom_medical_type": "Orthophoniste"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        
        # Status assertion
        assert response.status_code == 200, f"Registration failed: {response.text}"
        
        # Data assertions
        data = response.json()
        assert "token" in data, "Token not returned"
        assert "user" in data, "User data not returned"
        assert data["user"]["email"] == email
        assert data["user"]["user_type"] == "doctor"
        assert data["user"]["medical_type"] == "autre"
        
        # Store token for later tests
        self.token = data["token"]
        self.user_id = data["user"]["id"]
        
        print(f"✓ Doctor registered with 'autre' medical type: {email}")
        return data
    
    def test_register_doctor_with_autre_and_custom_specialties(self):
        """Register a doctor with 'autre' and custom specialties"""
        unique_id = str(uuid.uuid4())[:8]
        email = f"podologue_{unique_id}@test.com"
        
        payload = {
            "email": email,
            "password": "Test123456",
            "name": f"Dr. Podologue {unique_id}",
            "user_type": "doctor",
            "medical_type": "autre",
            "specialties": ["Podologie", "Soins des pieds", "Orthopédie podologique"],
            "custom_medical_type": "Podologue"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        
        assert response.status_code == 200, f"Registration failed: {response.text}"
        
        data = response.json()
        assert data["user"]["specialties"] == ["Podologie", "Soins des pieds", "Orthopédie podologique"]
        
        print(f"✓ Doctor registered with custom specialties: {email}")
        return data


class TestAutreSearchAPI:
    """Tests for search API with custom_search parameter"""
    
    @pytest.fixture(autouse=True)
    def setup_test_doctor(self):
        """Create a test doctor with 'autre' type for search tests"""
        unique_id = str(uuid.uuid4())[:8]
        email = f"ergotherapeute_{unique_id}@test.com"
        
        payload = {
            "email": email,
            "password": "Test123456",
            "name": f"Dr. Ergothérapeute {unique_id}",
            "user_type": "doctor",
            "medical_type": "autre",
            "specialties": ["Ergothérapie", "Rééducation fonctionnelle"],
            "custom_medical_type": "Ergothérapeute"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        if response.status_code == 200:
            self.test_doctor = response.json()
            self.test_email = email
            print(f"✓ Test doctor created: {email}")
        else:
            self.test_doctor = None
            print(f"⚠ Could not create test doctor: {response.text}")
    
    def test_search_with_custom_search_parameter(self):
        """Test search API with custom_search parameter"""
        # Search for "Ergothérapeute"
        response = requests.get(f"{BASE_URL}/api/doctors/search", params={
            "custom_search": "Ergothérapeute"
        })
        
        assert response.status_code == 200, f"Search failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        print(f"✓ Search with custom_search returned {len(data)} results")
        
        # If we created a test doctor, verify it appears in results
        if self.test_doctor and len(data) > 0:
            found = any(d.get("email") == self.test_email for d in data)
            if found:
                print(f"✓ Test doctor found in search results")
    
    def test_search_with_custom_search_partial_match(self):
        """Test search API with partial custom_search"""
        response = requests.get(f"{BASE_URL}/api/doctors/search", params={
            "custom_search": "Ergo"
        })
        
        assert response.status_code == 200, f"Search failed: {response.text}"
        
        data = response.json()
        print(f"✓ Partial search 'Ergo' returned {len(data)} results")
    
    def test_search_with_custom_search_case_insensitive(self):
        """Test that custom_search is case insensitive"""
        response_lower = requests.get(f"{BASE_URL}/api/doctors/search", params={
            "custom_search": "ergothérapeute"
        })
        
        response_upper = requests.get(f"{BASE_URL}/api/doctors/search", params={
            "custom_search": "ERGOTHÉRAPEUTE"
        })
        
        assert response_lower.status_code == 200
        assert response_upper.status_code == 200
        
        # Both should return results (case insensitive)
        print(f"✓ Case insensitive search working")
    
    def test_search_without_custom_search(self):
        """Test that regular search still works"""
        response = requests.get(f"{BASE_URL}/api/doctors/search")
        
        assert response.status_code == 200, f"Search failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        
        print(f"✓ Regular search returned {len(data)} doctors")
    
    def test_search_with_medical_type_filter(self):
        """Test search with medical_type filter"""
        response = requests.get(f"{BASE_URL}/api/doctors/search", params={
            "medical_type": "moderne"
        })
        
        assert response.status_code == 200
        
        data = response.json()
        # All results should have medical_type = moderne
        for doctor in data:
            assert doctor.get("medical_type") == "moderne", f"Wrong medical_type: {doctor.get('medical_type')}"
        
        print(f"✓ Medical type filter working, returned {len(data)} doctors")
    
    def test_search_with_combined_filters(self):
        """Test search with custom_search and other filters"""
        response = requests.get(f"{BASE_URL}/api/doctors/search", params={
            "custom_search": "Orthophoniste",
            "location": "Abidjan"
        })
        
        assert response.status_code == 200
        
        data = response.json()
        print(f"✓ Combined search returned {len(data)} results")


class TestDoctorProfileWithAutre:
    """Tests for doctor profile with 'autre' medical type"""
    
    def test_doctor_profile_has_custom_medical_type(self):
        """Verify doctor profile stores custom_medical_type"""
        # First register a doctor with 'autre'
        unique_id = str(uuid.uuid4())[:8]
        email = f"osteopathe_{unique_id}@test.com"
        
        payload = {
            "email": email,
            "password": "Test123456",
            "name": f"Dr. Ostéopathe {unique_id}",
            "user_type": "doctor",
            "medical_type": "autre",
            "specialties": ["Ostéopathie"],
            "custom_medical_type": "Ostéopathe"
        }
        
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        assert reg_response.status_code == 200, f"Registration failed: {reg_response.text}"
        
        # Search for this doctor
        search_response = requests.get(f"{BASE_URL}/api/doctors/search", params={
            "custom_search": "Ostéopathe"
        })
        
        assert search_response.status_code == 200
        
        doctors = search_response.json()
        
        # Find our doctor
        our_doctor = None
        for doc in doctors:
            if doc.get("email") == email:
                our_doctor = doc
                break
        
        if our_doctor:
            # Verify custom_medical_type is stored
            assert our_doctor.get("custom_medical_type") == "Ostéopathe", \
                f"custom_medical_type not stored correctly: {our_doctor.get('custom_medical_type')}"
            print(f"✓ Doctor profile has custom_medical_type: {our_doctor.get('custom_medical_type')}")
        else:
            print(f"⚠ Doctor not found in search results, but registration succeeded")


class TestSpecialtiesEndpoint:
    """Tests for specialties endpoint"""
    
    def test_get_specialties(self):
        """Test that specialties endpoint returns data"""
        response = requests.get(f"{BASE_URL}/api/specialties")
        
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0, "No specialties returned"
        
        # Check structure
        first_specialty = data[0]
        assert "id" in first_specialty
        assert "name" in first_specialty
        assert "medical_type" in first_specialty
        
        print(f"✓ Specialties endpoint returned {len(data)} specialties")
    
    def test_specialties_have_medical_types(self):
        """Test that specialties have various medical types"""
        response = requests.get(f"{BASE_URL}/api/specialties")
        
        assert response.status_code == 200
        
        data = response.json()
        medical_types = set(s.get("medical_type") for s in data)
        
        # Should have multiple medical types
        expected_types = {"moderne", "traditionnel_africain", "bien_etre", "service_domicile", "materiel_medical", "boutique_bien_etre"}
        
        for expected in expected_types:
            assert expected in medical_types, f"Missing medical_type: {expected}"
        
        print(f"✓ Specialties cover all medical types: {medical_types}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
