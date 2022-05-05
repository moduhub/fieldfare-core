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

		this.addSet('services');
		this.addSet('webports');

		this.methods.set('addService', this.applyAddService.bind(this));

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

		host.environment = this;

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

	async addProvider(serviceUUID, providerID) {

		await this.auth(host.id);

		const providers = this.getProviders(serviceUUID);

		if(await providers.has(providerID)) {
			throw 'provider already in list';
		}

		await providers.add(providerID);

		await this.commit({
			addProvider: {
				service: serviceUUID,
				host: providerID
			}
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

	async setWebport(hostID, info) {

		this.auth(host.id);

		//validate info
		if('protocol' in info === false) throw 'missing webport protocol';
		if('address' in info === false) throw 'missing webport address';
		if('port' in info === false) throw 'missing webport number';

		const webport = {
			hostid: hostID,
			protocol: info.protocol,
			address: info.address,
			port: info.port
		}

		const resourceKey = await host.storeResourceObject(webport);

		const webports = this.elements.get('webports');

		if(await webports.has(resourceKey) === false) {

			//Exact same information already present
			await webports.add(webport);

			await this.commit({
				setWebport: resourceKey
			});
		}

		return resourceKey;
	}

};
