import {
    ffinit,
    LocalHost,
    ChunkSet,
    ChunkMap,
    AdministeredCollection,
    logger
} from 'fieldfare/test';

var gTestCollection;

beforeAll(async () => {
    logger.disable();
    ffinit.setupLocalHost();
    gTestCollection = new AdministeredCollection;
    return;
});

test('AdministeredCollection can add an admin', async () => {
    const adminsBefore = await gTestCollection.getElement('admins');
    expect(adminsBefore).toBeUndefined();
    await gTestCollection.addAdmin(LocalHost.getID());
    const adminsAfter = await gTestCollection.getElement('admins');
    expect(adminsAfter).toBeInstanceOf(ChunkSet);
    return;
});