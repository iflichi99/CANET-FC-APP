import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, getDocs, collection, writeBatch } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCbeqleqo-dR9mU1A0108SY-3QmuFSEJ74",
  authDomain: "canet-fc-app.firebaseapp.com",
  projectId: "canet-fc-app",
  storageBucket: "canet-fc-app.firebasestorage.app",
  messagingSenderId: "737322194439",
  appId: "1:737322194439:web:6cad6c11ee8087839d7ca2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Cada equipo se guarda en su propio documento para evitar el límite de 1MB
export const loadData = async () => {
  try {
    const snap = await getDocs(collection(db, "teams"));
    if(!snap.empty) {
      const teams = [];
      snap.forEach(d => teams.push(d.data()));
      teams.sort((a,b) => (a.id||"").localeCompare(b.id||""));
      if(teams.length > 0) return teams;
    }
    // Fallback al documento antiguo
    const old = await getDoc(doc(db, "club", "canet_v4"));
    if(old.exists()) return old.data().teams;
    return null;
  } catch(e) {
    console.error("Load error:", e);
    return null;
  }
};

export const saveData = async (teams) => {
  try {
    const batch = writeBatch(db);
    teams.forEach(team => {
      const ref = doc(db, "teams", team.id);
      batch.set(ref, team);
    });
    await batch.commit();
  } catch(e) {
    console.error("Save batch error:", e);
    try {
      await setDoc(doc(db, "club", "canet_v4"), { teams });
    } catch(e2) {
      console.error("Fallback save error:", e2);
    }
  }
};
