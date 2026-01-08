// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBxQ4IstdBzERoOVH6Zc6AxxPX4eKo9Y74",
  authDomain: "crmdep.firebaseapp.com",
  projectId: "crmdep",
  storageBucket: "crmdep.firebasestorage.app",
  messagingSenderId: "534291712626",
  appId: "1:534291712626:web:fa136a53cd1d66b72650eb",
  measurementId: "G-XL3Q4WJWEM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);// تهيئة Firestore
const db = getFirestore(app);

export { db };