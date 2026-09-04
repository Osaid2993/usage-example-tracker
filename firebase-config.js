// firebase-config.js
import { initializeApp } from "firebase/app";
const firebaseConfig = {
  apiKey: "AIzaSyDXIy9xKeIpy_Aa2i_xHHibd2CKB_Q-yCQ",
  authDomain: "splashkit-tracker.firebaseapp.com",
  databaseURL: "https://splashkit-tracker-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "splashkit-tracker",
  storageBucket: "splashkit-tracker.firebasestorage.app",
  messagingSenderId: "719014220435",
  appId: "1:719014220435:web:f3f35d8c06c5a373aff366"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);