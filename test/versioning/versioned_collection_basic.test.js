import {
    ffinit,
    cryptoManager,
    LocalHost,
    Chunk,
    ChunkList,
    ChunkSet,
    ChunkMap,
    VersionStatement,
    VersionChain,
    VersionedCollection,
    logger
} from 'fieldfare/test';
import { HostIdentifier } from '../../src/env/HostIdentifier';


var gTestCollection;

beforeAll(async () => {
    logger.disable();
    await ffinit.setupLocalHost();
    gTestCollection = new VersionedCollection;
    return;
});

afterAll(() => {
    ffinit.terminate();
});

test('VersionedCollection elements is a ChunkMap of degree=5', () => {
    expect(gTestCollection.elements).toBeInstanceOf(ChunkMap);
    expect(gTestCollection.elements.degree).toBe(5);
});

test('VersionedCollection can create elements', async () => {
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

test('VersionedCollection can delete elements', async () => {
    await gTestCollection.deleteElement('list_a');
    await gTestCollection.deleteElement('set_b');
    const listAfter = await gTestCollection.getElement('list_a');
    const setAfter = await gTestCollection.getElement('set_b');
    const mapAfter = await gTestCollection.getElement('map_c');
    expect(listAfter).toBeUndefined();
    expect(setAfter).toBeUndefined();
    expect(mapAfter).toBeInstanceOf(ChunkMap);
    expect(mapAfter.degree).toBe(4);
    return;
});

test('VersionedCollection produces a valid VersionChain', async () => {
    const localChain = new VersionChain(gTestCollection.versionIdentifier, LocalHost.getID(), 50);
    for await (const [identifier, statement] of localChain) {
        const pubKeyIdentifier = HostIdentifier.toChunkIdentifier(statement.source);
        const pubKeyChunk = Chunk.fromIdentifier(pubKeyIdentifier, statement.source);
        const pubKey = await cryptoManager.importPublicKey(await pubKeyChunk.expand(0));
        const result = await cryptoManager.verifyMessage(statement, pubKey);
        expect(result).toBe(true);
    }
});

test('VersionedCollection version chain contains expected changes', async () => {
    const localChain = new VersionChain(gTestCollection.versionIdentifier, LocalHost.getID(), 50);
    const changes = await localChain.getChanges();
    const changesArray = [];
    for await (const change of changes) {
        changesArray.push(change);
        console.log(change);
    }
    expect(changesArray[0].issuer).toBe(LocalHost.getID());
    expect(changesArray[0].method).toBe('createElement');
    expect(changesArray[0].params.name).toBe('list_a');
    expect(changesArray[0].params.descriptor.type).toBe('list');
    expect(changesArray[0].params.descriptor.degree).toBe(3);
    
    expect(changesArray[1].issuer).toBe(LocalHost.getID());
    expect(changesArray[1].method).toBe('createElement');
    expect(changesArray[1].params.name).toBe('set_b');
    expect(changesArray[1].params.descriptor.type).toBe('set');
    expect(changesArray[1].params.descriptor.degree).toBe(5);
    
    expect(changesArray[2].issuer).toBe(LocalHost.getID());
    expect(changesArray[2].method).toBe('createElement');
    expect(changesArray[2].params.name).toBe('map_c');
    expect(changesArray[2].params.descriptor.type).toBe('map');
    expect(changesArray[2].params.descriptor.degree).toBe(4);

    expect(changesArray[3].issuer).toBe(LocalHost.getID());
    expect(changesArray[3].method).toBe('deleteElement');
    expect(changesArray[3].params.name).toBe('list_a');

    expect(changesArray[4].issuer).toBe(LocalHost.getID());
    expect(changesArray[4].method).toBe('deleteElement');
    expect(changesArray[4].params.name).toBe('set_b');
});

test('VersionedCollection checkouts specific version', async () => {
    const localChain = new VersionChain(gTestCollection.versionIdentifier, LocalHost.getID(), 50);
    const versionIdentifiers = [];
    for await(const [identifier, statement] of localChain) {
        versionIdentifiers.push(identifier);
    }
    versionIdentifiers.reverse(); //remember versions are in reverse order
    //Checkout the specific version    
    await gTestCollection.checkout(versionIdentifiers[1]);
    const list_a = await gTestCollection.getElement('list_a');
    const set_b = await gTestCollection.getElement('set_b');
    const map_c = await gTestCollection.getElement('map_c');
    expect(list_a).toBeInstanceOf(ChunkList);
    expect(list_a.degree).toBe(3);
    expect(set_b).toBeInstanceOf(ChunkSet);
    expect(set_b.degree).toBe(5);
    expect(map_c).toBeUndefined();
});