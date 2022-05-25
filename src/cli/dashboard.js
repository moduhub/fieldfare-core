import blessed from 'blessed';

import {logger} from '../basic/Log'

var screen;
var activeHostsList;
var servicesList;

var count = 0;
var env;

async function update() {

    logger.info('Updating screen');

    //============ Active Hosts
    var hostsListContent = 'Active hosts: ' + env.activeHosts.size + '\n';

    for(const [id, info] of env.activeHosts) {
        const timeDiff = Date.now() - info.lastEnvUpdate;
        hostsListContent += ">>" + id
            + ' (updated ' + timeDiff + 'ms ago)';
    }

    activeHostsList.setContent(hostsListContent);

    //Services List
    var servicesListContent = 'Services: \n';
    const services = env.elements.get('services');

    for await(const key of services) {
        const definition = await host.getResourceObject(key);
        servicesListContent += definition.name + '\n';
    }

    servicesList.setContent(servicesListContent);

    // Render the screen.
    screen.render();

}

export function dashboard(pEnv) {

    env = pEnv;

    logger.log('info', 'dashboard init');

    screen = blessed.screen({
        smartCSR: true
    });

    screen.title = 'Environment ' + env.uuid;

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

    servicesList = blessed.box({
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

    // Append our box to the screen.
    screen.append(activeHostsList);
    screen.append(servicesList);

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
