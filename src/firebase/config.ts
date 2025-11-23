import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
//THIS IS THE MAIN DB
// const firebaseConfig = {
//   apiKey: "AIzaSyBeiejGHWW0ZqQi4vzUGy-l547h18J-f0s",
//   authDomain: "balaji-inn.firebaseapp.com",
//   projectId: "balaji-inn",
//   storageBucket: "balaji-inn.firebasestorage.app",
//   messagingSenderId: "393579021304",
//   appId: "1:393579021304:web:aa18acc562e1a8bcd24c0d",
//   measurementId: "G-YFSTJ5YMWZ"
// };

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
