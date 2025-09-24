// PrimeVicio - Site/lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Sua configuração do Firebase que você forneceu
const firebaseConfig = {
  apiKey: "AIzaSyCNEGDpDLuWYrxTkoONy4oQujnatx6KIS8",
  authDomain: "cineveok.firebaseapp.com",
  databaseURL: "https://cineveok-default-rtdb.firebaseio.com",
  projectId: "cineveok",
  storageBucket: "cineveok.firebasestorage.app",
  messagingSenderId: "805536124347",
  appId: "1:805536124347:web:b408c28cb0a4dc914d089e",
  measurementId: "G-H7WVDQQDVJ"
};

// Inicializa o Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const firestore = getFirestore(app);

export { app, firestore };