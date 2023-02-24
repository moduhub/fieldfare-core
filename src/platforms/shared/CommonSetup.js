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
    const env = new Environment(envUUID);
    await env.init();
	LocalHost.addEnvironment(env);
    //Serve webports
    const servedWebports = await env.getWebports(LocalHost.getID());
    for(const webport of servedWebports) {
        LocalHost.serveWebport(webport);
    }
    return env;
}

export function setupBasicCollectionTypes() {
    Collection.registerType('list', ChunkList);
    Collection.registerType('set', ChunkSet);
    Collection.registerType('map', ChunkMap);
}