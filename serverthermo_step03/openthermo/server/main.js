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

relaissetEvent = function(data)
{
    var deviceid = data.coreid;
    //findOne restituisce il primo documento in Devices del termostato con l'id specificato 
    thermo = Devices.findOne({"devicedata.id":deviceid});
    //output di debug con id del device e nome dell'evento
    console.log("Receiving from device: ", deviceid);
    console.log("--relais: set");
    // se il termostato è spento allora la variabile relaisaorb deve assumere valore "1"
    thermo.devicedata.variables.relaisaorb = 1;
    thermo.devicedata.connected=true;   
    thermo.event={};
    thermo.event.eventname = "relaisset";
    thermo.event.argument = 1;
    //con new Date() si ottiene data e ora in cui si sta effettuando il salvataggio dell'evento
    thermo.event.time = new Date();
    Devices.update({"devicedata.id":deviceid}, thermo);
    //eliminiamo l'id interno dell'oggetto thermo per poterlo inserire in una diversa collection
    delete thermo._id;
    EventsHistory.insert(thermo);
};

relaisresetEvent = function(data)
{
    var deviceid = data.coreid;
    //findOne restituisce il primo documento in Devices del termostato con l'id specificato
    thermo = Devices.findOne({"devicedata.id":deviceid});
    //output di debug con id del device e nome dell'evento
    console.log("Receiving from device: ", deviceid);
    console.log("--relais: reset");
    // se il termostato è spento allora la variabile relaisaorb deve assumere valore "0"
    thermo.devicedata.variables.relaisaorb = 0;
    thermo.devicedata.connected=true;
    thermo.event={};
    thermo.event.eventname = "relaisreset";
    thermo.event.argument = 0;
    //con new Date() si ottiene data e ora in cui si sta effettuando il salvataggio dell'evento
    thermo.event.time = new Date();
    Devices.update({"devicedata.id":deviceid}, thermo);
    //eliminiamo l'id interno dell'oggetto thermo per poterlo inserire in una diversa collection
    delete thermo._id;
    EventsHistory.insert(thermo);
};

tempchangedEvent = function(data)
{
    var temp = data.data;
    var deviceid = data.coreid;
    //findOne restituisce il primo documento in Devices del termostato con l'id specificato
    thermo = Devices.findOne({"devicedata.id":deviceid});
    //output di debug con id del device, nome dell'evento e nuovo valore della temperatura
    console.log("Receiving from device: ", deviceid);
    console.log("--temperature: ", temp);
    //la variabile temperature del termostato è settata al valore "temp" memorizzato precedentemente
    thermo.devicedata.variables.temperature = temp;
    thermo.devicedata.connected=true;
    thermo.event={};
    thermo.event.eventname = "tempchanged";
    thermo.event.argument = temp;
    //con new Date() si ottiene data e ora in cui si sta effettuando il salvataggio dell'evento
    thermo.event.time = new Date();
    Devices.update({"devicedata.id":deviceid}, thermo);
    //eliminiamo l'id interno dell'oggetto thermo per poterlo inserire in una diversa collection
    delete thermo._id;
    EventsHistory.insert(thermo);
};

Meteor.startup(function()
{
    //ottengo e converto in array tutti i token in Tokens
    tokens=Tokens.find({}).fetch();
    //per ogni oggetto token in tokens..
    tokens.forEach(function(token){
        //..connetto le tre funzioni di callback al loro evento, utilizzando la funzione Particle.eventSource(access_token, nome_evento, funzione_callback)
        Particle.eventSource(token.access_token, "relaisset", relaissetEvent);
        Particle.eventSource(token.access_token, "relaisreset", relaisresetEvent);
        Particle.eventSource(token.access_token, "tempchanged", tempchangedEvent);
    });
});

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
    },

    'device.update'(info) 
    {
        //findOne restituisce il primo oggetto Mongo con gli attributi indicati
        token=Tokens.findOne({access_token:info.access_token});
        //eseguiamo le istruzioni solo se "token" non è nullo
        if(token)
        {
            //findOne restituirà il primo oggetto in Devices con id e token specificati
            device=Devices.findOne({
                //il tag $and [{condizione1}, {condizione2}, ...] permette di filtrare i risultati controllando più attributi
                "$and":
                [
                    {"devicedata.id":info.id},
                    {access_token:info.access_token}
                ]
            }); 
            //con [collection].update({filtro},{modifiche}) impostiamo i documenti di Devices corrispondenti al filtro applicato
            Devices.update(
                {
                    //filtriamo con $and secondo id e access_token indicati
                    "$and":
                    [
                        {"devicedata.id":info.id},
                        {access_token:info.access_token}
                    ]
                },
                {
                    //con $set impostiamo i nuovi valori dei tre campi di *update* del device
                    $set:
                    {
                        "update.status": "pending", 
                        "update.variablename": info.variablename,
                        "update.argument": info.argument
                    }
            });
        }
    //fine del metodo 'device.update'
    },
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
        Particle.eventSource(doc.access_token, "relaisset", relaissetEvent);
        Particle.eventSource(doc.access_token, "relaisreset", relaisresetEvent);
        Particle.eventSource(doc.access_token, "tempchanged", tempchangedEvent);
    }
});
    
