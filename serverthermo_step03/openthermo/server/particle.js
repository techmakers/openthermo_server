import {HTTP} from 'meteor/http';

//object with methods to communicate with particle cloud and rotilios
export var Particle = 
{
    baseUrl:'https://api.particle.io/v1/',

    functionDevice : function (options)
    {
        var returnvalue=-1;
        var requestUrl = this.baseUrl+"devices/" + options.device + "/" + options.functionname;
        //output di debug, che indica l'url della chiamata e l'argomento che verrà passato
        console.log("Particle - CHIAMATA FUNZIONE:") ;
        console.log(requestUrl, options.argument) ;
        try 
        {

            res=HTTP.post(requestUrl, {params: 
                {
                    access_token : options.access_token,
                    args: options.argument 
                }
            });
            console.log(res);
            returnvalue=res.data.return_value;          
        } 
        catch (e)
        {
        
            res = e;
            console.log(res);
        }     
        return returnvalue ;
    },

    variableDevice : function (options)
    {
        // costruiamo l'url della richiesta utilizzando i parametri di input
        var requestUrl = this.baseUrl+"devices/" + options.device + "/" + options.variablename + "?access_token=" + options.access_token;

        console.log("Particle - RICHIESTA DI VARIABILE:");
        console.log(requestUrl);

        try {
            // in res memorizziamo il campo data.result dell'oggetto restituito dalla chiamata, ovvero il valore della variabile
            var res = HTTP.get(requestUrl).data.result ;

        } catch (e){
            // gestiamo l'errore assegnando alla variabile da restituire l'oggetto di errore (e.response.data)
            res = e.response.data ;
            console.log(res);
        }

        return res ;
    },

    deviceInfo : function (options)
    {
        //prepariamo in una stringa (requestUrl) l'url della richiesta HTTP
        var requestUrl = this.baseUrl+'devices/'+options.device+'/?access_token='+options.access_token;

        console.log("Particle - DEVICE VARIABLES");
        console.log(requestUrl);
        
        try 
        {
            var device=HTTP.get(requestUrl).data;
        }
        catch (e) 
        {
            //l'oggetto di errore è contenuto in e.response.data
            device=e.response.data;
            //l'errore verrò restituito nell'oggetto devices
            console.log(device);
        }

        //se la richiesta ha avuto esito positivo (e quindi non esiste il campo "error" di device)
        if (!device.error)
        {
            //spostiamo il valore del campo "name" (il nome del device) sul campo "particlename" 
            //per indicarlo come nome del Rotilio assegnato dall'account Particle.
            device.particlename=device.name;
            delete device.name;

            if(device.variables!=null && device.connected)
            {
                //in variablesNames memorizziamo il campo variables di device
                //utilizziamo Object.keys per memorizzarlo e poi usarlo come array
                variablesNames=Object.keys(device.variables);
                //variablesNames.indexOf, che restituisce -1 se il suo argomento non è un elemento dell'array)
                //in questo modo controlliamo la presenza di una variabile fondamentale per un firmware RotilioThermo,
                // ad esempio "heateron". In caso negativo chiudiamo la sottofunzione restituendo un oggetto nullo.
                if (variablesNames.indexOf("heateron") == -1) return ; }
                var BreakException = {};
                try 
                {
                    variablesNames.forEach(function(variableName) 
                    {
                        //this.variableDevice restituisce il valore di una variabile, volta per volta
                        device.variables[variableName]=this.variableDevice(
                        {
                            device:device.id, 
                            access_token:options.access_token, 
                            variablename:variableName
                        });
                        // all'interno di ogni ciclo controlliamo che la variabile ottenuto non contenga un oggetto di errore
                        // altrimenti usciamo dalle istruzioni in *try* entrando in *catch* grazie a *throw*
                        if(device.variables[variableName].error) throw BreakException;
                    }, this);
                } 
                catch(e) {
                    // nel caso l'errore e sia quello individuato e passato dal codice
                    // impostiamo su false lo stato di connessione del dispositivo
                    if(e==BreakException) device.connected=false;
                }
            }

        return device;
    },

    listDevices : function (access_token)
    {
        //prepariamo in una stringa (requestUrl) l'url della richiesta HTTP
        var requestUrl = this.baseUrl+'devices/?access_token='+access_token;
        console.log("Particle - LIST DEVICES");
        console.log(requestUrl);
        try
        {
            var devices=HTTP.get(requestUrl).data;
        }
        catch (e)
        {
            //l'oggetto di errore è contenuto in e.response.data
            devices=e.response.data;
            //l'errore verrò restituito nell'oggetto devices
            console.log(devices);
        }
        return devices;
    },

    listDevicesWithData : function (access_token)
    {
        var devicesWithData=[];
        //obtain list of devices related to the token
        var devices=this.listDevices(access_token);
        //if devices does not contains error
        //if devices does not contains error
        if(!devices.error)
        {
            devices.forEach(function(device) 
            {
                //for every device detected, obtain his information
                var deviceInfo=this.deviceInfo({device:device.id, access_token:access_token});
                //add device information into devicesWithData array
                devicesWithData.push({devicedata:deviceInfo, access_token:access_token, createdAt: new Date()});
            }, this);
        }
        else
            //if devices contains a error object, it is copied into devicesWithData
            devicesWithData=devices;

        return devicesWithData;
    },

    eventSource : function(access_token, eventname, callback)
    {
        var EventSource = Npm.require('eventsource');
        var particleUrl="https://api.particle.io/v1/devices/events?access_token="+access_token;
        //output di debug, che indica l'url di ascolto particleUrl
        console.log("Preparing eventsource:",particleUrl);
        //costruaimo l'istanza eventSource
        var eventSource = new EventSource(particleUrl);
        eventSource.addEventListener(eventname,function(e) 
        {
            //otteniamo un oggetto Fiber per eseguire in modo sincrono l'elaborazione dei dati
            Fiber = Npm.require('fibers');
            //all'interno di Fiber(...).run(); inseriamo la funzione di elaborazione
            Fiber(function(){
                //il dato relativo all'evento è contenuto all'interno di e.data
                //convertiamo il dato dal formato stringa ad un oggetto javascript con JSON.parse()
                data = JSON.parse(e.data);
                //output di debug con il dato dell'evento ricevuto
                console.log("eventsource - EVENTDATA:",data);
                //chiamiamo la funzione di callback, inserendo data come argomento
                callback(data)
            }).run();
        });    
    },
    
    functionToVariable : {tempsetpoint: 'settemp', heateron: 'setheater'}
}