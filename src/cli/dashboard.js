import blessed from 'blessed';

import {logger} from '../basic/Log'

var screen;
var activeHostsList;
var envServicesList;
var localServicesList;

var count = 0;
var env;

async function update() {

    logger.info('Updating screen');

    //============ Active Hosts
    var hostsListContent = 'Active hosts: ' + env.activeHosts.size + '\n';

    for(const [id, info] of env.activeHosts) {
        const timeDiff = Date.now() - info.lastEnvUpdate;
        hostsListContent += ">>" + id
            + ' (updated ' + timeDiff + 'ms ago)\n';
    }

    activeHostsList.setContent(hostsListContent);

    //Env Services List
    var envServicesListContent = 'Environment Services: \n';
    const envServices = env.elements.get('services');

    for await(const key of envServices) {
        const definition = await host.getResourceObject(key);
        envServicesListContent += definition.name
            + '(' + env.numActiveProviders(definition.uuid) + ' active providers)'
            + '\n';
    }

    envServicesList.setContent(envServicesListContent);

    //Local services status
    var localServicesListContent = 'Local Services: \n';

    for(const [uuid, service] of host.services) {
        localServicesListContent += service.definition.name;
        localServicesListContent += '(' + service.numRequests + ' requests/'
            + service.numErrors + ' errors)';
    }

    localServicesList.setContent(localServicesListContent);

    // Render the screen.
    screen.render();

}

export function dashboard(pEnv) {

    env = pEnv;

    logger.log('info', 'dashboard init');

    screen = blessed.screen({
        smartCSR: true
    });

    screen.title = 'mhHost-' + host.id.substring(0,8);

    // Create a box perfectly centered horizontally and vertically.
    activeHostsList = blessed.box({
      top: 'top',
      left: 'right',
      width: '60%',
      height: '50%',
      content: 'Active Hosts',
      tags: true,
      border: {
        type: 'line'
      },
      // style: {
      //   fg: 'white',
      //   bg: 'grey',
      //   border: {
      //     fg: '#f0f0f0'
      //   },
      //   hover: {
      //     bg: 'green'
      //   }
      // }
    });

    envServicesList = blessed.box({
        top: '0',
        left: '60%',
        width: '40%',
        height: '50%',
        content: 'Services',
        tags: true,
        border: {
            type: 'line'
        }
    });

    localServicesList = blessed.box({
        top: '50%',
        left: '60%',
        width: '40%',
        height: '50%',
        content: 'Services',
        tags: true,
        border: {
            type: 'line'
        }
    });

    // Append our box to the screen.
    screen.append(activeHostsList);
    screen.append(envServicesList);
    screen.append(localServicesList);

    // Quit on Escape, q, or Control-C.
    screen.key(['escape', 'q', 'C-c'], function(ch, key) {
      return process.exit(0);
    });

    // Focus our element.
    activeHostsList.focus();

    logger.log('info', 'dashboard before render');
    screen.render();
    logger.log('info', 'dashboard after render');

    setInterval(update, 1000);

}
