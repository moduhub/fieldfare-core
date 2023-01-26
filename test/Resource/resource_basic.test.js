import {
    Resource,
    ResourceUtils,
    VolatileResourcesManager,
    NodeCryptoManager,
    logger
} from 'fieldfare/node';

var gTestPerson;

beforeAll(async () => {

    logger.disable();
    NodeCryptoManager.init();
    VolatileResourcesManager.init();

    //Create resource tree
    gTestPerson = await Resource.fromObject({
        name: 'John Doe',
        age: 34,
        car: await Resource.fromObject({
            manufacturer: await Resource.fromObject({
                name: 'Ford',
                location: await Resource.fromObject({
                    lat: 42.314936,
                    lng: -83.209773
                })
            }),
            model: 'F-250',
            year: 1999
        }),
        employer: await Resource.fromObject({
            name: 'Ford',
            location: await Resource.fromObject({
                lat: 42.314936,
                lng: -83.209773
            })
        })
    });

    return;
});

test('Resource expands correctly to level 0', async () => {
    const expandedResource = await gTestPerson.expand(0);
    expect(expandedResource.name).toBe('John Doe');
    expect(expandedResource.age).toBe(34);
    expect(expandedResource.car instanceof Resource).toBe(true);
    expect(expandedResource.employer instanceof Resource).toBe(true);
    return;
});

test('Resource expands correctly to level 1', async () => {
    const expandedResource = await gTestPerson.expand(1);
    expect(expandedResource.name).toBe('John Doe');
    expect(expandedResource.age).toBe(34);
    expect(expandedResource.car.manufacturer instanceof Resource).toBe(true);
    expect(expandedResource.car.model).toBe('F-250');
    expect(expandedResource.car.year).toBe(1999);
    expect(expandedResource.employer.name).toBe('Ford');
    expect(expandedResource.employer.location instanceof Resource).toBe(true);
    return;
});

test('Resource expands correctly to level 2', async () => {
    const expandedResource = await gTestPerson.expand(2);
    expect(expandedResource.name).toBe('John Doe');
    expect(expandedResource.age).toBe(34);
    expect(expandedResource.car.manufacturer.name).toBe('Ford');
    expect(expandedResource.car.manufacturer.location instanceof Resource).toBe(true);
    expect(expandedResource.car.model).toBe('F-250');
    expect(expandedResource.car.year).toBe(1999);
    expect(expandedResource.employer.name).toBe('Ford');
    expect(expandedResource.employer.location.lat).toBe(42.314936);
    expect(expandedResource.employer.location.lng).toBe(-83.209773);
    return;
});

test('Resource expands correctly to level 3', async () => {
    const expandedResource = await gTestPerson.expand(3);
    expect(expandedResource.name).toBe('John Doe');
    expect(expandedResource.age).toBe(34);
    expect(expandedResource.car.manufacturer.name).toBe('Ford');
    expect(expandedResource.car.manufacturer.location.lat).toBe(42.314936);
    expect(expandedResource.car.manufacturer.location.lng).toBe(-83.209773);
    expect(expandedResource.car.model).toBe('F-250');
    expect(expandedResource.car.year).toBe(1999);
    expect(expandedResource.employer.name).toBe('Ford');
    expect(expandedResource.employer.location.lat).toBe(42.314936);
    expect(expandedResource.employer.location.lng).toBe(-83.209773);
    return;
});

test('Resource deduplicates', async () => {
    const level1Resource = await gTestPerson.expand(1);
    const level2Resource = await gTestPerson.expand(2);
    // console.log('level1Resource.employer:' + JSON.stringify(level1Resource.employer));
    // console.log('level2Resource.car.manufaturer:' + JSON.stringify(level2Resource.car.manufacturer));
    expect(level1Resource.employer.location instanceof Resource).toBe(true);
    expect(level2Resource.car.manufacturer.location instanceof Resource).toBe(true);
    expect(level1Resource.employer.location.key === level2Resource.car.manufacturer.location.key).toBe(true);
    return;
});