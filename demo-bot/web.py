import os
import time
import json
import platform
from datetime import datetime, timezone

START_TIME = time.time()

def uptime_str():
    secs = int(time.time() - START_TIME)
    h, r = divmod(secs, 3600)
    m, s = divmod(r, 60)
    return f"{h}h {m}m {s}s"

BOT_TOKEN_SET = bool(os.environ.get("BOT_TOKEN"))
HOST = os.environ.get("HOST", platform.node())
DEPLOY_MODE = os.environ.get("DEPLOY_MODE", "polling")

def app(environ, start_response):
    path = environ.get("PATH_INFO", "/")
    if path == "/health" or path == "/":
        data = {
            "status": "healthy",
            "host": HOST,
            "uptime": uptime_str(),
            "python": platform.python_version(),
            "platform": platform.system(),
            "bot_configured": BOT_TOKEN_SET,
            "deploy_mode": DEPLOY_MODE,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "service": "nexus-cloud-demo-bot",
        }
        status = "200 OK"
    else:
        data = {"error": "not found"}
        status = "404 Not Found"

    body = json.dumps(data).encode()
    headers = [
        ("Content-Type", "application/json"),
        ("Content-Length", str(len(body))),
        ("Cache-Control", "no-store"),
    ]
    start_response(status, headers)
    return [body]
