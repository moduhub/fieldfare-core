import { LocalHost } from '../../env/LocalHost';
import { JerryZephyrCrypto } from './JerryZephyrCrypto';
import { cryptoManager } from '../../basic/CryptoManager';
import { FileSystemNVD } from '../shared/FileSystemNVD';
import { FileSystemResourcesManager } from '../shared/FileSystemResourcesManager';
import { logger } from '../../basic/Log';

export * from '../shared/CommonSetup';

export async function setupLocalHost() {
    FileSystemNVD.init();
    FileSystemResourcesManager.init();
    JerryZephyrCrypto.init();
    const localKeypair = await cryptoManager.getLocalKeypair();
    LocalHost.init(localKeypair);
}
