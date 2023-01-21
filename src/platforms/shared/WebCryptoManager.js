import { CryptoManager } from "../../basic/CryptoManager";
import {NVD} from '../../basic/NVD'

export class WebCryptoManager extends CryptoManager {
    
    constructor() {
        super();
    }

    importPublicKey(keyData) {
        const plaformPulicKey = crypto.subtle.importKey(
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
            platformData: plaformPulicKey
        };
    }

    exportPublicKey(publicKey) {
        return crypto.subtle.exportKey("jwk", publicKey.platformData);
    }

    async digest(buffer) {
        return new Uint8Array(await crypto.subtle.digest({ name: 'SHA-256' }, buffer));
    }

    signBuffer(buffer, privateKey) {
		return crypto.subtle.sign(
			{
				name: "ECDSA",
				hash: {name: "SHA-256"}
			},
			privateKey.platformData,
			buffer);
    }

    verifyBuffer(dataBuffer, signatureBuffer, publicKey) {
        return crypto.subtle.verify(
            {
                name: "ECDSA",
                hash: {name: "SHA-256"}
            },
            publicKey.platformData,
            signatureBuffer,
            dataBuffer);
    }
}