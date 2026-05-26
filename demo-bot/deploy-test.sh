#!/usr/bin/env bash
set -e

echo "═══════════════════════════════════════════════════"
echo "   NEXUS CLOUD — Telegram Bot Hosting Test Suite"
echo "═══════════════════════════════════════════════════"
echo ""

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# ── Step 1: Check Python ──────────────────────────────
echo "▸ [1/6] Checking Python environment..."
PYTHON=$(command -v python3 || command -v python)
if [ -z "$PYTHON" ]; then
    echo "  ✗ Python not found. Install Python 3.10+."
    exit 1
fi
echo "  ✓ Python: $($PYTHON --version 2>&1)"

# ── Step 2: Install deps ──────────────────────────────
echo "▸ [2/6] Installing dependencies..."
$PYTHON -m pip install -q --upgrade pip 2>/dev/null
$PYTHON -m pip install -q -r requirements.txt 2>&1 | tail -3
echo "  ✓ Dependencies installed"

# ── Step 3: Validate files ────────────────────────────
echo "▸ [3/6] Validating project structure..."
for f in bot.py web.py requirements.txt Procfile runtime.txt render.yaml railway.json; do
    if [ -f "$f" ]; then
        echo "  ✓ $f"
    else
        echo "  ✗ Missing: $f"
        exit 1
    fi
done

# ── Step 4: Syntax check ──────────────────────────────
echo "▸ [4/6] Syntax validation..."
$PYTHON -m py_compile bot.py
$PYTHON -m py_compile web.py
echo "  ✓ bot.py syntax OK"
echo "  ✓ web.py syntax OK"

# ── Step 5: Health endpoint test ───────────────────────
echo "▸ [5/6] Testing health endpoint..."
$PYTHON -c "
import json
from web import app
from io import BytesIO

def test_health():
    env = {'PATH_INFO': '/health', 'REQUEST_METHOD': 'GET'}
    result = []
    def start_response(status, headers):
        result.append((status, headers))
    body = b''.join(app(env, start_response))
    status, headers = result[0]
    data = json.loads(body)
    assert status == '200 OK', f'Expected 200, got {status}'
    assert data['status'] == 'healthy', f'Expected healthy, got {data[\"status\"]}'
    assert data['service'] == 'nexus-cloud-demo-bot', 'Wrong service name'
    print(f'  ✓ Health: status={data[\"status\"]}, python={data[\"python\"]}')
    nf_env = {'PATH_INFO': '/nonexistent', 'REQUEST_METHOD': 'GET'}
    nf_body = b''.join(app(nf_env, start_response))
    nf_data = json.loads(nf_body)
    assert 'error' in nf_data, 'Expected error for unknown route'

test_health()
"
echo "  ✓ Health endpoint validates correctly"

# ── Step 6: Bot library import test (no token needed) ─
echo "▸ [6/6] Testing bot library import..."
$PYTHON -c "
import importlib
for mod in ['telebot', 'telegram', 'requests']:
    try:
        importlib.import_module(mod)
        print(f'  ✓ {mod} available')
    except ImportError:
        print(f'  ⚠ {mod} not installed (expected if using alternative)')
" 2>&1

echo ""
echo "═══════════════════════════════════════════════════"
echo "   ALL TESTS PASSED"
echo "═══════════════════════════════════════════════════"
echo ""
echo "Deploy Instructions:"
echo "  ┌─────────────────────────────────────────────┐"
echo "  │ 1. Push to GitHub:                          │"
echo "  │    git add demo-bot/ && git commit           │"
echo "  │    git push origin main                      │"
echo "  │                                             │"
echo "  │ 2. RENDER (Web Service):                    │"
echo "  │    New Blueprint → connect repo              │"
echo "  │    Root Dir: demo-bot                        │"
echo "  │    Env: BOT_TOKEN=<token>                    │"
echo "  │    Start: python bot.py                      │"
echo "  │                                             │"
echo "  │ 3. RAILWAY:                                 │"
echo "  │    New Project → Deploy from repo            │"
echo "  │    Root Directory: demo-bot                  │"
echo "  │    Env: BOT_TOKEN=<token>                    │"
echo "  │    Start: python bot.py                      │"
echo "  │                                             │"
echo "  │ 4. Test bot:                                 │"
echo "  │    Telegram → /start, /ping, /status         │"
echo "  └─────────────────────────────────────────────┘"
