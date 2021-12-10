/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */


module.exports = class RemoteHost {

	constructor(id) {
		this.id = id;
		this.channels = [];
	}
	
	send(message) {
		
		if(this.id == 'undefined') {
			throw 'undefined remote host address';
		}
		
		message.setDestinationAddress(this.id);
		
		this.channels.forEach((channel) => {
			
			console.log("Dispatching message to "
				+ channel.info.address
				+ ':'
				+ channel.info.port);
			
			channel.send(message);
		});
		
	}
};
