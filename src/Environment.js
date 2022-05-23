/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

const VersionedData = require('./versioning/VersionedData.js');

const VersionStatement = require('./versioning/VersionStatement.js');

const HashLinkedTree = require('./structures/HashLinkedTree.js');

const LocalService = require('./env/LocalService.js');


module.exports = class Environment extends VersionedData {

	constructor() {
		super();

		this.activeHosts = new Map();

		this.addSet('services');
		this.addSet('webports');

		this.methods.set('addService', this.applyAddService.bind(this));
		this.methods.set('addWebport', this.applyAddWebport.bind(this));
		this.methods.set('addProvider', this.applyAddProvider.bind(this));

		//report periodically
		setInterval(() => {
			console.log("REPORT: Active hosts of env " + this.uuid + ": " + this.activeHosts.size);
			for(const [id, info] of this.activeHosts) {
				const timeDiff = Date.now() - info.lastEnvUpdate;
				console.log("HOST: " + id
					+ 'at version ' + info.latestVersion
					+ ' updated ' + timeDiff + 'ms ago.');
			}
		}, 10000);

	}

	async init(uuid) {

		this.uuid = uuid;

		if(nvdata === undefined) {
			throw 'nvdata was not initialized';
		}

		const latestVersion = await nvdata.load(uuid);
		console.log("Latest Version: " + latestVersion);

		const rootStatement = await VersionStatement.createRoot(uuid);

		const rootVersion = await host.storeResourceObject(rootStatement);

		console.log("Root version: " + JSON.stringify(rootStatement, null, 2)
		+ '=>' + rootVersion);

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
					console.log("Host went inactive: " + remoteHost.id);
					this.removeActiveHost(remoteHost.id)
				}, 10000),
				lastEnvUpdate: Date.now(),
				latestVersion: version
			}

			console.log("hostInfo: " + newInfo.remoteHostObj.id
				+ ' date: ' + newInfo.lastEnvUpdate
				+ 'at version: ' + newInfo.latestVersion);

			this.activeHosts.set(remoteHost.id, newInfo);

		}

	}

	getSyncedHosts() {
		var numSyncedHosts = 0;
		for(const [id, info] of this.activeHosts) {
			// console.log("this.version: " + this.version
			// 	+ ' - their.version: ' + info.latestVersion);
			if(info.latestVersion === this.version) {
				numSyncedHosts++;
			}
		}
		return numSyncedHosts;
	}

	async sync() {

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
						console.log("env.sync waiting for active host");
					} else {
						console.log('env.sync waiting for any of ' + this.activeHosts.size
							+ ' active hosts to sync');
					}
					if(++attempts > 10) {
						clearInterval(interval);
						reject(Error('sync timeout'));
					}
				}
			}, 1000);

		});
	}

	updateProviderState(providerID, stateHash) {

		//provider state is a versioned state structure
		var currentStateObjectHash = this.getCurrentHostState(providerID);

	}

	numActiveProviders(serviceUUID) {

		var count = 0;
		for (const [id, info] of this.activeHosts) {
			const remoteHost = info.remoteHostObj;
			if(remoteHost.hasService(serviceUUID)) {
				count++;
			}
		}
		return count;
	}

	getActiveProviders(serviceUUID, howMany=-1) {

		var activeProviders = [];

		for (const [id, info] of this.activeHosts) {
			const remoteHost = info.remoteHostObj;
			if(remoteHost.hasService(serviceUUID)) {
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

		var newProviders = [];

		//Establish new
		const providers = await this.getProviders(serviceUUID);

		for await (const providerID of providers) {
			if(this.activeHosts.has(providerID) === false) {
				try {
					const remoteHost = await host.establish(providerID);
					newProviders.push(remoteHost);
				} catch (error) {
					console.log("Failed to reach host " + providerID);
				}
			}
		}

		//throw Error('Unable to find a provider for service ' + serviceUUID);

		return newProviders;
	}

	async applyAddService(issuer, params, merge=false) {

		VersionedData.validateParameters(params, ['definition']);

		console.log('applyAddService params: ' + JSON.stringify(params));

		const definition = params.definition;

		LocalService.validate(definition);

		const services = this.elements.get('services');

		if(await this.hasService(definition.uuid)) {
			if(merge) {
				const resouceKey = await ResourcesManager.generateKeyForObject(definition);
				if(await services.has(resourceKey)) {
					console.log('applyAddService succesfuly MERGED');
					return;
				} else {
					throw Error('applyAddService MERGE FAILED: different service defined with same UUID');
				}
			} else {
				throw Error('service already defined');
			}
		}

		await this.auth(issuer);

		const resource = await host.storeResourceObject(definition);

		await services.add(resource);

		this.addSet(definition.uuid + '.providers');

	}

	async addService(definition) {

		const params = {definition: definition};

		await this.applyAddService(host.id, params);

		await this.commit({
			addService: params
		});

		nvdata.save(this.uuid, this.version);

	}

	async getServiceDefinition(uuid) {

		var definition;

		const services = this.elements.get('services');

		for await(const resource of services) {

			const service = await host.getResourceObject(resource);

			//console.log(JSON.stringify(service));

			if(service.uuid === uuid) {
				return service;
			}
		}

		throw Error('service definition not found in env');

	}

	async hasService(uuid) {

		const services = this.elements.get('services');

		for await(const resourceKey of services) {

			const service = await host.getResourceObject(resourceKey);

			// console.log('hasService ' + uuid + ' compare with ' + service.uuid);

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

		if(this.elements.has(listName) == false) {
			throw Error('Service '+serviceUUID+' providers list does not exist');
		}

		const providers = this.elements.get(listName);

		// console.log("provider: " + JSON.stringify(provider));

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

		VersionedData.validateParameters(params,
			['uuid', 'host']);

		await this.auth(issuer);

		const providers = this.getProviders(params.uuid);

		if(await providers.has(params.host)) {
			if(merge) {
				console.log('addProvider successfully MERGED');
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

		await this.applyAddProvider(host.id, params);

		await this.commit({
			addProvider: params
		});

		nvdata.save(this.uuid, this.version);

	}

	async removeProvider(serviceUUID, providerID) {

		await this.auth(host.id);

		//

	}

	async getWebport(hostID) {

		const webports = this.elements.get('webports');

		for await(const resourceKey of webports) {

			const webport = await host.getResourceObject(resourceKey);

			// console.log('webport info: ' + JSON.stringify(webport));

			if(webport.hostid === hostID) {
				return webport;
			}

		}

		return null;
	}

	async applyAddWebport(issuer, params, merge=false) {

		VersionedData.validateParameters(params, ['hostid', 'protocol', 'address', 'port']);

		await this.auth(issuer);

		const webports = this.elements.get('webports');

		const resourceKey = await host.storeResourceObject(params);

		if(await webports.has(resourceKey)) {
			//Exact same information already present
			if(merge) {
				console.log('addWebport successfully MERGED');
				return;
			} else {
				throw Error('webport already defined');
			}
		}

		await webports.add(resourceKey);

	}

	async addWebport(info) {

		await this.applyAddWebport(host.id, info);

		await this.commit({
			addWebport: info
		});

		nvdata.save(this.uuid, this.version);
	}

};
