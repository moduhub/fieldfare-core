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
		const makingHostChunk = Chunk.fromObject({id:hostIdentifier});
		const admins = await this.localCopy.getElement('admins');
		if(!admins
		|| await admins.isEmpty()
		|| await admins.has(await makingHostChunk)) {
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
		HostIdentifier.validate(hostIdentifier);
		const makingKeyChunk = Chunk.fromObject({id:hostIdentifier});
		const gettingCurrentAdmins = this.localCopy.getElement('admins');
		return new Change('addAdmin', ...arguments)
			.setAuth((issuer) => {
				return this.isAdmin(issuer);
			})
			.setMergePolicy(async () => {
				const admins = await gettingCurrentAdmins;
				if(admins) {
					if(await admins.has(await makingKeyChunk)) {
						return false; //skip change
					}
				}
				return true;
			})
			.setAction(async () => {
				let admins = await gettingCurrentAdmins;
				if(!admins) {
					admins = await this.localCopy.createElement('admins', {
						type: 'set',
						degree: 5,
						root: null
					});
				}
				const keyChunk = await makingKeyChunk;
				if(await admins.has(keyChunk)) {
					throw Error('applyAddAdmin failed: id already in set');
				}
				await admins.add(keyChunk);
				await this.localCopy.updateElement('admins', admins.descriptor);
			});
	}

	removeAdmin(hostIdentifier) {
		const makingKeyChunk = Chunk.fromObject({id:hostIdentifier});
		const gettingCurrentAdmins = this.localCopy.getElement('admins');
		return new Change('removeAdmin', ...arguments)
			.setAuth((issuer) => {
				return this.isAdmin(issuer);
			})
			.setMergePolicy(async () => {
				const admins = await gettingCurrentAdmins;
				if(!admins) {
					throw Error('applyRemoveAdmin failed: no admins set');
				}
				if(await admins.has(await makingKeyChunk) === false) {
					return false; //skip change
				}
				return true;
			})
			.setAction(async () => {
				const admins = await gettingCurrentAdmins;
				if(!admins) {
					throw Error('applyRemoveAdmin failed: no admins set');
				}
				const keyChunk = await makingKeyChunk;
				if(await admins.has(keyChunk)===false) {
					throw Error('applyRemoveAdmin failed: id not in set');
				}
				await admins.delete(keyChunk);
				await this.localCopy.updateElement('admins', admins.descriptor);
			});
	}

}