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

		await this.vdata.services.add(definition);

		this.vdata.providers[definition.uuid] = new HashLinkedTree(5);

		//Create changes "replication instructions"
		await this.commit({
			addService: definition
		});

	}

	async hasService(uuid) {

		for await(const service of this.vdata.services) {

			console.log();

			if(service.uuid === uuid) {
				return true;
			}
		}

		return false;
	}

	//Env alteration functions
	addProvider(serviceUUID, providerID) {

		//check if service exists

		//add provider to list

	}

	removeProvider(serviceUUID, providerID) {

		//

	}

};
