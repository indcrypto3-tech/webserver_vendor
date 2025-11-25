const admin = require('firebase-admin');
const path = require('path');

let firebaseApp = null;

/**
 * Initialize Firebase Admin SDK
 * Supports multiple configuration methods:
 * 1. File path (local development)
 * 2. Environment variable with JSON string (serverless)
 * 3. Individual environment variables
 */
function initializeFirebase() {
  if (firebaseApp) {
    return firebaseApp;
  }

  try {
    let serviceAccount;

    // Option 1: Load from file (local development)
    if (process.env.FIREBASE_PRIVATE_KEY_PATH) {
      const serviceAccountPath = path.resolve(process.env.FIREBASE_PRIVATE_KEY_PATH);
      serviceAccount = require(serviceAccountPath);
    }
    // Option 2: Load from environment variable (serverless/Vercel)
    else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    }
    // Option 3: Individual env vars (alternative)
    else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      serviceAccount = {
        type: 'service_account',
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
      };
    }
    else {
      console.warn('⚠️  Firebase credentials not configured. Push notifications disabled.');
      return null;
    }

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id,
    });

    console.log('✅ Firebase Admin SDK initialized');
    return firebaseApp;
  } catch (error) {
    console.error('❌ Firebase initialization error:', error.message);
    return null;
  }
}

/**
 * Get Firebase Messaging instance
 */
function getMessaging() {
  const app = initializeFirebase();
  if (!app) {
    return null;
  }
  return admin.messaging();
}

/**
 * Check if Firebase is configured
 */
function isFirebaseConfigured() {
  return firebaseApp !== null || (
    process.env.FIREBASE_PRIVATE_KEY_PATH ||
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL)
  );
}

module.exports = {
  initializeFirebase,
  getMessaging,
  isFirebaseConfigured,
};
