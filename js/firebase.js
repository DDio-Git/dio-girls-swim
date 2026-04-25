import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js';
import { getDatabase, ref, set, onValue } from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-database.js';

const firebaseConfig = {
  apiKey: 'AIzaSyBaif2tkOM5M8a2QtDI_jPkKBNf4WV6cbY',
  authDomain: 'dio-girls-swim.firebaseapp.com',
  databaseURL: 'https://dio-girls-swim-default-rtdb.firebaseio.com',
  projectId: 'dio-girls-swim',
  storageBucket: 'dio-girls-swim.firebasestorage.app',
  messagingSenderId: '1030829818898',
  appId: '1:1030829818898:web:66b69102418c1701a1c4cb'
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const dataRef = ref(db, 'swimData');

// Stores the entire appData object as a JSON string to avoid Firebase array quirks
export async function saveSwimData(data) {
  await set(dataRef, { json: JSON.stringify(data) });
}

// Fires immediately with current value, then on every remote change
export function subscribeToData(callback) {
  onValue(dataRef, snapshot => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }
    const val = snapshot.val();
    try {
      callback(val.json ? JSON.parse(val.json) : null);
    } catch {
      callback(null);
    }
  });
}
