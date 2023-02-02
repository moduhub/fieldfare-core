import {
    Resource,
    VolatileResourcesManager,
    NodeCryptoManager,
    ChunkSet,
    logger
} from 'fieldfare/node';

const numCreatedElements = 100;
const numNonExistingElements = Math.floor(numCreatedElements/5);
const numRemovedElements = Math.floor(numCreatedElements/5);
const numExistingElements = numCreatedElements-numRemovedElements;

const gSalt = 'hlt';

const set = new ChunkSet(5);

//Build an array of elements to add
const createdElements = [];
const removedElements = [];
const removedKeys = [];
const existingElements = [];
const existingKeys = [];
const nonExistingElements = [];
const nonExistingKeys = [];

beforeAll(async () => {

    logger.disable();
    NodeCryptoManager.init();
    VolatileResourcesManager.init();

    for (var i=0; i<numCreatedElements; i++) {
        const element = await Resource.fromObject({
            index: i,
            salt: gSalt
        });
        createdElements.push(element);
        if(i<numRemovedElements) {
            removedElements.push(element);
            removedKeys.push(element.key);
        } else {
            existingElements.push(element);
            existingKeys.push(element.key);
        }
    }

    for(var i=0; i<numNonExistingElements; i++) {
        const element = await Resource.fromObject({
            index: numCreatedElements+i,
            salt: gSalt
        });
        nonExistingElements.push(element);
        nonExistingKeys.push(element.key);
    }

    return;
});

test('Set stores '+numCreatedElements+' elements', async () => {
    expect(set.root).toBe(null);
    for(const element of createdElements) {
        //console.log('set.add('+JSON.stringify(element)+')');
        await set.add(element);
    }
    return;
});

test('Set removes '+numRemovedElements+' elements', async () => {
    for(const element of removedElements) {
        await set.delete(element);
    }
    return;
});

test('Set throws on attempt to remove elements that do not exist, root remains uchanged', async () => {
    const prevRoot = set.rootHash;
    for(const element of nonExistingElements) {
        await expect(set.delete(element))
        .rejects
        .toThrow();
    }
    expect(set.rootHash).toBe(prevRoot);
    return;
});

test('Set iterates set elements in order, without duplications or invalid elements', async () => {
    const iteratedKeys = [];
    var lastElementKey = '';
    for await(const element of set) {
        expect(iteratedKeys.includes(element.key)).toBe(false); //check for duplicated elements
        expect(element.key > lastElementKey).toBe(true); //check if elements are in order
        iteratedKeys.push(element.key);
        expect(existingKeys.includes(element.key)).toBe(true);
        expect(removedKeys.includes(element.key)).toBe(false);
        lastElementKey = element.key;
    }
    expect(iteratedKeys.length).toBe(numExistingElements);
    return;
});

test('Set confirms existance of '+numExistingElements+' elements', async () => {
    for(const element of existingElements) {
        const hasElement = await set.has(element);
        expect(hasElement).toBe(true);
    }
    return;
});

test('Set confirms non-existance of '+(numNonExistingElements)+' not-added elements', async () => {
    for(const element of nonExistingElements) {
        const hasElement = await set.has(element);
        expect(hasElement).toBe(false);
    }
    return;
});

test('Set confirms non-existance of '+(numRemovedElements)+' removed elements', async () => {
    for(const element of removedElements) {
        const hasElement = await set.has(element);
        expect(hasElement).toBe(false);
    }
    return;
});

test('Set removes all elements, root goes back to \'\'', async () => {
    var iteration = 0;
    for(const element of existingElements) {
        await expect(set.delete(element))
        .resolves
        .not.toThrow();
    }
    expect(set.root).toBe(null);
    return;
});
