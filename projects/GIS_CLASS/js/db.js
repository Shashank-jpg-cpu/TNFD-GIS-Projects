/**
 * db.js - IndexedDB storage for Host sessions, timestamps, duration,
 * and multiple offline video recordings stored directly on the host's device.
 */

const DB_NAME = 'LiveSessionHostDB';
const DB_VERSION = 2;
const SESSIONS_STORE = 'sessions';
const RECORDINGS_STORE = 'recordings';

class SessionDB {
  constructor() {
    this.db = null;
  }

  async init() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;

        // Store for session metadata
        if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
          const sessionStore = db.createObjectStore(SESSIONS_STORE, { keyPath: 'roomCode' });
          sessionStore.createIndex('timestamp', 'startTimestamp', { unique: false });
        }

        // Store for actual video blobs (allows multiple recordings per session)
        if (db.objectStoreNames.contains(RECORDINGS_STORE)) {
          db.deleteObjectStore(RECORDINGS_STORE);
        }
        const recStore = db.createObjectStore(RECORDINGS_STORE, { keyPath: 'id' });
        recStore.createIndex('roomCode', 'roomCode', { unique: false });
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };

      request.onerror = (e) => {
        console.error('IndexedDB open error:', e);
        resolve(null);
      };
    });
  }

  // Save or update session metadata
  async saveSession(sessionData) {
    const db = await this.init();
    if (!db) return sessionData;

    return new Promise((resolve, reject) => {
      const tx = db.transaction([SESSIONS_STORE], 'readwrite');
      const store = tx.objectStore(SESSIONS_STORE);

      const getReq = store.get(sessionData.roomCode);

      getReq.onsuccess = () => {
        const existing = getReq.result || {};
        const updated = {
          ...existing,
          ...sessionData,
          recordings: sessionData.recordings || existing.recordings || []
        };

        const putReq = store.put(updated);
        putReq.onsuccess = () => resolve(updated);
        putReq.onerror = () => reject(putReq.error);
      };

      getReq.onerror = () => reject(getReq.error);
    });
  }

  async createSessionRecord(roomCode, title, role = 'host') {
    const now = new Date();
    return this.saveSession({
      roomCode,
      title,
      role,
      date: now.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }),
      startTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      hasRecording: false
    });
  }

  // Save recorded video Blob (Supports multiple recordings per session without overwriting)
  async saveRecording(roomCode, blob, filename, typeLabel = 'Host Only') {
    const db = await this.init();
    if (!db) return;

    const recId = 'rec_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const mp4Filename = (filename || 'Session-' + roomCode + '.mp4').replace(/\.webm$/i, '.mp4');
    const mp4Blob = blob.type === 'video/mp4' ? blob : new Blob([blob], { type: 'video/mp4' });

    return new Promise((resolve, reject) => {
      const tx = db.transaction([RECORDINGS_STORE, SESSIONS_STORE], 'readwrite');
      const recStore = tx.objectStore(RECORDINGS_STORE);
      const sessStore = tx.objectStore(SESSIONS_STORE);

      // 1. Save blob record strictly as MP4
      recStore.put({
        id: recId,
        roomCode: roomCode,
        blob: mp4Blob,
        filename: mp4Filename,
        size: mp4Blob.size,
        type: typeLabel,
        format: 'MP4',
        savedAt: new Date().toISOString()
      });

      // 2. Append to session recordings list
      const getReq = sessStore.get(roomCode);
      getReq.onsuccess = () => {
        const sess = getReq.result || { roomCode };
        sess.recordings = sess.recordings || [];
        sess.recordings.push({
          id: recId,
          filename: mp4Filename,
          type: typeLabel,
          format: 'MP4',
          sizeStr: this.formatBytes(mp4Blob.size),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        sess.hasRecording = true;
        sessStore.put(sess);
      };

      tx.oncomplete = () => resolve(recId);
      tx.onerror = () => reject(tx.error);
    });
  }

  // Retrieve all sessions ordered by startTimestamp descending
  async getAllSessions() {
    const db = await this.init();
    if (!db) return [];

    return new Promise((resolve) => {
      const tx = db.transaction([SESSIONS_STORE], 'readonly');
      const store = tx.objectStore(SESSIONS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const sessions = request.result || [];
        sessions.sort((a, b) => (b.startTimestamp || 0) - (a.startTimestamp || 0));
        resolve(sessions);
      };

      request.onerror = () => resolve([]);
    });
  }

  // Download specific recording by ID (Strictly downloads in .mp4 format)
  async downloadRecording(recId) {
    const db = await this.init();
    if (!db) return;

    return new Promise((resolve) => {
      const tx = db.transaction([RECORDINGS_STORE], 'readonly');
      const store = tx.objectStore(RECORDINGS_STORE);
      const request = store.get(recId);

      request.onsuccess = () => {
        const rec = request.result;
        if (!rec || !rec.blob) {
          alert('Recording file not found on this device.');
          resolve();
          return;
        }

        const mp4Blob = new Blob([rec.blob], { type: 'video/mp4' });
        const url = URL.createObjectURL(mp4Blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        const dlFilename = (rec.filename || `Session-Recording-${recId}.mp4`).replace(/\.webm$/i, '.mp4');
        a.download = dlFilename;
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 500);
        resolve();
      };

      request.onerror = () => resolve();
    });
  }

  // Delete session and all its associated recordings
  async deleteSession(roomCode) {
    const db = await this.init();
    if (!db) return;

    return new Promise((resolve) => {
      const tx = db.transaction([SESSIONS_STORE, RECORDINGS_STORE], 'readwrite');
      const sessStore = tx.objectStore(SESSIONS_STORE);
      const recStore = tx.objectStore(RECORDINGS_STORE);

      sessStore.delete(roomCode);

      // Delete all recordings with this roomCode
      const index = recStore.index('roomCode');
      const req = index.getAllKeys(roomCode);
      req.onsuccess = () => {
        const keys = req.result || [];
        keys.forEach(k => recStore.delete(k));
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }

  formatBytes(bytes, decimals = 1) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
}

window.sessionDB = new SessionDB();
