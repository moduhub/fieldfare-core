
const LevelNVData = require('../nvd/LevelNVData.js');

const Utils = require('../basic/Utils.js');

import ResourcesManager from '../resources/ResourcesManager';

var privateKeyData;
var pubKeyData;


export async function init() {

    if(global.nvdata === undefined) {
        global.nvdata = new LevelNVData;
    }

    if(global.crypto === undefined) {
        global.crypto = require('crypto').webcrypto;
    }

}

export async function getEnvironmentUUID() {
    var uuid = await nvdata.load('envUUID');
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

    await nvdata.save('envUUID', uuid);

}

export async function getHostID() {

    if(privateKeyData === undefined) {
        privateKeyData = await nvdata.load('privateKey');

        if(privateKeyData) {
            await importPrivateKey(privateKeyData);
        } else {
            return '<undefined>';
        }
    }

    const id = await ResourcesManager.generateKeyForObject(pubKeyData);

    console.log("host.id: " + id);

    return id;
}

export async function getBootWebports() {

    const webportsJSON = await nvdata.load('bootWebports');

    if(webportsJSON) {
        return JSON.parse(webportsJSON);
    } else {
        return undefined;
    }

}

export async function addBootWebport(newWebportData) {

    const webportsJSON = await nvdata.load('bootWebports');

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

    await nvdata.save('bootWebports', JSON.stringify(webports));

}

export async function removeBootWebport(index) {

    const webportsJSON = await nvdata.load('bootWebports');

    var webports;

    if(webportsJSON === null
    || webportsJSON === undefined) {
        webports = [];
    } else {
        webports = JSON.parse(webportsJSON);
    }

    webports.splice(index, 1);

    await nvdata.save('bootWebports', JSON.stringify(webports));
}

export async function removeAllBootWebports() {

    await nvdata.save('bootWebports', '[]');

}
