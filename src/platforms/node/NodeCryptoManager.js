import { WebCryptoManager } from "../shared/WebCryptoManager";
import { CryptoManager } from "../../basic/CryptoManager";
import {NVD} from '../../basic/NVD';
import {logger} from '../../basic/Log'
import nodeCrypto from 'crypto';

/**
 * The Node Crypto manager inherits from the WebCryptoManager
 * and implements only the key management methods. Keys are
 * stored unencrypted in the disk in JWK format.
 */
export class NodeCryptoManager extends WebCryptoManager {

    static async init() {
        global.crypto = nodeCrypto.webcrypto;
        CryptoManager.singleton(new NodeCryptoManager);
    }

    async generateLocalKeypair() {
        const newKeypair = await crypto.subtle.generateKey(
            {
                name: "ECDSA",
                namedCurve: "P-256"
            },
            true,
            ['sign', 'verify']
        );
        const publicKey = newKeypair.publicKey;
        const privateKey = newKeypair.privateKey;
        const privateKeyJWK = await crypto.subtle.exportKey("jwk", newKeypair.privateKey);
        const publicKeyJWK = await crypto.subtle.exportKey("jwk", newKeypair.publicKey);
        await NVD.save('privateKey', privateKeyJWK);
        await NVD.save('publicKey', publicKeyJWK);
        return {
            publicKey: {
                index: 0,
                platformData: publicKey
            },
            privateKey: {
                index: 0,
                platformData: privateKey
            }
        };
    }

    async getLocalKeypair() {
        const publicKeyJWK = await NVD.load('publicKey');
        const privateKeyJWK = await NVD.load('privateKey');
        if(publicKeyJWK === undefined
        || publicKeyJWK === null
        || privateKeyJWK === undefined
        || privateKeyJWK === null) {
            return this.generateLocalKeypair();
        }
        // logger.debug('privateKeyJWK: ' + JSON.stringify(privateKeyJWK));
        const privateKey = await crypto.subtle.importKey(
            'jwk',
            privateKeyJWK,
            {
                name:'ECDSA',
                namedCurve: 'P-256'
            },
            true,
            ['sign']
        );
        const publicKey = await crypto.subtle.importKey(
            'jwk',
            publicKeyJWK,
            {
                name:'ECDSA',
                namedCurve: 'P-256'
            },
            true,
            ['verify']
        );
        return {
            publicKey: {
                index: 0,
                platformData: publicKey
            },
            privateKey: {
                index: 0,
                platformData: privateKey
            }
        };
    }

}