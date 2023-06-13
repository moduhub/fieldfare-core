import {
    Chunk,
    VolatileChunkManager,
    ChunkList,
    logger
} from '../../src';
import { TestCryptoManager } from '../mockSetup';

import {jest} from '@jest/globals';

const numCreatedChunks = 100;

const createdChunks = [];

const chunkList = new ChunkList(5);

jest.setTimeout(30000);

beforeAll(async () => {
    logger.disable();
    await TestCryptoManager.init();
    VolatileChunkManager.init();
    for (var i=0; i<numCreatedChunks; i++) {
        const chunk = await Chunk.fromObject({
            index: i,
            salt: 'akftw'
        });
        createdChunks.push(chunk);
    }
    return;
});

test('ChunkList stores '+numCreatedChunks+' chunks', async () => {
    await expect(chunkList.getNumElements()).resolves.toBe(0);
    var currentNumElements=0;
    for(const chunk of createdChunks) {
        await chunkList.push(chunk);
        currentNumElements++;
        await expect(chunkList.getNumElements()).resolves.toBe(currentNumElements);
    }
    return;
});

test('ChunkList iterates chunks in reverse order', async () => {
    var index = createdChunks.length-1;
    for await(const chunk of chunkList.chunks()) {
        const expectedChunkIdentifier = createdChunks[index].id;
        expect(chunk.id).toBe(expectedChunkIdentifier)
        index--;
    }
    return;
});