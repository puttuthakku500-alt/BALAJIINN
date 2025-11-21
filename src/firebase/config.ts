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
  apiKey: "AIzaSyAIxrA5uo64FQOq_RP1GnG8sNhhXJBaX2E",
  authDomain: "boss-test-3d2f8.firebaseapp.com",
  projectId: "boss-test-3d2f8",
  storageBucket: "boss-test-3d2f8.firebasestorage.app",
  messagingSenderId: "820395646920",
  appId: "1:820395646920:web:38b8361365c00c74ce2afd",
  measurementId: "G-HHBR54NKFM"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { db, auth, storage };
