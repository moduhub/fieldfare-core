import {LocalHost} from '../../env/LocalHost';
import {NVD} from '../../basic/NVD';
import {JerryZephyrCrypto} from './JerryZephyrCrypto';
import {FileSystemNVD} from '../shared/FileSystemNVD';
import {FileSystemChunkManager} from '../shared/FileSystemChunkManager';
import {logger} from '../../basic/Log';

export * from '../shared/CommonSetup';

export async function setupLocalHost() {
    if(global.crypto === undefined) {
        global.crypto = JerryZephyrCrypto;
    }
    FileSystemNVD.init();
    FileSystemChunkManager.init();
    const privateKeyData = JerryZephyrCrypto.loadPrivateKey();
    LocalHost.init(privateKeyData);
}
