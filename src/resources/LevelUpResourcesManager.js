import {ResourcesManager} from './ResourcesManager';
import {logger} from '../basic/Log';

import asyncstorageDown from 'asyncstorage-down';
import levelup from 'levelup';
import AsyncStorage from '@react-native-async-storage/async-storage';


export class LevelUpResourcesManager extends ResourcesManager{

  constructor(){
    super();

    //check stopsdb.js if necessary for the next lines 👇
    this.db = new levelup('./resources', {
      db: location => asyncstorageDown(location, { AsyncStorage })
    });
  }

  async storeResource(base64data) {

    //logger.log('info', "LevelResourcesManager storing res: " + base64data);

    const base64hash = await ResourcesManager.generateKeyForData(base64data);

    await this.db.put(base64hash, base64data);

    return base64hash;
  }

  async getResource(base64hash) {

    //logger.log('info', "LevelResourcesManager fetching res: " + base64hash);

    var base64data;

    try {

      base64data = await this.db.get(base64hash);

    } catch (error) {

      var newError = Error('Resource fetch failed: ' + {cause: error});

      if (error.notFound === true) {
        newError.name = 'NOT_FOUND_ERROR';
        base64data = undefined;
      }

      throw newError;
    }
    return base64data;
  }
}
