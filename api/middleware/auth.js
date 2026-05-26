import admin from 'firebase-admin';

let firebaseInitialized = false;

function initFirebase() {
  if (firebaseInitialized) return;
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccount) {
    try {
      const cred = JSON.parse(serviceAccount);
      admin.initializeApp({ credential: admin.credential.cert(cred) });
      firebaseInitialized = true;
    } catch (err) {
      console.warn('[AUTH] Firebase init failed, using dev mode:', err.message);
    }
  } else {
    console.warn('[AUTH] No FIREBASE_SERVICE_ACCOUNT_KEY set, using dev mode');
  }
}

export async function authenticate(req, res, next) {
  initFirebase();

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];

  if (!firebaseInitialized) {
    req.user = { uid: 'dev-user', email: 'dev@nexus.host', role: 'admin', devMode: true };
    return next();
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = {
      uid: decoded.uid,
      email: decoded.email || '',
      role: decoded.role || 'user',
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token', message: err.message });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (roles.length > 0 && !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}
