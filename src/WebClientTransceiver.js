/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

const Transceiver = require('./Transceiver.js');

module.exports = class WebClientTransceiver extends Transceiver {

	constructor() {
		super();


	}

	newChannel(address, port) {

		return new Promise((resolve, reject) => {

			// Create WebSocket connection.
			const socket = new WebSocket(address + ':' + port, 'mhnet');

			var rNewChannel = {
				type: 'wsClient',
				send: (message) => {
					var stringifiedMessage = JSON.stringify(message, message.jsonReplacer);
					//console.log("calling ws socket send, with message: " + stringifiedMessage);
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

					//console.log('WS: Message from server: ' + message);

					try {
						//Convert to object
						var messageObject = JSON.parse(message);

						rNewChannel.onMessageReceived(messageObject);

					} catch (error) {
						console.log("Failed to parse message: " + error);
					}

				}

			});

			rNewChannel.onMessageReceived = (message) => {
				console.log('WS channel onMessageReceived: no message parser assigned, discarding');
			};

			// Connection opened
			socket.addEventListener('open', (event) => {

				console.log('WebSocket client opened: ' + event);
				resolve(rNewChannel);

			});

			socket.addEventListener('error', (event) => {

				console.log('WebSocket client error!');
				reject(event);

			});

		});
	}

};
