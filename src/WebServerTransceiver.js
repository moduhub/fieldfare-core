/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

const Transceiver = require('./Transceiver.js');
const WebSocketServer  = require('websocket').server;
const http = require('http');

module.exports = class WebServerTransceiver extends Transceiver {
	
	constructor(port) {
		super();
		
		this.port = port;
		
		this.server = http.createServer((request, response) => {
			this.treatHttpRequest(request, response);
		});
				
		this.wsServer = new WebSocketServer({
			httpServer: this.server,
			// You should not use autoAcceptConnections for production
			// applications, as it defeats all standard cross-origin protection
			// facilities built into the protocol and the browser.  You should
			// *always* verify the connection's origin and decide whether or not
			// to accept it.
			autoAcceptConnections: false
		});
		
		this.wsServer.on('request', (request) => {
			
			console.log("wsServer onRequest");
			
			this.treatWsRequest(request);
		});
	}
	
	open() {
		
		this.server.listen(this.port, () => {
			console.log((new Date()) + ' WS Server is listening on port ' + this.port);
		});
		
	}
	
	treatHttpRequest(request, response) {
		
		console.log((new Date()) + ' Received request for ' + request.url);
		response.writeHead(404);
		response.end();
		
	}
	
	originIsAllowed(origin) {
		return true;
	}
	
	treatWsRequest(request) {
	
		console.log("Entered treatWsRequest");
	
		if (!this.originIsAllowed(request.origin)) {
			// Make sure we only accept requests from an allowed origin
			request.reject();
			console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
			return;
		}
    
		//Create new channel for this destination
		try {
			
			var connection = request.accept('mhnet', request.origin);
			console.log((new Date()) + ' Connection from ' + request.origin + 'accepted.');
			
			var newChannel = {
				type: 'wsServer',
				send: (message) => {
					var stringifiedMessage = JSON.stringify(message);
					connection.send(stringifiedMessage);
				},
				info: {
					origin: request.origin,
					connection: connection
				}
			};
			
			newChannel.onMessageReceived = (message) => {
				console.log("WS connection callback undefined. Message droped: " + message);
			}
			
			connection.on('message', (message) => {

				if (message.type === 'utf8') {
					
					if(newChannel.onMessageReceived) {

						try {
							console.log('WS: Message from client: ' + message.utf8Data);

							var messageObject = JSON.parse(message.utf8Data);

							newChannel.onMessageReceived(messageObject);	
							
						} catch (error) {
							
							console.log("Failed to treat WS message: " + error);
							
						}

					}
					
				} else {
					
					throw 'invalide message format';
					
				}
				
			});

			connection.on('close', function(reasonCode, description) {
				console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
			});
			
			if(this.onNewChannel) {
				this.onNewChannel(newChannel);
			}
			
		} catch (error) {
			
			console.log("Failed to accept connection: " + error);
			
		}
	}
};