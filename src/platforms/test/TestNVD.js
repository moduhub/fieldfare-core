import {NVD} from '../../basic/NVD'

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
