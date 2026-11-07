import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { firebaseConfig } from "./config.js?v=20261107190111";

export const configured = !!firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("PASTE") && !!firebaseConfig.projectId;
export const app = configured ? initializeApp(firebaseConfig) : null;
export const db = configured ? getFirestore(app) : null;
export const auth = configured ? getAuth(app) : null;

export {
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, orderBy, limit, writeBatch, increment, serverTimestamp, onSnapshot
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
export {
  signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