//execute code when list of devices to update (status: "pending") changes
Devices.find({"update.status" :"pending"}).observe({

    //if a device is added to the list it has to be synchronized 
    ////doc: the device document whose update status was set to "pending"
    added (doc) {
        //dichiaro l'oggetto options che contiene i parametri per impostare Rotilio tramite una sua funzione
        options =
        {
            device:doc.devicedata.id, 
            access_token:doc.access_token, 
            //il campo functionToVariable dell'oggetto Particle sarà un oggetto i cui campi sono i nomi delle variabili del termostato, e i valori i nomi delle funzioni che le modificano
            //in questo modo, possiamo associare al campo functionname il corretto nome della funzione da chiamare su Rotilio
            functionname:Particle.functionToVariable[doc.update.variablename],
            //convertiamo in formato Stringa il nuovo valore da passare alla funzione
            argument:doc.update.argument.toString()
        }
        //output di debug sulla console, che visualizza il nome del device in sincronizzazione e l'oggetto options
        console.log("Trying to update device: ", doc.devicedata.name, options);
        //se options.functionname contiene il nome di una funzione su Rotilio, il nome della variabile da modificare in *update* è corretto
        if(options.functionname)
        {
            //con il parametro options passiamo le informazioni utili all'oggetto Particle 
            result=Particle.functionDevice(options);
        }

        var deviceid = doc.devicedata.id;
        thermo=Devices.findOne({"devicedata.id":deviceid});
        //la funzione restituisce zero, quindi la sincronizzazione è completata
        if (result==0)
        {
            //1. update status so that a new setting to "pending" will trigger again this observer
            thermo.update.status = "updated";
            thermo.devicedata.connected=true;

            //2. update the changed variable in the definitive datas in the doc
            thermo.devicedata.variables[doc.update.variablename] = doc.update.argument;
            //salvataggio delle modifiche all'oggetto thermo in Devices con update
            Devices.update({"devicedata.id":deviceid}, thermo);
            //eliminiamo l'id interno del documento per poterlo aggiungere nello storico delle impostazioni, SettingsHistory
            delete thermo._id;
            SettingsHistory.insert(thermo);

            //output di debug, completo di oggetto termostato che si stava sincronizzando
            console.log("Update: successfull", thermo);
        }
        //la funzione restituisce un val. negativo, quindi l'argomento era invalido
        else if (result>0)
        {
            thermo.update.status = "invalid";
            thermo.devicedata.connected = true;
            //salvataggio delle modifiche all'oggetto thermo in Devices con update
            Devices.update({"devicedata.id":deviceid}, thermo);
            //output di debug, completo di oggetto termostato che si stava sincronizzando
            console.log("Update: value not valid", thermo);
        }
        //altrimenti, non è stato possibile comunicare con Rotilio
        else
        {
            thermo.update.status = "error";
            thermo.devicedata.connected = false;+            //salvataggio delle modifiche all'oggetto thermo in Devices con update
            Devices.update({"devicedata.id":deviceid}, thermo);
            //output di debug, completo di oggetto termostato che si stava sincronizzando
            console.log("Update: no response", thermo);
        }

    //chiusura della funzione added..
    }
//..e della observe
});