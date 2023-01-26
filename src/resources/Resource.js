import { ResourcesManager } from "./ResourcesManager";
import { ResourceUtils } from "./ResourceUtils";
import { LocalHost } from "../env/LocalHost";
import { Utils } from '../basic/Utils';
import { cryptoManager } from "../basic/CryptoManager";


export class Resource {

    constructor() {
    }

    /**
     * Build resource from key in base64 format
     * @param {string} key resource key in base64 format
     * @param {string} owner remote resource owner ID in base64 format
     * @returns new Resource object assigned to given key
     */    
    static fromKey(key, ownerID) {
        if(key === null
        || key === '') {
            return null;
        }
        ResourceUtils.validateKey(key);
        const newResource = new Resource;
        newResource.key = key;
        newResource.ownerID = ownerID;
        return newResource;
    }

    async fetch() {
        if(this.data === undefined)  {
            try {
                this.data = await ResourcesManager.getLocalResourceData(this.key);
                this.local = true;
            } catch(error) {
                if(error.name === 'NOT_FOUND_ERROR') {
                    //logger.log('info', "res.fetch: Not found locally. Owner: " + owner);
                    if(this.ownerID === null
                    || this.ownerID === undefined) {
                        //Owner not know, fail
                        var error = Error('resource not found locally, owner unknown: ' + this.key);
                        error.name = 'NOT_FOUND_ERROR';
                        throw error;
                    }
                    this.data = await ResourcesManager.getRemoteResourceData(this.key, this.ownerID);
                    this.local = false;    
                }                
                throw error;
            }
        }
        return this.data;
    }

    static async fromObject(object) {
        const newResource = new Resource;
        newResource.local = true;
        newResource.ownerID = LocalHost.getID();
        //iterate object searching for Resource instances, convert them to keys
        var convertedObject = {};
        for(const prop in object) {
            const value = object[prop];
            if(value instanceof Resource) {
                convertedObject[prop] = value.key;
                //await value.fetch(); //resource may be remote, must make it local
            } else {
                convertedObject[prop] = value;
            }
        }
        // console.log('Original object: ' + JSON.stringify(object));
        // console.log('Converted object: ' + JSON.stringify(convertedObject));
        newResource.data = ResourceUtils.convertObjectToData(convertedObject);
        newResource.key = await ResourcesManager.storeResourceData(newResource.data);
        return newResource;
    }

    async expand(depth=0) {
        const object = ResourceUtils.convertDataToObject(await this.fetch());
        //iterate properties searching for child resources
        for(const prop in object) {
            const value = object[prop];
            if(ResourceUtils.isValidKey(value)) {
                const childResource = await Resource.fromKey(value, this.ownerID);
                if(depth > 0) {
                    object[prop] = await childResource.expand(depth-1);
                } else {
                    object[prop] = childResource;
                }
            }
        }
        return object;
    }

    /**
	 * Fetch all child resources from a remote host iteratively by following resource keys  
	 * contained inside JSON data down to a point where the resource is
	 * already available at the local ResourcesManager, or down to the last key
	 * depending on the value of the 'limit' parameter.
	 * @param {boolean} limit true if the process should stop when a resource is already
	 * available locally, if false or undefined, process continues until no more child
	 * keys are available
	 */
	async touch(limit) {
		const resourceObject = await ResourcesManager.getResourceObject(resourceKey, owner);

	}
}