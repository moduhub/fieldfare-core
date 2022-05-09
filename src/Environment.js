/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

const VersionedData = require('./versioning/VersionedData.js');

const VersionStatement = require('./versioning/VersionStatement.js');

const HashLinkedTree = require('./structures/HashLinkedTree.js');

const Service = require('./env/Service.js');


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

			const latestStatement = await VersionStatement.fromResource(latestVersion);

			//Build chain downto env root
			const chain = latestStatement.buildChain(rootVersion);

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

	async sync() {

		//Collect a certain number of announces from environment members

		// return new Promise((resolve, reject) => {
		// 	setTimeout(() => {
		// 		resolve()
		// 	}, 1000);
		// });

	}

	updateProviderState(providerID, stateHash) {

		//provider state is a versioned state strucutre
		var currentStateObjectHash = this.getCurrentHostState(providerID);

	}

	async applyAddService(issuer, params) {

		const definition = params;

		Service.validate(definition);

		if(await this.hasService(definition.uuid)) {
			throw 'service already defined';
		}

		await this.auth(issuer);

		const resource = await host.storeResourceObject(definition);

		const services = this.elements.get('services');

		await services.add(resource);

		this.addSet(definition.uuid + '.providers');

	}

	async addService(definition) {

		await this.applyAddService(host.id, definition);

		await this.commit({
			addService: definition
		});

	}

	async getService(uuid) {

		var definition;

		const services = this.elements.get('services');

		for await(const resource of services) {

			const service = await host.getResourceObject(resource);

			//console.log(JSON.stringify(service));

			if(service.uuid === uuid) {
				return service;
			}
		}

		throw 'service definition not found in env';

	}

	async hasService(uuid) {

		const services = this.elements.get('services');

		for await(const service of services) {

			if(service.uuid === uuid) {
				return true;
			}
		}

		return false;
	}

	getProviders(serviceUUID) {

		const providers = this.elements.get(serviceUUID + '.providers');

		// console.log("provider: " + JSON.stringify(provider));

		return providers;
	}

	async isProvider(hostID, serviceUUID) {

		const providers = this.getProviders(serviceUUID);

		if(providers
		&& providers !== undefined
		&& providers !== null) {

			return providers.has(hostID);

		}

		return false;
	}

	async applyAddProvider(issuer, params) {

		VersionedData.validateParameters(params,
			['uuid', 'host']);

		await this.auth(issuer);

		const providers = this.getProviders(params.uuid);

		if(await providers.has(params.host)) {
			throw Error('provider already in list');
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

	}

	async removeProvider(serviceUUID, providerID) {

		await this.auth(host.id);

		//

	}

	async getWebport(hostID) {

		const webports = this.elements.get('webports');

		for await(const resource of webports) {

			console.log('webport info: ' + JSON.stringfy(webport));

			const webport = await host.getResourceObject(resource);

			if(webport.hostid === hostID) {
				return webport;
			}

		}

		return null;
	}

	async applyAddWebport(issuer, params) {

		await this.auth(issuer);

		//validate params
		if('hostid' in params === false) throw 'missing webport hostid';
		if('protocol' in params === false) throw 'missing webport protocol';
		if('address' in params === false) throw 'missing webport address';
		if('port' in params === false) throw 'missing webport number';

		const webports = this.elements.get('webports');

		const resourceKey = await host.storeResourceObject(params);

		if(await webports.has(resourceKey)) {
			//Exact same information already present
			throw Error('webport already defined');
		}

		await webports.add(resourceKey);

	}

	async addWebport(info) {

		await this.applyAddWebport(host.id, info);

		await this.commit({
			addWebport: info
		});

	}

};
