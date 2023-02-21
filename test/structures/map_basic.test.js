import {
    Chunk,
    VolatileChunkManager,
    TestCryptoManager,
    ChunkMap,
    logger
} from 'fieldfare/test';

const numCreatedElements = 100;
const numNonExistingKeys = Math.floor(numCreatedElements/5);
const numRemovedKeys = Math.floor(numCreatedElements/5);
const numUpdatedKeys = Math.floor(numCreatedElements/5);
const numExistingKeys = numCreatedElements-numRemovedKeys;

const chunkMap = new ChunkMap(5);

//Build an array of elements to add
const preUpdateJSMap = new Map;
const updatedJSMap = new Map;
const updatedKeyChunks = new Set;
const updatedKeys = new Set;
const removedKeyChunks = new Set;
const removedKeys = new Set;
const existingKeyChunks = new Set;
const existingKeys = new Set;
const nonExistingKeyChunks = new Set;
const nonExistingKeys = new Set;

jest.setTimeout(30000);

beforeAll(async () => {
    logger.disable();
    await TestCryptoManager.init();
    VolatileChunkManager.init();
    for(var i=0; i<numCreatedElements; i++) {
        const iKeyObject = {
            index: i,
            content: 'key'
        };
        const iValueObject = {
            index: i,
            content: 'value'
        };
        const keyChunk = await Chunk.fromObject(iKeyObject);
        const valueChunk = await Chunk.fromObject(iValueObject);
        preUpdateJSMap.set(keyChunk.id, valueChunk);
        updatedJSMap.set(keyChunk.id, valueChunk);
        if(i<numRemovedKeys) {
            removedKeyChunks.add(keyChunk);
            removedKeys.add(keyChunk.id);
        } else {
            existingKeyChunks.add(keyChunk);
            existingKeys.add(keyChunk.id)
            if(i<numRemovedKeys+numUpdatedKeys){
                updatedKeyChunks.add(keyChunk);
                updatedKeys.add(keyChunk.id);
                iValueObject.content += '_updated';
                const updatedValueChunk = await Chunk.fromObject(iValueObject);
                updatedJSMap.set(keyChunk.key, updatedValueChunk);
            }
        }
    }
    for(var i=0; i<numNonExistingKeys; i++) {
        const iKeyObject = {
            index: i,
            content: 'key'
        };
        const keyChunk = await Chunk.fromObject(iKeyObject);
        nonExistingKeyChunks.add(keyChunk);
        nonExistingKeys.add(keyChunk.id);
    }
    return;
});

// test('map.add([key, value]) and map.set(key, value) produce same result', async => {
//
// });

test('ChunkMap stores '+numCreatedElements+' key/value chunk pairs', async () => {
    //expect(chunkMap.root).toBe(null);
    await expect(chunkMap.isEmpty()).resolves.toBe(true);
    for(const [keyChunkIdentifier, valueChunk] of preUpdateJSMap) {
        // console.log('map.set('+JSON.stringify([key, value])+')');
        await chunkMap.set(await Chunk.fromIdentifier(keyChunkIdentifier), valueChunk);
        await expect(chunkMap.isEmpty()).resolves.toBe(false);
    }
    return;
});

test('ChunkMap removes '+numRemovedKeys+' key/value chunk pairs', async () => {
    for(const keyChunk of removedKeyChunks) {
        await chunkMap.delete(keyChunk);
    }
    return;
});

test('ChunkMap updates '+numUpdatedKeys+' value chunks', async () => {
    for (const keyChunk of updatedKeyChunks) {
        expect((await chunkMap.get(keyChunk)).id).toBe(preUpdateJSMap.get(keyChunk.id).id);
        await chunkMap.set(keyChunk, updatedJSMap.get(keyChunk.id));
        expect((await chunkMap.get(keyChunk)).id).toBe(updatedJSMap.get(keyChunk.id).id);
    }
    return;
});

test('ChunkMap throws on attempt to remove keys that do not exist, root remains unchanged', async () => {
    const prevRoot = chunkMap.rootChunk;
    for(const keyChunk of nonExistingKeyChunks) {
        await expect(chunkMap.delete(keyChunk))
        .rejects
        .toThrow();
    }
    expect(chunkMap.rootChunk.id).toBe(prevRoot.id);
    return;
});

test('ChunkMap iterates map elements in order, without duplications or invalid elements', async () => {
    const iteratedKeyIdentifiers = [];
    var lastKeyIdentifier = '';
    for await(const [keyChunk, valueChunk] of chunkMap) {
        expect(iteratedKeyIdentifiers.includes(keyChunk.id)).toBe(false); //check for duplicated keys
        expect(keyChunk.id > lastKeyIdentifier).toBe(true); //check if keys are in order
        iteratedKeyIdentifiers.push(keyChunk.id);
        // console.log('map iteration '+iteratedKeyIdentifiers.length+': ('+JSON.stringify([key, value])+')');
        expect(valueChunk.id).toBe(updatedJSMap.get(keyChunk.id).id); //every key maps to correct value
        expect(existingKeys.has(keyChunk.id)).toBe(true);
        expect(removedKeys.has(keyChunk.id)).toBe(false);
        lastKeyIdentifier = keyChunk.id;
    }
    expect(iteratedKeyIdentifiers.length).toBe(numExistingKeys);
    return;
});

test('ChunkMap matches value assigned to '+numExistingKeys+' keys', async () => {
    for(const keyChunk of existingKeyChunks) {
        const hasKey = await chunkMap.has(keyChunk);
        expect(hasKey).toBe(true);
        const valueResource = await chunkMap.get(keyChunk);
        expect(valueResource.id).toBe(updatedJSMap.get(keyChunk.id).id);
    }
    return;
});

test('ChunkMap confirms non-existance of '+(numNonExistingKeys)+' not-added keys', async () => {
    for(const keyChunk of nonExistingKeyChunks) {
        const hasElement = await chunkMap.has(keyChunk);
        expect(hasElement).toBe(false);
    }
    return;
});

test('ChunkMap confirms non-existance of '+(numRemovedKeys)+' removed elements', async () => {
    for(const keyChunk of removedKeyChunks) {
        const hasElement = await chunkMap.has(keyChunk);
        expect(hasElement).toBe(false);
    }
    return;
});

test('ChunkMap removes all elements, root goes back to \'\'', async () => {
    var iteration = 0;
    for(const keyChunks of existingKeyChunks) {
        await expect(chunkMap.delete(keyChunks))
        .resolves
        .not.toThrow();
    }
    expect(chunkMap.rootChunk.id).toBe(undefined);
    await expect(chunkMap.isEmpty()).resolves.toBe(true);
    return;
});
