
import { Message } from '../trx/Message';
import { Utils } from './Utils';
import { logger } from './Log';

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
        const normalizedMessageData = await Message.normalize(message.data);
        const utf8ArrayBuffer = Utils.strToUtf8Array(JSON.stringify(normalizedMessageData));
        console.log('Message to be signed:');
        console.log(normalizedMessageData);
        const signatureBuffer = await cryptoManager.signBuffer(utf8ArrayBuffer, privateKey);
        message.signature = Utils.uint8ArrayToBase64(signatureBuffer);
    }

    async verifyMessage(message, publicKey) {
        if(cryptoManager === undefined) {
            throw Error('CryptoManager not initialized');
        }
        const normalizedMessageData = await Message.normalize(message.data);
        var result = false;
        if('signature' in message) {
            var signatureBuffer = Utils.base64ToUint8Array(message.signature);
            var dataBuffer = Utils.strToUtf8Array(JSON.stringify(normalizedMessageData));
            console.log('Message to be verified:');
            console.log(normalizedMessageData);
            result = await cryptoManager.verifyBuffer(dataBuffer, signatureBuffer, publicKey);
            logger.log('info', "Signature verify result: " + result);
        } else {
            logger.log('info', 'missing signature inside message: ' + JSON.stringify(message));
        }
        return result;
    }
}