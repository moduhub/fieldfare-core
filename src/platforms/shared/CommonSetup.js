/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import {LocalHost} from '../../env/LocalHost.js';
import {Environment} from '../../env/Environment.js';
import {NVD} from '../../basic/NVD.js';
import { ChunkList } from './CommonExports.js';
import { ChunkSet } from './CommonExports.js';
import { ChunkMap } from './CommonExports.js';
import { Collection } from './CommonExports.js';


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