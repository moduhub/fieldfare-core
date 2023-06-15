/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import { Utils } from "../basic/Utils.js";
import { cryptoManager } from "../basic/CryptoManager.js";

export const chunkIdentifierPrefix = 'd:';

export const ChunkingUtils = {
    
    isValidIdentifier: function (id) {
        if(id
        && id !== null
        && id !== undefined) {
            if(typeof(id) === 'string') {
                if(id.length === 46) {
                    const prefix = id.slice(0,2);
                    const base64part = id.slice(2,46);
                    if(prefix === chunkIdentifierPrefix
                    && Utils.isBase64(base64part)) {
                        return true;
                    }
                }
            }
        }
        return false;
    },

    validateIdentifier: function (id) {
        if(ChunkingUtils.isValidIdentifier(id) === false) {
            throw Error('Invalid chunk id: ' + JSON.stringify(id));
        }
    },

    /**
     * DEPRECATED
     * @param {Object} object 
     * @returns string containing base64 data correspondig to the object
     */
    convertObjectToData: function (object) {
        const utf8ArrayBuffer = Utils.strToUtf8Array(JSON.stringify(object));
		const base64data = Utils.uint8ArrayToBase64(utf8ArrayBuffer);
        return base64data;
    },

    /**
     * DEPRECATED
     * @param {string} base64data 
     * @returns js object corresponding to the data
     */
    convertDataToObject: function (base64data) {
        return JSON.parse(atob(base64data));
    },

    generateIdentifierForData: async function (base64data) {
        if(!Utils.isBase64(base64data)) {
            throw Error('Attempt to generate identifier for non-base64 data: ' + JSON.stringify(base64data));
        }
        const dataBuffer = Utils.base64ToUint8Array(base64data);
        const hashBuffer = await cryptoManager.digest(dataBuffer);
        const base64hash = Utils.uint8ArrayToBase64(hashBuffer);
        return (chunkIdentifierPrefix+base64hash);
    },

    /**
     * DEPRECATED
     * @param {string} base64data 
     * @returns js object corresponding to the data
     */
    generateIdentifierForObject: async function (object) {
		const base64data = ChunkingUtils.convertObjectToData(object);
		const id = await ChunkingUtils.generateIdentifierForData(base64data);
		return id;
	},

    /**
	 * Expand the base64 chunk data collecting all valid chunk identifiers found in its properties,
	 * will parse inside all objects and arrays recursively.
	 * @param {string} base64data Chunk data in base64 format
	 * @returns an array containing the identifiers found
	 */
    getChildrenIdentifiers: async function (base64data) {
        const json = atob(base64data);
        const children = [];
        JSON.parse(json, (key, value) => {
            if(ChunkingUtils.isValidIdentifier(value)) {
                children.push(value);
            }
        });
        return children;
    }
}