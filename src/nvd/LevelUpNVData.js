import levelup from 'levelup';

export class LevelUpNVData{

  constructor(){
    const stops_db = levelup('./nvd', {
      db: location => asyncstorageDown(location, { AsyncStorage })
    });
  }


  async save(key, object){
    await this.db.put(key, object);
  }


  async load(key){
    var object;

    try {
      object = await this.db.get(key);
    } catch (error) {
      if(error.notFound === true){
        object = undefined;
      }
    }

    return object;
  }

}
