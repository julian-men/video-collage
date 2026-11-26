// Browser storage for the current project: one small layout record, plus each
// media file stored once under its id.
const DB_NAME = 'multimedia-collage-maker'
const DB_VERSION = 1
const META_STORE = 'project'
const FILE_STORE = 'files'
const META_KEY = 'current'

let dbPromise = null

function openDb() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE)
      if (!db.objectStoreNames.contains(FILE_STORE)) db.createObjectStore(FILE_STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  // A failed open can be retried on the next call.
  dbPromise.catch(() => {
    dbPromise = null
  })
  return dbPromise
}

function settle(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function completion(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error ?? new Error('Save was aborted'))
  })
}

/** `{ meta, files }` as last saved, or null when nothing was saved. */
export async function loadProject() {
  const db = await openDb()
  const transaction = db.transaction([META_STORE, FILE_STORE], 'readonly')
  const meta = await settle(transaction.objectStore(META_STORE).get(META_KEY))
  if (!meta) return null
  const files = new Map()
  const store = transaction.objectStore(FILE_STORE)
  const [keys, blobs] = await Promise.all([settle(store.getAllKeys()), settle(store.getAll())])
  keys.forEach((key, index) => files.set(key, blobs[index]))
  return { meta, files }
}

/**
 * Saves the layout record, writes only files that aren't stored yet, and
 * deletes stored files the project no longer uses.
 */
export async function saveProject(meta, files) {
  const db = await openDb()
  const transaction = db.transaction([META_STORE, FILE_STORE], 'readwrite')
  const done = completion(transaction)
  const fileStore = transaction.objectStore(FILE_STORE)
  const keysRequest = fileStore.getAllKeys()
  keysRequest.onsuccess = () => {
    const stored = new Set(keysRequest.result)
    for (const [id, blob] of files) {
      if (!stored.has(id)) fileStore.put(blob, id)
    }
    for (const id of stored) {
      if (!files.has(id)) fileStore.delete(id)
    }
    transaction.objectStore(META_STORE).put(meta, META_KEY)
  }
  return done
}
