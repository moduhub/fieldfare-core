
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
        if(!key) {
            throw Error('Attempt to store NVD with an invalid key: ' + JSON.stringify(key));
        }
        await this.db.put(key, object);
    }

    async load(key) {
        if(!key) {
            throw Error('Attempt to load NVD with an invalid key: ' + JSON.stringify(key));
        }
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
