import asyncstorageDown from 'asyncstorage-down';
import levelup from 'levelup';
import AsyncStorage from '@react-native-async-storage/async-storage';

export class LevelUpNVData{

  constructor(){
    this.db = new levelup('./nvd', {
      db: location => asyncstorageDown(location, { AsyncStorage })
    });
  }


  save(key, object){
    console.log('levelupnvdata save', key, 'Object: ', JSON.stringify(object));
    return new Promise((resolve, reject) => {
      this.db.put(key, object, (err) => {
        if (err) {
          console.log('Error in levelupnvdata save, error: ' + err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }


  load(key){
    var object;
      console.log('levelupnvdata load\nkey: ' + key);
      return new Promise((resolve) => {
        this.db.get(key, function(err, value){
          if(err){
            resolve(undefined);
          } else {
            console.log('Gotten value: ', JSON.parse(value));
            console.log('Key: ' + key);
            object = value;
            resolve(object);
          }
      });
    });
  }

}
