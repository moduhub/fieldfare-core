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

const tree = new HashLinkedTree(5);

//Build an array of elements to add
const createdElements = [];
const removedElements = [];
const existingElements = [];
const nonExistingElements = [];

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
        createdElements.push(key);
        if(i<numRemovedElements) {
            removedElements.push(key);
        } else {
            existingElements.push(key);
        }
    }

    for(var i=0; i<numNonExistingElements; i++) {
        const iElement = {
            index: createdElements+i,
            salt: gSalt
        };
        const key = await ResourcesManager.storeResourceObject(iElement);
        nonExistingElements.push(key);
    }

    return;
});

test('Stores '+numCreatedElements+' elements', async () => {
    for(const element of createdElements) {
        // console.log('Tree.add('+element+')');
        await tree.add(element);
    }
    return;
});

test('Removes '+numRemovedElements+' elements', async () => {
    for(const element of removedElements) {
        await tree.remove(element);
    }
    return;
});

test('Throws on attempt to remove elements that do not exist, root remains uchanged', async () => {
    const prevRoot = tree.rootHash;
    for(const element of nonExistingElements) {
        await expect(tree.remove(element))
        .rejects
        .toThrow();
    }
    expect(tree.rootHash).toBe(prevRoot);
    return;
});

test('Iterates tree elements in order, without duplications or invalid elements', async () => {
    const iteratedKeys = [];
    var lastKey = '';
    for await(const key of tree) {
        expect(iteratedKeys.includes(key)).toBe(false); //check for duplicated elements
        expect(key > lastKey).toBe(true); //check if elements are in order
        iteratedKeys.push(key);
        expect(existingElements.includes(key)).toBe(true);
        expect(removedElements.includes(key)).toBe(false);
        lastKey = key;
    }
    expect(iteratedKeys.length).toBe(numExistingElements);
    return;
});

test('Confirms existance of '+numExistingElements+' elements', async () => {
    for(const element of existingElements) {
        const hasElement = await tree.has(element);
        expect(hasElement).toBe(true);
    }
    return;
});

test('Confirms non-existance of '+(numNonExistingElements)+' not-added elements', async () => {
    for(const element of nonExistingElements) {
        const hasElement = await tree.has(element);
        expect(hasElement).toBe(false);
    }
    return;
});

test('Confirms non-existance of '+(numRemovedElements)+' removed elements', async () => {
    for(const element of removedElements) {
        const hasElement = await tree.has(element);
        expect(hasElement).toBe(false);
    }
    return;
});

test('Removes all elements, root goes back to \'\'', async () => {
    var iteration = 0;
    for(const element of existingElements) {
        await expect(tree.remove(element))
        .resolves
        .not.toThrow();
    }
    expect(tree.rootHash).toBe('');
    return;
});
