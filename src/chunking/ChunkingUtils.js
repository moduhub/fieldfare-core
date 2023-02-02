
import { Utils } from "../basic/Utils";
import { cryptoManager } from "../basic/CryptoManager";

const chunkIdentiferPrefix = 'd:';

export const ChunkingUtils = {
    
    isValidIdentifier: function (id) {
        if(id
        && id !== null
        && id !== undefined) {
            if(typeof(id) === 'string') {
                if(id.length === 46) {
                    const prefix = id.slice(0,2);
                    const base64part = id.slice(2,46);
                    if(prefix === chunkIdentiferPrefix
                    && Utils.isBase64(base64part)) {
                        return true;
                    }
                }
            }
        }
        return false;
    },

    validateIdentifier: function (id) {
        if(ChunkingUtils.isValidIdentifier(id) === false) {
            throw Error('Invalid chunk id: ' + JSON.stringify(id));
        }
    },

    convertObjectToData: function (object) {
        const utf8ArrayBuffer = Utils.strToUtf8Array(JSON.stringify(object));
		const base64data = Utils.arrayBufferToBase64(utf8ArrayBuffer);
        return base64data;
    },

    convertDataToObject: function (base64data) {
        return JSON.parse(atob(base64data));
    },

    generateIdentifierForData: async function (base64data) {
        const dataBuffer = Utils.base64ToArrayBuffer(base64data);
        const hashBuffer = await cryptoManager.digest(dataBuffer);
        const base64hash = Utils.arrayBufferToBase64(hashBuffer);
        return (chunkIdentiferPrefix+base64hash);
    },

    generateIdentifierForObject: async function (object) {
		const base64data = ChunkingUtils.convertObjectToData(object);
		const id = await ChunkingUtils.generateIdentifierForData(base64data);
		return id;
	}
}