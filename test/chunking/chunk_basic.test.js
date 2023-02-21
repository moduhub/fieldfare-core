import {
    Chunk,
    ChunkingUtils,
    VolatileChunkManager,
    NodeCryptoManager,
    logger
} from 'fieldfare/node';
import { Utils } from '../../src/basic/Utils';

var gTestPersonChunk;

beforeAll(async () => {

    logger.disable();
    await NodeCryptoManager.init();
    VolatileChunkManager.init();

    //Create Chunk tree
    gTestPersonChunk = await Chunk.fromObject({
        name: 'John Doe',
        age: 34,
        car: await Chunk.fromObject({
            manufacturer: await Chunk.fromObject({
                name: 'Ford',
                location: await Chunk.fromObject({
                    lat: 42.314936,
                    lng: -83.209773
                })
            }),
            model: 'F-250',
            year: 1999
        }),
        employer: await Chunk.fromObject({
            name: 'Ford',
            location: await Chunk.fromObject({
                lat: 42.314936,
                lng: -83.209773
            })
        })
    });

    return;
});

test('Chunk expands correctly to level 0 (keep identifiers)', async () => {
    const expandedChunk = await gTestPersonChunk.expand(0);
    // console.log('expandedChunk expanded to level0');
    // console.log(expandedChunk);
    Utils.validateParameters(expandedChunk, ['name', 'age', 'car', 'employer']);
    expect(expandedChunk.name).toBe('John Doe');
    expect(expandedChunk.age).toBe(34);
    expect(ChunkingUtils.isValidIdentifier(expandedChunk.car)).toBe(true);
    expect(ChunkingUtils.isValidIdentifier(expandedChunk.employer)).toBe(true);
    return;
});

test('Chunk expands correctly to level 1', async () => {
    const expandedChunk = await gTestPersonChunk.expand(1);
    // console.log('expandedChunk expanded to level1');
    // console.log(expandedChunk);
    Utils.validateParameters(expandedChunk, ['name', 'age', 'car', 'employer']);
    expect(expandedChunk.name).toBe('John Doe');
    expect(expandedChunk.age).toBe(34);
    expect(expandedChunk.car instanceof Chunk).toBe(true);
    expect(expandedChunk.employer instanceof Chunk).toBe(true);
    return;
});

test('Chunk expands correctly to level 2', async () => {
    const expandedChunk = await gTestPersonChunk.expand(2);
    // console.log('expandedChunk expanded to level2');
    // console.log(expandedChunk);
    Utils.validateParameters(expandedChunk, ['name', 'age', 'car', 'employer']);
    expect(expandedChunk.name).toBe('John Doe');
    expect(expandedChunk.age).toBe(34);
    Utils.validateParameters(expandedChunk.car, ['manufacturer', 'model', 'year']);
    expect(expandedChunk.car.manufacturer instanceof Chunk).toBe(true);
    expect(expandedChunk.car.model).toBe('F-250');
    expect(expandedChunk.car.year).toBe(1999);
    Utils.validateParameters(expandedChunk.employer, ['name', 'location']);
    expect(expandedChunk.employer.name).toBe('Ford');
    expect(expandedChunk.employer.location instanceof Chunk).toBe(true);
    return;
});

test('Chunk expands correctly to level 3', async () => {
    const expandedChunk = await gTestPersonChunk.expand(3);
    // console.log('expandedChunk expanded to level3');
    // console.log(expandedChunk);
    expect(expandedChunk.name).toBe('John Doe');
    expect(expandedChunk.age).toBe(34);
    Utils.validateParameters(expandedChunk.car, ['manufacturer', 'model', 'year']);
    Utils.validateParameters(expandedChunk.car.manufacturer, ['name', 'location']);
    expect(expandedChunk.car.manufacturer.name).toBe('Ford');
    expect(expandedChunk.car.manufacturer.location instanceof Chunk).toBe(true);
    expect(expandedChunk.car.model).toBe('F-250');
    expect(expandedChunk.car.year).toBe(1999);
    Utils.validateParameters(expandedChunk.employer, ['name', 'location']);
    Utils.validateParameters(expandedChunk.employer.location, ['lat', 'lng']);
    expect(expandedChunk.employer.name).toBe('Ford');
    expect(expandedChunk.employer.location.lat).toBe(42.314936);
    expect(expandedChunk.employer.location.lng).toBe(-83.209773);
    return;
});

test('Chunk expands correctly to level 4', async () => {
    const expandedChunk = await gTestPersonChunk.expand(4);
    // console.log('expandedChunk expanded to level4');
    // console.log(expandedChunk);
    expect(expandedChunk.name).toBe('John Doe');
    expect(expandedChunk.age).toBe(34);
    Utils.validateParameters(expandedChunk.car, ['manufacturer', 'model', 'year']);
    Utils.validateParameters(expandedChunk.car.manufacturer, ['name', 'location']);
    Utils.validateParameters(expandedChunk.car.manufacturer.location, ['lat', 'lng']);
    expect(expandedChunk.car.manufacturer.name).toBe('Ford');
    expect(expandedChunk.car.manufacturer.location.lat).toBe(42.314936);
    expect(expandedChunk.car.manufacturer.location.lng).toBe(-83.209773);
    expect(expandedChunk.car.model).toBe('F-250');
    expect(expandedChunk.car.year).toBe(1999);
    Utils.validateParameters(expandedChunk.employer, ['name', 'location']);
    Utils.validateParameters(expandedChunk.employer.location, ['lat', 'lng']);
    expect(expandedChunk.employer.name).toBe('Ford');
    expect(expandedChunk.employer.location.lat).toBe(42.314936);
    expect(expandedChunk.employer.location.lng).toBe(-83.209773);
    return;
});

test('Chunk deduplicates', async () => {
    const level2Chunk = await gTestPersonChunk.expand(2);
    const level3Chunk = await gTestPersonChunk.expand(3);
    const locationChunk1 = level2Chunk.employer.location;
    const locationChunk2 = level3Chunk.car.manufacturer.location;
    // console.log('locationChunk1');
    // console.log(locationChunk1);
    // console.log('locationChunk2');
    // console.log(locationChunk2);
    expect(locationChunk1 instanceof Chunk).toBe(true);
    expect(locationChunk2 instanceof Chunk).toBe(true);
    expect(locationChunk1.id === locationChunk2.id).toBe(true);
    return;
});