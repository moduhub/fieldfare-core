import {
    ffinit,
    cryptoManager,
    LocalHost,
    RemoteHost,
    Message,
    LocalService,
    Environment,
    ChunkList,
    ChunkMap,
    Collection,
    Chunk,
    logger
} from 'fieldfare/test';
import { HostIdentifier } from '../../src/env/HostIdentifier';

const gTestEnvironment = new Environment('c7a89589-b875-4b1b-a757-3a59d2e86c8e');
var gTestService;

const numTestHosts = 5;
const testHosts = [];
const testSendMocks = [];
const fastTestRequests = [];
const slowTestRequests = [];

const testServiceDefinition = {
    "uuid": "a41e43e5-c56d-4481-9ef1-aae08735a742",
    "name": "testService",
    "methods": [
        "fastMethod",
        "slowMethod"
    ],
    "collection": [
        {
            "name": "listA",
            "descriptor": {
                type: "list",
                degree: 5
            }
        },
        {
            "name": "mapB",
            "descriptor": {
                type: "map",
                degree: 3
            }
        }
    ]
};

const testServiceUUID = testServiceDefinition.uuid;
const invalidUUID = 'a41e43e5_c56d-4481-9ef1-aae08735a742';

class ValidServiceA extends LocalService {
    fastMethod(remoteHost, params) {
        return 'fastResultA: ' + params.a + ' ' + params.b;
    }
    slowMethod(remoteHost, params) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve('slowResultA: ' + params.a + ' ' + params.b);
            }, 300);
        });
    }
};

class ValidServiceB extends LocalService {
    fastMethod(remoteHost, params) {
        return 'fastResultB: ' + params.a + ' ' + params.b;
    }
    slowMethod(remoteHost, params) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve('slowResultB: ' + params.a + ' ' + params.b);
            }, 500);
        });
    }
};

class InvalidService {
    methodA() {
        return 'invalid';
    }
}


beforeAll(async () => {
    //logger.disable();
    await ffinit.setupLocalHost();
    //prepare a mocked up environment
    await gTestEnvironment.addService(testServiceDefinition);
    for(var i=0; i<numTestHosts; i++) {
        const iKeypair = await cryptoManager.generateTestKeypair();
        const iPubkeyJWK = await cryptoManager.exportPublicKey(iKeypair.publicKey);
        const iPubkeyChunk = await Chunk.fromObject(iPubkeyJWK);
        const iHostIdentifier = HostIdentifier.fromChunkIdentifier(iPubkeyChunk.id);
        testHosts[i] = new RemoteHost(iHostIdentifier);
        testSendMocks[i] = jest.fn();
        testHosts[i].send = testSendMocks[i];   //mock RemoteHost.send() function
        fastTestRequests[i] = new Message(testServiceUUID, {
            fastMethod: {
                a: 'data_a',
                b: 'data_b'
            }
        });
        slowTestRequests[i] = new Message(testServiceUUID, {
            slowMethod: {
                a: 'data_a',
                b: 'data_b'
            }
        });
    }
    return;
});

afterAll(() => {
    ffinit.terminate();
});


describe('LocalService registerImplementation', () => {
    test('throws on attempt to register null', () => {
        expect(()=>{
            LocalService.registerImplementation(testServiceUUID, null);
        }).toThrow();
    });
    test('throws on attempt to register undefined', () => {
        expect(()=>{
            LocalService.registerImplementation();
        }).toThrow();
    });
    test('throws on attempt to register invalid UUID', () => {
        expect(()=>{
            LocalService.registerImplementation(invalidUUID, ValidServiceA);
        }).toThrow();
    });
    test('throws on attempt to register an invalid implementation', () => {
        expect(()=>{
            LocalService.registerImplementation(testServiceUUID, InvalidService);
        }).toThrow();
    });
    test('succeeds on attempt to register a valid implementation', () => {
        expect(()=>{
            LocalService.registerImplementation(testServiceUUID, ValidServiceA);
        }).not.toThrow();
    });
    test('throws on attempt to register duplicate', () => {
        expect(()=>{
            LocalService.registerImplementation(testServiceUUID, ValidServiceB);
        }).toThrow();
    });
});

