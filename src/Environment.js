/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

const VersionedData = require('./VersionControl/VersionedData.js');

const VersionStatement = require('./VersionControl/VersionStatement.js');


module.exports = class Environment extends VersionedData {

	constructor() {
		super();
		
		//this.uuid = uuid;
		
		this.services = '';
		
		this.providers = '';
		
	}
	
	async init(uuid) {
		
		if(nvdata === undefined) {
			throw 'nvdata was not initialized';
		}
		
		const latestVersion = nvdata.load(uuid);
		
		const rootStatement = VersionStatement.createRoot({
			uuid: uuid
		});
		
		if(latestVersion
		&& latestVersion !== null
		&& latestVersion !== undefined) {

			const latestStatement = host.getResourceObject(latestVersion);

			//Build chain downto envRoot
			const chain = latestStatement.buildChain(rootStatement);
			
		} else {
			
			//No data, start from scratch
			this.version = await host.storeResourceObject(rootStatement);
			
			console.log("Root version: " + this.version);
			
		}
		//UpdateMessage.validate(update);?
				
	
	}
		
	updateProviderState(providerID, stateHash) {
		
		//provider state is a versioned state strucutre
		var currentStateObjectHash = this.getCurrentHostState(providerID);

	}
	
	addService(definition) {
		
		//
		
	}
	
	//Env alteration functions
	addServiceProvider(serviceName, providerID) {
		
		//check if service exists
		
		//add provider to list
		
	}
	
	removeServiceProvider(serviceName, providerID) {
		
		//
		
	}
	
};