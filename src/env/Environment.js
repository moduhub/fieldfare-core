/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import { LocalHost } from './LocalHost.js';
import { Chunk } from '../chunking/Chunk.js';
import { AdministeredCollection } from '../versioning/AdministeredCollection.js';
import { Change } from '../versioning/Change.js';
import { ServiceDescriptor } from './ServiceDescriptor.js';
import { NVD } from '../basic/NVD.js';
import { Utils } from '../basic/Utils.js';
import { logger } from '../basic/Log.js';
import { HostIdentifier } from './HostIdentifier.js';
import { Collection } from '../structures/Collection.js';

export class Environment extends AdministeredCollection {

	constructor(uuid) {
		super(uuid);
		this.activeHosts = new Map();
		this.allowedChanges - new Set([
			'addAdmin', 'removeAdmin',
			'addService', 'removeService',
			'addProvider', 'removeProvider',
			'addWebport', 'removeWebport'
		]);
		//report periodically
		// setInterval(() => {
		//	logger.info(this.report());
		// }, 10000);
	}

	async init() {
		await super.init();
		Collection.track(this.uuid, (remoteCollection) => {
			logger.log('info', 'Environment '+this.uuid+' received update from remote host ' + remoteCollection.owner);
			this.update(remoteCollection);
		});
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

	addService(definition) {
		return new Change('addService', arguments)
			.setAuth(async (issuer) => {
				return await this.isAdmin(issuer);
			})
			.setMergePolicy(async () => {
				const services = await this.getElement('services');
				if(services) {
					const previousDefinitionChunk = await services.get(keyChunk);
					if(previousDefinitionChunk) {
						if(previousDefinitionChunk.id === definitionChunk.id) {
							logger.log('info', 'applyAddService succesfuly MERGED');
							return false;
						} else {
							throw Error('applyAddService MERGE FAILED: different service defined with same UUID');
						}
					}
				}
				return true;
			})
			.setAction(async () => {
				ServiceDescriptor.validate(definition);
				const definitionChunk = await Chunk.fromObject(definition);
				const keyChunk = await Chunk.fromObject({
					uuid: definition.uuid
				});
				let services = await this.getElement('services');
				if(!services) {
					services = await this.forceCreateElement('services', {
						type: 'map',
						degree: 3
					});
				}
				if(await services.has(keyChunk)) {
					throw Error('service UUID already assigned');
				}
				await services.set(keyChunk, definitionChunk);
				await this.updateElement('services', services.descriptor);
				await this.forceCreateElement(definition.uuid+'.providers', {
					type: 'set',
					degree: 5
				})
			})
	}

    removeService(uuid) {
		return new Change('removeService', arguments)
		.setAuth(async (issuer) => {
			return await this.isAdmin(issuer);
		})
		.setMergePolicy(async () => {
			const services = await this.getElement('services');
			if(services) {
				const keyChunk = await Chunk.fromObject({uuid:uuid});
				if(await services.has(keyChunk)) {
					return true;
				}
			}
			return false;
		})
		.setAction(async () => {
			const keyChunk = await Chunk.fromObject({uuid:uuid});
			const services = await this.getElement('services');
			if(!services) {
				throw Error('Environment services not defined');
			}
			if(await services.has(keyChunk) === false) {
				throw Error('Service does not exist');
			}
			await services.delete(keyChunk);
			await this.updateElement('services', services.descriptor);
			await this.forceDeleteElement(uuid+'.providers');
		})
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

	addProvider(serviceUUID, providerID) {
		Utils.isUUID(serviceUUID);
		HostIdentifier.validate(providerID);
		return new Change('addProvider', arguments)
			.setAuth(async (issuer) => {
				return await this.isAdmin(issuer);
			})
			.setMergePolicy(async () => {
				const providers = await this.getElement(serviceUUID+'.providers');
				if(providers) {
					const hostChunkIdentifier = HostIdentifier.toChunkIdentifier(providerID);
					const hostChunk = Chunk.fromIdentifier(hostChunkIdentifier, hostChunkIdentifier);
					if(await providers.has(hostChunk)) {
						logger.debug('addProvider successfully MERGED');
						return false;
					}
				}
				return true;
			})
			.setAction(async () => {
				const hostChunkIdentifier = HostIdentifier.toChunkIdentifier(providerID);
				const hostChunk = Chunk.fromIdentifier(hostChunkIdentifier, hostChunkIdentifier);
				const providerListName = serviceUUID + '.providers';
				const providers = await this.getElement(providerListName);
				if(!providers) {
					throw Error(serviceUUID + ' providers ChunkSet does not exist');
				}
				if(await providers.has(hostChunk)) {
					throw Error('provider already in list');
				}
				await providers.add(hostChunk);
				await this.updateElement(providerListName, providers.descriptor);
			})
	}

	removeProvider(serviceUUID, providerID) {
		return new Change('removeProvider', arguments)
			.setAuth(async (issuer) => {
				return await this.isAdmin(issuer);
			})
			.setMergePolicy(async () => {
				const providers = await this.getElement(serviceUUID+'.providers');
				if(providers) {
					const hostChunkIdentifier = HostIdentifier.toChunkIdentifier(providerID);
					const hostChunk = Chunk.fromIdentifier(hostChunkIdentifier, hostChunkIdentifier);
					if(await providers.has(hostChunk)) {
						return true;
					}
				}
				logger.debug('removeProvider successfully MERGED');
				return true;
			})
			.setAction(async () => {
				const hostChunkIdentifier = HostIdentifier.toChunkIdentifier(providerID);
				const hostChunk = Chunk.fromIdentifier(hostChunkIdentifier, hostChunkIdentifier);
				const providerListName = serviceUUID + '.providers';
				const providers = await this.getElement(providerListName);
				if(!providers) {
					throw Error(serviceUUID + ' providers ChunkSet does not exist');
				}
				if(await providers.has(hostChunk) === false) {
					throw Error('provider not in list');
				}
				await providers.delete(hostChunk);
				await this.updateElement(providerListName, providers.descriptor);
			})
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

	addWebport(descriptor) {
		Utils.validateParameters(descriptor, ['hostid', 'protocol', 'address', 'port']);
		return new Change('addWebport', arguments)
			.setAuth(async (issuer) => {
				return await this.isAdmin(issuer);
			})
			.setMergePolicy(async () => {
				const webportChunk = await Chunk.fromObject(descriptor);
				const webports = await this.getElement('webports');
				if(webports) {
					if(await webports.has(webportChunk)) {
						logger.debug('addWebport successfully MERGED');
						return false;
					}
				}
				return true;
			})
			.setAction(async () => {
				let webports = await this.getElement('webports');
				if(!webports) {
					webports = await this.forceCreateElement('webports', {
						type: 'set',
						degree: 5
					});
				}
				const webportChunk = await Chunk.fromObject(descriptor);
				if(await webports.has(webportChunk)) {
					throw Error('webport already defined');
				}
				await webports.add(webportChunk);
				await this.updateElement('webports', webports.descriptor);
			})
	}

    removeWebport(webportChunk) {
		return new Change('removeWebport', arguments)
			.setAuth(async (issuer) => {
				return await this.isAdmin(issuer);
			})
			.setMergePolicy(async () => {
				const webports = await this.getElement('webports');
				if(webports) {
					if(await webports.has(webportChunk)) {
						return true;
					}
				}
				logger.debug('removeWebport successfully MERGED');
				return false;
			})
			.setAction(async () => {
				const webports = await this.getElement('webports');
				if(!webports) {
					throw Error('webports ChunkSet does not exist');
				}
				if(await webports.has(webportChunk) === false) {
					throw Error('webport does not exist');
				}
				await webports.delete(webportChunk);
				await this.updateElement('webports', webports.descriptor);
			})
    }

};
