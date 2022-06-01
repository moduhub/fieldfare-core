/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

import {Transceiver} from './Transceiver';
import {logger} from './basic/Log';

export class WebClientTransceiver extends Transceiver {

	constructor() {
		super();


	}

	newChannel(address, port) {

		return new Promise((resolve, reject) => {

			// Create WebSocket connection.
			 const socket = new WebSocket('ws://' + address + ':' + port, 'mhnet');

			var rNewChannel = {
				type: 'wsClient',
				send: (message) => {
					var stringifiedMessage = JSON.stringify(message, message.jsonReplacer);
					//logger.log('info', "calling ws socket send, with message: " + stringifiedMessage);
					socket.send(stringifiedMessage);
				},
				info: {
					socket: socket
				}
			}

			// Listen for messages
			socket.addEventListener('message', (event) => {

				var message = event.data;

				if(rNewChannel.onMessageReceived) {

					//logger.log('info', 'WS: Message from server: ' + message);

					try {
						//Convert to object
						var messageObject = JSON.parse(message);

						rNewChannel.onMessageReceived(messageObject);

					} catch (error) {
						logger.log('info', "Failed to parse message: " + error);
					}

				}

			});

			rNewChannel.onMessageReceived = (message) => {
				logger.log('info', 'WS channel onMessageReceived: no message parser assigned, discarding');
			};

			// Connection opened
			socket.addEventListener('open', (event) => {

				logger.log('info', 'WebSocket client opened: ' + JSON.stringify(event));
				resolve(rNewChannel);

			});

			socket.addEventListener('error', (event) => {

				logger.log('info', 'WebSocket client error!');
				reject(JSON.stringify(event));

			});

		});
	}

};
