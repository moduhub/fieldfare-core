
const { Level } = require('level');

const ResourcesManager = require('./ResourcesManager.js');


module.exports = class LevelResourcesManager extends ResourcesManager {

    constructor() {
        super();

        this.db = new Level('resources', { valueEncoding: 'json' })

    }

    async storeResource(base64data) {

        console.log("LevelResourcesManager storing res: " + base64data);

        const base64hash = await ResourcesManager.generateKeyForData(base64data);

        await this.db.put(base64hash, base64data);

        return base64hash;
    }

    async getResource(base64hash) {

        console.log("LevelResourcesManager fetching res: " + base64data);

        var base64data;

        try {
            base64data = await this.db.get(base64hash);
        } catch (error) {
            if (error.notFound === true) {
                base64data = undefined;
            }
        }

        return base64data;

    }

}
