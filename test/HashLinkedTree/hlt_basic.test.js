import {
    ResourcesManager,
    VolatileResourcesManager,
    HashLinkedTree,
    logger
} from 'fieldfare';

const numCreatedElements = 1000;
const numNonExistingElements = 100;
const numRemovedElements = 100;
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

});

test('Store '+numCreatedElements+' elements', async () => {
    for(const element of createdElements) {
        await tree.add(element);
    }
});

test('Remove '+numRemovedElements+' elements', async () => {
    for(const element of removedElements) {
        await tree.remove(element);
    }
});

test('Iterate tree elements', async () => {
    var numElements = 0;
    for await(const key of tree) {
        numElements++;
        console.log("key: " + key);
        expect(existingElements.includes(key)).toBe(true);
        expect(removedElements.includes(key)).toBe(false);
    }
    expect(numElements).toBe(numExistingElements);
});

test('Check existance of '+numExistingElements+' true elements', async () => {
    for(const element of existingElements) {
        const hasElement = await tree.has(element);
        expect(hasElement).toBe(true);
    }
});

test('Check non-existance of '+(numNonExistingElements)+' false elements', async () => {
    for(const element of nonExistingElements) {
        const hasElement = await tree.has(element);
        expect(hasElement).toBe(false);
    }
});

test('Check non-existance of '+(numNonExistingElements)+' removed elements', async () => {
    for(const element of removedElements) {
        const hasElement = await tree.has(element);
        expect(hasElement).toBe(false);
    }
});
