/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

const dgram = require('dgram');
const Transceiver = require('./Transceiver.js');
const Utils = require('./Utils.js');


module.exports = class UDPTransceiver extends Transceiver {
	
	constructor(port) {
		super();
		
		this.socket = dgram.createSocket('udp4');
		
		this.socket.on('error', (err) => {
			console.log(`server error:\n${err.stack}`);
			this.socket.close();
		});

		this.socket.on('message', (msg, rinfo) => {
  
			console.log('Message from ' + rinfo.address + ':' + rinfo.port);
			console.log('Lenght: ' + msg.length + ' bytes');
  
			if(this.messageReceivedCallback) {
				
				var channel = {	type : 'udp',
						send : (message) => { this.send(message, channel)},
						info : rinfo};
				
				//Translate binary to JSON
				// ...
				
				this.messageReceivedCallback(msg, channel);
			}
  
		});

		this.socket.on('listening', () => {
			const address = this.socket.address();
			console.log(`server listening ${address.address}:${address.port}`);
		});
	
		this.socket.bind(port);
	}
	
	newChannel(address, port) {
		
		var rNewChannel = {
			type: 'udp',
			send: (message) => {this.send(message, rNewChannel)},
			info: {
				address: address,
				port: port
			}
		};	
		
		return rNewChannel;
	}
	
	onMessageReceived(callback) {
		this.messageReceivedCallback = callback;
	}
	
	send(message, channel) {
		
		console.log("Message object: " + JSON.stringify(message));
		
		var messageBuffer = message.toBuffer();
		
		console.log('UDPTrx.send ' + messageBuffer.length + ' bytes to '
			+ channel.info.address + ':'
			+ channel.info.port);
		
		console.log("Message binary: " + Utils.ab2hex(messageBuffer));
		
		this.socket.send(messageBuffer,
				channel.info.port,
				channel.info.address);
	}
}