
const ResourcesManager = require('./ResourcesManager.js');

import {logger} from '../basic/Log'


module.exports = class VolatileResourcesManager extends ResourcesManager {

    constructor() {
        super();

        this.hashmap = new Map;

        setInterval(() => {
            logger.log('info', "Volatile Resources Manager: " + this.hashmap.size + " resources stored.");
        }, 30000);

    }

    async storeResource(base64data) {

        const base64hash = await ResourcesManager.generateKeyForData(base64data);

		this.hashmap.set(base64hash, base64data);

		// logger.log('info', "res.store("
		// 	+ base64hash
		// 	+ ", "
		// 	+ base64data
		// 	+ ") >hashmap size: " + this.hashmap.size);

		return base64hash;
	}

	getResource(base64hash) {

		var base64data = this.hashmap.get(base64hash);

		return base64data;
	}

};
