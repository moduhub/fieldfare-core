/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import {logger} from '../basic/Log.js'

export async function addServedWebport(options) {

    logger.log('info', "addServedWebport running");

    var newWebportData = webportFromOptions(options);

    newWebportData.hostid = LocalHost.getID();

    logger.log('info',"adding served webport to env:" + JSON.stringify(newWebportData));

    await env.addWebport(newWebportData);

}

export async function removeServedWebports(options) {

    throw Error('uninmplemented');

}
