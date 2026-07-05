import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDHFet6EW6TKAnzsE8Qfhfsx5ue0mJDqpM",
  authDomain: "free-fire-tournament-84fa0.firebaseapp.com",
  databaseURL: "https://free-fire-tournament-84fa0-default-rtdb.firebaseio.com",
  projectId: "free-fire-tournament-84fa0",
  storageBucket: "free-fire-tournament-84fa0.firebasestorage.app",
  messagingSenderId: "132408381357",
  appId: "1:132408381357:web:1ca12a99a798f54cb55b24"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
