import requests
import sys
import json
from datetime import datetime

class HealthFusionAPITester:
    def __init__(self, base_url="https://keneyakafisa-health.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user_id = None
        self.doctor_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "status": "PASSED" if success else "FAILED",
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if headers:
            test_headers.update(headers)
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=test_headers)

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}"
            if not success:
                try:
                    error_data = response.json()
                    details += f", Error: {error_data.get('detail', 'Unknown error')}"
                except:
                    details += f", Response: {response.text[:200]}"

            self.log_test(name, success, details)
            return success, response.json() if success and response.content else {}

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_specialties(self):
        """Test specialties endpoint"""
        success, response = self.run_test(
            "Get Specialties",
            "GET",
            "specialties",
            200
        )
        if success and isinstance(response, list) and len(response) > 0:
            print(f"   Found {len(response)} specialties")
            return True
        return False

    def test_patient_registration(self):
        """Test patient registration"""
        patient_data = {
            "name": f"Test Patient {datetime.now().strftime('%H%M%S')}",
            "email": f"patient_{datetime.now().strftime('%H%M%S')}@test.com",
            "password": "TestPass123!",
            "user_type": "patient"
        }
        
        success, response = self.run_test(
            "Patient Registration",
            "POST",
            "auth/register",
            200,
            data=patient_data
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response['user']['id']
            print(f"   Patient registered with ID: {self.user_id}")
            return True
        return False

    def test_doctor_registration(self):
        """Test doctor registration"""
        doctor_data = {
            "name": f"Dr. Test {datetime.now().strftime('%H%M%S')}",
            "email": f"doctor_{datetime.now().strftime('%H%M%S')}@test.com",
            "password": "TestPass123!",
            "user_type": "doctor",
            "medical_type": "moderne",
            "specialties": ["Médecine Générale", "Cardiologie"]
        }
        
        success, response = self.run_test(
            "Doctor Registration",
            "POST",
            "auth/register",
            200,
            data=doctor_data
        )
        
        if success and 'token' in response:
            print(f"   Doctor registered with ID: {response['user']['id']}")
            return True
        return False

    def test_login(self):
        """Test login functionality"""
        # First register a test user
        test_email = f"login_test_{datetime.now().strftime('%H%M%S')}@test.com"
        register_data = {
            "name": "Login Test User",
            "email": test_email,
            "password": "TestPass123!",
            "user_type": "patient"
        }
        
        # Register user
        success, _ = self.run_test(
            "Register for Login Test",
            "POST",
            "auth/register",
            200,
            data=register_data
        )
        
        if not success:
            return False
        
        # Now test login
        login_data = {
            "email": test_email,
            "password": "TestPass123!"
        }
        
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data=login_data
        )
        
        if success and 'token' in response:
            print(f"   Login successful for user: {response['user']['name']}")
            return True
        return False

    def test_auth_me(self):
        """Test /auth/me endpoint"""
        if not self.token:
            self.log_test("Auth Me", False, "No token available")
            return False
            
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        
        if success and 'id' in response:
            print(f"   Current user: {response.get('name', 'Unknown')}")
            return True
        return False

    def test_doctor_search(self):
        """Test doctor search functionality"""
        success, response = self.run_test(
            "Search All Doctors",
            "GET",
            "doctors/search",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} doctors")
            if len(response) > 0:
                self.doctor_id = response[0]['id']
                print(f"   Using doctor ID: {self.doctor_id}")
            return True
        return False

    def test_doctor_search_with_filters(self):
        """Test doctor search with filters"""
        # Test with medical type filter
        success, response = self.run_test(
            "Search Doctors by Medical Type",
            "GET",
            "doctors/search?medical_type=moderne",
            200
        )
        
        if success:
            print(f"   Found {len(response)} modern doctors")
        
        # Test with specialty filter
        success2, response2 = self.run_test(
            "Search Doctors by Specialty",
            "GET",
            "doctors/search?specialty=Médecine Générale",
            200
        )
        
        if success2:
            print(f"   Found {len(response2)} general medicine doctors")
        
        return success and success2

    def test_doctor_profile(self):
        """Test getting doctor profile"""
        if not self.doctor_id:
            self.log_test("Get Doctor Profile", False, "No doctor ID available")
            return False
            
        success, response = self.run_test(
            "Get Doctor Profile",
            "GET",
            f"doctors/{self.doctor_id}",
            200
        )
        
        if success and 'name' in response:
            print(f"   Doctor profile: Dr. {response['name']}")
            return True
        return False

    def test_appointment_booking(self):
        """Test appointment booking"""
        if not self.token or not self.doctor_id:
            self.log_test("Book Appointment", False, "Missing token or doctor ID")
            return False
            
        appointment_data = {
            "doctor_id": self.doctor_id,
            "appointment_date": "2024-12-25",
            "appointment_time": "10:00",
            "reason": "Test consultation"
        }
        
        success, response = self.run_test(
            "Book Appointment",
            "POST",
            "appointments",
            200,
            data=appointment_data
        )
        
        if success and 'id' in response:
            print(f"   Appointment booked with ID: {response['id']}")
            return True
        return False

    def test_get_appointments(self):
        """Test getting appointments"""
        if not self.token:
            self.log_test("Get Appointments", False, "No token available")
            return False
            
        success, response = self.run_test(
            "Get User Appointments",
            "GET",
            "appointments",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} appointments")
            return True
        return False

    def test_messages(self):
        """Test messaging functionality"""
        if not self.token or not self.doctor_id:
            self.log_test("Send Message", False, "Missing token or doctor ID")
            return False
            
        message_data = {
            "recipient_id": self.doctor_id,
            "content": "Test message from patient"
        }
        
        success, response = self.run_test(
            "Send Message",
            "POST",
            "messages",
            200,
            data=message_data
        )
        
        if success and 'id' in response:
            print(f"   Message sent with ID: {response['id']}")
            return True
        return False

    def test_conversations(self):
        """Test getting conversations"""
        if not self.token:
            self.log_test("Get Conversations", False, "No token available")
            return False
            
        success, response = self.run_test(
            "Get Conversations",
            "GET",
            "conversations",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} conversations")
            return True
        return False

    def test_reviews(self):
        """Test review functionality"""
        if not self.token or not self.doctor_id:
            self.log_test("Create Review", False, "Missing token or doctor ID")
            return False
            
        review_data = {
            "doctor_id": self.doctor_id,
            "rating": 5,
            "comment": "Excellent doctor, very professional!"
        }
        
        success, response = self.run_test(
            "Create Review",
            "POST",
            "reviews",
            200,
            data=review_data
        )
        
        if success and 'id' in response:
            print(f"   Review created with ID: {response['id']}")
            
            # Test getting reviews
            success2, response2 = self.run_test(
                "Get Doctor Reviews",
                "GET",
                f"reviews/{self.doctor_id}",
                200
            )
            
            if success2:
                print(f"   Found {len(response2)} reviews for doctor")
            
            return success and success2
        return False

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting HealthFusion API Tests...")
        print(f"📍 Testing against: {self.base_url}")
        print("=" * 60)
        
        # Test basic endpoints
        self.test_specialties()
        
        # Test authentication
        self.test_patient_registration()
        self.test_doctor_registration()
        self.test_login()
        self.test_auth_me()
        
        # Test doctor functionality
        self.test_doctor_search()
        self.test_doctor_search_with_filters()
        self.test_doctor_profile()
        
        # Test patient functionality (requires authentication)
        self.test_appointment_booking()
        self.test_get_appointments()
        self.test_messages()
        self.test_conversations()
        self.test_reviews()
        
        # Print summary
        print("=" * 60)
        print(f"📊 Tests completed: {self.tests_passed}/{self.tests_run}")
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"📈 Success rate: {success_rate:.1f}%")
        
        if success_rate < 70:
            print("⚠️  WARNING: Low success rate detected!")
            return 1
        elif success_rate < 90:
            print("⚡ Some issues detected, but mostly working")
            return 0
        else:
            print("🎉 All tests passed successfully!")
            return 0

def main():
    tester = HealthFusionAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())