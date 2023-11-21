/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import { Chunk } from '../chunking/Chunk.js';
import { AdministeredCollection } from '../versioning/AdministeredCollection.js';
import { Change } from '../versioning/Change.js';
import { ServiceDescriptor } from './ServiceDescriptor.js';
import { Utils } from '../basic/Utils.js';
import { logger } from '../basic/Log.js';
import { HostIdentifier } from './HostIdentifier.js';

export class Environment extends AdministeredCollection {

	constructor(uuid) {
		super(uuid);
		this.activeHosts = new Map();
		this.allowedChanges = new Set([
			'addAdmin', 'removeAdmin',
			'addService', 'removeService',
			'addProvider', 'removeProvider',
			'addWebport', 'removeWebport',
			'merge'
		]);
	}

	async getServicesForHost(hostIdentifier) {
		const authorizedUUIDs = [];
		const hostChunk = await Chunk.fromObject({id:hostIdentifier});
		const services = await this.localCopy.getElement('services');
		if(!services) {
			return authorizedUUIDs;
		}
		for await(const [keyChunk, valueChunk] of services) {
			const {uuid} = await keyChunk.expand(0);
			const providerListName = uuid + '.providers';
			const providers = await this.localCopy.getElement(providerListName);
			if(providers) {
				if(await providers.has(hostChunk)) {
					authorizedUUIDs.push(uuid);
				}
			}
		}
		return authorizedUUIDs;
	}

	addService(definition) {
		return new Change('addService', ...arguments)
			.setAuth(async (issuer) => {
				return await this.isAdmin(issuer);
			})
			.setMergePolicy(async () => {
				ServiceDescriptor.validate(definition);
				const definitionChunk = await Chunk.fromObject(definition);
				const keyChunk = await Chunk.fromObject({
					uuid: definition.uuid
				});
				const services = await this.localCopy.getElement('services');
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
				let services = await this.localCopy.getElement('services');
				if(!services) {
					services = await this.localCopy.createElement('services', {
						type: 'map',
						degree: 3
					});
				}
				if(await services.has(keyChunk)) {
					throw Error('service UUID ' + definition.uuid + ' already assigned');
				}
				await services.set(keyChunk, definitionChunk);
				await this.localCopy.updateElement('services', services.descriptor);
				await this.localCopy.createElement(definition.uuid+'.providers', {
					type: 'set',
					degree: 5
				})
			})
	}

    removeService(uuid) {
		return new Change('removeService', ...arguments)
		.setAuth(async (issuer) => {
			return await this.isAdmin(issuer);
		})
		.setMergePolicy(async () => {
			const services = await this.localCopy.getElement('services');
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
			const services = await this.localCopy.getElement('services');
			if(!services) {
				throw Error('Environment services not defined');
			}
			if(await services.has(keyChunk) === false) {
				throw Error('Service does not exist');
			}
			await services.delete(keyChunk);
			await this.localCopy.updateElement('services', services.descriptor);
			await this.localCopy.deleteElement(uuid+'.providers');
		})
    }

	async getServiceDescriptor(uuid) {
		const services = await this.localCopy.getElement('services');
		if(services) {
			const keyChunk = await Chunk.fromObject({uuid:uuid});
			const descriptorChunk = await services.get(keyChunk);
			const descriptor = descriptorChunk.expand(1);
			return descriptor;
		}
		return undefined;
	}

	async hasService(uuid) {
		const services = await this.localCopy.getElement('services');
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
		if(!HostIdentifier.isValid(hostID)) {
			throw Error('Invalid hostID');
		}
		const hostChunk = await Chunk.fromObject({id:hostID});
		const providers = await this.localCopy.getElement(serviceUUID+'.providers');
		if(providers
		&& providers !== undefined
		&& providers !== null) {
			return providers.has(hostChunk);
		}
		return false;
	}

