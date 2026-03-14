import requests
import json
import time
import os

BASE_URL = "http://localhost:5000/api"

def run_tests():
    print("Starting API Tests...")
    
    # 1. Start Server Check
    try:
        health = requests.get(f"{BASE_URL}/health").json()
        print("Health Check:", health['status'])
    except Exception as e:
        print("Server not running. Please start it with 'python backend/app.py'")
        return

    # 2. Create Project
    print("\n--- Testing Projects ---")
    project_payload = {
        "name": "Lumio",
        "category": "Smart TVs",
        "competitors": ["Samsung", "Sony", "TCL"],
        "region": "India"
    }
    res = requests.post(f"{BASE_URL}/projects/", json=project_payload)
    print("Create Project Status:", res.status_code)
    project_id = res.json().get("id")
    print("Project ID:", project_id)

    # 3. Add Prompt
    print("\n--- Testing Prompts ---")
    prompt_payload = {
        "prompt_text": "Best TVs under 50k"
    }
    res = requests.post(f"{BASE_URL}/prompts/project/{project_id}", json=prompt_payload)
    print("Add Prompt Status:", res.status_code)
    prompt_id = res.json().get("id")
    print("Prompt ID:", prompt_id)

    # 4. Run Analysis (This is the heavy lifting)
    print("\n--- Running AI Analysis (This will take a few seconds) ---")
    res = requests.post(f"{BASE_URL}/analysis/run/{prompt_id}")
    print("Run Analysis Status:", res.status_code)
    result = res.json()
    print("Analysis Result Score Impact:", result.get("score_impact"))

    # 5. Get Dashboard Report
    print("\n--- Fetching Dashboard Report ---")
    res = requests.get(f"{BASE_URL}/reports/project/{project_id}/dashboard")
    print("Dashboard Status:", res.status_code)
    report = res.json()
    print("Current Visibility Score:", report.get("current_visibility_score"))
    print("Competitors List:")
    for comp in report.get("competitors", []):
         print(f"  - {comp['brand']}: {comp['visibility_score']} (Focus: {comp['is_focus']})")
    
    print("\n--- ALL TESTS COMPLETED ---")

if __name__ == "__main__":
    run_tests()
