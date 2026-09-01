import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, getDocs, deleteDoc, collection, writeBatch } from "firebase/firestore";

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

export const loadData = async () => {
  try {
    const snap = await getDocs(collection(db, "teams"));
    if (!snap.empty) {
      const teams = [];
      snap.forEach(d => teams.push(d.data()));
      teams.sort((a, b) => (a.id || "").localeCompare(b.id || ""));
      if (teams.length > 0) return teams;
    }
    const old = await getDoc(doc(db, "club", "canet_v4"));
    if (old.exists()) return old.data().teams;
    return null;
  } catch (e) {
    console.error("Load error:", e);
    const cached = localStorage.getItem("canet_offline_cache");
    if (cached) try { return JSON.parse(cached); } catch {}
    return null;
  }
};

export const saveData = async (teams) => {
  try {
    localStorage.setItem("canet_offline_cache", JSON.stringify(teams));
    
    // Get existing IDs to detect deletions
    const existing = await getDocs(collection(db, "teams"));
    const existingIds = new Set();
    existing.forEach(d => existingIds.add(d.id));
    const newIds = new Set(teams.map(t => t.id));

    const batch = writeBatch(db);
    
    // Save/update current teams
    teams.forEach(team => {
      batch.set(doc(db, "teams", team.id), team);
    });
    
    // Delete removed teams
    existingIds.forEach(id => {
      if (!newIds.has(id)) {
        batch.delete(doc(db, "teams", id));
      }
    });

    await batch.commit();
  } catch (e) {
    console.error("Save error:", e);
  }
};
