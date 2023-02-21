import { VersionedCollection } from "./VersionedCollection";
import { LocalHost } from "../env/LocalHost";
import { Chunk } from "../chunking/Chunk";
import { Utils } from "../basic/Utils";
import { NVD } from "../basic/NVD";
import { logger } from "../basic/Log";
import { HostIdentifier } from "../env/HostIdentifier";


export class AdministeredCollection extends VersionedCollection {

    constructor(uuid) {
        super(uuid);
        this.methods.set('addAdmin', this.applyAddAdmin.bind(this));
        this.methods.set('removeAdmin', this.applyRemoveAdmin.bind(this));
    }

    async auth(hostIdentifier, strict=false) {
		const chunkIdentifier = HostIdentifier.toChunkIdentifier(hostIdentifier);
		const hostChunk = Chunk.fromIdentifier(chunkIdentifier, hostIdentifier);
		const admins = await this.getElement('admins');
		// console.log(admins);
		// if(admins) {
		// 	console.log('admins is empty? ' + await admins.isEmpty());
		// }
		if(admins == undefined
		|| await admins.isEmpty()) {
			if(strict) {
				throw Error('strict auth failed, no admins defined');
			}
		} else {
			if(await admins.has(hostChunk) === false) {
				throw Error('not authorized');
			}
		}
	}

	async applyAddAdmin(issuer, params, merge=false) {
		Utils.validateParameters(params, ['id']);
		const hostIdentifier = params.id;
		const chunkIdentifier = HostIdentifier.toChunkIdentifier(hostIdentifier);
		const newAdminChunk = Chunk.fromIdentifier(chunkIdentifier, hostIdentifier);
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
		await this.updateElement('admins', admins.descriptor);
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
		await this.applyAddAdmin(LocalHost.getID(), params);
		await this.commit({
			addAdmin: params
		});
		await NVD.save(this.uuid, this.versionIdentifier);
	}

	async applyRemoveAdmin(issuer, params, merge=false) {
		Utils.validateParameters(params, ['id']);
		const adminIdentifier = params.id;
		const chunkIdentifier = HostIdentifier.toChunkIdentifier(adminIdentifier);
		const adminChunk = Chunk.fromIdentifier(chunkIdentifier);
		const admins = await this.getElement('admins');
		if(await admins.has(adminChunk)===false) {
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
		await admins.delete(adminChunk);
		await this.updateElement('admins', admins.descriptor);
	}

	async removeAdmin(adminID) {
		const params = {id: adminID};
		await this.applyRemoveAdmin(LocalHost.getID(), params);
		await this.commit({
			removeAdmin: params
		});
		await NVD.save(this.uuid, this.versionIdentifier);
	}

}