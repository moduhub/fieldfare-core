
import { Utils } from './Utils';

export var cryptoManager;

export class CryptoManager {
    constructor() {
        //
    }

    static singleton(instance) {
        cryptoManager = instance;
    }

    async signMessage(message, privateKey) {
        if(cryptoManager === undefined) {
            throw Error('CryptoManager not initialized');
        }
        const utf8ArrayBuffer = Utils.strToUtf8Array(JSON.stringify(message.data));
        const signatureBuffer = await cryptoManager.signBuffer(utf8ArrayBuffer, privateKey);
        message.signature = Utils.uint8ArrayToBase64(signatureBuffer);
    }

    async verifyMessage(message, publicKey) {
        if(cryptoManager === undefined) {
            throw Error('CryptoManager not initialized');
        }
        var result = false;
        if('signature' in message) {
            var signatureBuffer = Utils.base64ToUint8Array(message.signature);
            var dataBuffer = Utils.strToUtf8Array(JSON.stringify(message.data));
            result = await CryptoManager.verifyBuffer(dataBuffer, signatureBuffer, publicKey);
            logger.log('info', "Signature verify result: " + result);
        } else {
            logger.log('info', 'missing signature inside message: ' + JSON.stringify(message));
        }
        return result;
    }
}