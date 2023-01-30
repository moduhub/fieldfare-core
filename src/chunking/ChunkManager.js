
import { LocalHost } from '../env/LocalHost';
import { Request } from '../trx/Request';
import { ChunkingUtils } from './ChunkingUtils';
import { logger } from '../basic/Log';

var instances = new Set();

export class ChunkManager {

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

    static async storeObjectAsChunk(object) {
		const chunkContents = ChunkingUtils.convertObjectToData(object);
		const id = await ChunkManager.storeChunkContents(chunkContents);
//		logger.log('info', "------------------------------\n"
//			+ "Storing: " + base64hash
//			+ "->" + JSON.stringify(object, null, 2)
//			+ "\n------------------------------\n");
		return id;
	}

	static async getObjectFromIdentifier(id, owner) {
		const base64data = await ChunkManager.getDataFromIdentifier(id, owner);
		const object = ChunkingUtils.convertDataToObject(base64data);
		return object;
	}

	/**
	 * Store the contents of a chunk, generating its identifier in the process
	 * @param {string} contents Chunk contents inbase64 format 
	 * @returns string containing a chunk identifier assigned to the given data
	 */
	static async storeChunkContents(contents) {
		var base64key;
		if(ChunkManager.available() === false) {
	          throw Error('No chunk managers defined');
        }
		//Store in all defined managers
		for (const instance of instances) {
			base64key = await instance.storeChunkContents(contents);
		}
		return base64key;
	}

	/**
	 * Fetch chunk data locally if available, or request from remote host
	 * otherwise. Throws an error if the chunk is not found anywhere.
	 * - DEPRECATED: use Chunk.fromIdentifier() instead of managing chunk identifiers manually
	 * @param {string} id chunk id in base64 format plus prefix
	 * @param {string} ownerID chunk owner ID in base64 format
	 * @returns string containing chunk data in base64 format
	 */
	static async getChunkContents(id, ownerID) {
		ChunkingUtils.validateIdentifier(id);
		var data;
		try {
			data = await ChunkManager.getLocalChunkContents(id);
		} catch(error) {
			if(error.name === 'NOT_FOUND_ERROR') {
				//logger.log('info', "res.fetch: Not found locally. Owner: " + owner);
				if(ownerID === null
				|| ownerID === undefined) {
					//Owner not know, fail
					var error = Error('chunk not found locally, owner unknown: ' + id);
					error.name = 'NOT_FOUND_ERROR';
					throw error;
				}
				data = await ChunkManager.getRemoteChunkContents(id, ownerID);
			}                
			throw error;
		}
		return data;
	}
	
	/**
	 * Search all local Chunk Managers for the chunk indicated by the
	 * 'id' argument, throws a NOT_FOUND_ERROR if the chunk is not found.
	 * @param {string} id Chunk identifier in base64 format plus prefix
	 * @returns string containing chunk data in base64 format
	 */
	static async getLocalChunkContents(id) {
		var base64data;
		for(const instance of instances) {
			try {
				base64data = await instance.getDataFromIdentifier(id);
				if(base64data !== undefined) {
					return base64data;
				}
			} catch (error) {
				if(error.name === 'NOT_FOUND_ERROR') {
					// logger.log('info', 'Manager ' + manager + ' does not have ' + id);
				} else {
					throw Error('getLocalChunkContents failed: ', {cause: error});
				}
			}
		}
		const error = new Error('Chunk not found locally');
		error.name = 'NOT_FOUND_ERROR';
		throw error;
	}

	/**
	 * Request chunk identified by the given identifier from remote host
	 * identified by the given ownerID.
	 * @param {string} id chunk identifier in base64 format plus prefix
	 * @param {string} owner chunk ownerID in base64 format
	 * @returns string containg chunk contents in base64 format
	 */
	static async getRemoteChunkContents(id, owner) {
		const retryCount = 3;
		for(var attempts = 0; attempts<retryCount; attempts++) {
			//Check if there is already a request for this same identifier
			var request = LocalHost.getPendingRequest(id);
			if(request === undefined) {
				if(attempts > 0) {
					logger.debug('get chunk request retry ' + attempts + ' of ' + retryCount-1);
				}
				request = new Request('chunk', 3000, {
					id: id
				});
				request.setDestinationAddress(owner);
				//Notify that a new request was created
				LocalHost.dispatchRequest(id, request);
			}
			try {
				const response = await request.complete();
				var remoteChunkIdentifier = response.data.id;
				var remoteChunkData = response.data.data;
				//logger.log 'info', ("Received remote chunk response:" + JSON.stringify(response.data.data));
				const verifyIdentifier = await ChunkManager.storeChunkContents(remoteChunkData);
				if(verifyIdentifier !== remoteChunkIdentifier) {
					//logger.log('info', "[+RES] (" + hash + "):(" + response.data.data + ")");
					throw Error('corrupted chunk received from remote host');
				}
				return remoteChunkData;
			} catch (error) {
				logger.error('Get chunk request failed: ' + error.stack);
			} finally {
                LocalHost.clearRequest(id);
			}
		}
		throw Error('Chunk not found remotely: ' + id).name = 'NOT_FOUND_ERROR';
	}

};
