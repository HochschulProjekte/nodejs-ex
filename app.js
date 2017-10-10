/* app.js - node.js server running */

/* Settings and initialization */

var
    port       = process.env.PORT || 8080,
    io         = require('socket.io'),
    express    = require('express'),
    UUID       = require('node-uuid'),
    verbose    = false,
    http       = require('http'),
    app        = express(),
    server     = http.createServer(app);




/* Express server set up. */

//The express server handles passing the content to the browser,
//As well as routing users where they need to go. 

//Tell the server to listen for incoming connections and log if succeeded
server.listen(port, () => console.log('\t ::    Server   :: Listening on port ' + port));

//Routing
app.get( '/', function( req, res ){
    console.log('\t ::    Server   :: Try to load ' + __dirname + '/index.html');
    res.sendFile( '/index.html' , { root:__dirname });
});

app.get( '/*' , function( req, res, next ) {

    var file = req.params[0];
    if(verbose) console.log('\t ::    Server   :: File requested: ' + file);
    res.sendFile( __dirname + '/' + file );

});





/* Socket.IO server set up. */
    
/* Server settings */

//Create a socket.io instance using the express server
var sio = io.listen(server);

// Configure server
sio.configure(function (){

    sio.set('log level', 0);

    sio.set('authorization', function (handshakeData, callback) {
        callback(null, true);
    });

});

// Initialize game server handling server side game actions
game_server = require('./game.server.js');



/* Client settings */

// Handlers for new client connection
sio.sockets.on('connection', function (client) {
    
    //Generate a new UUID for this client and store it on their socket
    client.userid = UUID();

    console.log('\t ::    Server   :: Client ' + client.userid + ' connected.');

    // Tell the client that he is connected and give him his id and ask for username
    client.emit('send userid get username', { userid: client.userid }, function(username) {
        client.username = username;
        console.log('\t ::    Server   :: Username: ' + client.username);
        //Find a game for the client
        game_server.findGame(client, sio);
    } );

    
    // Disconnect
    client.on('disconnect', function () {

        console.log('\t ::    Server   :: Client ' + client.username + ' (' + client.userid + ') disconnected.');

    });
    
});