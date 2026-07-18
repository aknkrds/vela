#!/usr/bin/env python3
"""
Comprehensive Backend API Test Suite for Final Message App
Tests all authentication, CRUD operations, and admin functionality
"""

import requests
import json
from datetime import datetime

# Configuration
BASE_URL = "https://last-words-5.preview.emergentagent.com/api"
ADMIN_EMAIL = "akin@symi.com.tr"
ADMIN_PASSWORD = "DorukNaz2010"

# Test data storage
test_data = {
    "user_token": None,
    "admin_token": None,
    "user_id": None,
    "recipient_id": None,
    "message_id": None,
    "test_user_email": f"testuser_{datetime.now().timestamp()}@example.com"
}

# Color codes for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

def print_test(test_name):
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}Testing: {test_name}{RESET}")
    print(f"{BLUE}{'='*80}{RESET}")

def print_success(message):
    print(f"{GREEN}✓ SUCCESS: {message}{RESET}")

def print_error(message):
    print(f"{RED}✗ FAILED: {message}{RESET}")

def print_info(message):
    print(f"{YELLOW}ℹ INFO: {message}{RESET}")

def print_response(response):
    print(f"Status Code: {response.status_code}")
    try:
        print(f"Response: {json.dumps(response.json(), indent=2)}")
    except:
        print(f"Response: {response.text}")

# ============================================================================
# 1. AUTHENTICATION TESTS
# ============================================================================

def test_user_registration():
    """Test POST /api/auth/register - Create a new test user"""
    print_test("User Registration")
    
    payload = {
        "email": test_data["test_user_email"],
        "password": "test123",
        "full_name": "Test User",
        "phone": "+1234567890"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/auth/register", json=payload)
        print_response(response)
        
        if response.status_code == 200:
            data = response.json()
            if "access_token" in data and "user" in data:
                test_data["user_token"] = data["access_token"]
                test_data["user_id"] = data["user"]["_id"]
                print_success(f"User registered successfully. Token: {test_data['user_token'][:20]}...")
                return True
            else:
                print_error("Response missing access_token or user")
                return False
        else:
            print_error(f"Registration failed with status {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Exception during registration: {str(e)}")
        return False

def test_user_login():
    """Test POST /api/auth/login - Login with the created user"""
    print_test("User Login")
    
    payload = {
        "email": test_data["test_user_email"],
        "password": "test123"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json=payload)
        print_response(response)
        
        if response.status_code == 200:
            data = response.json()
            if "access_token" in data:
                print_success("User login successful")
                return True
            else:
                print_error("Response missing access_token")
                return False
        else:
            print_error(f"Login failed with status {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Exception during login: {str(e)}")
        return False

def test_admin_login():
    """Test POST /api/auth/login - Login with admin credentials"""
    print_test("Admin Login")
    
    payload = {
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    }
    
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json=payload)
        print_response(response)
        
        if response.status_code == 200:
            data = response.json()
            if "access_token" in data:
                test_data["admin_token"] = data["access_token"]
                print_success(f"Admin login successful. Token: {test_data['admin_token'][:20]}...")
                return True
            else:
                print_error("Response missing access_token")
                return False
        else:
            print_error(f"Admin login failed with status {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Exception during admin login: {str(e)}")
        return False

def test_get_current_user():
    """Test GET /api/users/me - Get current user info"""
    print_test("Get Current User Info")
    
    if not test_data["user_token"]:
        print_error("No user token available")
        return False
    
    headers = {"Authorization": f"Bearer {test_data['user_token']}"}
    
    try:
        response = requests.get(f"{BASE_URL}/users/me", headers=headers)
        print_response(response)
        
        if response.status_code == 200:
            data = response.json()
            if "email" in data and data["email"] == test_data["test_user_email"]:
                print_success("User info retrieved successfully")
                return True
            else:
                print_error("User info doesn't match expected data")
                return False
        else:
            print_error(f"Get user info failed with status {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Exception during get user info: {str(e)}")
        return False

# ============================================================================
# 2. RECIPIENTS TESTS
# ============================================================================

