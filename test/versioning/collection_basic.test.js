import {
    ffinit,
    LocalHost,
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

test('Collection elements is a ChunkMap of degree=5', () => {
    expect(gTestCollection.elements).toBeInstanceOf(ChunkMap);
    expect(gTestCollection.elements.degree).toBe(5);
});

test('Collection can add an admin', async () => {
    const admins = await gTestCollection.getElement('admins');
    expect(admins).toBeUndefined();
    await gTestCollection.addAdmin(LocalHost.getID());
    expect(admins).toBeInstaceOf(ChunkMap);
    return;
});