import {
    ResourcesManager,
    VolatileResourcesManager,
    HashLinkedTree,
    logger
} from 'fieldfare';

const numCreatedElements = 100;
const numNonExistingKeys = Math.floor(numCreatedElements/5);
const numRemovedKeys = Math.floor(numCreatedElements/5);
const numExistingKeys = numCreatedElements-numRemovedKeys;

const gKeyDescriptor = 'key';
const gValueDescriptor = 'value';

const map = new HashLinkedTree(5, null, true);

//Build an array of elements to add
const createdElements = new Map;
const removedKeys = new Set;
const existingKeys = new Set;
const nonExistingKeys = new Set;

beforeAll(async () => {
    logger.disable();
    if(global.crypto === undefined) {
        global.crypto = require('crypto').webcrypto;
    }
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
        const key = await ResourcesManager.storeResourceObject(iKeyObject);
        const value = await ResourcesManager.storeResourceObject(iValueObject);
        createdElements.set(key, value);
        if(i<numRemovedKeys) {
            removedKeys.add(key);
        } else {
            existingKeys.add(key);
        }
    }
    for(var i=0; i<numNonExistingKeys; i++) {
        const iKeyObject = {
            index: i,
            descriptor: 'key'
        };
        const key = await ResourcesManager.storeResourceObject(iKeyObject);
        nonExistingKeys.add(key);
    }
    return;
});

// test('map.add([key, value]) and map.set(key, value) produce same result', async => {
//     //todo
// });

test('Stores '+numCreatedElements+' elements', async () => {
    expect(map.rootHash).toBe(null);
    //await expect(map.isEmpty()).resolves.toBe(true);
    for(const element of createdElements) {
        console.log('Tree.add('+JSON.stringify(element)+')');
        await map.add(element);
    }
    //await expect(map.isEmpty()).resolves.toBe(false);
    return;
});

test('Removes '+numRemovedKeys+' keys', async () => {
    for(const key of removedKeys) {
        await map.delete(key);
    }
    return;
});

test('Throws on attempt to remove keys that do not exist, root remains unchanged', async () => {
    const prevRoot = map.rootHash;
    for(const key of nonExistingKeys) {
        await expect(map.delete(key))
        .rejects
        .toThrow();
    }
    expect(map.rootHash).toBe(prevRoot);
    return;
});

test('Iterates map elements in order, without duplications or invalid elements', async () => {
    const iteratedKeys = [];
    var lastKey = '';
    for await(const [key, value] of map) {
        expect(iteratedKeys.includes(key)).toBe(false); //check for duplicated keys
        expect(key > lastKey).toBe(true); //check if keys are in order
        iteratedKeys.push(key);
        expect(value).toBe(createdElements.get(key)); //every key maps to correct value
        expect(existingElements.includes(key)).toBe(true);
        expect(removedElements.includes(key)).toBe(false);
        lastKey = key;
    }
    expect(iteratedKeys.length).toBe(numExistingKeys);
    return;
});

test('Matches mapping of '+numExistingKeys+' keys', async () => {
    for(const key of existingKeys) {
        const hasKey = await map.has(key);
        expect(hasKey).toBe(true);
        const value = await map.get(key);
        expect(value).toBe(createdElements.get(key));
    }
    return;
});

test('Confirms non-existance of '+(numNonExistingKeys)+' not-added keys', async () => {
    for(const key of nonExistingKeys) {
        const hasElement = await map.has(key);
        expect(hasElement).toBe(false);
    }
    return;
});

test('Confirms non-existance of '+(numRemovedKeys)+' removed elements', async () => {
    for(const key of removedKeys) {
        const hasElement = await map.has(key);
        expect(hasElement).toBe(false);
    }
    return;
});

test('Removes all elements, root goes back to \'\'', async () => {
    var iteration = 0;
    for(const key of existingKeys) {
        await expect(map.delete(key))
        .resolves
        .not.toThrow();
    }
    expect(map.rootHash).toBe(null);
    await expect(map.isEmpty()).resolves.toBe(true);
    return;
});
