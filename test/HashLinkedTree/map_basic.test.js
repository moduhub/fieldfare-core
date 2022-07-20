import {
    ResourcesManager,
    VolatileResourcesManager,
    HashLinkedTree,
    logger
} from 'fieldfare';

const numCreatedElements = 100;
const numNonExistingKeys = Math.floor(numCreatedElements/5);
const numRemovedKeys = Math.floor(numCreatedElements/5);
const numUpdatedKeys = Math.floor(numCreatedElements/5);
const numExistingKeys = numCreatedElements-numRemovedKeys;

const gKeyDescriptor = 'key';
const gValueDescriptor = 'value';

const map = new HashLinkedTree(5, null, true);

//Build an array of elements to add
const preUpdateMap = new Map;
const updatedMap = new Map;
const updatedKeys = new Set;
const removedKeys = new Set;
const existingKeys = new Set;
const nonExistingKeys = new Set;

jest.setTimeout(30000);

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
        preUpdateMap.set(key, value);
        updatedMap.set(key, value);
        if(i<numRemovedKeys) {
            removedKeys.add(key);
        } else {
            existingKeys.add(key);
            if(i<numRemovedKeys+numUpdatedKeys){
                updatedKeys.add(key);
                iValueObject.descriptor += '_updated';
                const updatedValue = await ResourcesManager.storeResourceObject(iValueObject);
                updatedMap.set(key, updatedValue);
                // console.log('key: ' + key +', pre-update value: ' + value + ', post-update value:' + updatedValue);
                existingKeys.add(key);
            }
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
//
// });

test('Stores '+numCreatedElements+' elements', async () => {
    expect(map.rootHash).toBe(null);
    await expect(map.isEmpty()).resolves.toBe(true);
    for(const [key, value] of preUpdateMap) {
        // console.log('map.set('+JSON.stringify([key, value])+')');
        await map.set(key, value);
    }
    await expect(map.isEmpty()).resolves.toBe(false);
    return;
});

test('Removes '+numRemovedKeys+' keys', async () => {
    for(const key of removedKeys) {
        await map.delete(key);
    }
    return;
});

test('Updates '+numUpdatedKeys+' keys', async () => {
    for (const key of updatedKeys) {
        // console.log('map.get( '+key+') pre update: ' + await );
        await expect(map.get(key)).resolves.toBe(preUpdateMap.get(key));
        await map.set(key, updatedMap.get(key));
        // console.log('map.get( '+key+') post update: ' + await map.get(key));
        await expect(map.get(key)).resolves.toBe(updatedMap.get(key));
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
        // console.log('map iteration '+iteratedKeys.length+': ('+JSON.stringify([key, value])+')');
        expect(value).toBe(updatedMap.get(key)); //every key maps to correct value
        expect(existingKeys.has(key)).toBe(true);
        expect(removedKeys.has(key)).toBe(false);
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
        expect(value).toBe(updatedMap.get(key));
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