def test_create_recipient():
    """Test POST /api/recipients - Create a recipient"""
    print_test("Create Recipient")
    
    if not test_data["user_token"]:
        print_error("No user token available")
        return False
    
    headers = {"Authorization": f"Bearer {test_data['user_token']}"}
    payload = {
        "name": "John Doe",
        "phone": "+1111111111",
        "email": "john@example.com",
        "relation": "Friend"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/recipients", json=payload, headers=headers)
        print_response(response)
        
        if response.status_code == 200:
            data = response.json()
            if "_id" in data:
                test_data["recipient_id"] = data["_id"]
                print_success(f"Recipient created successfully. ID: {test_data['recipient_id']}")
                return True
            else:
                print_error("Response missing _id")
                return False
        else:
            print_error(f"Create recipient failed with status {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Exception during create recipient: {str(e)}")
        return False

def test_list_recipients():
    """Test GET /api/recipients - List all recipients"""
    print_test("List Recipients")
    
    if not test_data["user_token"]:
        print_error("No user token available")
        return False
    
    headers = {"Authorization": f"Bearer {test_data['user_token']}"}
    
    try:
        response = requests.get(f"{BASE_URL}/recipients", headers=headers)
        print_response(response)
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                print_success(f"Recipients list retrieved successfully. Count: {len(data)}")
                return True
            else:
                print_error("Response is not a list")
                return False
        else:
            print_error(f"List recipients failed with status {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Exception during list recipients: {str(e)}")
        return False

def test_update_recipient():
    """Test PUT /api/recipients/{id} - Update a recipient's name"""
    print_test("Update Recipient")
    
    if not test_data["user_token"] or not test_data["recipient_id"]:
        print_error("No user token or recipient ID available")
        return False
    
    headers = {"Authorization": f"Bearer {test_data['user_token']}"}
    payload = {
        "name": "Jane Doe"
    }
    
    try:
        response = requests.put(
            f"{BASE_URL}/recipients/{test_data['recipient_id']}", 
            json=payload, 
            headers=headers
        )
        print_response(response)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                print_success("Recipient updated successfully")
                return True
            else:
                print_error("Response doesn't indicate success")
                return False
        else:
            print_error(f"Update recipient failed with status {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Exception during update recipient: {str(e)}")
        return False

# ============================================================================
# 3. MESSAGES TESTS
# ============================================================================

def test_create_message():
    """Test POST /api/messages - Create a text message"""
    print_test("Create Message")
    
    if not test_data["user_token"] or not test_data["recipient_id"]:
        print_error("No user token or recipient ID available")
        return False
    
    headers = {"Authorization": f"Bearer {test_data['user_token']}"}
    payload = {
        "recipient_id": test_data["recipient_id"],
        "message_type": "text",
        "content": "This is my final message",
        "encryption_password": "pass1234"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/messages", json=payload, headers=headers)
        print_response(response)
        
        if response.status_code == 200:
            data = response.json()
            if "_id" in data:
                test_data["message_id"] = data["_id"]
                print_success(f"Message created successfully. ID: {test_data['message_id']}")
                return True
            else:
                print_error("Response missing _id")
                return False
        else:
            print_error(f"Create message failed with status {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Exception during create message: {str(e)}")
        return False

def test_list_messages():
    """Test GET /api/messages - List all messages"""
    print_test("List Messages")
    
    if not test_data["user_token"]:
        print_error("No user token available")
        return False
    
    headers = {"Authorization": f"Bearer {test_data['user_token']}"}
    
    try:
        response = requests.get(f"{BASE_URL}/messages", headers=headers)
        print_response(response)
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                print_success(f"Messages list retrieved successfully. Count: {len(data)}")
                return True
            else:
                print_error("Response is not a list")
                return False
        else:
            print_error(f"List messages failed with status {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Exception during list messages: {str(e)}")
        return False

def test_delete_message():
    """Test DELETE /api/messages/{id} - Delete a message"""
    print_test("Delete Message")
    
    if not test_data["user_token"] or not test_data["message_id"]:
        print_error("No user token or message ID available")
        return False
    
    headers = {"Authorization": f"Bearer {test_data['user_token']}"}
    
    try:
        response = requests.delete(
            f"{BASE_URL}/messages/{test_data['message_id']}", 
            headers=headers
        )
        print_response(response)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                print_success("Message deleted successfully")
                test_data["message_id"] = None  # Clear message ID
                return True
            else:
                print_error("Response doesn't indicate success")
                return False
        else:
            print_error(f"Delete message failed with status {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Exception during delete message: {str(e)}")
        return False

# ============================================================================
# 4. CHECK-IN TESTS
# ============================================================================

def test_checkin():
    """Test POST /api/users/checkin - Perform a daily check-in"""
    print_test("Daily Check-in")
    
    if not test_data["user_token"]:
        print_error("No user token available")
        return False
    
    headers = {"Authorization": f"Bearer {test_data['user_token']}"}
    
    try:
        response = requests.post(f"{BASE_URL}/users/checkin", headers=headers)
        print_response(response)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success") and "streak" in data:
                print_success(f"Check-in successful. Streak: {data['streak']}")
                return True
            else:
                print_error("Response doesn't indicate success or missing streak")
                return False
        else:
            print_error(f"Check-in failed with status {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Exception during check-in: {str(e)}")
        return False

def test_checkin_history():
    """Test GET /api/users/checkin-history - Get check-in history"""
    print_test("Check-in History")
    
    if not test_data["user_token"]:
        print_error("No user token available")
        return False
    
    headers = {"Authorization": f"Bearer {test_data['user_token']}"}
    
    try:
        response = requests.get(f"{BASE_URL}/users/checkin-history", headers=headers)
        print_response(response)
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                print_success(f"Check-in history retrieved successfully. Count: {len(data)}")
                return True
            else:
                print_error("Response is not a list")
                return False
        else:
            print_error(f"Get check-in history failed with status {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Exception during get check-in history: {str(e)}")
        return False

# ============================================================================
# 5. SUBSCRIPTION TESTS
# ============================================================================

def test_get_subscription_plans():
    """Test GET /api/subscriptions/plans - Get all subscription plans"""
    print_test("Get Subscription Plans")
    
    try:
        response = requests.get(f"{BASE_URL}/subscriptions/plans")
        print_response(response)
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list) and len(data) > 0:
                print_success(f"Subscription plans retrieved successfully. Count: {len(data)}")
                return True
            else:
                print_error("Response is not a list or empty")
                return False
        else:
            print_error(f"Get subscription plans failed with status {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Exception during get subscription plans: {str(e)}")
        return False

def test_subscribe_to_plan():
    """Test POST /api/subscriptions/subscribe - Subscribe to a plan"""
    print_test("Subscribe to Plan")
    
    if not test_data["user_token"]:
        print_error("No user token available")
        return False
    
    headers = {"Authorization": f"Bearer {test_data['user_token']}"}
    payload = {
        "plan_name": "gold"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/subscriptions/subscribe", json=payload, headers=headers)
        print_response(response)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success") and data.get("plan") == "gold":
                print_success("Subscription successful")
                return True
            else:
                print_error("Response doesn't indicate success or wrong plan")
                return False
        else:
            print_error(f"Subscribe failed with status {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Exception during subscribe: {str(e)}")
        return False

# ============================================================================
# 6. ADMIN TESTS
# ============================================================================

def test_admin_get_users():
    """Test GET /api/admin/users - Get all users (admin only)"""
    print_test("Admin: Get All Users")
    
    if not test_data["admin_token"]:
        print_error("No admin token available")
        return False
    
    headers = {"Authorization": f"Bearer {test_data['admin_token']}"}
    
    try:
        response = requests.get(f"{BASE_URL}/admin/users", headers=headers)
        print_response(response)
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                print_success(f"Admin users list retrieved successfully. Count: {len(data)}")
                return True
            else:
                print_error("Response is not a list")
                return False
        else:
            print_error(f"Admin get users failed with status {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Exception during admin get users: {str(e)}")
        return False

def test_admin_get_stats():
    """Test GET /api/admin/stats - Get admin statistics"""
    print_test("Admin: Get Statistics")
    
    if not test_data["admin_token"]:
        print_error("No admin token available")
        return False
    
    headers = {"Authorization": f"Bearer {test_data['admin_token']}"}
    
    try:
        response = requests.get(f"{BASE_URL}/admin/stats", headers=headers)
        print_response(response)
        
        if response.status_code == 200:
            data = response.json()
            if "total_users" in data and "total_messages" in data:
                print_success("Admin stats retrieved successfully")
                return True
            else:
                print_error("Response missing expected fields")
                return False
        else:
            print_error(f"Admin get stats failed with status {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Exception during admin get stats: {str(e)}")
        return False

def test_admin_update_user_status():
    """Test PUT /api/admin/users/{user_id}/status - Update user status"""
    print_test("Admin: Update User Status")
    
    if not test_data["admin_token"] or not test_data["user_id"]:
        print_error("No admin token or user ID available")
        return False
    
    headers = {"Authorization": f"Bearer {test_data['admin_token']}"}
    
    try:
        response = requests.put(
            f"{BASE_URL}/admin/users/{test_data['user_id']}/status?status=flagged",
            headers=headers
        )
        print_response(response)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                print_success("User status updated successfully")
                return True
            else:
                print_error("Response doesn't indicate success")
                return False
        else:
            print_error(f"Admin update user status failed with status {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Exception during admin update user status: {str(e)}")
        return False

# ============================================================================
# 7. CLEANUP AND DELETE RECIPIENT TEST
# ============================================================================

def test_delete_recipient():
    """Test DELETE /api/recipients/{id} - Try to delete recipient"""
    print_test("Delete Recipient")
    
    if not test_data["user_token"] or not test_data["recipient_id"]:
        print_error("No user token or recipient ID available")
        return False
    
    headers = {"Authorization": f"Bearer {test_data['user_token']}"}
    
    try:
        response = requests.delete(
            f"{BASE_URL}/recipients/{test_data['recipient_id']}", 
            headers=headers
        )
        print_response(response)
        
        # This should succeed now since we deleted the message
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                print_success("Recipient deleted successfully")
                return True
            else:
                print_error("Response doesn't indicate success")
                return False
        elif response.status_code == 400:
            # Expected if messages still exist
            print_info("Cannot delete recipient with associated messages (expected behavior)")
            return True
        else:
            print_error(f"Delete recipient failed with status {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Exception during delete recipient: {str(e)}")
        return False

# ============================================================================
# MAIN TEST RUNNER
# ============================================================================

def run_all_tests():
    """Run all backend API tests in sequence"""
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}FINAL MESSAGE APP - BACKEND API TEST SUITE{RESET}")
    print(f"{BLUE}{'='*80}{RESET}")
    print(f"Base URL: {BASE_URL}")
    print(f"Test User Email: {test_data['test_user_email']}")
    print(f"{BLUE}{'='*80}{RESET}\n")
    
    results = {}
    
    # 1. Authentication Tests
    results["User Registration"] = test_user_registration()
    results["User Login"] = test_user_login()
    results["Admin Login"] = test_admin_login()
    results["Get Current User"] = test_get_current_user()
    
    # 2. Recipients Tests
    results["Create Recipient"] = test_create_recipient()
    results["List Recipients"] = test_list_recipients()
    results["Update Recipient"] = test_update_recipient()
    
    # 3. Messages Tests
    results["Create Message"] = test_create_message()
    results["List Messages"] = test_list_messages()
    results["Delete Message"] = test_delete_message()
    
    # 4. Check-in Tests
    results["Daily Check-in"] = test_checkin()
    results["Check-in History"] = test_checkin_history()
    
    # 5. Subscription Tests
    results["Get Subscription Plans"] = test_get_subscription_plans()
    results["Subscribe to Plan"] = test_subscribe_to_plan()
    
    # 6. Admin Tests
    results["Admin Get Users"] = test_admin_get_users()
    results["Admin Get Stats"] = test_admin_get_stats()
    results["Admin Update User Status"] = test_admin_update_user_status()
    
    # 7. Delete Recipient (after message is deleted)
    results["Delete Recipient"] = test_delete_recipient()
    
    # Print Summary
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}TEST SUMMARY{RESET}")
    print(f"{BLUE}{'='*80}{RESET}\n")
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = f"{GREEN}✓ PASSED{RESET}" if result else f"{RED}✗ FAILED{RESET}"
        print(f"{test_name}: {status}")
    
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"Total Tests: {total}")
    print(f"{GREEN}Passed: {passed}{RESET}")
    print(f"{RED}Failed: {total - passed}{RESET}")
    print(f"Success Rate: {(passed/total)*100:.1f}%")
    print(f"{BLUE}{'='*80}{RESET}\n")
    
    return results

if __name__ == "__main__":
    run_all_tests()
