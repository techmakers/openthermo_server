////add other components of the project
//particle static class to communicate with devices
import './particle.js';
//db declarations
import '/database/collections.js';
//import collection of tokens and devices
import {Tokens} from '/database/collections.js';
import {Devices} from '/database/collections.js';
import {SettingsHistory} from '/database/collections.js';
import {EventsHistory} from '/database/collections.js';
//import Particle class
import {Particle} from './particle.js';

Meteor.startup(function(){});

Meteor.publish('tokens.all', function () {
    // chiamiamo la funzione [collection].find()
    // che restituisce l'array dei documenti che contengono campi e valori passati nel parametro
    return Tokens.find(
    {
        // se il parametro è un oggetto vuoto verranno restituiti tutti i documenti della collection
        // quindi sono pubblicati tutti gli access token
    });
});

//publish to client all the devices with the given access_token
Meteor.publish('devices.token', function (access_token) {    
    return Devices.find(
        {
            // in questo caso il client riceve solo i documenti (oggetti) dei device 
            // che contengono l'access token indicato
            access_token: access_token
        }
    );
});

//server methods that will be visible from client
Meteor.methods({
    
    'token.add'(access_token)
    {
        //il metodo upsert modifica o crea un documento nella collection Tokens
        Tokens.upsert(
            //il primo parametro indica gli attributi che deve avere un doc già esistente per essere modificato
            //in caso nessun doc venga trovato, viene creato un nuovo doc
            {access_token:access_token},
            // con $set impostiamo il nuovo valore del campo access_token
            {$set: { access_token:access_token } }
        );
    },

    'token.remove'(access_token)
    {
        //remove rimuove dalla collection Tokens tutti i doc con l'attributo indicato
        Tokens.remove( {access_token:access_token} );
    },

    'devices.find'(access_token) {        
        //ask an array of all particle devices with the added token
        //containing all variables, functions name and token
        var devices = Particle.listDevicesWithData(access_token);

        //visualizziamo sulla console gli oggetti device ottenuti
        console.log(devices);

        //controlliamo che la variabile non contenga errori
        if(devices.error==null)
        {
            //insert in the db all devices element of the array
            devices.forEach(function(device) {
                //usciamo dal metodo senza salvataggi se l'oggetto non contiene dati
                if (!device.devicedata) return ;
                //con upsert aggiungiamo i campi dell'oggetto device al documento con l'id corrispondente (specificato nel primo parametro)
                //nel caso non esista nessun documento con quell'id, verrà creato un nuovo documento per il device
                Devices.upsert({"devicedata.id":device.devicedata.id}, {$set:device});
            });
        }
    }
});

//execute code when list of all tokens (Tokens.find({})) changes
Tokens.find({updatedOn:{$exists:false}}).observe({   
    //code executed when a token document is added
    ////id: token document id
    ////token: the new token
    added (doc) {
        //output di debug sulla console
        console.log("New token added:");
        console.log(doc.access_token);
        //chiamiamo il metodo che sincronizza i device, passando come token il campo access_token del documento aggiunto
        Meteor.call("devices.find", doc.access_token);
        //con update aggiorniamo il documento aggiunto, aggiungendogli il campo updateOn grazie al tag {$set: {[campo_da_aggiornare]: [nuovo_valore]}
        Tokens.update(doc._id,{$set:{updatedOn:new Date()}});
    }
});
    

