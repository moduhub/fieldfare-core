/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import { ChunkManager } from './ChunkManager.js';
import { ChunkingUtils } from './ChunkingUtils.js';
import { logger } from '../basic/Log.js';

export class VolatileChunkManager extends ChunkManager {

    constructor(enableReport=false) {
        super();
        this.completeQualifiedChunks = new Map;
        this.incompleteChunks = new Map;
        if(enableReport) {
            setInterval(() => {
                const numChunks = this.completeQualifiedChunks.size + this.incompleteChunks.size;
                logger.log('info', "Volatile Chunk Manager: " + numChunks + " chunks stored.");
            }, 30000);
        }
    }

    static init() {
        const newInstance = new VolatileChunkManager;
        ChunkManager.addInstance(newInstance);
    }

    async storeChunkContents(base64data) {
        let complete = true;
        let depth = 0;
        let size = base64data.length;
        if(size > 1024) {
            throw Error('Chunk size limit exceeded');
        }
        const childrenIdentifiers = await ChunkingUtils.getChildrenIdentifiers(base64data);
        for(const childIdentifier of childrenIdentifiers) {
            const childChunk = this.completeQualifiedChunks.get(childIdentifier);
            if(!childChunk) {
                complete = false;
                break;
            }
            size += childChunk.size;
            depth = Math.max(depth, childChunk.depth+1);
        }
        const identifier = await ChunkingUtils.generateIdentifierForData(base64data);
        if(complete) {
            this.completeQualifiedChunks.set(identifier, {base64data, depth, size});
        } else {
            this.incompleteChunks.set(identifier, base64data);
            depth = undefined;
            size = undefined;
        }
        return {identifier, base64data, complete, depth, size};
    }

    getChunkContents(identifier) {
        const completeChunk = this.completeQualifiedChunks.get(identifier);
		if(completeChunk) {
            return {
                base64data: completeChunk.base64data,
                complete: true,
                depth: completeChunk.depth,
                size: completeChunk.size
            };
        }
        const base64data = this.incompleteChunks.get(identifier);
        if(!base64data) {
            const error = Error('Chunk not found');
            error.name = 'NOT_FOUND_ERROR';
            throw error;
        }
		return {base64data, complete:false};
	}

};