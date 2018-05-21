//import database object
import { Mongo } from 'meteor/mongo';

////declare and export to other files collections
//list of access tokens
export const Tokens = new Mongo.Collection('tokens');
console.log("Exported tokens collection");
//list of device objects related to a token
export const Devices = new Mongo.Collection('devices');
console.log("Exported devices collection");
//history of all different settings of devices
export const SettingsHistory = new Mongo.Collection('settingsHistory');
//history of all different values of devices
export const EventsHistory = new Mongo.Collection('eventsHistory');
