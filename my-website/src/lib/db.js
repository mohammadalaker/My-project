import { openDB } from 'idb';

const DB_NAME = 'saneen-pos-db';
const DB_VERSION = 1;

// Initialize the database
export const initDB = async () => {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            // Store for caching products
            if (!db.objectStoreNames.contains('products')) {
                db.createObjectStore('products', { keyPath: 'id' });
            }
            // Store for the offline sync queue
            if (!db.objectStoreNames.contains('syncQueue')) {
                db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
            }
        },
    });
};

export const saveProductsLocally = async (products) => {
    const db = await initDB();
    const tx = db.transaction('products', 'readwrite');
    const store = tx.objectStore('products');

    // Clear old products and add new ones
    await store.clear();
    for (const product of products) {
        await store.add(product);
    }
    await tx.done;
};

export const getLocalProducts = async () => {
    const db = await initDB();
    return db.getAll('products');
};

export const addToSyncQueue = async (orderData) => {
    const db = await initDB();
    return db.add('syncQueue', {
        ...orderData,
        timestamp: new Date().toISOString()
    });
};

export const getSyncQueue = async () => {
    const db = await initDB();
    return db.getAll('syncQueue');
};

export const removeFromSyncQueue = async (id) => {
    const db = await initDB();
    return db.delete('syncQueue', id);
};

export const clearSyncQueue = async () => {
    const db = await initDB();
    const tx = db.transaction('syncQueue', 'readwrite');
    await tx.objectStore('syncQueue').clear();
    await tx.done;
};
