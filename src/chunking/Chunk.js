import { ChunkManager } from "./ChunkManager";
import { ChunkingUtils } from "./ChunkingUtils";
import { LocalHost } from "../env/LocalHost";


export class Chunk {

    constructor() {
        /**
         * Chunk identifier in base64 format, preceeded by chunk prefix
         * @type {string}
         * @public
         */
        this.id = undefined;
    }

    static null() {
        return new Chunk();
    }

    /**
     * Build Chunk from its indentifier
     * @param {string} id chunk identifier in base64 format plus prefix
     * @param {string} owner remote chunk owner ID in base64 format
     * @returns new Chunk object assigned to given key
     */    
    static fromIdentifier(id, ownerID) {
        if(id === null
        || id === '') {
            return null;
        }
        ChunkingUtils.validateIdentifier(id);
        const newChunk = new Chunk;
        newChunk.id = id;
        newChunk.ownerID = ownerID;
        return newChunk;
    }

    async fetch() {
        if(this.data === undefined)  {
            try {
                this.data = await ChunkManager.getLocalChunkContents(this.id);
                this.local = true;
            } catch(error) {
                if(error.name === 'NOT_FOUND_ERROR') {
                    //logger.log('info', "res.fetch: Not found locally. Owner: " + owner);
                    if(this.ownerID === null
                    || this.ownerID === undefined) {
                        //Owner not know, fail
                        var error = Error('chunk not found locally, owner unknown: ' + this.id);
                        error.name = 'NOT_FOUND_ERROR';
                        throw error;
                    }
                    this.data = await ChunkManager.getRemoteChunkContents(this.id, this.ownerID);
                    this.local = false;    
                }                
                throw error;
            }
        }
        return this.data;
    }

    static async fromObject(object) {
        const newChunk = new Chunk;
        newChunk.local = true;
        newChunk.ownerID = LocalHost.getID();
        //iterate object searching for Chunk instances, convert them to chunk ids
        var convertedObject = {};
        for(const prop in object) {
            const value = object[prop];
            if(value instanceof Chunk) {
                convertedObject[prop] = value.id;
                //await value.fetch(); //chunk may be remote, must make it local
            } else {
                convertedObject[prop] = value;
            }
        }
        // console.log('Original object: ' + JSON.stringify(object));
        // console.log('Converted object: ' + JSON.stringify(convertedObject));
        newChunk.data = ChunkingUtils.convertObjectToData(convertedObject);
        newChunk.id = await ChunkManager.storeChunkData(newChunk.data);
        return newChunk;
    }

    async expand(depth=0) {
        if(this.id === null
        || this.id === undefined) {
            return null;
        }
        const object = ChunkingUtils.convertDataToObject(await this.fetch());
        //iterate properties searching for child chunks
        for(const prop in object) {
            const value = object[prop];
            if(ChunkingUtils.isValidKey(value)) {
                const childChunk = Chunk.fromIdentifier(value, this.ownerID);
                if(depth > 0) {
                    object[prop] = await childChunk.expand(depth-1);
                } else {
                    object[prop] = childChunk;
                }
            }
        }
        return object;
    }

}