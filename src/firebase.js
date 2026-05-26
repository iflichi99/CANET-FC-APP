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

let migratedOldData = false;

export const loadData = async () => {
  try {
    // Always try new per-team collection first
    const snap = await getDocs(collection(db, "teams"));
    if (!snap.empty) {
      const teams = [];
      snap.forEach(d => teams.push(d.data()));
      teams.sort((a, b) => (a.id || "").localeCompare(b.id || ""));
      if (teams.length > 0) {
        migratedOldData = true;
        return teams;
      }
    }
    // Only fallback to old doc if no teams collection exists yet
    if (!migratedOldData) {
      const old = await getDoc(doc(db, "club", "canet_v4"));
      if (old.exists()) {
        const teams = old.data().teams;
        // Migrate: save each team to its own document
        if (teams && teams.length > 0) {
          await saveData(teams);
          migratedOldData = true;
        }
        return teams;
      }
    }
    return null;
  } catch (e) {
    console.error("Load error:", e);
    // Offline fallback
    const cached = localStorage.getItem("canet_offline_cache");
    if (cached) try { return JSON.parse(cached); } catch {}
    return null;
  }
};

export const saveData = async (teams) => {
  try {
    // Save to localStorage as offline cache
    localStorage.setItem("canet_offline_cache", JSON.stringify(teams));
    
    // Get existing team IDs to detect deletions
    const existing = await getDocs(collection(db, "teams"));
    const existingIds = new Set();
    existing.forEach(d => existingIds.add(d.id));
    
    const newIds = new Set(teams.map(t => t.id));
    
    const batch = writeBatch(db);
    
    // Save/update all current teams
    teams.forEach(team => {
      const ref = doc(db, "teams", team.id);
      batch.set(ref, team);
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
