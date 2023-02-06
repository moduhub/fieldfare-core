import {
    ffinit,
    LocalHost,
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

test('Collection elements is a ChunkMap of degree=5', () => {
    expect(gTestCollection.elements).toBeInstanceOf(ChunkMap);
    expect(gTestCollection.elements.degree).toBe(5);
});

test('Collection can add an admin', async () => {
    const adminsBefore = await gTestCollection.getElement('admins');
    expect(adminsBefore).toBeUndefined();
    await gTestCollection.addAdmin(LocalHost.getID());
    const adminsAfter = await gTestCollection.getElement('admins');
    expect(adminsAfter).toBeInstanceOf(ChunkSet);
    return;
});