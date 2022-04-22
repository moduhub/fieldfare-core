
const ResourcesManager = require('./ResourcesManager.js');

const IndexedDBBase = require('../basic/IndexedDBBase.js');

module.exports = class IndexedDBResourcesManager extends ResourcesManager {

    constructor() {
        super();

        this.db = new IndexedDBBase('res');

    }

    async storeResource(base64data) {

        const key = await ResourcesManager.generateKeyForData(base64data);

        const base64hash = await this.db.put(key, base64data);

        return base64hash;
    }

    async getResource(base64hash) {

        const base64data = await this.db.get(base64hash);

        return base64data;

    }

};
