import {
    ResourcesManager,
    VolatileResourcesManager,
    HashLinkedTree,
    logger
} from 'fieldfare';

const numCreatedElements = 100;
const numNonExistingElements = Math.floor(numCreatedElements/5);
const numRemovedElements = Math.floor(numCreatedElements/5);
const numExistingElements = numCreatedElements-numRemovedElements;

const gSalt = 'hlt';

const set = new HashLinkedTree(5, null, false);

//Build an array of elements to add
const createdKeys = [];
const removedKeys = [];
const existingKeys = [];
const nonExistingKeys = [];

beforeAll(async () => {

    logger.disable();

    if(global.crypto === undefined) {
        global.crypto = require('crypto').webcrypto;
    }

    VolatileResourcesManager.init();

    for(var i=0; i<numCreatedElements; i++) {
        const iElement = {
            index: i,
            salt: gSalt
        };
        const key = await ResourcesManager.storeResourceObject(iElement);
        createdKeys.push(key);
        if(i<numRemovedElements) {
            removedKeys.push(key);
        } else {
            existingKeys.push(key);
        }
    }

    for(var i=0; i<numNonExistingElements; i++) {
        const iElement = {
            index: createdKeys+i,
            salt: gSalt
        };
        const key = await ResourcesManager.storeResourceObject(iElement);
        nonExistingKeys.push(key);
    }

    return;
});

test('Stores '+numCreatedElements+' elements', async () => {
    expect(set.rootHash).toBe(null);
    for(const key of createdKeys) {
        // console.log('set.add('+key+')');
        await set.add(key);
    }
    return;
});

test('Removes '+numRemovedElements+' elements', async () => {
    for(const key of removedKeys) {
        await set.delete(key);
    }
    return;
});

test('Throws on attempt to remove elements that do not exist, root remains uchanged', async () => {
    const prevRoot = set.rootHash;
    for(const key of nonExistingKeys) {
        await expect(set.delete(key))
        .rejects
        .toThrow();
    }
    expect(set.rootHash).toBe(prevRoot);
    return;
});

test('Iterates set elements in order, without duplications or invalid elements', async () => {
    const iteratedKeys = [];
    var lastKey = '';
    for await(const key of set) {
        expect(iteratedKeys.includes(key)).toBe(false); //check for duplicated elements
        expect(key > lastKey).toBe(true); //check if elements are in order
        iteratedKeys.push(key);
        expect(existingKeys.includes(key)).toBe(true);
        expect(removedKeys.includes(key)).toBe(false);
        lastKey = key;
    }
    expect(iteratedKeys.length).toBe(numExistingElements);
    return;
});

test('Confirms existance of '+numExistingElements+' elements', async () => {
    for(const key of existingKeys) {
        const hasElement = await set.has(key);
        expect(hasElement).toBe(true);
    }
    return;
});

test('Confirms non-existance of '+(numNonExistingElements)+' not-added elements', async () => {
    for(const key of nonExistingKeys) {
        const hasElement = await set.has(key);
        expect(hasElement).toBe(false);
    }
    return;
});

test('Confirms non-existance of '+(numRemovedElements)+' removed elements', async () => {
    for(const key of removedKeys) {
        const hasElement = await set.has(key);
        expect(hasElement).toBe(false);
    }
    return;
});

test('Removes all elements, root goes back to \'\'', async () => {
    var iteration = 0;
    for(const key of existingKeys) {
        await expect(set.delete(key))
        .resolves
        .not.toThrow();
    }
    expect(set.rootHash).toBe(null);
    return;
});
