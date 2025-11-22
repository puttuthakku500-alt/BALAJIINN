import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
//THIS IS THE MAIN DB
/*const firebaseConfig = {
  apiKey: "AIzaSyD57ySp5pnHPxX_3UaveoC62lZHFOUrT-Y",
  authDomain: "bossinn-44651.firebaseapp.com",
  projectId: "bossinn-44651",
  storageBucket: "bossinn-44651.firebasestorage.app",
  messagingSenderId: "510548886376",
  appId: "1:510548886376:web:2a4d9f0e8724090cc7ccdd",
  measurementId: "G-596DPL3V12"
};*/


//TESTING

const firebaseConfig = {
  apiKey: "AIzaSyA-pRxNph8ECQEi2IzUWgPAq06fi-3wKK8",
  authDomain: "bossinn-7fbb9.firebaseapp.com",
  projectId: "bossinn-7fbb9",
  storageBucket: "bossinn-7fbb9.firebasestorage.app",
  messagingSenderId: "138358328390",
  appId: "1:138358328390:web:e04ab1e548d7c56e5fce47",
  measurementId: "G-8KRR5T7YJQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { db, auth, storage };