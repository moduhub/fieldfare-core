/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import { Level } from 'level';
import { NVD } from '../../basic/NVD.js'

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


    async delete(key) {
        if(!key) {
            throw Error('Attempt to delete NVD with an invalid key: ' + JSON.stringify(key));
        }
        await this.db.del(key);
    }
};
