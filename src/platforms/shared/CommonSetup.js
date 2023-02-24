import {LocalHost} from '../../env/LocalHost';
import {Environment} from '../../env/Environment';
import {NVD} from '../../basic/NVD';
import { ChunkList } from './CommonExports';
import { ChunkSet } from './CommonExports';
import { ChunkMap } from './CommonExports';
import { Collection } from './CommonExports';


export async function setEnvironmentUUID(uuid) {
	await NVD.save('envUUID', uuid);
}

export async function setupEnvironment() {
	const envUUID = await NVD.load('envUUID');
    if(!envUUID) {
        throw Error('Environemnt UUID not defined, please check your setup');;
    }
    const env = new Environment(envUUID);
    await env.init();
    return env;
}

export function terminate() {
    LocalHost.terminate();
}

export function setupBasicCollectionTypes() {
    Collection.registerType('list', ChunkList);
    Collection.registerType('set', ChunkSet);
    Collection.registerType('map', ChunkMap);
}