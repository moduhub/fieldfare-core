/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import {IndexedDBBase} from './IndexedDBBase.js';
import {NVD} from '../../basic/NVD.js';

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
