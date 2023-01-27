
import { Utils } from "../basic/Utils";
import { cryptoManager } from "../basic/CryptoManager";

export const ChunkingUtils = {

    isValidIdentifier(id) {
        if(Utils.isBase64(id)
        && id.length === 44) {
            return true;
        }
        return false;
    },

    validateIdentifer(id) {
        if(ChunkingUtils.isValidIdentifier(id) === false) {
            throw Error('Invalid chunk id: ' + JSON.stringify(id));
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

    async generateIdForData(base64data) {
        const dataBuffer = Utils.base64ToArrayBuffer(base64data);
        const hashBuffer = await cryptoManager.digest(dataBuffer);
        const base64hash = Utils.arrayBufferToBase64(hashBuffer);
        return 'D:'+base64hash;
    },

    async generateIdForObject(object) {
		const base64data = ChunkingUtils.convertObjectToData(object);
		const id = await ResourcesManager.generateKeyForData(base64data);
		return id;
	}
}