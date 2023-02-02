import {
    Resource,
    VolatileResourcesManager,
    NodeCryptoManager,
    ChunkMap,
    logger
} from 'fieldfare/node';

const numCreatedElements = 100;
const numNonExistingKeys = Math.floor(numCreatedElements/5);
const numRemovedKeys = Math.floor(numCreatedElements/5);
const numUpdatedKeys = Math.floor(numCreatedElements/5);
const numExistingKeys = numCreatedElements-numRemovedKeys;

const gKeyDescriptor = 'key';
const gValueDescriptor = 'value';

const map = new ChunkMap(5);

//Build an array of elements to add
const preUpdateMap = new Map;
const updatedMap = new Map;
const updatedKeyResources = new Set;
const updatedKeys = new Set;
const removedKeyResources = new Set;
const removedKeys = new Set;
const existingKeyResources = new Set;
const existingKeys = new Set;
const nonExistingKeyResources = new Set;
const nonExistingKeys = new Set;

jest.setTimeout(30000);

beforeAll(async () => {
    logger.disable();
    NodeCryptoManager.init();
    VolatileResourcesManager.init();
    for(var i=0; i<numCreatedElements; i++) {
        const iKeyObject = {
            index: i,
            descriptor: 'key'
        };
        const iValueObject = {
            index: i,
            descriptor: 'value'
        };
        const keyResource = await Resource.fromObject(iKeyObject);
        const valueResource = await Resource.fromObject(iValueObject);
        preUpdateMap.set(keyResource.key, valueResource);
        updatedMap.set(keyResource.key, valueResource);
        if(i<numRemovedKeys) {
            removedKeyResources.add(keyResource);
            removedKeys.add(keyResource.key);
        } else {
            existingKeyResources.add(keyResource);
            existingKeys.add(keyResource.key)
            if(i<numRemovedKeys+numUpdatedKeys){
                updatedKeyResources.add(keyResource);
                updatedKeys.add(keyResource.key);
                iValueObject.descriptor += '_updated';
                const updatedValueResource = await Resource.fromObject(iValueObject);
                updatedMap.set(keyResource.key, updatedValueResource);
            }
        }
    }
    for(var i=0; i<numNonExistingKeys; i++) {
        const iKeyObject = {
            index: i,
            descriptor: 'key'
        };
        const keyResource = await Resource.fromObject(iKeyObject);
        nonExistingKeyResources.add(keyResource);
        nonExistingKeys.add(keyResource.key);
    }
    return;
});

// test('map.add([key, value]) and map.set(key, value) produce same result', async => {
//
// });

test('Map stores '+numCreatedElements+' elements', async () => {
    expect(map.root).toBe(null);
    await expect(map.isEmpty()).resolves.toBe(true);
    for(const [key, value] of preUpdateMap) {
        // console.log('map.set('+JSON.stringify([key, value])+')');
        await map.set(await Resource.fromKey(key), value);
    }
    await expect(map.isEmpty()).resolves.toBe(false);
    return;
});

test('Map removes '+numRemovedKeys+' keys', async () => {
    for(const keyResource of removedKeyResources) {
        await map.delete(keyResource);
    }
    return;
});

test('Map updates '+numUpdatedKeys+' keys', async () => {
    for (const keyResource of updatedKeyResources) {
        expect((await map.get(keyResource)).key).toBe(preUpdateMap.get(keyResource.key).key);
        await map.set(keyResource, updatedMap.get(keyResource.key));
        expect((await map.get(keyResource)).key).toBe(updatedMap.get(keyResource.key).key);
    }
    return;
});

test('Map throws on attempt to remove keys that do not exist, root remains unchanged', async () => {
    const prevRoot = map.root;
    for(const key of nonExistingKeyResources) {
        await expect(map.delete(key))
        .rejects
        .toThrow();
    }
    expect(map.root.key).toBe(prevRoot.key);
    return;
});

test('Map iterates map elements in order, without duplications or invalid elements', async () => {
    const iteratedKeys = [];
    var lastKey = '';
    for await(const [keyResource, valueResource] of map) {
        expect(iteratedKeys.includes(keyResource.key)).toBe(false); //check for duplicated keys
        expect(keyResource.key > lastKey).toBe(true); //check if keys are in order
        iteratedKeys.push(keyResource.key);
        // console.log('map iteration '+iteratedKeys.length+': ('+JSON.stringify([key, value])+')');
        expect(valueResource.key).toBe(updatedMap.get(keyResource.key).key); //every key maps to correct value
        expect(existingKeys.has(keyResource.key)).toBe(true);
        expect(removedKeys.has(keyResource.key)).toBe(false);
        lastKey = keyResource.key;
    }
    expect(iteratedKeys.length).toBe(numExistingKeys);
    return;
});

test('Map matches value assigned to '+numExistingKeys+' keys', async () => {
    for(const keyResource of existingKeyResources) {
        const hasKey = await map.has(keyResource);
        expect(hasKey).toBe(true);
        const valueResource = await map.get(keyResource);
        expect(valueResource.key).toBe(updatedMap.get(keyResource.key).key);
    }
    return;
});

test('Map confirms non-existance of '+(numNonExistingKeys)+' not-added keys', async () => {
    for(const keyResource of nonExistingKeyResources) {
        const hasElement = await map.has(keyResource);
        expect(hasElement).toBe(false);
    }
    return;
});

test('Map confirms non-existance of '+(numRemovedKeys)+' removed elements', async () => {
    for(const keyResource of removedKeyResources) {
        const hasElement = await map.has(keyResource);
        expect(hasElement).toBe(false);
    }
    return;
});

test('Map removes all elements, root goes back to \'\'', async () => {
    var iteration = 0;
    for(const keyResource of existingKeyResources) {
        await expect(map.delete(keyResource))
        .resolves
        .not.toThrow();
    }
    expect(map.root).toBe(null);
    await expect(map.isEmpty()).resolves.toBe(true);
    return;
});
