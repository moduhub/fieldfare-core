
const ResourcesManager = require('./ResourcesManager.js');

module.exports = class VolatileResourcesManager extends ResourcesManager {

    constructor() {
        super();

        this.hashmap = new Map;

        setInterval(() => {
            console.log("Volatile Resources Manager: " + this.hashmap.size + " resources stored.");
        }, 30000);

    }

    async storeResource(base64data) {

        const base64hash = ResourcesManager.generateKeyForData(base64data);

		this.hashmap.set(base64hash, base64data);

		/*
		console.log("res.store("
			+ base64hash
			+ ", "
			+ base64data
			+ ") >hashmap size: " + this.hashmap.size);
		*/

		return base64hash;
	}

	getResource(base64hash) {

		var base64data = this.hashmap.get(base64hash);

		return base64data;
	}

};
