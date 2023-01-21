import { WebCryptoManager } from "../shared/WebCryptoManager";
import { CryptoManager } from "../../basic/CryptoManager";
import {NVD} from '../../basic/NVD';
import {logger} from '../../basic/Log'

/**
 * The Node Crypto manager inherits from the WebCryptoManager
 * and implements only the key management methods.
 */
export class NodeCryptoManager extends WebCryptoManager {

    static init() {
        CryptoManager.singleton(new NodeCryptoManager);
    }

    async generateLocalKeypair() {
        const newKeypair = await crypto.subtle.generateKey(
            {
                name: "ECDSA",
                namedCurve: "P-256"
            },
            true,
            ["sign"]
        );
        logger.debug('New keypair generated: ' + JSON.stringify(newKeypair));
        const publicKey = newKeypair.publicKey;
        const privateKey = newKeypair.privateKey;
        const privateKeyJWK = await crypto.subtle.exportKey("jwk", newKeypair.privateKey);
        const publicKeyJWK = {
            kty: "EC",
            use: "sig",
            crv: "P-256",
            kid: privateKeyJWK.kid,
            x: privateKeyJWK.x,
            y: privateKeyJWK.y,
            alg: "ES256"
        };
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
        logger.debug('privateKeyJWK: ' + JSON.stringify(privateKeyJWK));
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