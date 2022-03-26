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
		
		const update = nvdata.load(uuid);
		
		const rootVersion = VersionStatement.createRoot({
			uuid: uuid
		});
		
		if(update
		&& update !== null
		&& update !== undefined) {

			//Build chain downto envRoot
			const chain = update.buildChain(rootVersion);
			
		} else {
			
			//No data, start from scratch
			this.version = await host.storeResourceObject(rootVersion);
			
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