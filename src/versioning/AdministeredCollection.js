import { VersionedCollection } from "./VersionedCollection";
import { LocalHost } from "../env/LocalHost";
import { Chunk } from "../chunking/Chunk";
import { Utils } from "../basic/Utils";
import { NVD } from "../basic/NVD";
import { logger } from "../basic/Log";


export class AdministeredCollection extends VersionedCollection {

    constructor() {
        super();
        this.methods.set('addAdmin', this.applyAddAdmin.bind(this));
        this.methods.set('removeAdmin', this.applyRemoveAdmin.bind(this));
    }

    async auth(id, strict=false) {
		console.log('auth> ' + JSON.stringify(id));
		const hostChunk = Chunk.fromIdentifier(id, id);
		const admins = await this.getElement('admins');
		console.log(admins);
		if(admins) {
			console.log('admins is empty? ' + await admins.isEmpty());
		}
		if(admins == undefined
		|| await admins.isEmpty()) {
			if(strict) {
				throw Error('strict auth failed, no admins defined');
			}
		} else {
			console.log('current admins:')
			for await (const chunk of admins) {
				console.log('>> ' + chunk.id);
			}
			if(await admins.has(hostChunk) === false) {
				throw Error('not authorized');
			}
		}
		logger.debug('>> ' + id + ' auth OK');
	}

	async applyAddAdmin(issuer, params, merge=false) {
		logger.debug("applyAddAdmin params: " + JSON.stringify(params));
		Utils.validateParameters(params, ['id']);
		const newAdminChunk = Chunk.fromIdentifier(params.id, params.id);
		const admins = await this.getElement('admins');
		if(!admins) {
			throw Error('admins groups does not exist');
		}
		logger.log('info', "Current admins: ");
		for await (const admin of admins) {
			logger.log('info', '> ' + admin);
		}
		//Check if admin was not already present
		if(await admins.has(newAdminChunk)) {
			if(merge) {
				logger.log('info', 'applyAddAdmin successfully MERGED');
				return;
			} else {
				throw Error('applyAddAdmin failed: id already in set');
			}
		}
		//Check auth, non strict
		await this.auth(issuer, false);
		//Perform local changes
		await admins.add(newAdminChunk);
	}

	async addAdmin(newAdminID) {
		const params = {id: newAdminID};
		//newAdmin must be a valid host ID
		const admins = await this.getElement('admins');
		if(!admins) {
			await this.createElement('admins', {
				type: 'set',
				degree: 5,
				root: null
			});
		}
		logger.log('info', "VersionedData.addAdmin ID="+newAdminID);
		await this.applyAddAdmin(LocalHost.getID(), params);
		await this.commit({
			addAdmin: params
		});
		await NVD.save(this.uuid, this.versionIdentifier);
	}

	async applyRemoveAdmin(issuer, params, merge=false) {
		logger.debug("applyRemoveAdmin params: " + JSON.stringify(params));
		Utils.validateParameters(params, ['id']);
		const adminID = params.id;
		ChunkingUtils.validateIdentifier(adminID);
		const admins = this.elements.get('admins');
		if(await admins.has(adminID)===false) {
			if(merge) {
				logger.debug('applyRemoveAdmin successfully MERGED');
				return;
			} else {
				throw Error('applyRemoveAdmin failed: id not in set');
			}
		}
		//Check auth, non strict
		await this.auth(issuer, false);
		//Perform local changes
		await admins.remove(adminID);
	}

	async removeAdmin(adminID) {
		const params = {id: adminID};
		logger.log('info', "VersionedData.removeAdmin ID="+adminID);
		await this.applyRemoveAdmin(LocalHost.getID(), params);
		await this.commit({
			removeAdmin: params
		});
		await NVD.save(this.uuid, this.versionIdentifier);
	}

}