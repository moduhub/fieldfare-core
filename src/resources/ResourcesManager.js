
import {LocalHost} from '../env/LocalHost';
import {Request} from '../trx/Request';
import {Utils} from '../basic/Utils';
import {logger} from '../basic/Log';
import { cryptoManager } from '../basic/CryptoManager';

var instances = new Set();

export class ResourcesManager {

    constructor() {
            //
    }

    static available() {
        if (instances.size > 0) {
            return true;
        }
        return false;
    }

    static validateKey(key) {
        if(Utils.isBase64(key) == false
        || key.length !== 44) {
            throw Error('Invalid resource key: ' + JSON.stringify(key));
        }
    }

    static convertObjectToData(object) {
        const utf8ArrayBuffer = Utils.strToUtf8Array(JSON.stringify(object));
		const base64data = Utils.arrayBufferToBase64(utf8ArrayBuffer);
        return base64data;
    }

    static convertDataToObject(base64data) {
        return JSON.parse(atob(base64data));
    }

    static async generateKeyForData(base64data) {
        const dataBuffer = Utils.base64ToArrayBuffer(base64data);
        const hashBuffer = await cryptoManager.digest(dataBuffer);
        const base64hash = Utils.arrayBufferToBase64(hashBuffer);
        return base64hash;
    }

    static async generateKeyForObject(object) {
		const base64data = ResourcesManager.convertObjectToData(object);
		const base64hash = await ResourcesManager.generateKeyForData(base64data);
		return base64hash;
	}

    static addInstance(instance) {
        instances.add(instance);
    }

    static async storeResourceObject(object) {
		const base64data = ResourcesManager.convertObjectToData(object);
		const base64hash = await ResourcesManager.storeResource(base64data);
//		logger.log('info', "------------------------------\n"
//			+ "Storing: " + base64hash
//			+ "->" + JSON.stringify(object, null, 2)
//			+ "\n------------------------------\n");
		return base64hash;
	}

	static async getResourceObject(hash, owner) {
		const base64data = await ResourcesManager.getResource(hash, owner);
		const object = ResourcesManager.convertDataToObject(base64data);
		return object;
	}

	static async storeResource(data) {
		var base64hash;
		if(ResourcesManager.available() === false) {
	          throw Error('No resources managers defined');
        }
		//Store in all defined managers
		for (const instance of instances) {
			base64hash = await instance.storeResource(data);
		}
		return base64hash;
	}

	static async getResource(hash, owner) {
        ResourcesManager.validateKey(hash);
		var base64data;
		//Attemp to find resource on all resources managers
		for(const instance of instances) {
			try {
				base64data = await instance.getResource(hash);
				if(base64data !== undefined) {
					return base64data;
				}
			} catch (error) {
				if(error.name === 'NOT_FOUND_ERROR') {
					// logger.log('info', 'Manager ' + manager + ' does not have ' + hash);
				} else {
					throw Error('getResource failed: ', {cause: error});
				}
			}
		}
		//logger.log('info', "res.fetch: Not found locally. Owner: " + owner);
		//not found locally, attemp to find on remote host
		if(owner === null
		|| owner === undefined) {
			//Owner not know, fail
			var error = Error('resource not found locally, owner not known: ' + hash);
			error.name = 'NOT_FOUND_ERROR';
			throw error;
		}
		const retryCount = 3;
		for(var attempts = 0; attempts<retryCount; attempts++) {
			//Check if there is already a request for
			//this same hash
			var request = LocalHost.getPendingRequest(hash);
			if(request === undefined) {
				if(attempts > 0) {
					logger.debug('get resource request retry ' + attempts + ' of ' + retryCount-1);
				}
				request = new Request('resource', 3000, {
					hash: hash
				});
				request.setDestinationAddress(owner);
				//Notify that a new request was created
				LocalHost.dispatchRequest(hash, request);
			}
			try {
				const response = await request.complete();
				var remoteBase64hash = response.data.hash;
				var remoteBase64data = response.data.data;
				//logger.log 'info', ("Received remote resource response:" + JSON.stringify(response.data.data));
				const verifyHash = await ResourcesManager.storeResource(remoteBase64data);
				if(verifyHash !== remoteBase64hash) {
					//logger.log('info', "[+RES] (" + hash + "):(" + response.data.data + ")");
					throw Error('corrupted resource received from remote host');
				}
				return remoteBase64data;
			} catch (error) {
				logger.error('Get resource request failed: ' + error.stack);
			} finally {
                LocalHost.clearRequest(hash);
			}
		}
		throw Error('Resource not found remotely: ' + hash).name = 'NOT_FOUND_ERROR';
	}

};
