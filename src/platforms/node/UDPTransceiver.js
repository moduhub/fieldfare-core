/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

const dgram = require('dgram');

import {Transceiver} from '../../trx/Transceiver';
import {Utils} from '../../basic/Utils';
import {logger} from '../../basic/Log';


export class UDPTransceiver extends Transceiver {

	constructor(port) {
		super();

		this.channelMap = new Map();

		this.socket = dgram.createSocket('udp4');

		this.socket.on('error', (err) => {
			logger.debug(`server error:\n${err.stack}`);
			this.socket.close();
		});

		this.socket.on('message', (msg, rinfo) => {

  			logger.debug('[UDPTRX] Message from ' + rinfo.address + ':' + rinfo.port
				+ ' (Lenght: ' + msg.length + ' bytes)');

			const channelID = rinfo.address + ":" + rinfo.port;

			logger.log('info', "ChannelID: " + channelID);

			var assignedChannel;

			//Check if channel is already registered
			if(this.channelMap.has(channelID)) {

				assignedChannel = this.channelMap.get(channelID);

			} else {

				//new channel
				if(this.onNewChannel) {

					assignedChannel = {
						type : 'udp',
						send : (message) => { this.send(message, assignedChannel);},
						active: () => {return true;},
						info : {
							address: rinfo.address,
							port: rinfo.port
						}
					};

					this.channelMap.set(channelID, assignedChannel);

					this.onNewChannel(assignedChannel);

				} else {

					logger.error("UDPtrx: onNewChannelCallback not defined");

				}
			}

			if(assignedChannel
			&& assignedChannel.onMessageReceived) {

				var messageObject = JSON.parse(msg);

				assignedChannel.onMessageReceived(messageObject);

			} else {

				logger.error("UDPtrx: no messageReceivedCallback defined");

			}

		});

		this.socket.on('listening', () => {
			const address = this.socket.address();
			logger.debug(`server listening ${address.address}:${address.port}`);
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

		// logger.debug("[UDPTRX] outgoing message: " + JSON.stringify(message, message.jsonReplacer));

		var messageBuffer = JSON.stringify(message, message.jsonReplacer);//message.toBuffer();

		logger.debug('UDPTRX.send ' + messageBuffer.length + ' bytes to '
			+ channel.info.address + ':'
			+ channel.info.port);

		//logger.log('info', "Message binary: " + Utils.ab2hex(messageBuffer));

		this.socket.send(messageBuffer,
				channel.info.port,
				channel.info.address);
	}
}
