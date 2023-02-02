import {
    Chunk,
    VolatileChunkManager,
    NodeCryptoManager,
    logger
} from 'fieldfare/node';

var gTestPersonChunk;

beforeAll(async () => {

    logger.disable();
    NodeCryptoManager.init();
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

test('Chunk expands correctly to level 0', async () => {
    const expandedChunk = await gTestPersonChunk.expand(0);
    expect(expandedChunk.name).toBe('John Doe');
    expect(expandedChunk.age).toBe(34);
    expect(expandedChunk.car instanceof Chunk).toBe(true);
    expect(expandedChunk.employer instanceof Chunk).toBe(true);
    return;
});

test('Chunk expands correctly to level 1', async () => {
    const expandedChunk = await gTestPersonChunk.expand(1);
    expect(expandedChunk.name).toBe('John Doe');
    expect(expandedChunk.age).toBe(34);
    expect(expandedChunk.car.manufacturer instanceof Chunk).toBe(true);
    expect(expandedChunk.car.model).toBe('F-250');
    expect(expandedChunk.car.year).toBe(1999);
    expect(expandedChunk.employer.name).toBe('Ford');
    expect(expandedChunk.employer.location instanceof Chunk).toBe(true);
    return;
});

test('Chunk expands correctly to level 2', async () => {
    const expandedChunk = await gTestPersonChunk.expand(2);
    expect(expandedChunk.name).toBe('John Doe');
    expect(expandedChunk.age).toBe(34);
    expect(expandedChunk.car.manufacturer.name).toBe('Ford');
    expect(expandedChunk.car.manufacturer.location instanceof Chunk).toBe(true);
    expect(expandedChunk.car.model).toBe('F-250');
    expect(expandedChunk.car.year).toBe(1999);
    expect(expandedChunk.employer.name).toBe('Ford');
    expect(expandedChunk.employer.location.lat).toBe(42.314936);
    expect(expandedChunk.employer.location.lng).toBe(-83.209773);
    return;
});

test('Chunk expands correctly to level 3', async () => {
    const expandedChunk = await gTestPersonChunk.expand(3);
    expect(expandedChunk.name).toBe('John Doe');
    expect(expandedChunk.age).toBe(34);
    expect(expandedChunk.car.manufacturer.name).toBe('Ford');
    expect(expandedChunk.car.manufacturer.location.lat).toBe(42.314936);
    expect(expandedChunk.car.manufacturer.location.lng).toBe(-83.209773);
    expect(expandedChunk.car.model).toBe('F-250');
    expect(expandedChunk.car.year).toBe(1999);
    expect(expandedChunk.employer.name).toBe('Ford');
    expect(expandedChunk.employer.location.lat).toBe(42.314936);
    expect(expandedChunk.employer.location.lng).toBe(-83.209773);
    return;
});

test('Chunk deduplicates', async () => {
    const level1Chunk = await gTestPersonChunk.expand(1);
    const level2Chunk = await gTestPersonChunk.expand(2);
    const locationChunk1 = level1Chunk.employer.location;
    const locationChunk2 = level2Chunk.car.manufacturer.location;
    expect(locationChunk1 instanceof Chunk).toBe(true);
    expect(locationChunk2 instanceof Chunk).toBe(true);
    expect(locationChunk1.id === locationChunk2.id).toBe(true);
    return;
});