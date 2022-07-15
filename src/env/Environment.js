/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2022 Adan Kvitschal
 * ISC LICENSE
 */

import {LocalHost} from './LocalHost';
import {ResourcesManager} from '../resources/ResourcesManager';
import {HashLinkedTree} from '../structures/HashLinkedTree';
import {VersionedData} from '../versioning/VersionedData';
import {VersionStatement} from '../versioning/VersionStatement';
import {ServiceDefinition} from './ServiceDefinition';
import {NVD} from '../basic/NVD';
import {Utils} from '../basic/Utils';
import {logger} from '../basic/Log';


export class Environment extends VersionedData {

	constructor() {
		super();
		this.activeHosts = new Map();
		this.addSet('services');
		this.addSet('webports');
		this.methods.set('addService', this.applyAddService.bind(this));
        this.methods.set('removeService', this.applyRemoveService.bind(this));
		this.methods.set('addProvider', this.applyAddProvider.bind(this));
        this.methods.set('removeProvider', this.applyRemoveProvider.bind(this));
		this.methods.set('addWebport', this.applyAddWebport.bind(this));
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

	async init(uuid) {
		this.uuid = uuid;
		if(NVD.available() === false) {
			throw Error('NVD was not initialized');
		}
		const latestVersion = await NVD.load(uuid);
		// logger.log('info', "Latest Version: " + latestVersion);
		const rootStatement = await VersionStatement.createRoot(uuid);
		const rootVersion = await ResourcesManager.storeResourceObject(rootStatement);
		// logger.log('info', "Root version: " + JSON.stringify(rootStatement, null, 2)
		// + '=>' + rootVersion);
		if(latestVersion
		&& latestVersion !== null
		&& latestVersion !== undefined
		&& latestVersion !== rootVersion) {
			await this.revertToVersion(latestVersion);
		} else {
			//No data, start from scratch
			this.version = rootVersion;
		}
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
			logger.log('info', "this.version: " + this.version
				+ ' - their.version: ' + info.latestVersion);
			if(info.latestVersion === this.version) {
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

	async getServicesForHost(hostid) {
		var list = [];
		const services = this.elements.get('services');
		for await(const key of services) {
			const definition = await ResourcesManager.getResourceObject(key);
			// logger.info('iteration - definition: ' + JSON.stringify(definition));
			const providerListName = definition.uuid + '.providers';
			const providers = this.elements.get(providerListName);
			if(await providers.has(hostid)) {
				list.push(definition);
			}
		}
		// logger.info('getServicesForHost return with list: ' + JSON.stringify(list));
		return list;
	}

	async applyAddService(issuer, params, merge=false) {
		Utils.validateParameters(params, ['definition']);
		logger.log('info', 'applyAddService params: ' + JSON.stringify(params));
		const definition = params.definition;
		ServiceDefinition.validate(definition);
		const services = this.elements.get('services');
		if(await this.hasService(definition.uuid)) {
			if(merge) {
				const resouceKey = await ResourcesManager.generateKeyForObject(definition);
				if(await services.has(resourceKey)) {
					logger.log('info', 'applyAddService succesfuly MERGED');
					return;
				} else {
					throw Error('applyAddService MERGE FAILED: different service defined with same UUID');
				}
			} else {
				throw Error('service already defined');
			}
		}
		await this.auth(issuer);
		const resource = await ResourcesManager.storeResourceObject(definition);
		await services.add(resource);
		this.addSet(definition.uuid + '.providers');
	}

	async addService(definition) {
		const params = {definition: definition};
		await this.applyAddService(LocalHost.getID(), params);
		await this.commit({
			addService: params
		});
		NVD.save(this.uuid, this.version);
	}

    async applyRemoveService(issuer, params, merge=false) {
        Utils.validateParameters(params, ['uuid']);
		logger.debug('applyRemoveService params: ' + JSON.stringify(params));
		const uuid = params.uuid;
		const services = this.elements.get('services');
		if(await this.hasService(uuid) === false) {
			if(merge) {
				logger.log('info', 'applyRemoveService succesfuly MERGED');
			} else {
				throw Error('service does not exist');
			}
		}
		await this.auth(issuer);
		const resourceKey = await this.getServiceDefinition(uuid);
		await services.remove(resourceKey);
		this.elements.delete(uuid + '.providers');
    }

    async removeService(uuid) {
        const params = {uuid: uuid};
		await this.applyRemoveService(LocalHost.getID(), params);
		await this.commit({
			removeService: params
		});
		NVD.save(this.uuid, this.version);
    }

	async getServiceDefinition(uuid) {
		var definition;
		const services = this.elements.get('services');
		for await(const resource of services) {
			const service = await ResourcesManager.getResourceObject(resource);
			//logger.log('info', JSON.stringify(service));
			if(service.uuid === uuid) {
				return service;
			}
		}
		throw Error('service definition not found in env');
	}

	async hasService(uuid) {
		const services = this.elements.get('services');
		for await(const resourceKey of services) {
			const service = await ResourcesManager.getResourceObject(resourceKey);
			// logger.log('info', 'hasService ' + uuid + ' compare with ' + service.uuid);
			if(service.uuid === uuid) {
				return true;
			}
		}
		return false;
	}

	async getProviders(serviceUUID) {
		if(await this.hasService(serviceUUID) === false) {
			throw Error('Service ' + serviceUUID + ' is not defined in env ' + this.uuid);
		}
		const listName = serviceUUID + '.providers';
		if(this.elements.has(listName) === false) {
		    throw Error('Service '+serviceUUID+' providers list does not exist');
		}
		const providers = this.elements.get(listName);
		// logger.log('info', "provider: " + JSON.stringify(provider));
		return providers;
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
		const providers = await this.getProviders(params.uuid);
		if(await providers.has(params.host)) {
			if(merge) {
				logger.log('info', 'addProvider successfully MERGED');
			} else {
				throw Error('provider already in list');
			}
		}
		await providers.add(params.host);
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
		await NVD.save(this.uuid, this.version);
	}

    async applyRemoveProvider(issuer, params, merge=false) {
        Utils.validateParameters(params,
            ['uuid', 'host']);
        await this.auth(issuer);
        const providers = await this.getProviders(params.uuid);
        if(await providers.has(params.host) === false) {
            if(merge) {
                logger.log('info', 'addProvider successfully MERGED');
            } else {
                throw Error('provider not in list');
            }
        }
        await providers.remove(params.host);
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
        await NVD.save(this.uuid, this.version);
	}

	async getWebports(hostID) {
		var hostWebports = [];
		const envWebports = this.elements.get('webports');
		for await(const resourceKey of envWebports) {
            logger.debug('[ENV] getWebports>resourceKey: '+ resourceKey);
			const webport = await ResourcesManager.getResourceObject(resourceKey);
			// logger.log('info', 'webport info: ' + JSON.stringify(webport));
			if(webport.hostid === hostID) {
				hostWebports.push(webport);
			}
        }
		return hostWebports;
	}

	async applyAddWebport(issuer, params, merge=false) {

		Utils.validateParameters(params, ['hostid', 'protocol', 'address', 'port']);

		await this.auth(issuer);

		const webports = this.elements.get('webports');

		const resourceKey = await ResourcesManager.storeResourceObject(params);

		if(await webports.has(resourceKey)) {
			//Exact same information already present
			if(merge) {
				logger.log('info', 'addWebport successfully MERGED');
				return;
			} else {
				throw Error('webport already defined');
			}
		}

		await webports.add(resourceKey);

	}

	async addWebport(info) {

		await this.applyAddWebport(LocalHost.getID(), info);

		await this.commit({
			addWebport: info
		});

		NVD.save(this.uuid, this.version);
	}

};
