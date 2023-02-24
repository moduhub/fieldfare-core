/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import { LocalHost } from './LocalHost';
import { Chunk } from '../chunking/Chunk';
import { ChunkingUtils } from '../chunking/ChunkingUtils';
import { AdministeredCollection } from '../versioning/AdministeredCollection';
import { VersionStatement } from '../versioning/VersionStatement';
import { ServiceDescriptor } from './ServiceDescriptor';
import { NVD } from '../basic/NVD';
import { Utils } from '../basic/Utils';
import { logger } from '../basic/Log';
import { ChunkSet } from '../structures/ChunkSet';
import { HostIdentifier } from './HostIdentifier';


export class Environment extends AdministeredCollection {

	constructor(uuid) {
		super(uuid);
		this.activeHosts = new Map();
		this.methods.set('addService', this.applyAddService.bind(this));
        this.methods.set('removeService', this.applyRemoveService.bind(this));
		this.methods.set('addProvider', this.applyAddProvider.bind(this));
        this.methods.set('removeProvider', this.applyRemoveProvider.bind(this));
		this.methods.set('addWebport', this.applyAddWebport.bind(this));
        this.methods.set('removeWebport', this.applyRemoveWebport.bind(this));
		//report periodically
		// setInterval(() => {
		//	logger.info(this.report());
		// }, 10000);
	}

	report() {
		var content = 'Active hosts: ' + this.activeHosts.size + '\n';
		for(const [id, info] of this.activeHosts) {
			const timeDiff = Date.now() - info.lastEnvUpdate;
			content += "HOST: " + id
				+ 'at version ' + info.latestVersion
				+ ' updated ' + timeDiff + 'ms ago.';
		}
		return content;
	}

	removeActiveHost(hostid) {
		if(this.activeHosts.has(hostid)) {
			const oldInfo = this.activeHosts.get(hostid);
			clearTimeout(oldInfo.timeout);
			this.activeHosts.clear(hostid);
		}
	}

	updateActiveHost(remoteHost, version) {
		if(remoteHost.id) {
			this.removeActiveHost(remoteHost.id);
			const newInfo = {
				remoteHostObj: remoteHost,
				timeout: setTimeout(() => {
					// logger.log('info', "Host went inactive: " + remoteHost.id);
					this.removeActiveHost(remoteHost.id)
				}, 10000),
				lastEnvUpdate: Date.now(),
				latestVersion: version
			}
			// logger.log('info', "hostInfo: " + newInfo.remoteHostObj.id
			// 	+ ' date: ' + newInfo.lastEnvUpdate
			// 	+ 'at version: ' + newInfo.latestVersion);
			this.activeHosts.set(remoteHost.id, newInfo);
		}
	}

	getSyncedHosts() {
		var numSyncedHosts = 0;
		for(const [id, info] of this.activeHosts) {
			logger.log('info', "this.versionIdentifier: " + this.versionIdentifier
				+ ' - their.version: ' + info.latestVersion);
			if(info.latestVersion === this.versionIdentifier) {
				numSyncedHosts++;
			}
		}
		return numSyncedHosts;
	}

	sync() {
		const preSyncedHosts = this.getSyncedHosts();
		if(preSyncedHosts > 0) {
			return preSyncedHosts;
		}
		return new Promise((resolve, reject) => {
			var attempts = 0;
			const interval = setInterval(() => {
				const syncedHosts = this.getSyncedHosts();
				if(syncedHosts > 0) {
					clearInterval(interval);
					resolve(syncedHosts);
				} else {
					if(this.activeHosts.size === 0) {
						logger.log('info', "env.sync waiting for active host");
					} else {
						logger.log('info', 'env.sync waiting for any of ' + this.activeHosts.size
						 	+ ' active hosts to sync');
					}
					attempts++;
					if(this.updateInProgress) {
						logger.info('env.sync waiting for update in progress');
						attempts = 0;
					} else
					if(attempts > 10) {
						clearInterval(interval);
						reject(Error('sync timeout'));
					}
				}
			}, 1000);
		});
	}

	numActiveProviders(serviceUUID) {
		var count = 0;
		for (const [id, info] of this.activeHosts) {
			const remoteHost = info.remoteHostObj;
			if(remoteHost.definedServices.has(serviceUUID)) {
				count++;
			}
		}
		return count;
	}

	getActiveProviders(serviceUUID, howMany=-1) {
		var activeProviders = [];
		for (const [id, info] of this.activeHosts) {
			const remoteHost = info.remoteHostObj;
			if(remoteHost.definedServices.has(serviceUUID)) {
				activeProviders.push(remoteHost);
				if(howMany !== -1) {
					if(activeProviders.size >= howMany) {
						break;
					}
				}
			}
		}
		return activeProviders;
	}

