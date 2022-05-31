
export async function importPrivateKey(privateKeyData) {

    console.log("importing privateKeyData: " + privateKeyData);

    const privateKey = await crypto.subtle.importKey(
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

    nvdata.save('privateKey', privateKeyData);
}

export async function generatePrivateKey() {

    const keypair = await crypto.subtle.generateKey(
        {
            name: "ECDSA",
            namedCurve: "P-256"
        },
        true,
        ["sign"]
    );

    privateKeyData = await crypto.subtle.exportKey('jwk', keypair.privateKey);

    console.log('Private key:' + privateKeyData);

    //pubKeyData = await crypto.subtle.exportKey('jwk', keypair.publicKey);

    pubKeyData = {
        kty: "EC",
        use: "sig",
        crv: "P-256",
        kid: privateKeyData.kid,
        x: privateKeyData.x,
        y: privateKeyData.y,
        alg: "ES256"
    };

    console.log('Public key: ' + pubKeyData);

    await nvdata.save('privateKey', privateKeyData);

    return privateKeyData;
}
