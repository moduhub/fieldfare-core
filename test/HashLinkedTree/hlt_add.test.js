import {
    ResourcesManager,
    VolatileResourcesManager,
    HashLinkedTree,
    logger
} from 'fieldfare';

const numExistingElements = 1000;
const numNonExistingElements = 100;
const numRemovedElements = 100;

const gSalt = 'hlt';

logger.disable();

if(global.crypto === undefined) {
    global.crypto = require('crypto').webcrypto;
}

VolatileResourcesManager.init();

const tree = new HashLinkedTree(5);

//Build an array of elements to add
const createdElements = [];
const removedElements = [];
const existingElements = [];
const nonExistingElements = [];

for(var i=0; i<numExistingElements; i++) {

    const iElement = {
        index: i,
        salt: gSalt
    };

    createdElements.push(iElement);

    if(i<numRemovedElements) {
        removedElements.push(iElement);
    } else {
        existingElements.push(iElement);
    }
}

for(var i=0; i<numNonExistingElements; i++) {
    nonExistingElements.push({
        index: numExistingElements+i,
        salt: gSalt
    });
}

test('Store '+numExistingElements+' elements', async () => {
    for(const element of createdElements) {
        await tree.add(element);
    }
});

test('Remove '+numRemovedElements+' elements', async () => {
    for(const element of removedElements) {
        await tree.remove(element);
    }
});

test('Check existance of '+numExistingElements+' added elements', async () => {
    for(const element of existingElements) {
        const hasElement = await tree.has(element);
        expect(hasElement).toBe(true);
    }
});

test('Check non-existance of '+(numNonExistingElements)+' never added elements', async () => {
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
