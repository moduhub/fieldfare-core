/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import dgram from 'dgram';

import {Transceiver} from '../../trx/Transceiver.js';
import {logger} from '../../basic/Log.js';

const minUDPPort = 10000;
const maxUDPPort = 60000;

export class UDPTransceiver extends Transceiver {

	constructor() {
		super();
		this.channelMap = new Map();
		this.socket = dgram.createSocket('udp4');
	}

	serve(pAddress, pPort) {
		if(this.port) {
			throw Error('Cannot serve more than one UDP port');
		}
		logger.log('info', 'Opening UDP port ' + pPort);
		this.port = pPort;
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
					logger.error("UDPtrx: onNewChannel callback not defined");
				}
			}
			if(assignedChannel
			&& assignedChannel.onMessageReceived) {
				var messageObject = JSON.parse(msg);
				assignedChannel.onMessageReceived(messageObject);
			} else {
				logger.error("[UDPtrx] no messageReceivedCallback defined");
			}
		});
		this.socket.on('listening', () => {
			const address = this.socket.address();
			logger.debug(`server listening ${address.address}:${address.port}`);
		});
		this.socket.bind(pPort);
	}

	newChannel(address, port) {
		const channelID = address + ":" + port;
		const assignedChannel = this.channelMap.get(channelID);
		if(assignedChannel) {
			return assignedChannel;
		} else {
			if(this.port === undefined) {
				//called without a call to serve, assign a random port
	            const udpPort = Math.floor(Math.random() * (maxUDPPort - minUDPPort) + minUDPPort);
				this.serve(null, udpPort);
			}
			var rNewChannel = {
				type: 'udp',
				send: (message) => {this.send(message, rNewChannel)},
				active: ()=>{return true;},
				info: {
					address: address,
					port: port
				}
			};
			this.channelMap.set(channelID, rNewChannel);
			return rNewChannel;
		}
	}

	send(message, channel) {
		for(const [key, value] of this.channelMap) {
			console.log('key:' + JSON.stringify(key) + '   value:' + JSON.stringify(value));
		}
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
