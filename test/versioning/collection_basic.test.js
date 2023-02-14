import {
    ffinit,
    LocalHost,
    ChunkList,
    ChunkSet,
    ChunkMap,
    VersionedCollection,
    logger
} from 'fieldfare/test';

var gTestCollection;

beforeAll(async () => {
    logger.disable();
    ffinit.setupLocalHost();
    gTestCollection = new VersionedCollection;
    return;
});

test('VersionedCollection elements is a ChunkMap of degree=5', () => {
    expect(gTestCollection.elements).toBeInstanceOf(ChunkMap);
    expect(gTestCollection.elements.degree).toBe(5);
});

test('VersionedCollection can add elements', async () => {
    const listBefore = await gTestCollection.getElement('list_a');
    const setBefore = await gTestCollection.getElement('set_b');
    const mapBefore = await gTestCollection.getElement('map_c');
    expect(listBefore).toBeUndefined();
    expect(setBefore).toBeUndefined();
    expect(mapBefore).toBeUndefined();
    await gTestCollection.createElement('list_a', {
        type: 'list',
        degree: 3
    });
    await gTestCollection.createElement('set_b', {
        type: 'set',
        degree: 5
    });
    await gTestCollection.createElement('map_c', {
        type: 'map',
        degree: 4
    });
    const listAfter = await gTestCollection.getElement('list_a');
    const setAfter = await gTestCollection.getElement('set_b');
    const mapAfter = await gTestCollection.getElement('map_c');
    expect(listAfter).toBeInstanceOf(ChunkList);
    expect(listAfter.degree).toBe(3);
    expect(setAfter).toBeInstanceOf(ChunkSet);
    expect(setAfter.degree).toBe(5);
    expect(mapAfter).toBeInstanceOf(ChunkMap);
    expect(mapAfter.degree).toBe(4);
    return;
});