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
     * Build Chunk from its indentifier. If teh identifier is null or
     * a null string like '', the function will return null.
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
        newChunk.id = await ChunkManager.storeChunkContents(newChunk.data);
        return newChunk;
    }

    /**
     * Expand chunk to a JavaScript object, following object properties 
     * that are recognized as chunk identifiers and transforming them to 
     * Chunk objects, unless keepIdentifiers is set, in which case the 
     * identifiers are kept as strings in base64 format plus prefix.
     * @param {integer} depth Depth to which the algoritm iterates down
     * os object properties expanding chunk identifiers to objects, where
     * zero will expand only the root object.
     * @param {boolean} keepIdentifiers setting this to true will convert no
     * identifer at all, keeping all strings in their original form even if 
     * they correspond to a chunk identifier.
     * @returns an Object containing all properties recovered from the chunk data
     */
    async expand(depth=0, keepIdentifiers=false) {
        if(this.id === null
        || this.id === undefined) {
            return null;
        }
        const object = ChunkingUtils.convertDataToObject(await this.fetch());
        if(!keepIdentifiers) {
            //iterate properties searching for child chunks
            for(const prop in object) {
                const value = object[prop];
                if(ChunkingUtils.isValidIdentifier(value)) {
                    const childChunk = Chunk.fromIdentifier(value, this.ownerID);
                    if(depth > 0) {
                        object[prop] = await childChunk.expand(depth-1);
                    } else {
                        object[prop] = childChunk;
                    }
                }
            }
        }
        return object;
    }

    /**
     * Expands the chunk in the same way as Chunk.expand(0), but will cast the
     * resulting object to a specific class type. The methos also searches for
     * a static method called validateParameters in the given class to perform
     * any content validation on the object recovered from the chunk.
     * @param {class} type class to which the resulting object will be cast into
     * @param {boolean} keepIdentifiers if set, will not expand any property
     * that matches a Chunk indentifier, keeping them as strings
     * @returns the resulting object as an instance of given type
     */
    async expandTo(type, keepIdentifiers=false) {
        if(type == null
        || type == undefined) {
            throw Error('expandTo failed, type not defined');
        }
        const rawObject = await this.expand(0, keepIdentifiers);
        if(type.validateParameters) {
            type.validateParameters(rawObject);
        }
        const typedObject = new type;
        Object.assign(typedObject, rawObject);
		return typedObject;
    }

}