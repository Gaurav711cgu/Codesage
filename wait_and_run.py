import time, requests, os, subprocess

print("Waiting for celery to finish ingestion...")
while True:
    try:
        r = requests.get("http://localhost:8000/api/v1/repos").json()
        celery_status = next((repo["status"] for repo in r["data"] if repo["name"] == "celery"), None)
        if celery_status == "complete":
            print("Celery is complete! Running benchmarks...")
            break
        print(f"Celery status: {celery_status}")
    except Exception as e:
        print(f"Error checking status: {e}")
    time.sleep(5)

env = dict(os.environ)
with open('.env') as f:
    for line in f:
        line = line.strip()
        if line and '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip('"\'')

subprocess.run(["python3", "benchmarks/run_internal_eval.py"], env=env)