	async establishProvidersOf(serviceUUID, howMany=1) {
        logger.debug('establishProvidersOf: ' + serviceUUID + ' howMany: ' + howMany);
		var newProviders = [];
		const providers = await this.getProviders(serviceUUID);
		logger.debug("providers: " + providers);
		for await (const providerID of providers) {
			logger.debug("providerID: " + providerID);
			if(this.activeHosts.has(providerID) === false) {
				try {
					const remoteHost = await LocalHost.establish(providerID);
					const numNewProviders = newProviders.push(remoteHost);
					if(numNewProviders >= howMany) {
						break;
					}
				} catch (error) {
					logger.log('info', "Failed to reach host " + providerID + ' cause: ' + error);
				}
			} else {
				logger.debug('host ' + providerID + ' already established');
			}
		}
		//throw Error('Unable to find a provider for service ' + serviceUUID);
		return newProviders;
	}

	async getServicesForHost(hostIdentifier) {
		var list = [];
		const services = await this.getElement('services');
		if(services) {
			for await(const [keyChunk, valueChunk] of services) {
				const {uuid} = await keyChunk.expand();
				const providerListName = uuid + '.providers';
				const providers = await this.getElement(providerListName);
				const hostChunkIdentifier = HostIdentifier.toChunkIdentifier(hostIdentifier);
				const hostChunk = Chunk.fromIdentifier(hostChunkIdentifier);
				if(await providers.has(hostChunk)) {
					list.push(uuid);
				}
			}
		}
		return list;
	}

	async applyAddService(issuer, params, merge=false) {
		Utils.validateParameters(params, ['definition']);
		logger.log('info', 'applyAddService params: ' + JSON.stringify(params));
		const definition = params.definition;
		ServiceDescriptor.validate(definition);
		const definitionChunk = await Chunk.fromObject(definition);
		const keyChunk = await Chunk.fromObject({
			uuid: definition.uuid
		});		
		const services = await this.getElement('services');
		if(!services) {
			throw Error('services ChunkMap does not exist');
		}
		if(await services.has(keyChunk)) {
			if(merge) {
				const previousDefinitionChunk = await services.get(keyChunk);
				if(previousDefinitionChunk.id === definitionChunk.id) {
					logger.log('info', 'applyAddService succesfuly MERGED');
					return;
				} else {
					throw Error('applyAddService MERGE FAILED: different service defined with same UUID');
				}
			} else {
				throw Error('service UUID already assigned');
			}
		}
		await this.auth(issuer);
		await services.set(keyChunk, definitionChunk);
		await this.updateElement('services', services.descriptor);
		await this.createElement(definition.uuid+'.providers', {
			type: 'set',
			degree: 5
		});
	}

	async addService(definition) {
		const params = {definition: definition};
		const services = await this.getElement('services');
		if(!services) {
			await this.createElement('services', {
				type: 'map',
				degree: 3
			});
		}
		await this.applyAddService(LocalHost.getID(), params);
		await this.commit({
			addService: params
		});
		NVD.save(this.uuid, this.versionIdentifier);
	}

    async applyRemoveService(issuer, params, merge=false) {
        Utils.validateParameters(params, ['uuid']);
		logger.debug('applyRemoveService params: ' + JSON.stringify(params));
		const uuid = params.uuid;
		const keyChunk = await Chunk.fromObject({uuid:params.uuid});
		const services = await this.getElement('services');
		if(!services) {
			throw Error('Environment services not defined');
		}
		if(await services.has(keyChunk) === false) {
			if(merge) {
				logger.log('info', 'applyRemoveService succesfuly MERGED');
			} else {
				throw Error('service does not exist');
			}
		}
		await this.auth(issuer);
		await services.delete(keyChunk);
		await this.updateElement('services', services.descriptor);
		await this.deleteElement(uuid+'.providers');
    }

    async removeService(uuid) {
        const params = {uuid: uuid};
		await this.applyRemoveService(LocalHost.getID(), params);
		await this.commit({
			removeService: params
		});
		NVD.save(this.uuid, this.versionIdentifier);
    }

	async getServiceDescriptor(uuid) {
		const services = await this.getElement('services');
		if(services) {
			const keyChunk = await Chunk.fromObject({uuid:uuid});
			const descriptorChunk = await services.get(keyChunk);
			const descriptor = descriptorChunk.expand(1);
			return descriptor;
		}
		return undefined;
	}

	async hasService(uuid) {
		const services = await this.getElement('services');
		if(services) {
			for await(const chunk of services) {
				const service = await chunk.expand();
				// logger.log('info', 'hasService ' + uuid + ' compare with ' + service.uuid);
				if(service.uuid === uuid) {
					return true;
				}
			}
		}
		return false;
	}

	async isProvider(serviceUUID, hostID) {
		const providers = await this.getProviders(serviceUUID);
		if(providers
		&& providers !== undefined
		&& providers !== null) {
			return await providers.has(hostID);
		}
		return false;
	}

