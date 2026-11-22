// LocalStorage + IndexedDB offline persistence layer for Hulu Guard

const LS_KEYS = {
  USER: 'hg_user_v1',
  HIKES: 'hg_hikes_v1',
  ACTIVE_ASCENT: 'hg_active_ascent_v1'
};

const DB_NAME = 'HuluGuardDB';
const DB_VERSION = 1;
const STORE_PHOTOS = 'photos';
const STORE_MODELS = 'models';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
        db.createObjectStore(STORE_PHOTOS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_MODELS)) {
        db.createObjectStore(STORE_MODELS, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function savePhoto(id, dataUrl) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PHOTOS, 'readwrite');
    tx.objectStore(STORE_PHOTOS).put({ id, dataUrl, savedAt: Date.now() });
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPhoto(id) {
  if (!id) return null;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PHOTOS, 'readonly');
    const req = tx.objectStore(STORE_PHOTOS).get(id);
    req.onsuccess = () => resolve(req.result ? req.result.dataUrl : null);
    req.onerror = () => reject(req.error);
  });
}

export async function saveModelBuffer(name, arrayBuffer) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MODELS, 'readwrite');
    tx.objectStore(STORE_MODELS).put({
      id: 'yolo11_huluguard',
      name,
      buffer: arrayBuffer,
      byteLength: arrayBuffer.byteLength,
      savedAt: Date.now()
    });
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getModelRecord() {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_MODELS, 'readonly');
      const req = tx.objectStore(STORE_MODELS).get('yolo11_huluguard');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function clearModelRecord() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MODELS, 'readwrite');
    tx.objectStore(STORE_MODELS).delete('yolo11_huluguard');
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export function getUser() {
  try {
    const raw = localStorage.getItem(LS_KEYS.USER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveUser(user) {
  localStorage.setItem(LS_KEYS.USER, JSON.stringify(user));
}

export function logoutUser() {
  localStorage.removeItem(LS_KEYS.USER);
}

export function getHikes() {
  try {
    const raw = localStorage.getItem(LS_KEYS.HIKES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addHike(hike) {
  const hikes = getHikes();
  hikes.unshift(hike);
  localStorage.setItem(LS_KEYS.HIKES, JSON.stringify(hikes));
  return hikes;
}

export function getActiveAscent() {
  try {
    const raw = localStorage.getItem(LS_KEYS.ACTIVE_ASCENT);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setActiveAscent(ascent) {
  if (ascent === null) {
    localStorage.removeItem(LS_KEYS.ACTIVE_ASCENT);
  } else {
    localStorage.setItem(LS_KEYS.ACTIVE_ASCENT, JSON.stringify(ascent));
  }
}

export async function clearAllAppData() {
  localStorage.removeItem(LS_KEYS.HIKES);
  localStorage.removeItem(LS_KEYS.ACTIVE_ASCENT);
  try {
    const db = await openDb();
    await new Promise((resolve) => {
      const tx = db.transaction(STORE_PHOTOS, 'readwrite');
      tx.objectStore(STORE_PHOTOS).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
}

export function getDashboardStats() {
  const hikes = getHikes();
  const totalHikes = hikes.length;
  const totalWasteKg = hikes.reduce((sum, h) => sum + (Number(h.descentWeightKg) || 0), 0);
  const compliantHikes = hikes.filter((h) => h.compliant).length;

  // Monthly activity for Jun - Nov 2026 (matches mockup chart window)
  const targetMonths = [
    { key: '2026-06', label: 'Jun' },
    { key: '2026-07', label: 'Jul' },
    { key: '2026-08', label: 'Agu' },
    { key: '2026-09', label: 'Sep' },
    { key: '2026-10', label: 'Okt' },
    { key: '2026-11', label: 'Nov' }
  ];

  const monthlyMap = Object.fromEntries(targetMonths.map((m) => [m.key, 0]));
  for (const h of hikes) {
    const monthKey = (h.dateIso || '').slice(0, 7);
    if (monthKey in monthlyMap) {
      monthlyMap[monthKey] += 1;
    }
  }

  const monthly = targetMonths.map((m, idx) => ({
    ...m,
    count: monthlyMap[m.key] || 0,
    isCurrent: idx === targetMonths.length - 1
  }));

  const badges = [
    {
      id: 'first_step',
      title: 'Langkah awal',
      subtitle: 'Pendakian pertama',
      unlocked: totalHikes >= 1,
      progressText: `${Math.min(totalHikes, 1)}/1 pendakian`,
      progressPct: Math.min(100, Math.round((totalHikes / 1) * 100)),
      icon: 'mountain'
    },
    {
      id: 'nature_friend',
      title: 'Sahabat alam',
      subtitle: '5 kg terkumpul',
      unlocked: totalWasteKg >= 5.0,
      progressText: `${totalWasteKg.toFixed(1).replace('.', ',')}/5,0 kg`,
      progressPct: Math.min(100, Math.round((totalWasteKg / 5.0) * 100)),
      icon: 'leaf'
    },
    {
      id: 'trail_guardian',
      title: 'Penjaga jalur',
      subtitle: '10 pendakian',
      unlocked: totalHikes >= 10,
      progressText: `${Math.min(totalHikes, 10)}/10 pendakian`,
      progressPct: Math.min(100, Math.round((totalHikes / 10) * 100)),
      icon: 'badge'
    },
    {
      id: 'zero_trace',
      title: 'Nol jejak',
      subtitle: '100% dibawa turun',
      unlocked: compliantHikes >= 1,
      progressText: `${compliantHikes} pendakian patuh`,
      progressPct: compliantHikes >= 1 ? 100 : 0,
      icon: 'checkCircle'
    }
  ];

  return {
    totalHikes,
    totalWasteKg,
    compliantHikes,
    monthly,
    badges,
    unlockedCount: badges.filter((b) => b.unlocked).length
  };
}
