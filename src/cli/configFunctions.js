
import logger from '../basic/Log'

export async function addServedWebport(options) {

    logger.log('info', "addServedWebport running");

    var newWebportData = webportFromOptions(options);

    newWebportData.hostid = host.id;

    logger.log('info',"adding served webport to env:" + JSON.stringify(newWebportData));

    await env.addWebport(newWebportData);

}

export async function removeServedWebports(options) {

    throw Error('uninmplemented');

}
