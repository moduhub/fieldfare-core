
const { Level } = require('level');

export class LevelNVD {

    constructor() {

         this.db = new Level('nvd', { valueEncoding: 'json' })

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