	addProvider(serviceUUID, providerID) {
		if(!Utils.isUUID(serviceUUID)) {
			throw Error('Invalid serviceUUID');
		}
		HostIdentifier.validate(providerID);
		const providerListName = serviceUUID + '.providers';
		const makingHostChunk = Chunk.fromObject({id:providerID});
		const gettingProviders = this.localCopy.getElement(providerListName);
		return new Change('addProvider', ...arguments)
			.setAuth(async (issuer) => {
				return await this.isAdmin(issuer);
			})
			.setMergePolicy(async () => {
				const providers = await gettingProviders;
				if(providers) {
					const hostChunk = await makingHostChunk;
					if(await providers.has(hostChunk)) {
						logger.debug('addProvider successfully MERGED');
						return false;
					}
				}
				return true;
			})
			.setAction(async () => {
				const providers = await gettingProviders;
				if(!providers) {
					throw Error(serviceUUID + ' providers ChunkSet does not exist');
				}
				const hostChunk = await makingHostChunk;
				if(await providers.has(hostChunk)) {
					throw Error('provider already in list');
				}
				await providers.add(hostChunk);
				await this.localCopy.updateElement(providerListName, providers.descriptor);
			})
	}

	removeProvider(serviceUUID, providerID) {
		const providerListName = serviceUUID + '.providers';
		const gettingProviders = this.localCopy.getElement(providerListName);
		const makingHostChunk = Chunk.fromObject({id:providerID});
		return new Change('removeProvider', ...arguments)
			.setAuth((issuer) => {
				return this.isAdmin(issuer);
			})
			.setMergePolicy(async () => {
				const providers = await gettingProviders;
				if(providers) {
					if(await providers.has(await makingHostChunk)) {
						return true;
					}
				}
				logger.debug('removeProvider successfully MERGED');
				return true;
			})
			.setAction(async () => {
				const providers = await gettingProviders;
				if(!providers) {
					throw Error(serviceUUID + ' providers ChunkSet does not exist');
				}
				const hostChunk = await makingHostChunk;
				if(await providers.has(hostChunk) === false) {
					throw Error('provider not in list');
				}
				await providers.delete(hostChunk);
				await this.localCopy.updateElement(providerListName, providers.descriptor);
			})
	}

	async getWebports(hostID) {
		var hostWebports = [];
		const envWebports = await this.localCopy.getElement('webports');
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
		return new Change('addWebport', ...arguments)
			.setAuth(async (issuer) => {
				return await this.isAdmin(issuer);
			})
			.setMergePolicy(async () => {
				const webportChunk = await Chunk.fromObject(descriptor);
				const webports = await this.localCopy.getElement('webports');
				if(webports) {
					if(await webports.has(webportChunk)) {
						logger.debug('addWebport successfully MERGED');
						return false;
					}
				}
				return true;
			})
			.setAction(async () => {
				let webports = await this.localCopy.getElement('webports');
				if(!webports) {
					webports = await this.localCopy.createElement('webports', {
						type: 'set',
						degree: 5
					});
				}
				const webportChunk = await Chunk.fromObject(descriptor);
				if(await webports.has(webportChunk)) {
					throw Error('webport already defined');
				}
				await webports.add(webportChunk);
				await this.localCopy.updateElement('webports', webports.descriptor);
			})
	}

    removeWebport(webportChunk) {
		if(!webportChunk) {
			throw Error('Invalid webportChunk');
		}
		if(!(webportChunk instanceof Chunk)) {
			throw Error('Invalid webportChunk');
		}
		return new Change('removeWebport', ...arguments)
			.setAuth(async (issuer) => {
				return await this.isAdmin(issuer);
			})
			.setMergePolicy(async () => {
				const webports = await this.localcopy.getElement('webports');
				if(webports) {
					if(await webports.has(webportChunk)) {
						return true;
					}
				}
				logger.debug('removeWebport successfully MERGED');
				return false;
			})
			.setAction(async () => {
				const webports = await this.localCopy.getElement('webports');
				if(!webports) {
					throw Error('webports ChunkSet does not exist');
				}
				if(await webports.has(webportChunk) === false) {
					throw Error('webport does not exist');
				}
				await webports.delete(webportChunk);
				await this.localCopy.updateElement('webports', webports.descriptor);
			})
    }

};
