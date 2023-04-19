/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import { Chunk } from '../chunking/Chunk.js';
import { Utils } from './Utils.js';
import { logger } from './Log.js';

export var cryptoManager;

export class CryptoManager {
    constructor() {
        //
    }

    static singleton(instance) {
        cryptoManager = instance;
    }

	/**
	 * Substitute chunks, hosts and any other dedicated objects by their identifiers,
	 * in a way that the message always hashes to the same value independent of
	 * any chunk expansion.
	 * @param {message} message 
	 * @returns a normalized copy of the message
	 */
	static async normalizeMessage(message) {
		const normalizedMessage = new Object;
		Object.assign(normalizedMessage, message);
		await Chunk.replaceChunks(normalizedMessage, (key, value) => {
            return value.id;
        })
		return normalizedMessage;
	}

    async signMessage(message, privateKey) {
        if(!message) {
            throw Error('message is undefined');
        }
        if(!privateKey) {
            throw Error('privateKey is undefined');
        }
        if(cryptoManager === undefined) {
            throw Error('CryptoManager not initialized');
        }
        const normalizedMessageData = await CryptoManager.normalizeMessage(message.data);
        const utf8ArrayBuffer = Utils.strToUtf8Array(JSON.stringify(normalizedMessageData));
        const signatureBuffer = await cryptoManager.signBuffer(utf8ArrayBuffer, privateKey);
        message.signature = Utils.uint8ArrayToBase64(signatureBuffer);
    }

    async verifyMessage(message, publicKey) {
        if(cryptoManager === undefined) {
            throw Error('CryptoManager not initialized');
        }
        const normalizedMessageData = await CryptoManager.normalizeMessage(message.data);
        var result = false;
        if('signature' in message) {
            var signatureBuffer = Utils.base64ToUint8Array(message.signature);
            var dataBuffer = Utils.strToUtf8Array(JSON.stringify(normalizedMessageData));
            result = await cryptoManager.verifyBuffer(dataBuffer, signatureBuffer, publicKey);
            logger.log('info', "Signature verify result: " + result);
        } else {
            logger.log('info', 'missing signature inside message: ' + JSON.stringify(message));
        }
        return result;
    }
}