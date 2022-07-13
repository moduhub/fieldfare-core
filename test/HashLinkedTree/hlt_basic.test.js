import {
    ResourcesManager,
    VolatileResourcesManager,
    HashLinkedTree,
    logger
} from 'fieldfare';

const numCreatedElements = 100;
const numNonExistingElements = Math.floor(numCreatedElements/5);
const numRemovedElements = 2;//Math.floor(numCreatedElements/5);
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

test('Store '+numCreatedElements+' elements', async () => {
    for(const element of createdElements) {
        // console.log('Tree.add('+element+')');
        await tree.add(element);
    }
    return;
});

test('Remove '+numRemovedElements+' elements', async () => {
    for(const element of removedElements) {
        await tree.remove(element);
    }
    return;
});

test('Attempt to remove elements that do not exist', async () => {
    const prevRoot = tree.rootHash;
    for(const element of nonExistingElements) {
        await expect(tree.remove(element))
        .rejects
        .toThrow();
    }
    expect(tree.rootHash).toBe(prevRoot);
    return;
});

test('Iterate tree elements', async () => {
    const iteratedKeys = [];
    var lastKey = '';
    for await(const key of tree) {
        expect(iteratedKeys.includes(key)).toBe(false); //check for duplicated elements
        expect(key > lastKey).toBe(true); //check if elements are in order
        iteratedKeys.push(key);
        // console.log('[iteration '+iteratedKeys.length+'] key: ' + key
        //      + ' exists at buffer index ' + existingElements.indexOf(key));
        expect(existingElements.includes(key)).toBe(true);
        expect(removedElements.includes(key)).toBe(false);
        lastKey = key;
    }
    // console.log('tree iteration returned ' + iteratedKeys.length + ' elements');
    expect(iteratedKeys.length).toBe(numExistingElements);
    return;
});

test('Check existance of '+numExistingElements+' true elements', async () => {
    // console.log('Check existance of '+numExistingElements+' true elements');
    var iteration=0;
    for(const element of existingElements) {
        // console.log('[iteration '+iteration++ +'] Tree.has('+element+')');
        const hasElement = await tree.has(element);
        expect(hasElement).toBe(true);
    }
    return;
});

test('Check non-existance of '+(numNonExistingElements)+' false elements', async () => {
    console.log('Check non-existance of '+(numNonExistingElements)+' false elements');
    for(const element of nonExistingElements) {
        const hasElement = await tree.has(element);
        expect(hasElement).toBe(false);
    }
    return;
});

test('Check non-existance of '+(numRemovedElements)+' removed elements', async () => {
    console.log('Check non-existance of '+(numRemovedElements)+' removed elements');
    for(const element of removedElements) {
        const hasElement = await tree.has(element);
        expect(hasElement).toBe(false);
    }
    return;
});
