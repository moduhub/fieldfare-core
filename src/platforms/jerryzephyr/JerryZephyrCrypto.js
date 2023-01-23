import {CryptoManager} from '../../basic/CryptoManager';

class JerryZephyrCrypto extends CryptoManager {
    
    constructor() {
        //
    }

    static init() {
        CryptoManager.singleton(new JerryZephyrCrypto);
    }

    async generateLocalKeypair() {
        return {
            publicKey: {
                platformData: 0 //pointer/index to the key in C code
            },
            privateKey: {
                platformData: 0 //pointer/index to the key in C code
            }
        }
    }

    async getLocalKeypair() {
        // Get public/private key pointer from C code
            //Optional, generate key if none exists on first call to this method
        return {
            publicKey: {
                platformData: 0 //pointer/index to the key in C code
            },
            privateKey: {
                platformData: 0 //pointer/index to the key in C code
            }
        }
    }

    importPublicKey(keyData) {
        //Import public key from JWK data
        //returns publicKey as in the keypair object example above, containing platformData
        return {
            platformData: 0 //index to the key in C code
        };
    }

    exportPublicKey(publicKey) {
        //The code below is an example only
        return {
            "kty": "EC",
            "use": "sig",
            "crv": "P-256",
            "kid": "kiC-s4Hx_v6XkyrIUH1ezlYVXoeES-rByL23S6H0-SQ",
            "x": "s1_Z1YDpyqXZ3vaOr8JSpRq8BN1mfvCAmbEHSn6s1dQ",
            "y": "Qg7EG8mFC4hCxxGfaW75kUkxdjSEczbP2D8CAk-HrRQ",
            "alg": "ES256"
        }
    }

    async digest(buffer) {
        // native call: zephyr_digest using SHA256
        //buffer: uint8 buffer containing data to be digested
        //returns: uint8 buffer containing SHA256 digest
        digestBuffer = new Uint8Array(0);
        return digestBuffer;
    }

    signBuffer(buffer, privateKey) {
		// native call: something like zephyr_sign_buffer(buffer, privateKey.platformData)
        
        return signatureBuffer;
    }

    verifyBuffer(dataBuffer, signatureBuffer, publicKey) {
        // native call: something like zephyr_verify_buffer(dataBuffer, signatureBuffer, publicKey.platformData)
        //dataBuffer -> data to be signed, uint8_buffer
        //signatureBuffer -> buffer containign signature, uint8_buffer
        //publicKey pointer to the public key assigned to that signature
        return true; //return true if verify pass, false otherwise
    }

}