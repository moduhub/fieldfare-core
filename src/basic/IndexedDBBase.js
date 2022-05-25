
import {logger} from '../basic/Log'

const dbname = 'mhlib';
const dbversion = 1;

module.exports = class IndexedDBBase {

    constructor(storeName) {

        if(IndexedDBBase.stores === null
        || IndexedDBBase.stores === undefined) {
            logger.log('info', "IndexedDBBase.stores = new Set();");
            IndexedDBBase.stores = new Set();
        }

        this.storeName = storeName;

        IndexedDBBase.stores.add(storeName);

    }

    connect() {
        return new Promise((resolve, reject) => {
            const request = window.indexedDB.open(dbname, dbversion);
            request.onupgradeneeded = IndexedDBBase.upgrade;
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
            request.onblocked = () => logger.log('warning', 'pending till unblocked');
        });
    }

    static upgrade(event) {

        //indexedDB.deleteDatabase(this.dbname);

        logger.log('info', "Upgrading DB: " + dbname + ' Version: ' + dbversion);

        var db = event.target.result;

        // Stops Store Init
        for(const storeName of IndexedDBBase.stores) {

            logger.log('info', "Creating store: " + storeName);
            db.createObjectStore(storeName);

        }

    }

    put(key, entry) {

        return this.connect()
        .then((db) => {
            return new Promise((resolve, reject) => {

    			const tx = db.transaction(this.storeName, 'readwrite');
    			const store = tx.objectStore(this.storeName);
    			const request = store.put(entry, key);

    			request.onsuccess = () => {
                    db.close();
                    resolve(request.result);
                }

    			request.onerror = () => {
                    db.close();
                    reject(request.error);
                }
            });
		});

	}

    get(key) {
        return this.connect()
        .then((db) => {
            return new Promise((resolve, reject) => {
                const tx = db.transaction(this.storeName, 'readonly');
                const store = tx.objectStore(this.storeName);
                const request = store.get(key);
                request.onsuccess = () => {
                    db.close();
                    resolve(request.result)
                };
                request.onerror = () => {
                    db.close();
                    reject(request.error);
                };
            });
        });
    }

}
