
import { chunkIdentifierPrefix, ChunkingUtils } from "../chunking/ChunkingUtils";
import { Utils } from "../basic/Utils";

const hostIdentifierPrefix = 'h:';

export const HostIdentifier = {

    isValid: function (identifier) {
        if(identifier
        && identifier !== null
        && identifier !== undefined) {
            if(typeof(identifier) === 'string') {
                if(identifier.length === 46) {
                    const prefix = identifier.slice(0,2);
                    const base64part = identifier.slice(2,46);
                    if(prefix === hostIdentifierPrefix
                    && Utils.isBase64(base64part)) {
                        return true;
                    }
                }
            }
        }
        return false;
    },

    validate: function (identifier) {
        if(HostIdentifier.isValid(identifier) === false) {
            throw Error('Invalid host identifier: ' + JSON.stringify(identifier));
        }
    },

	fromChunkIdentifier: function (chunkIdentifier) {
        ChunkingUtils.validateIdentifier(chunkIdentifier);
        const hostIdentifier = hostIdentifierPrefix + chunkIdentifier.slice(2,46);
		return hostIdentifier;
	},

    toChunkIdentifier: function (hostIdentifier) {
		HostIdentifier.validate(hostIdentifier);
        const chunkIdentifier = chunkIdentifierPrefix + hostIdentifier.slice(2,46);
        return chunkIdentifier;
	},
}