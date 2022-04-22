/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

const dgram = require('dgram');
const Transceiver = require('./Transceiver.js');
const Utils = require('./basic/Utils.js');


module.exports = class UDPTransceiver extends Transceiver {

	constructor(port) {
		super();

		this.channelMap = new Map();

		this.socket = dgram.createSocket('udp4');

		this.socket.on('error', (err) => {
			console.log(`server error:\n${err.stack}`);
			this.socket.close();
		});

		this.socket.on('message', (msg, rinfo) => {

  			console.log('Message from ' + rinfo.address + ':' + rinfo.port);
			console.log('Lenght: ' + msg.length + ' bytes');

			const channelID = rinfo.address + ":" + rinfo.port;

			console.log("ChannelID: " + channelID);

			var assignedChannel;

			//Check if channel is already registered
			if(this.channelMap.has(channelID)) {

				assignedChannel = this.channelMap.get(channelID);

			} else {

				//new channel
				if(this.onNewChannel) {

					assignedChannel = {
						type : 'udp',
						send : (message) => { this.send(message, assignedChannel)},
						info : {
							address: rinfo.address,
							port: rinfo.port
						}
					};

					this.channelMap.set(channelID, assignedChannel);

					this.onNewChannel(assignedChannel);

				} else {

					console.error("UDPtrx: onNewChannelCallbck not defined");

				}
			}

			if(assignedChannel
			&& assignedChannel.onMessageReceived) {

				var messageObject = JSON.parse(msg);

				assignedChannel.onMessageReceived(messageObject);

			} else {

				console.error("UDPtrx: no messageReceivedCallback defined");

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

	send(message, channel) {

		console.log("Message object: " + JSON.stringify(message, message.jsonReplacer));

		var messageBuffer = JSON.stringify(message, message.jsonReplacer);//message.toBuffer();

		console.log('UDPTrx.send ' + messageBuffer.length + ' bytes to '
			+ channel.info.address + ':'
			+ channel.info.port);

		//console.log("Message binary: " + Utils.ab2hex(messageBuffer));

		this.socket.send(messageBuffer,
				channel.info.port,
				channel.info.address);
	}
}
