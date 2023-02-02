import {LocalHost} from '../../env/LocalHost';
import {Environment} from '../../env/Environment';
import {NVD} from '../../basic/NVD';
import { ChunkList } from './CommonExports';
import { ChunkSet } from './CommonExports';
import { ChunkMap } from './CommonExports';
import { VersionedCollection } from './CommonExports';
import {logger} from '../../basic/Log';

export async function setEnvironmentUUID(uuid) {
	await NVD.save('envUUID', uuid);
}

export async function setupEnvironment() {
	const env = new Environment();
	const envUUID = await NVD.load('envUUID');
	await env.init(envUUID);
	LocalHost.addEnvironment(env);
    //Serve webports
    const servedWebports = await env.getWebports(LocalHost.getID());
    for(const webport of servedWebports) {
        LocalHost.serveWebport(webport);
    }
    return env;
}

export function setupBasicCollectionTypes() {
    VersionedCollection.registerType('list', ChunkList);
    VersionedCollection.registerType('set', ChunkSet);
    VersionedCollection.registerType('map', ChunkMap);
}