import { HostManager } from '../HostManager';
import { LevelUpNVData } from '../nvd/LevelUpNVData';
import { LevelUpResourcesManager } from '..resources/LevelUpResourcesManager';


export async function setupReactNativeHost(){

  logger.info("System initHost - React Native");

  global.host = new HostManager();

  global.host = new LevelUpNVData();

  host.addResourcesManager(new LevelUpResourcesManager());

  // check webSetup if needed
}
