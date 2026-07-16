import requests
import time
import sys

BACKEND_URL = "http://localhost:8000"
REPOS = [
    "https://github.com/fastapi/fastapi",
    "https://github.com/encode/httpx",
    "https://github.com/celery/celery"
]

def main():
    print("Starting ingestion of test repositories...")
    task_ids = {}

    # Trigger and poll ingestion sequentially
    for url in REPOS:
        print(f"Triggering ingestion for {url}...")
        resp = requests.post(f"{BACKEND_URL}/api/v1/repo/ingest", json={"github_url": url})
        resp.raise_for_status()
        data = resp.json()
        task_id = data["data"]["task_id"]
        print(f"Started task {task_id}")

        print(f"Polling for {url} completion...")
        while True:
            resp = requests.get(f"{BACKEND_URL}/api/v1/repo/ingest/{task_id}/status")
            if resp.status_code == 200:
                data = resp.json()["data"]
                status = data["status"]
                stage = data["stage"]
                print(f"[{url}] Status: {status} | Stage: {stage}")
                if status == "complete":
                    print(f"✅ {url} ingestion completed successfully!")
                    break
                elif status == "failed":
                    print(f"❌ {url} ingestion failed! Error: {data.get('error')}")
                    break
            else:
                print(f"[{url}] Failed to get status: {resp.status_code}")
            
            time.sleep(5)
            
    print("\nAll ingestions finished.")

if __name__ == "__main__":
    main()
