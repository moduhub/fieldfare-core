import {
    Chunk,
    VolatileChunkManager,
    TestCryptoManager,
    ChunkSet,
    logger
} from 'fieldfare/test';

const numCreatedChunks = 100;
const numNonExistingChunks = Math.floor(numCreatedChunks/5);
const numRemovedChunks = Math.floor(numCreatedChunks/5);
const numExistingChunks = numCreatedChunks-numRemovedChunks;

const gSalt = 'hlt';

const chunkSet = new ChunkSet(5);

//Build an array of elements to add
const createdChunks = [];
const removedChunks = [];
const removedChunkIdentifiers = [];
const existingChunks = [];
const existingChunkIdentifiers = [];
const nonExistingChunks = [];
const nonExistingChunkIdentifiers = [];

beforeAll(async () => {

    logger.disable();
    TestCryptoManager.init();
    VolatileChunkManager.init();

    for (var i=0; i<numCreatedChunks; i++) {
        const chunk = await Chunk.fromObject({
            index: i,
            salt: gSalt
        });
        createdChunks.push(chunk);
        if(i<numRemovedChunks) {
            removedChunks.push(chunk);
            removedChunkIdentifiers.push(chunk.id);
        } else {
            existingChunks.push(chunk);
            existingChunkIdentifiers.push(chunk.id);
        }
    }

    for(var i=0; i<numNonExistingChunks; i++) {
        const chunk = await Chunk.fromObject({
            index: numCreatedChunks+i,
            salt: gSalt
        });
        nonExistingChunks.push(chunk);
        nonExistingChunkIdentifiers.push(chunk.id);
    }

    return;
});

test('ChunkSet stores '+numCreatedChunks+' chunks', async () => {
    //expect(chunkSet.rootChunk).toBe(null);
    await expect(chunkSet.isEmpty()).resolves.toBe(true);
    for(const chunk of createdChunks) {
        //console.log('chunkSet.add('+JSON.stringify(chunk)+')');
        await chunkSet.add(chunk);
        await expect(chunkSet.isEmpty()).resolves.toBe(false);
    }
    return;
});

test('ChunkSet removes '+numRemovedChunks+' chunks', async () => {
    for(const chunk of removedChunks) {
        await chunkSet.delete(chunk);
    }
    return;
});

test('ChunkSet throws on attempt to remove chunks that do not exist, root remains uchanged', async () => {
    const prevRoot = chunkSet.rootHash;
    for(const chunk of nonExistingChunks) {
        await expect(chunkSet.delete(chunk))
        .rejects
        .toThrow();
    }
    expect(chunkSet.rootHash).toBe(prevRoot);
    return;
});

test('ChunkSet iterates set elements in order, without duplications or invalid elements', async () => {
    const iteratedChunkIdentifiers = [];
    var lastChunkIdentifier = '';
    for await(const chunk of chunkSet) {
        expect(iteratedChunkIdentifiers.includes(chunk.id)).toBe(false); //check for duplicated chunks
        expect(chunk.id > lastChunkIdentifier).toBe(true); //check if chunks are in order
        iteratedChunkIdentifiers.push(chunk.id);
        expect(existingChunkIdentifiers.includes(chunk.id)).toBe(true);
        expect(removedChunkIdentifiers.includes(chunk.id)).toBe(false);
        lastChunkIdentifier = chunk.id;
    }
    expect(iteratedChunkIdentifiers.length).toBe(numExistingChunks);
    return;
});

test('ChunkSet confirms existance of '+numExistingChunks+' elements', async () => {
    for(const chunk of existingChunks) {
        await expect(chunkSet.has(chunk)).resolves.toBe(true);
    }
    return;
});

test('ChunkSet confirms non-existance of '+(numNonExistingChunks)+' not-added elements', async () => {
    for(const chunk of nonExistingChunks) {
        await expect(chunkSet.has(chunk)).resolves.toBe(false);
    }
    return;
});

test('ChunkSet confirms non-existance of '+(numRemovedChunks)+' removed elements', async () => {
    for(const element of removedChunks) {
        await expect(chunkSet.has(element)).resolves.toBe(false);
    }
    return;
});

test('ChunkSet removes all elements, root goes back to \'\'', async () => {
    for(const chunk of existingChunks) {
        await expect(chunkSet.delete(chunk))
        .resolves
        .not.toThrow();
    }
    expect(chunkSet.rootChunk.id).toBe(undefined);
    return;
});
