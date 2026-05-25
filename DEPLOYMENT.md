# NEXUS HOST — Deployment Guide

## Architecture Overview

NEXUS HOST is a production-grade Laravel hosting platform with support for multiple runtimes including PHP/Laravel, Node.js, Python, and static sites.

## Project Structure

```
nexus-host/
├── index.html                 # Main SPA Dashboard
├── login.html                 # Authentication
├── css/
│   └── nexus.css             # Complete style system
├── js/
│   ├── nexus.js              # Application logic
│   └── deployment-engine.js  # Deployment pipeline
├── config/
│   ├── firebase-config.js    # Firebase initialization
│   ├── database.rules.json   # RTDB security rules
│   └── security-rules.json   # Firestore rules
└── assets/
    ├── logo.png              # Platform logo
    ├── favicon.png           # Browser favicon
    ├── welcome.gif           # Animated welcome
    └── background.mp4        # Video background
```

## Firebase Setup

1. Create Firebase project at console.firebase.google.com
2. Enable Authentication (Email/Password + Google OAuth)
3. Enable Realtime Database (deploy rules from config/database.rules.json)
4. Enable Storage
5. Copy Firebase config to config/firebase-config.js

## Deployment Options

### 1. Render Deployment

```bash
# Build command
cp config/firebase-config.js.example config/firebase-config.js
# Deploy via Render dashboard
```

Render settings:
- Build Command: `npm run build` or `composer install`
- Start Command: `php artisan serve --host=0.0.0.0 --port=${PORT:-8000}`
- Health Check Path: `/health`

### 2. Vercel Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

Vercel configuration (vercel.json):
```json
{
  "build": { "command": "echo 'Static deployment'" },
  "outputDirectory": ".",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### 3. Termux (Mobile)

```bash
pkg update && pkg upgrade
pkg install nodejs-lts
npm i -g serve
serve -s . -p 3000
```

### 4. VPS Manual

```bash
# Clone
git clone https://github.com/your-org/nexus-host.git
cd nexus-host

# Setup
python3 -m http.server 8080
# or
npx serve -s . -p 8080
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| FIREBASE_API_KEY | Firebase API key | Yes |
| FIREBASE_AUTH_DOMAIN | Auth domain | Yes |
| FIREBASE_DATABASE_URL | RTDB URL | Yes |
| FIREBASE_PROJECT_ID | Project ID | Yes |
| FIREBASE_STORAGE_BUCKET | Storage bucket | Yes |

## Security

- JWT-based authentication via Firebase
- All files are scanned during upload
- ZIP extraction validates against path traversal
- Environment variables encrypted at rest
- Rate limiting on API endpoints
- CORS configured for authorized domains only

## Database Security Rules

The Realtime Database uses strict rules:
- Users can only read/write their own data
- Projects scoped to owner UID
- Deployments scoped to project owner
- Environment variables protected

## Maintenance

- Monitor usage via Firebase Console
- Review authentication logs
- Update security rules periodically
- Rotate API keys on schedule
- Backup Firebase database weekly
