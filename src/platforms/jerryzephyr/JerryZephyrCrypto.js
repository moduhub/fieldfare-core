/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import {CryptoManager} from '../../basic/CryptoManager.js';

class JerryZephyrCrypto extends CryptoManager {
    constructor() {
        //
    }

    loadPrivateKey() {
        //return private key in jwk format
    }

    //adapt js crypto calls to uECC inside ZephyrOS

}