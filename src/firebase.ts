import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBytAP0vO7M25RZ5uv0JMFBnyIrHRhvCpE",
  authDomain: "npl-tournaments.firebaseapp.com",
  databaseURL: "https://npl-tournaments-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "npl-tournaments",
  storageBucket: "npl-tournaments.firebasestorage.app",
  messagingSenderId: "229048065105",
  appId: "1:229048065105:web:965a331d7e300a39172c70"
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
