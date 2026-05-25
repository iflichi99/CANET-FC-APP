import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCbeqleqo-dR9mU1A0108SY-3QmuFSEJ74",
  authDomain: "canet-fc-app.firebaseapp.com",
  projectId: "canet-fc-app",
  storageBucket: "canet-fc-app.firebasestorage.app",
  messagingSenderId: "737322194439",
  appId: "1:737322194439:web:6cad6c11ee8087839d7ca2"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

import { signInWithRedirect, getRedirectResult } from "firebase/auth";
export const signInWithGoogle = () => signInWithRedirect(auth, googleProvider);
export const getGoogleRedirectResult = () => getRedirectResult(auth);
export const logOut = () => signOut(auth);
export const onAuthChange = (cb) => onAuthStateChanged(auth, cb);

export const loadData = async () => {
  try {
    const ref = doc(db, "club", "canet_v4");
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data().teams : null;
  } catch(e) {
    console.error("Load error:", e);
    return null;
  }
};

export const saveData = async (teams) => {
  try {
    const ref = doc(db, "club", "canet_v4");
    await setDoc(ref, { teams });
  } catch(e) {
    console.error("Save error:", e);
  }
};
