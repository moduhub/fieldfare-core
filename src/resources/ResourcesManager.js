
import { LocalHost } from '../env/LocalHost';
import { Request } from '../trx/Request';
import { ResourceUtils } from './ResourceUtils';
import { logger } from '../basic/Log';

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

    static addInstance(instance) {
        instances.add(instance);
    }

    static async storeResourceObject(object) {
		const base64data = ResourceUtils.convertObjectToData(object);
		const base64hash = await ResourcesManager.storeResourceData(base64data);
//		logger.log('info', "------------------------------\n"
//			+ "Storing: " + base64hash
//			+ "->" + JSON.stringify(object, null, 2)
//			+ "\n------------------------------\n");
		return base64hash;
	}

	static async getResourceObject(hash, owner) {
		const base64data = await ResourcesManager.getResourceData(hash, owner);
		const object = ResourceUtils.convertDataToObject(base64data);
		return object;
	}

	static async storeResourceData(data) {
		var base64key;
		if(ResourcesManager.available() === false) {
	          throw Error('No resources managers defined');
        }
		//Store in all defined managers
		for (const instance of instances) {
			base64key = await instance.storeResourceData(data);
		}
		return base64key;
	}

	/**
	 * Fetch resource data locally if available, or request from remote host
	 * otherwise. Throws an error if the resource is not found anywhere.
	 * - DEPRECATED: use Resource.fromKey() instead of managing resource keys manually
	 * @param {string} key resource key in base64 format
	 * @param {string} ownerID resource owner ID in base64 format
	 * @returns string containing resource data in base64 format
	 */
	static async getResourceData(key, ownerID) {
		ResourceUtils.validateKey(key);
		var data;
		try {
			data = await ResourcesManager.getLocalResourceData(key);
		} catch(error) {
			if(error.name === 'NOT_FOUND_ERROR') {
				//logger.log('info', "res.fetch: Not found locally. Owner: " + owner);
				if(ownerID === null
				|| ownerID === undefined) {
					//Owner not know, fail
					var error = Error('resource not found locally, owner unknown: ' + key);
					error.name = 'NOT_FOUND_ERROR';
					throw error;
				}
				data = await ResourcesManager.getRemoteResourceData(key, ownerID);
			}                
			throw error;
		}
		return data;
	}
	
	/**
	 * Search all local Resources Managers for the resource indicated by the
	 * 'key' argument, throws a NOT_FOUND_ERROR if the resource is not found.
	 * @param {string} key Resource key in base64 format
	 * @returns string containing resource data in base64 format
	 */
	static async getLocalResourceData(key) {
		var base64data;
		for(const instance of instances) {
			try {
				base64data = await instance.getResourceData(key);
				if(base64data !== undefined) {
					return base64data;
				}
			} catch (error) {
				if(error.name === 'NOT_FOUND_ERROR') {
					// logger.log('info', 'Manager ' + manager + ' does not have ' + key);
				} else {
					throw Error('getResource failed: ', {cause: error});
				}
			}
		}
		const error = new Error('Resource not found locally');
		error.name = 'NOT_FOUND_ERROR';
		throw error;
	}

	/**
	 * Request resource identified by the given key, from remote host
	 * identified by the given ownerID.
	 * @param {string} hash resource hash (key) in base64 format
	 * @param {string} owner resource ownerID in base64 format
	 * @returns string containg resource data in base64 format
	 */
	static async getRemoteResourceData(hash, owner) {
		const retryCount = 3;
		for(var attempts = 0; attempts<retryCount; attempts++) {
			//Check if there is already a request for this same hash
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
				const verifyHash = await ResourcesManager.storeResourceData(remoteBase64data);
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
