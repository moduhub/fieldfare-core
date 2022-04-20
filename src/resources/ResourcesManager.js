
const Utils = require('../Utils.js');

module.exports = class ResourcesManager {

    constructor() {

            //

    }

    static convertObjectToData(object) {

        var utf8ArrayBuffer = new TextEncoder().encode(JSON.stringify(object));

		var base64data = Utils.arrayBufferToBase64(utf8ArrayBuffer);

        return base64data;
    }

    static convertDataToObject(base64data) {

        return JSON.parse(atob(base64data));

    }

    static async generateKeyForData(base64data) {

        var dataBuffer = Utils.base64ToArrayBuffer(base64data);

        var hash = new Uint8Array(await crypto.subtle.digest('SHA-256', dataBuffer));

        var base64hash = btoa(String.fromCharCode.apply(null, hash));

        return base64hash;
    }

    static async generateKeyForObject(object) {

		var utf8ArrayBuffer = new TextEncoder().encode(JSON.stringify(object));

		var base64data = Utils.arrayBufferToBase64(utf8ArrayBuffer);

		var base64hash = await ResourcesManager.generateKeyForData(base64data);

		return base64hash;
	}

};
