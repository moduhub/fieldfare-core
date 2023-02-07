
import { ChunkManager } from './ChunkManager';
import { ChunkingUtils } from './ChunkingUtils';
import { logger } from '../basic/Log';


export class VolatileChunkManager extends ChunkManager {

    constructor(enableReport=false) {
        super();
        this.hashmap = new Map;
        if(enableReport) {
            setInterval(() => {
                logger.log('info', "Volatile Chunk Manager: " + this.hashmap.size + " chunks stored.");
            }, 30000);
        }
    }

    static init() {
        const newInstance = new VolatileChunkManager;
        ChunkManager.addInstance(newInstance);
    }

    async storeChunkContents(base64data) {
        const id = await ChunkingUtils.generateIdentifierForData(base64data);
		this.hashmap.set(id, base64data);
		return id;
	}

	getChunkContents(id) {
		var base64data = this.hashmap.get(id);
        if(base64data === undefined) {
            const error = Error('Chunk not found');
            error.name = 'NOT_FOUND_ERROR';
            throw error;
        }
		return base64data;
	}

};
