/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */


module.exports = class Environment {

	constructor() {
		
		this.lastHash = '';
		
		this.admins = new Set();
		
		this.services = new Set();
		
		this.states = new Map();
		
	}
	
	init(envRoot) {
		
		console.log("Init environment from root:" + JSON.stringify(envRoot));
		
		//Store all admins
		envRoot.admins.forEach((hostid) => {
			
			if(hostid != host.id) {
				
				var newHost = host.registerRemoteHost(hostid);
				
				this.admins.add(newHost);
				
			} else {
				
				console.log("heh, found meeself in admin list");
				
			}
			
		});
		
		//Update env from remote hosts data
	}
		
	sync(newEnvState) {
		
		//env stat deppends on a group of versioned sets
		
	}
		
	updateProviderState(providerID, stateHash) {
		
		//provider state is a versioned state strucutre
		var currentStateObjectHash = this.getCurrentHostState(providerID);

	}
	
	//Env alteration functions
	addServiceProvider(serviceName, providerID) {
		
		//
		
	}
	
	removeServiceProvider(serviceName, providerID) {
		
		//
		
	}
	
};