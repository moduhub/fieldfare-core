/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import { VersionedCollection } from "./VersionedCollection.js";
import { Chunk } from "../chunking/Chunk.js";
import { HostIdentifier } from "../env/HostIdentifier.js";
import { Change } from "./Change.js";

export class AdministeredCollection extends VersionedCollection {

    constructor(uuid) {
        super(uuid);
        this.allowedChanges.add(['addAdmin', 'removeAdmin']);
    }

    async isAdmin(hostIdentifier) {
		const chunkIdentifier = HostIdentifier.toChunkIdentifier(hostIdentifier);
		const hostChunk = Chunk.fromIdentifier(chunkIdentifier, hostIdentifier);
		const admins = await this.getElement('admins');
		if(!admins
		|| await admins.isEmpty()
		|| await admins.has(hostChunk)) {
			return true;
		}
		return false;
	}

	createElement(name, descriptor) {
		return super.createElement(name, descriptor)
			.setAuth((issuer) => {
				if(name == 'admins') {
					return false;
				}
				return this.isAdmin(issuer);
			});
	}

	removeElement(name) {
		return super.removeElement(name)
			.setAuth((issuer) => {
				if(name == 'admins') {
					return false;
				}
				return this.isAdmin(issuer);
			});
	}

	addAdmin(hostIdentifier) {
		return new Change('addAdmin', arguments)
			.setAuth((issuer) => {
				return this.isAdmin(issuer);
			})
			.setMergePolicy(async () => {
				const admins = await this.getElement('admins');
				if(admins) {
					const chunkIdentifier = HostIdentifier.toChunkIdentifier(hostIdentifier);
					const newAdminChunk = Chunk.fromIdentifier(chunkIdentifier, hostIdentifier);
					if(await admins.has(newAdminChunk)) {
						return false; //skip change
					}
				}
				return true;
			})
			.setAction(async () => {
				const chunkIdentifier = HostIdentifier.toChunkIdentifier(hostIdentifier);
				const newAdminChunk = Chunk.fromIdentifier(chunkIdentifier, hostIdentifier);
				let admins = await this.getElement('admins');
				if(!admins) {
					admins = await this.localCopy.createElement('admins', {
						type: 'set',
						degree: 5,
						root: null
					});
				}
				if(await admins.has(newAdminChunk)) {
					throw Error('applyAddAdmin failed: id already in set');
				}
				await admins.add(newAdminChunk);
				await this.localCopy.updateElement('admins', admins.descriptor);
			});
	}

	removeAdmin(hostIdentifier) {
		return new Change('removeAdmin', arguments)
			.setAuth((issuer) => {
				return this.isAdmin(issuer);
			})
			.setMergePolicy(async () => {
				const admins = await this.getElement('admins');
				if(!admins) {
					throw Error('applyRemoveAdmin failed: no admins set');
				}
				const chunkIdentifier = HostIdentifier.toChunkIdentifier(hostIdentifier);
				const newAdminChunk = Chunk.fromIdentifier(chunkIdentifier, hostIdentifier);
				if(await admins.has(newAdminChunk) === false) {
					return false; //skip change
				}
				return true;
			})
			.setAction(async () => {
				const chunkIdentifier = HostIdentifier.toChunkIdentifier(hostIdentifier);
				const adminChunk = Chunk.fromIdentifier(chunkIdentifier);
				const admins = await this.getElement('admins');
				if(!admins) {
					throw Error('applyRemoveAdmin failed: no admins set');
				}
				if(await admins.has(adminChunk)===false) {
					throw Error('applyRemoveAdmin failed: id not in set');
				}
				await admins.delete(adminChunk);
				await this.localCopy.updateElement('admins', admins.descriptor);
			});
	}

}