describe('LocalService implement method', () => {
    test('throws on attempt to implement undefined', async () => {
        await expect(LocalService.implement()).rejects.toBeInstanceOf(Error);
    });
    test('throws on attempt to implement invalid UUID', async () => {
        await expect(LocalService.implement(invalidUUID, null)).rejects.toBeInstanceOf(Error);
    });
    test('throws on attempt to implement without an environment', async () => {
        await expect(LocalService.implement(testServiceUUID, null)).rejects.toBeInstanceOf(Error);
    });
    test('succeeds on attempt to implement a valid service', async () => {
        gTestService = await LocalService.implement(testServiceUUID, gTestEnvironment);
        await expect(gTestService).toBeInstanceOf(LocalService);
    });
    // test('throws on attempt to re-implement previous service', async () => {
    //     await expect(LocalService.implement(testServiceUUID, gTestEnvironment)).rejects.toBeInstanceOf(Error);
    // });
});

describe('LocalService implemented service', () => {
    test('has a collection', () => {
        expect(gTestService).toHaveProperty('collection');
    });
    describe('its collection', () => {
        test('is a valid instance of the Collection class', () => {
            expect(gTestService.collection).toBeInstanceOf(Collection);
        });
        test('has exactly 2 elements', async () => {
            var numElements = 0;
            console.log(gTestService.collection);
            for await (const [name, value] of gTestService.collection) {
                console.log(name);
                numElements++;
            }
            expect(numElements).toBe(2);
        });
        test('matches service descriptor data elements', async () => {
            const listA = await gTestService.collection.getElement('listA');
            const mapB = await gTestService.collection.getElement('mapB');
            expect(listA).toBeInstanceOf(ChunkList);
            expect(mapB).toBeInstanceOf(ChunkMap);
        });
    });
    describe('its request handler', () => {
        test('rejects invalid requests', async () => {
            await expect(gTestService.pushRequest()).rejects.toBeInstanceOf(Error);
        });
        describe('produces error responses', () => {
            // test('on invalid method name', async () => {
            //     testSendMocks[0].mockClear();
            //     await expect(gTestService.pushRequest(testHosts[0], fastTestRequests[0])).resolves.toBeUndefined();
            //     const [response] = testSendMocks[0].mock.calls[0];
            //     console.log(response);
            //     expect(response.service).toBe('response');
            //     //expect(response.data.hash).toBe(requestHash[0]);
            //     expect(response.data.status).toBe('done');
            // });
        // test('on malformed requests', async () => {
        //     await expect(gTestService.pushRequest(testHosts[0], fastTestRequests[0])).resolves.toBeUndefined();
        // });
        // test('on errors thrown inside the handler', async () => {
        //     await expect(gTestService.pushRequest(testHosts[0], fastTestRequests[0])).resolves.toBeUndefined();
        // });
        // test('on promise reject', async () => {
        //     await expect(gTestService.pushRequest(testHosts[0], fastTestRequests[0])).resolves.toBeUndefined();
        // });
        });        
        test('handles single fast request', async () => {
            testSendMocks[0].mockClear();
            await expect(gTestService.pushRequest(testHosts[0], fastTestRequests[0])).resolves.toBeUndefined();
            expect(testSendMocks[0]).toHaveBeenCalledTimes(1);
            const [response] = testSendMocks[0].mock.calls[0];
            console.log(response);
            expect(response.service).toBe('response');
            //expect(response.data.hash).toBe(requestHash[0]);
            expect(response.data.status).toBe('done');
            expect(response.data.result).toBe('fastResultA: data_a data_b');
        });
        test('handles single slow request', async () => {
            testSendMocks[0].mockClear();
            await expect(gTestService.pushRequest(testHosts[0], slowTestRequests[0])).resolves.toBeUndefined();
            expect(testSendMocks[0]).toHaveBeenCalledTimes(1);
            const [response] = testSendMocks[0].mock.calls[0];
            console.log(response);
            expect(response.service).toBe('response');
            //expect(response.data.hash).toBe(requestHash[0]);
            expect(response.data.status).toBe('done');
            expect(response.data.result).toBe('slowResultA: data_a data_b');
        });
        // test('handles a burst of fast requests', async () => {
        // });
        // test('handles a burst of slow requests', async () => {
        // });
        // test('handles a burst of mixed requests', async () => {
        // });
    });
});