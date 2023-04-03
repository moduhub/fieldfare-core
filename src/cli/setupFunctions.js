/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import { ChunkingUtils } from '../chunking/ChunkingUtils.js';
import { LevelNVD } from '../platforms/node/LevelNVD.js';
import { NVD } from '../basic/NVD.js';
import { Utils } from '../basic/Utils.js';
import { cryptoManager } from '../basic/CryptoManager.js';
import { NodeCryptoManager } from '../platforms/node/NodeCryptoManager.js';
import { LocalService } from '../env/LocalService.js';
import { logger } from '../basic/Log.js';

export async function init() {
    LevelNVD.init();
    await NodeCryptoManager.init();
}

export async function getLocalHostID() {
    const localKeypair = await cryptoManager.getLocalKeypair();
    if(localKeypair) {
        logger.debug('getLocalHostID, publicKey: ' + JSON.stringify(localKeypair.publicKey));
        const publicKeyJWK = await cryptoManager.exportPublicKey(localKeypair.publicKey);
        const hostID = await ChunkingUtils.generateIdentifierForObject(publicKeyJWK);
        return hostID;
    }
    return '<undefined>';
}

export async function getEnvironmentUUID() {
    var uuid = await NVD.load('envUUID');
    if(uuid === undefined) {
        uuid = '<undefined>';
    }
    return uuid;
}

export async function setEnvironmentUUID(uuid) {

    console.log(">>setEnvironment to " + uuid);

    if(Utils.isUUID(uuid) === false) {
        throw Error('invalid UUID');
    }

    await NVD.save('envUUID', uuid);

}

export async function getBootWebports() {

    const webportsJSON = await NVD.load('bootWebports');

    if(webportsJSON) {
        return JSON.parse(webportsJSON);
    } else {
        return undefined;
    }

}

export async function addBootWebport(newWebportData) {

    const webportsJSON = await NVD.load('bootWebports');

    var webports;

    if(webportsJSON === null
    || webportsJSON === undefined) {
        webports = [];
    } else {
        webports = JSON.parse(webportsJSON);
    }

    if(webports.includes(newWebportData)) {
        throw Error('Webport already defined');
    }

    webports.push(newWebportData);

    await NVD.save('bootWebports', JSON.stringify(webports));

}

export async function removeBootWebport(index) {

    const webportsJSON = await NVD.load('bootWebports');

    var webports;

    if(webportsJSON === null
    || webportsJSON === undefined) {
        webports = [];
    } else {
        webports = JSON.parse(webportsJSON);
    }

    webports.splice(index, 1);

    await NVD.save('bootWebports', JSON.stringify(webports));
}

export async function removeAllBootWebports() {

    await NVD.save('bootWebports', '[]');

}
