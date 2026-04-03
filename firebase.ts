import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
console.log("Initializing Firestore with databaseId:", firebaseConfig.firestoreDatabaseId);
const db = initializeFirestore(app, {}, firebaseConfig.firestoreDatabaseId);
const googleProvider = new GoogleAuthProvider();

export { app, auth, db, googleProvider };
