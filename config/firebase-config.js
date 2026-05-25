;(function() {
  var NEXUS_CONFIG = {
    apiKey: "AIzaSyBjBh-ZNmIqsWSaXFDIm4vA7uZna5ST5WY",
    authDomain: "blox-fruit-shop.firebaseapp.com",
    databaseURL: "https://blox-fruit-shop-default-rtdb.firebaseio.com",
    projectId: "blox-fruit-shop",
    storageBucket: "blox-fruit-shop.firebasestorage.app",
    messagingSenderId: "305744231968",
    appId: "1:305744231968:web:ef976a5971ebb711a04645",
    measurementId: "G-982B4H3BW3"
  };

  var configEl = document.getElementById('nexus-firebase-config');
  if (configEl) {
    NEXUS_CONFIG.apiKey = configEl.dataset.apiKey || NEXUS_CONFIG.apiKey;
    NEXUS_CONFIG.authDomain = configEl.dataset.authDomain || NEXUS_CONFIG.authDomain;
    NEXUS_CONFIG.databaseURL = configEl.dataset.databaseUrl || NEXUS_CONFIG.databaseURL;
    NEXUS_CONFIG.projectId = configEl.dataset.projectId || NEXUS_CONFIG.projectId;
    NEXUS_CONFIG.storageBucket = configEl.dataset.storageBucket || NEXUS_CONFIG.storageBucket;
    NEXUS_CONFIG.messagingSenderId = configEl.dataset.messagingSenderId || NEXUS_CONFIG.messagingSenderId;
    NEXUS_CONFIG.appId = configEl.dataset.appId || NEXUS_CONFIG.appId;
    NEXUS_CONFIG.measurementId = configEl.dataset.measurementId || NEXUS_CONFIG.measurementId;
  }

  if (window.__NEXUS_FIREBASE_API_KEY) {
    NEXUS_CONFIG.apiKey = window.__NEXUS_FIREBASE_API_KEY;
  }

  window.NEXUS_CONFIG = NEXUS_CONFIG;
  window.NEXUS_INITIALIZED = false;
  window.NEXUS_AUTH = null;
  window.NEXUS_DB = null;
  window.NEXUS_STORAGE = null;
  window.NEXUS_GOOGLE_PROVIDER = null;
  window.auth = null;
  window.db = null;
  window.storage = null;
  window.googleProvider = null;

  function init() {
    if (typeof firebase === 'undefined') {
      console.warn('[NEXUS] Firebase SDK not loaded');
      return;
    }
    if (!NEXUS_CONFIG.apiKey || NEXUS_CONFIG.apiKey.length < 10) {
      console.warn('[NEXUS] Invalid API key');
      return;
    }
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(NEXUS_CONFIG);
      }
      window.NEXUS_AUTH = firebase.auth();
      window.NEXUS_DB = firebase.database();
      window.NEXUS_STORAGE = firebase.storage();
      window.NEXUS_GOOGLE_PROVIDER = new firebase.auth.GoogleAuthProvider();
      window.NEXUS_GOOGLE_PROVIDER.setCustomParameters({ prompt: 'select_account' });
      window.NEXUS_INITIALIZED = true;
      window.auth = window.NEXUS_AUTH;
      window.db = window.NEXUS_DB;
      window.storage = window.NEXUS_STORAGE;
      window.googleProvider = window.NEXUS_GOOGLE_PROVIDER;
      console.log('[NEXUS] Firebase ready');
    } catch(e) {
      console.error('[NEXUS] Firebase error:', e.message);
    }
  }

  init();
})();
