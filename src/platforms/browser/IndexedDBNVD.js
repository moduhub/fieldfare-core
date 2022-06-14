
import {IndexedDBBase} from './IndexedDBBase';
import {NVD} from '../../basic/NVD';


export class IndexedDBNVD {

    constructor() {

         this.db = new IndexedDBBase('nvdata');

    }

    static init() {
        NVD.singleton(new IndexedDBNVD);
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
