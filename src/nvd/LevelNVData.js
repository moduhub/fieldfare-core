
const { Level } = require('level');

module.exports = class LevelNVData {

    constructor() {

         this.db = new Level('nvd', { valueEncoding: 'json' })

    }

    async save(key, object) {

        console.log("LevelNVData storing key: " + key);

        await this.db.put(key, object);

    }

    async load(key) {

        console.log("LevelNVData fetching key: " + key);

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
