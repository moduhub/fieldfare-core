import { WebCryptoManager } from "../shared/WebCryptoManager";
import { CryptoManager } from "../../basic/CryptoManager";
import {NVD} from '../../basic/NVD';

/**
 * The Browser Crypto Manager inherits from WebCryptoManager
 * and implements private key management via IndexedDB with 
 * non-extractable keys to enhance security in browser environments.
 */
export class BrowserCryptoManager extends WebCryptoManager {
    
    static init() {
        CryptoManager.singleton(new BrowserCryptoManager);
    }

    async generateLocalKeypair() {
        const newKeypair = await crypto.subtle.generateKey(
            {
                name: "ECDSA",
                namedCurve: "P-256"
            },
            false,
            ["sign"]
        );
        const publicKey = newKeypair.publicKey;
        const privateKey = newKeypair.privateKey;
        await NVD.save('publicKey', publicKey);
        await NVD.save('privateKey', privateKey);
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
        const publicKey = await NVD.load('publicKey');
        const privateKey = await NVD.load('privateKey');
        if(publicKey === undefined
        || publicKey === null
        || privateKey === undefined
        || privateKey === null) {
           return this.generateLocalKeypair();
        }
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