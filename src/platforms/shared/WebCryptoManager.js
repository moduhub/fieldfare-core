/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import { CryptoManager } from "../../basic/CryptoManager.js";

/**
 * The WebCryptoManager implements basic cryptographic functions
 * for use with platforms that support WebCrypto, like the browser
 * and Node.js
 */
export class WebCryptoManager extends CryptoManager {
    
    constructor() {
        super();
    }

    async importPublicKey(keyData) {
        const plaformPublicKey = await crypto.subtle.importKey(
            'jwk',
            keyData,
            {
                name:'ECDSA',
                namedCurve: 'P-256'
            },
            false,
            ['verify']
        );
        return {
            index: 0,
            platformData: plaformPublicKey
        };
    }

    exportPublicKey(publicKey) {
        return crypto.subtle.exportKey("jwk", publicKey.platformData);
    }

    async digest(buffer) {
        if(buffer instanceof Uint8Array === false) {
            throw Error('digest buffer must be a Uint8Array');
        }
        const hashBuffer = await crypto.subtle.digest({ name: 'SHA-256' }, buffer);
        return new Uint8Array(hashBuffer);
    }

    async signBuffer(buffer, privateKey) {
        if(buffer instanceof Uint8Array === false) {
            throw Error('digest buffer must be a Uint8Array');
        }
		const signatureBuffer = await crypto.subtle.sign(
			{
				name: "ECDSA",
				hash: {name: "SHA-256"}
			},
			privateKey.platformData,
			buffer);
        const uint8buffer = new Uint8Array(signatureBuffer);
        return uint8buffer;
    }

    async verifyBuffer(dataBuffer, signatureBuffer, publicKey) {
        if(dataBuffer instanceof Uint8Array === false) {
            throw Error('verify dataBuffer must be a Uint8Array');
        }
        if(signatureBuffer instanceof Uint8Array === false) {
            throw Error('verify signatureBuffer must be a Uint8Array');
        }
        const result = await crypto.subtle.verify(
            {
                name: "ECDSA",
                hash: {name: "SHA-256"}
            },
            publicKey.platformData,
            signatureBuffer,
            dataBuffer);
        return result;
    }
}