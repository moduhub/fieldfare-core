
import {IndexedDBBase} from '../basic/IndexedDBBase';

export class IndexedDBNVData {

    constructor() {

         this.db = new IndexedDBBase('nvdata');

    }

    async save(key, object) {

        console.log("Attemping to save object " + JSON.stringify(object) + " at key " + key);

        await this.db.put(key, object);

    }

    async load(key) {

        var object = await this.db.get(key);

        return object;
    }

};
