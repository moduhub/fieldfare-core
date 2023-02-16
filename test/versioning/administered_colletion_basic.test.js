import {
    ffinit,
    cryptoManager,
    LocalHost,
    HostIdentifier,
    Chunk,
    ChunkSet,
    ChunkMap,
    AdministeredCollection,
    logger
} from 'fieldfare/test';

var gTestCollection;

const addedAdmins = [];
var keptAdmins;
const adminKeypairs = [];
const numAddedAdmins = 20;
const removedAdmins = [];
const numRemovedAdmins = 5;

beforeAll(async () => {
    logger.disable();
    ffinit.setupLocalHost();
    gTestCollection = new AdministeredCollection;
    //genarate test data
    for(let i=0; i<numAddedAdmins; i++) {
        const iKeypair = await cryptoManager.generateTestKeypair();
        adminKeypairs.push(iKeypair);
        const iPubKeyJWK = await cryptoManager.exportPublicKey(iKeypair.publicKey);
        console.log('iHost pubkey: ' + JSON.stringify(iPubKeyJWK));
        const iPubKeyChunk = await Chunk.fromObject(iPubKeyJWK);
        addedAdmins[i] = HostIdentifier.fromChunkIdentifier(iPubKeyChunk.id);
        console.log('iHost Identifier: ' + addedAdmins[i]);
    }
    const removeStep = Math.floor(numAddedAdmins/numRemovedAdmins);
    for(let i=0; i<numRemovedAdmins; i++) {
        const adminToRemove = addedAdmins[i*removeStep];
        removedAdmins[i] = adminToRemove;
    }
    keptAdmins = addedAdmins.filter(element => !removedAdmins.includes(element));
    return;
});

test('AdministeredCollection LocalHost can add itself as an admin', async () => {
    const adminsBefore = await gTestCollection.getElement('admins');
    expect(adminsBefore).toBeUndefined();
    await gTestCollection.addAdmin(LocalHost.getID());
    const adminsAfter = await gTestCollection.getElement('admins');
    expect(adminsAfter).toBeInstanceOf(ChunkSet);
    return;
});

test('AdministeredCollection can add other admins', async () => {
    for(const hostIdentifier of addedAdmins) {
        await gTestCollection.addAdmin(hostIdentifier);
    }
    const admins = await gTestCollection.getElement('admins');
    var numAdmins = 0;
    for await (const chunk of admins) {
        const hostIdentifier = HostIdentifier.fromChunkIdentifier(chunk.id);
        if(hostIdentifier != LocalHost.getID()) {
            expect(addedAdmins.includes(hostIdentifier)).toBe(true);
        }
        numAdmins++;
    }
    expect(numAdmins).toBe(numAddedAdmins+1);
    return;
});

test('AdministeredCollection can remove admins', async () => {
    for(const hostIdentifier of removedAdmins) {
        await gTestCollection.removeAdmin(hostIdentifier);
    }
    const admins = await gTestCollection.getElement('admins');
    var numAdmins = 0;
    for await (const chunk of admins) {
        const hostIdentifier = HostIdentifier.fromChunkIdentifier(chunk.id);
        if(hostIdentifier != LocalHost.getID()) {
            expect(keptAdmins.includes(hostIdentifier)).toBe(true);
        }
        expect(removedAdmins.includes(hostIdentifier)).toBe(false);
        numAdmins++;
    }
    expect(numAdmins).toBe(numAddedAdmins-numRemovedAdmins+1);
    return;
});