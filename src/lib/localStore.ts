// In-memory + LocalStorage backed Firestore-compatible client

export const db = {
  type: 'localStore',
};

type DocRecord = {
  id: string;
  data: Record<string, any>;
};

const storeKey = (colPath: string) => `@masti_store_${colPath}`;

const getCollectionData = (colPath: string): Record<string, any> => {
  try {
    const raw = localStorage.getItem(storeKey(colPath));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveCollectionData = (colPath: string, data: Record<string, any>) => {
  try {
    localStorage.setItem(storeKey(colPath), JSON.stringify(data));
  } catch {}
  notifyListeners(colPath);
};

const listeners = new Map<string, Set<(snap: any) => void>>();

const notifyListeners = (colPath: string) => {
  const set = listeners.get(colPath);
  if (!set) return;
  const col = getCollectionData(colPath);
  const docs = Object.entries(col).map(([id, data]) => ({
    id,
    data: () => data,
    exists: () => true,
  }));
  const snapshot = {
    docs,
    empty: docs.length === 0,
    size: docs.length,
    forEach: (cb: (doc: any) => void) => docs.forEach(cb),
  };
  set.forEach((fn) => fn(snapshot));
};

export interface CollectionRef {
  _isCollection: true;
  path: string;
}

export interface DocRef {
  _isDoc: true;
  path: string;
  id: string;
  colPath: string;
}

export const collection = (_db: any, ...pathSegments: string[]): CollectionRef => {
  return {
    _isCollection: true,
    path: pathSegments.join('/'),
  };
};

export const doc = (_db: any, ...pathSegments: string[]): DocRef => {
  const fullPath = pathSegments.join('/');
  const parts = fullPath.split('/');
  const id = parts[parts.length - 1];
  const colPath = parts.slice(0, -1).join('/');
  return {
    _isDoc: true,
    path: fullPath,
    id,
    colPath,
  };
};

export const serverTimestamp = () => new Date().toISOString();

export const arrayUnion = (...elements: any[]) => ({
  _type: 'arrayUnion',
  elements,
});

export const setDoc = async (
  docRef: DocRef,
  data: Record<string, any>,
  options?: { merge?: boolean }
) => {
  const col = getCollectionData(docRef.colPath);
  const existing = col[docRef.id] || {};
  let updated = data;
  if (options?.merge) {
    updated = { ...existing, ...data };
  }
  col[docRef.id] = updated;
  saveCollectionData(docRef.colPath, col);
};

export const updateDoc = async (docRef: DocRef, data: Record<string, any>) => {
  return setDoc(docRef, data, { merge: true });
};

export const getDoc = async (docRef: DocRef) => {
  const col = getCollectionData(docRef.colPath);
  const data = col[docRef.id];
  return {
    id: docRef.id,
    exists: () => data !== undefined,
    data: () => data || {},
  };
};

export const deleteDoc = async (docRef: DocRef) => {
  const col = getCollectionData(docRef.colPath);
  delete col[docRef.id];
  saveCollectionData(docRef.colPath, col);
};

export const addDoc = async (colRef: CollectionRef, data: Record<string, any>) => {
  const id = 'doc_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
  const dRef = doc(null, colRef.path, id);
  await setDoc(dRef, { id, ...data });
  return dRef;
};

export const getDocs = async (queryRef: any) => {
  const colPath = queryRef.colPath || queryRef.path;
  const col = getCollectionData(colPath);
  let docs = Object.entries(col).map(([id, data]) => ({
    id,
    data: () => data,
    exists: () => true,
  }));

  // Apply filters if present
  if (queryRef.filters && queryRef.filters.length > 0) {
    docs = docs.filter((d) => {
      const data = d.data();
      return queryRef.filters.every((f: any) => {
        if (f.op === '==') return data[f.field] === f.val;
        if (f.op === 'in') return Array.isArray(f.val) && f.val.includes(data[f.field]);
        if (f.op === 'array-contains') return Array.isArray(data[f.field]) && data[f.field].includes(f.val);
        return true;
      });
    });
  }

  // Apply ordering if present
  if (queryRef.orderField) {
    docs.sort((a, b) => {
      const va = a.data()[queryRef.orderField];
      const vb = b.data()[queryRef.orderField];
      if (va < vb) return queryRef.orderDir === 'desc' ? 1 : -1;
      if (va > vb) return queryRef.orderDir === 'desc' ? -1 : 1;
      return 0;
    });
  }

  return {
    docs,
    empty: docs.length === 0,
    size: docs.length,
    forEach: (cb: (doc: any) => void) => docs.forEach(cb),
  };
};

export const query = (colRef: CollectionRef, ...queryConstraints: any[]) => {
  const q: any = {
    colPath: colRef.path,
    filters: [],
  };
  queryConstraints.forEach((c) => {
    if (c.type === 'where') q.filters.push(c);
    if (c.type === 'orderBy') {
      q.orderField = c.field;
      q.orderDir = c.dir;
    }
  });
  return q;
};

export const where = (field: string, op: string, val: any) => ({
  type: 'where',
  field,
  op,
  val,
});

export const orderBy = (field: string, dir: 'asc' | 'desc' = 'asc') => ({
  type: 'orderBy',
  field,
  dir,
});

export const onSnapshot = (
  queryOrDoc: any,
  callback: (snapshot: any) => void,
  _onError?: (err: any) => void
) => {
  const colPath = queryOrDoc.colPath || queryOrDoc.path;
  if (!listeners.has(colPath)) {
    listeners.set(colPath, new Set());
  }
  listeners.get(colPath)!.add(callback);

  // Trigger initial snapshot asynchronously
  setTimeout(() => {
    if (queryOrDoc._isDoc) {
      getDoc(queryOrDoc).then(callback);
    } else {
      getDocs(queryOrDoc).then(callback);
    }
  }, 10);

  return () => {
    listeners.get(colPath)?.delete(callback);
  };
};

export const writeBatch = (_db: any) => {
  const operations: Array<() => Promise<void>> = [];
  return {
    set: (docRef: DocRef, data: any, options?: any) => {
      operations.push(() => setDoc(docRef, data, options));
    },
    update: (docRef: DocRef, data: any) => {
      operations.push(() => updateDoc(docRef, data));
    },
    delete: (docRef: DocRef) => {
      operations.push(() => deleteDoc(docRef));
    },
    commit: async () => {
      for (const op of operations) {
        await op();
      }
    },
  };
};

export const runTransaction = async (_db: any, updateFunction: (transaction: any) => Promise<any>) => {
  const transaction = {
    get: async (docRef: DocRef) => getDoc(docRef),
    set: (docRef: DocRef, data: any, options?: any) => setDoc(docRef, data, options),
    update: (docRef: DocRef, data: any) => updateDoc(docRef, data),
    delete: (docRef: DocRef) => deleteDoc(docRef),
  };
  return updateFunction(transaction);
};

export default {
  db,
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  writeBatch,
  runTransaction,
};
