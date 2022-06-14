
export var nvd;

export class NVD {

    constructor() {

    }

    static singleton(pInstance) {
        nvd = pInstance;
    }

    static available() {
        if(nvd) {
            return true;
        }
        return false;
    }

    static load(key ) {

        if(nvd === undefined) {
            throw Error('NVD not initialized');
        }

        return nvd.load(key);
    }

    static save(key, value) {

        if(nvd === undefined) {
            throw Error('NVD not initialized');
        }

        return nvd.save(key, value);
    }

}
