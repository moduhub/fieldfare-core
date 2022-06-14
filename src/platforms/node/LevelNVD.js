
const { Level } = require('level');

import {NVD} from '../../basic/NVD'

export class LevelNVD {

    constructor() {

         this.db = new Level('nvd', { valueEncoding: 'json' })

    }

    static init() {
        NVD.singleton(new LevelNVD);
    }

    async save(key, object) {

        await this.db.put(key, object);

    }

    async load(key) {

        var object;

        try {
            object = await this.db.get(key);
        } catch (error) {
            if (error.notFound === true) {
                object = undefined;
            }
        }

        return object;
    }

};
