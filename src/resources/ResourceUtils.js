
import { Utils } from "../basic/Utils";
import { cryptoManager } from "../basic/CryptoManager";

export const ResourceUtils = {

    isValidKey(key) {
        if(Utils.isBase64(key)
        && key.length === 44) {
            return true;
        }
        return false;
    },

    validateKey(key) {
        if(ResourceUtils.isValidKey(key) === false) {
            throw Error('Invalid resource key: ' + JSON.stringify(key));
        }
    },

    convertObjectToData(object) {
        const utf8ArrayBuffer = Utils.strToUtf8Array(JSON.stringify(object));
		const base64data = Utils.arrayBufferToBase64(utf8ArrayBuffer);
        return base64data;
    },

    convertDataToObject(base64data) {
        return JSON.parse(atob(base64data));
    },

    async generateKeyForData(base64data) {
        const dataBuffer = Utils.base64ToArrayBuffer(base64data);
        const hashBuffer = await cryptoManager.digest(dataBuffer);
        const base64hash = Utils.arrayBufferToBase64(hashBuffer);
        return base64hash;
    },

    async generateKeyForObject(object) {
		const base64data = ResourceUtils.convertObjectToData(object);
		const base64hash = await ResourcesManager.generateKeyForData(base64data);
		return base64hash;
	}
}