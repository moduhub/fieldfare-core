/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */


const HostManager = require('../src/HostManager.js');
const UDPTransceiver = require('../src/UDPTransceiver.js');

try {
	
	//Host with specific key
	//var host = new HostManager(Buffer.from('30740201010420f483cacb5cfeb6caaa5c05991c6b01acca76591ab4f909ec5930c129e36509a5a00706052b8104000aa144034200040f49350dcc1951db5d521615ed4ffb3f58e9b45824569b0530b9cfa41b0290cc169c2a8af515fd4f8c3d71af27db573608d50599cd714e6c3787c021f6f7cef6', 'hex'));

	//Host with random key
	var host = new HostManager();
	
	var transceiver = new UDPTransceiver(15001);

	transceiver.onMessageReceived((message, channel) => {
	
		host.parse(message, channel);
	
	});
		
	setInterval(() => {
		console.log("Host is announcing");
		host.announce();
	}, 10000);
	
} catch(error) {

	console.log('fatal error:' + error);

}

