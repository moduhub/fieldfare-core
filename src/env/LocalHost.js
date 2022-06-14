/*
 * To change localHost license header, choose License Headers in Project Properties.
 * To change localHost template file, choose Tools | Templates
 * and open the template in the editor.
 */

import {ResourcesManager} from '../resources/ResourcesManager';
import {LocalService} from './LocalService';
import {RemoteHost} from './RemoteHost';
import {Message} from '../trx/Message';
import {Request} from '../trx/Request';
import {Utils} from '../basic/Utils';
import {logger} from '../basic/Log';

export const localHost = {
	bootChannels: new Set(),
	resourcesManagers: new Set(),
	remoteHosts: new Map(),
	requests: new Map(),
	services: new Map(),
	environments: new Set(),
	stateHash: ''
};

export const LocalHost = {

	getID() {
		return localHost.id;
	},

	async init(privateKeyData) {

		if(ResourcesManager.available() === false) {
			throw Error('Cannot setup ID without a resources manager');
		}

		let pubKeyData;

		if(privateKeyData) {

			localHost.privateKey = await crypto.subtle.importKey(
				'jwk',
				privateKeyData,
				{
					name:'ECDSA',
					namedCurve: 'P-256'
				},
				false,
				['sign']
			);

			pubKeyData = {
				kty: "EC",
				use: "sig",
				crv: "P-256",
				kid: privateKeyData.kid,
				x: privateKeyData.x,
				y: privateKeyData.y,
				alg: "ES256"
			};

		} else {

			const keypair = await crypto.subtle.generateKey(
				{
					name: "ECDSA",
					namedCurve: "P-256"
				},
				true,
				["sign"]
			);

			localHost.privateKey = keypair.privateKey;

			pubKeyData = await crypto.subtle.exportKey('jwk', keypair.publicKey);

		}

		// logger.log('info', 'host pubkey data: ' + JSON.stringify(pubKeyData));

		//Calculate host ID from pubkey
		//var hash = new Uint8Array(await crypto.subtle.digest('SHA-256', pubKeyData));

		localHost.id = await ResourcesManager.storeResourceObject(pubKeyData);

		// logger.log('info', 'HOST ID: ' + localHost.id);

		setInterval(() => {

			// logger.log('info', "Host is announcing to "
			// 	+ localHost.remoteHosts.size + " remote hosts and "
			// 	+ localHost.bootChannels.size + ' boot channels');

			for (const [id,host] of localHost.remoteHosts) 		LocalHost.announce(host);
			for (const channel of localHost.bootChannels) 	LocalHost.announce(channel);

		}, 10000);

	},

	getPendingRequest() {
		return localHost.requests.get(hash);
	},

	addEnvironment(env) {

		if(localHost.environments.has(env) === false) {
			localHost.environments.add(env);
			logger.log('info', 'New env registered: ' + env.uuid);
		} else {
			logger.warn('Env already registered ' + env.uuid);
		}

	},

	async setupService(definition) {

		var newService = LocalService.fromDefinition(definition);

		//Register service under host mapping
		localHost.services.set(definition.uuid, newService);

		//recover last service state
        const stateKey = definition.uuid;
        const serviceState = await NVD.load(stateKey);

		if(serviceState) {
			newService.setState(serviceState);
		} else {
            logger.log('info', "Service state is null, localHost can be a first setup");
        }

		return newService;
	},

	getLocalService(uuid) {
		return localHost.services.get(uuid);
	},

	updateState() {

		var hostState = new Object;

		for(const [uuid, service] of localHost.services) {

			// const serviceName = service.definition.name;
			const serviceState = service.updateState();

			hostState[uuid] = serviceState;

		}

		return hostState;
	},

	async registerRemoteHost(hostid) {

		var remoteHost = localHost.remoteHosts.get(hostid);

		//Check if host exists
		if(remoteHost === undefined) {

			remoteHost = new RemoteHost(hostid);
			localHost.remoteHosts.set(hostid, remoteHost);

			for(const env of localHost.environments) {
				const servicesList = await env.getServicesForHost(hostid);
				if(servicesList.length > 0) {
					await remoteHost.updateServices(servicesList);
				} else {
					logger.log('info', 'no services assigned to host ' + hostid);
				}
			}

		}

		return remoteHost;
	},

	getEnvironment(uuid) {

		for(const env of localHost.environments) {

			if(env.uuid === uuid) {
				return env;
			}
		}

		return null;
	},

	onNewRequest(request) {

		//logger.log('info', "Forwarding request to request.destination")

		var destinationHost = localHost.remoteHosts.get(request.destination);

		if(destinationHost != undefined) {

			request.source = localHost.id;

			destinationHost.send(request);

		} else {

			throw Error('Destination is unknown');

			//TODO: routing here
		}

	},

	async bootChannel(channel) {

		localHost.bootChannels.add(channel);

		channel.onMessageReceived = async (message) => {

			//logger.debug("Received message from boot channel: " + JSON.stringify(message));

			if(message.service === 'announce') {

//				logger.log('info', "message.source: " + message.source);
//				logger.log('info', "message.destination: " + message.destination);

				// Reject indirect announce in boot channel
//				if(!message.hasOwnProperty('source')
//				&& !message.hasOwnProperty('destination')) {

					var remoteId = message.data.id;

					// logger.log('info', "Received direct announce from boot channel. Host ID: " + remoteId);

					var remoteHost = localHost.remoteHosts.get(remoteId);

					//register channel to remote host
					if(remoteHost === undefined) {

						// logger.log('info', "Host was not registered. Creating new... ");

						remoteHost = await LocalHost.registerRemoteHost(remoteId);

					}

					remoteHost.assignChannel(channel);

					channel.onMessageReceived(message);

					//remove localHost channel from boot list
					localHost.bootChannels.clear(channel);

//				} else {
//
//					logger.log('info', "Message is not direct, reject from boot channel:" + JSON.stringify(message));
//				}

			} else {
				// logger.log('info', "Message service not announce! Service: " + message.service);
			}

		};

		//no source nor destination address, direct message
		try {

			LocalHost.announce(channel);

		} catch (error) {

			throw Error('Host.bootChannel.send() failed', {cause:error});

		}

	},

	async signMessage(message) {

		if(localHost.privateKey === undefined) {
			throw Error('failed to sign message, private key undefined');
		}

		var utf8ArrayBuffer = Utils.strToUtf8Array(JSON.stringify(message.data));

		var signatureBuffer = await crypto.subtle.sign(
			{
				name: "ECDSA",
				hash: {name: "SHA-256"}
			},
			localHost.privateKey,
			utf8ArrayBuffer);

//		logger.log('info', "Correct Message signature: " + Utils.arrayBufferToBase64(signatureBuffer));
//
//		var bufview = new Uint8Array(signatureBuffer);
//		bufview[1] = 0;

		message.signature = Utils.arrayBufferToBase64(signatureBuffer);

//		logger.log('info', "Message signature added: " + message.signature);
	},

	async announce(destination) {

		if(!destination) {
			throw Error('destination not defined');
		}

		var envVersionGroup;

		if(localHost.environments.size > 0) {
			envVersionGroup = {};
			for(const env of localHost.environments) {
				envVersionGroup[env.uuid] = env.version;
			}
		}

		var message = new Message('announce', {
			id: localHost.id,
			env: envVersionGroup,
			state: LocalHost.updateState()
		});

		await LocalHost.signMessage(message);

		message.setSourceAddress(localHost.id);

		if(typeof (destination.send) === 'function') {
			return destination.send(message);
		}

		throw Error('destination ' + JSON.stringify(destination) + ' not send-able');

	},

	async establish(remoteHostID) {

		logger.debug("host.establish: " + remoteHostID);

		const remoteHost = localHost.remoteHosts.get(snapshotProviderID);

		if(remoteHost === undefined
		|| remoteHost === null
		|| remoteHost.isActive() === false) {

			// //attemp connection to webport assigned to localHost host
			// const webport = await env.getWebport(snapshotProviderID);
			//
			// await host.connectWebport(webport);
			//
			throw Error('function not implemented');

		}

		logger.log('info', "Remote host " + snapshotProviderID + " is active");

		return remoteHost;
	}

}
