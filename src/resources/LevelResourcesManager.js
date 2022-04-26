
const { Level } = require('level');

const ResourcesManager = require('./ResourcesManager.js');


module.exports = class LevelResourcesManager extends ResourcesManager {

    constructor() {
        super();

        this.db = new Level('resources', { valueEncoding: 'json' })

        setInterval(async () => {
            console.log(await this.report());
        }, 10000);

    }

    async report() {

        var starttime = performance.now();
        const iterator = this.db.keys();
        var numEntries = 0;
        for await (const key of iterator) numEntries++;
        var endtime = performance.now();

        var deltaReport = "";

        if(this.lastNumEntries !== undefined) {

            deltaReport = ", "

            if(numEntries >= this.lastNumEntries) {
                deltaReport += (numEntries - this.lastNumEntries) + " more "
            } else {
                deltaReport += (this.lastNumEntries - numEntries) + " less "
            }

            deltaReport += "since last report";

        }

        this.lastNumEntries = numEntries;

        return "Level Resources Manager: "
            + numEntries
            + " resources stored"
            + deltaReport
            + ". (Search took "
            + (endtime - starttime)
            + " ms)";

    }

    async storeResource(base64data) {

        //console.log("LevelResourcesManager storing res: " + base64data);

        const base64hash = await ResourcesManager.generateKeyForData(base64data);

        await this.db.put(base64hash, base64data);

        return base64hash;
    }

    async getResource(base64hash) {

        //console.log("LevelResourcesManager fetching res: " + base64hash);

        var base64data;

        try {
            base64data = await this.db.get(base64hash);
        } catch (error) {

            console.log("LevelResourcesManager getResource: " + error);

            if (error.notFound === true) {
                base64data = undefined;
            }
        }

        return base64data;

    }

}
