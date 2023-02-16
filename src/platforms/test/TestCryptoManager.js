import { WebCryptoManager } from "../shared/WebCryptoManager";
import { CryptoManager } from "../../basic/CryptoManager";

/**
 * A crypto manager to be used in test enviroments, it used a fixed
 * WebCrypto keypair
 */
export class TestCryptoManager extends WebCryptoManager {

    static init() {
        global.crypto = require('node:crypto').webcrypto;
        CryptoManager.singleton(new TestCryptoManager);
    }

    async generateTestKeypair() {
        const newKeypair = await crypto.subtle.generateKey(
            {
                name: "ECDSA",
                namedCurve: "P-256"
            },
            true,
            ["sign"]
        );
        return {
            publicKey: {
                index: 0,
                platformData: newKeypair.publicKey
            },
            privateKey: {
                index: 0,
                platformData: newKeypair.privateKey
            }
        };
    }

    async generateLocalKeypair() {
        const privateKeyJWK = {
            "kty": "EC",
            "d": "N5DZ1JyZ5AyHElVE6gwOTM0yC9OCcu063BXdQXGW2xk",
            "use": "sig",
            "crv": "P-256",
            "kid": "pRM04kwPZNZZinW6suwFJOb5cYVO2D8DULHGHCCAJSQ",
            "x": "s3uet0V_BKynMbYongwRr0DsA4_SIYqinqWM6QzJFug",
            "y": "ZzKXOKYclZsbVHXWrHTI3o8MPX8g4IcgXBCkuJyX_kw",
            "alg": "ES256"
        };
        const publicKeyJWK = {
            "kty": "EC",
            "use": "sig",
            "crv": "P-256",
            "kid": "pRM04kwPZNZZinW6suwFJOb5cYVO2D8DULHGHCCAJSQ",
            "x": "s3uet0V_BKynMbYongwRr0DsA4_SIYqinqWM6QzJFug",
            "y": "ZzKXOKYclZsbVHXWrHTI3o8MPX8g4IcgXBCkuJyX_kw",
            "alg": "ES256"
        };
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

    async getLocalKeypair() {
        return this.generateLocalKeypair();
    }

}