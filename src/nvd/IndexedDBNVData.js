
const dbname = 'mhlib';
const dbversion = 1;
const storename = 'nvdata';

module.exports = class IndexedDBNVData {

    constructor() {
        //
    }

    connect() {
        return new Promise((resolve, reject) => {
            const request = window.indexedDB.open(dbname, dbversion);
            request.onupgradeneeded = IndexedDBNVData.upgrade;
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
            request.onblocked = () => console.warn('pending till unblocked');
        });
    }

    disconnect(db) {

        db.close();

    }

    static upgrade(event) {

        //indexedDB.deleteDatabase(this.dbname);

        console.log("Upgrading DB: " + dbname + ' Version: ' + dbversion);

        var db = event.target.result;

        // Stops Store Init
        var nvStore = db.createObjectStore(storename);

    }

    dbput(db, key, entry) {
		return new Promise((resolve, reject) => {
			const tx = db.transaction(storename, 'readwrite');
			const store = tx.objectStore(storename);
			const request = store.put(entry, key);
            //Uncaught (in promise) DOMException: Failed to execute 'put' on 'IDBObjectStore': The parameter is not a valid key
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	}

    dbget(db, key) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storename, 'readonly');
            const store = tx.objectStore(storename);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async save(key, object) {

        console.log("Attemping to save object " + JSON.stringify(object) + " at key " + key);

        const db = await this.connect();

        await this.dbput(db, key, object);

        await this.disconnect(db);

    }

    async load(key) {

        const db = await this.connect();

        var object = await this.dbget(db, key);

        await this.disconnect(db);

        return object;
    }

}
