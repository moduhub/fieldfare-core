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

		this.vdata.services = new HashLinkedTree(5);

		this.vdata.webports = new HashLinkedTree(5);

		this.vdata.providers = {};

	}

	async init(uuid) {

		if(nvdata === undefined) {
			throw 'nvdata was not initialized';
		}

		const latestVersion = await nvdata.load(uuid);

		const rootStatement = VersionStatement.createRoot({
			uuid: uuid
		});

		const rootVersion = await host.storeResourceObject(rootStatement);

		console.log("Latest Version: " + latestVersion);

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

			console.log("Root version: " + this.version);

		}

	}

	updateProviderState(providerID, stateHash) {

		//provider state is a versioned state strucutre
		var currentStateObjectHash = this.getCurrentHostState(providerID);

	}

	async addService(definition) {

		Service.validate(definition);

		if(await this.hasService(definition.uuid)) {
			throw 'service already defined';
		}

		await this.auth();

		const resource = await host.storeResourceObject(definition);

		await this.vdata.services.add(resource);

		this.vdata.providers[definition.uuid] = new HashLinkedTree(5);

		//Create changes "replication instructions"
		await this.commit({
			addService: definition
		});

	}

	async getService(uuid) {

		var definition;

		for await(const resource of this.vdata.services) {

			const service = await host.getResourceObject(resource);

			console.log(JSON.stringify(service));

			if(service.uuid === uuid) {
				return service;
			}
		}

		throw 'service definition not found in env';

	}

	async hasService(uuid) {

		for await(const service of this.vdata.services) {

			if(service.uuid === uuid) {
				return true;
			}
		}

		return false;
	}

	getProviders(serviceUUID) {

		const provider = this.vdata.providers[serviceUUID];

		// console.log("provider: " + JSON.stringify(provider));

		return provider;
	}

	//Env alteration functions
	async addProvider(serviceUUID, providerID) {

		await this.auth();

		//check if service exists

		//add provider to list

	}

	async removeProvider(serviceUUID, providerID) {

		await this.auth();

		//

	}

	async getWebport(hostID) {

		for await(const resource of this.vdata.webports) {

			console.log('webport info: ' + JSON.stringfy(webport));

			const webport = await host.getResourceObject(resource);

			if(webport.hostid === hostID) {
				return webport;
			}

		}

		return null;
	}

	async setWebport(hostID, info) {

		this.auth();

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

		if(await this.vdata.has(resourceKey) === false) {

			//Exact same information already present
			const resource = await this.vdata.add(webport);

			await this.commit({
				setWebport: resourceKey
			});
		}

		return resource;
	}

};
