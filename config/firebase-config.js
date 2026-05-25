;(function() {
  var config = document.getElementById('nexus-firebase-config');
  var firebaseConfig = {
    apiKey: config ? config.dataset.apiKey : (window.__NEXUS_FIREBASE_API_KEY || "AIzaSyBjBh-ZNmIqsWSaXFDIm4vA7uZna5ST5WY"),
    authDomain: config ? config.dataset.authDomain : (window.__NEXUS_AUTH_DOMAIN || "blox-fruit-shop.firebaseapp.com"),
    databaseURL: config ? config.dataset.databaseUrl : (window.__NEXUS_DATABASE_URL || "https://blox-fruit-shop-default-rtdb.firebaseio.com"),
    projectId: config ? config.dataset.projectId : (window.__NEXUS_PROJECT_ID || "blox-fruit-shop"),
    storageBucket: config ? config.dataset.storageBucket : (window.__NEXUS_STORAGE_BUCKET || "blox-fruit-shop.firebasestorage.app"),
    messagingSenderId: config ? config.dataset.messagingSenderId : (window.__NEXUS_MESSAGING_SENDER_ID || "305744231968"),
    appId: config ? config.dataset.appId : (window.__NEXUS_APP_ID || "1:305744231968:web:ef976a5971ebb711a04645"),
    measurementId: config ? config.dataset.measurementId : (window.__NEXUS_MEASUREMENT_ID || "G-982B4H3BW3")
  };

  window.NEXUS_CONFIG = firebaseConfig;
  window.NEXUS_INITIALIZED = false;

  if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "DEMO_MODE" && firebaseConfig.apiKey !== "YOUR_API_KEY") {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    window.NEXUS_INITIALIZED = true;
  }

  try {
    window.NEXUS_AUTH = firebaseConfig.apiKey && firebaseConfig.apiKey !== "DEMO_MODE" && firebaseConfig.apiKey !== "YOUR_API_KEY"
      ? firebase.auth() : null;
    window.NEXUS_DB = firebaseConfig.apiKey && firebaseConfig.apiKey !== "DEMO_MODE" && firebaseConfig.apiKey !== "YOUR_API_KEY"
      ? firebase.database() : null;
    window.NEXUS_STORAGE = firebaseConfig.apiKey && firebaseConfig.apiKey !== "DEMO_MODE" && firebaseConfig.apiKey !== "YOUR_API_KEY"
      ? firebase.storage() : null;
  } catch(e) {
    window.NEXUS_AUTH = null;
    window.NEXUS_DB = null;
    window.NEXUS_STORAGE = null;
  }

  window.NEXUS_GOOGLE_PROVIDER = window.NEXUS_AUTH
    ? new firebase.auth.GoogleAuthProvider()
    : null;
  if (window.NEXUS_GOOGLE_PROVIDER) {
    window.NEXUS_GOOGLE_PROVIDER.setCustomParameters({ prompt: 'select_account' });
  }

  // Expose globals for backwards compatibility
  window.auth = window.NEXUS_AUTH;
  window.db = window.NEXUS_DB;
  window.storage = window.NEXUS_STORAGE;
  window.googleProvider = window.NEXUS_GOOGLE_PROVIDER;
  window.NEXUS_INITIALIZED = window.NEXUS_INITIALIZED;
})();
