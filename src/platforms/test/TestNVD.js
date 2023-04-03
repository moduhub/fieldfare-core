/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import {NVD} from '../../basic/NVD.js'

export class TestNVD {

    constructor() {
         this.map = new Map;
    }

    static init() {
        NVD.singleton(new TestNVD);
    }

    async save(key, object) {
        this.map.set(key, object);
    }

    async load(key) {
        return this.map.get(key);
    }

};
