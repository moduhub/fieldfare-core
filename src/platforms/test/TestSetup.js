import { LocalHost } from '../../env/LocalHost';
import { TestNVD } from './TestNVD';
import { TestCryptoManager } from './TestCryptoManager';
import { VolatileChunkManager } from './TestExports';
import { cryptoManager } from '../../basic/CryptoManager';
import { setupBasicCollectionTypes } from '../shared/CommonSetup';

export * from '../shared/CommonSetup';

export async function setupLocalHost() {
    TestNVD.init();
    VolatileChunkManager.init();
    TestCryptoManager.init();
    setupBasicCollectionTypes();
    const localKeypair = await cryptoManager.getLocalKeypair();
    LocalHost.init(localKeypair);
}