	async applyAddProvider(issuer, params, merge=false) {
		Utils.validateParameters(params,
			['uuid', 'host']);
		await this.auth(issuer);
		const serviceUUID = params.uuid;
		const hostChunkIdentifier = HostIdentifier.toChunkIdentifier(params.host);
		const hostChunk = Chunk.fromIdentifier(hostChunkIdentifier, hostChunkIdentifier);
		const providerListName = serviceUUID + '.providers';
		const providers = await this.getElement(providerListName);
		if(!providers) {
			throw Error(serviceUUID + ' providers ChunkSet does not exist');
		}
		if(await providers.has(hostChunk)) {
			if(merge) {
				logger.log('info', 'addProvider successfully MERGED');
			} else {
				throw Error('provider already in list');
			}
		}
		await providers.add(hostChunk);
		await this.updateElement(providerListName, providers.descriptor);
	}

	async addProvider(serviceUUID, providerID) {
		const params = {
			uuid: serviceUUID,
			host: providerID
		}
		await this.applyAddProvider(LocalHost.getID(), params);
		await this.commit({
			addProvider: params
		});
		await NVD.save(this.uuid, this.versionIdentifier);
	}

    async applyRemoveProvider(issuer, params, merge=false) {
        Utils.validateParameters(params,
            ['uuid', 'host']);
		const hostChunkIdentifier = HostIdentifier.toChunkIdentifier(params.host);
		const hostChunk = Chunk.fromIdentifier(hostChunkIdentifier, params.host);
        await this.auth(issuer);
        const providers = await this.getElement(params.uuid+'.providers');
        if(!providers) {
			throw Error('Service '+params.uuid+' providers is not defined');
		}
		if(await providers.has(hostChunk) === false) {
            if(merge) {
                logger.log('info', 'addProvider successfully MERGED');
            } else {
                throw Error('provider not in list');
            }
        }
        await providers.delete(hostChunk);
		await this.updateElement(params.uuid+'.providers', providers.descriptor);
    }

	async removeProvider(serviceUUID, providerID) {
        const params = {
            uuid: serviceUUID,
            host: providerID
        }
        await this.applyRemoveProvider(LocalHost.getID(), params);
        await this.commit({
            removeProvider: params
        });
        await NVD.save(this.uuid, this.versionIdentifier);
	}

	async getWebports(hostID) {
		var hostWebports = [];
		const envWebports = await this.getElement('webports');
		if(envWebports) {
			for await(const chunk of envWebports) {
				//logger.debug('[ENV] getWebports>chunk.key: '+ chunk.key);
				const webport = await chunk.expand();
				// logger.log('info', 'webport info: ' + JSON.stringify(webport));
				if(webport.hostid === hostID) {
					hostWebports.push(webport);
				}
			}
		}
		return hostWebports;
	}

	async applyAddWebport(issuer, params, merge=false) {
		Utils.validateParameters(params, ['hostid', 'protocol', 'address', 'port']);
		await this.auth(issuer);
		const webportChunk = await Chunk.fromObject(params);
		const webports = await this.getElement('webports');
		if(!webports) {
			throw Error('webports ChunkSet does not exist');
		}
		if(await webports.has(webportChunk)) {
			//Exact same information already present
			if(merge) {
				logger.log('info', 'addWebport successfully MERGED');
				return;
			} else {
				throw Error('webport already defined');
			}
		}
		await webports.add(webportChunk);
		this.updateElement('webports', webports.descriptor);
	}

	async addWebport(info) {
		const webports = await this.getElement('webports');
		if(!webports) {
			await this.createElement('webports', {
				type: 'set',
				degree: 5
			});
		}
		await this.applyAddWebport(LocalHost.getID(), info);
		await this.commit({
			addWebport: info
		});
		NVD.save(this.uuid, this.versionIdentifier);
	}

    async applyRemoveWebport(issuer, params, merge=false) {
        const webportChunk = params;
        if(webportChunk instanceof Chunk === false) {
			throw Error('applyRemoveWebport params must be a Chunk object');
		}
        await this.auth(issuer);
        const webports = await this.getElement('webports');
		if(!webports) {
			throw Error('webports ChunkSet does not exist');
		}
        if(await webports.has(webportChunk) === false) {
            if(merge) {
                logger.debug('removeWebport successfully MERGED');
                return;
            } else {
                throw Error('webport does not exist');
            }
        }
        await webports.delete(webportChunk);
		this.updateElement('webports', webports.descriptor);
    }

    async removeWebport(webportChunk) {
        await this.applyRemoveWebport(LocalHost.getID(), webportChunk);
        await this.commit({
            removeWebport: webportChunk
        });
        NVD.save(this.uuid, this.versionIdentifier);
    }

};
