/*  game.server.js - Game server handling game things */

/* Settings and initializations */

const MAX_PLAYER = 4;

var
    game_server = module.exports = {    games_active : {}, 
                                        games_active_count : 0,
                                        game_waiting : false,
                                        game_waiting_instance : '',
                                        game_waiting_player : 0,
                                        game_waiting_players : [] },
    UUID        = require('node-uuid');

global.window = global.document = global;

//Import shared game library code.
require('./game.core.js');

//Wrapper for simply toggle logging
game_server.log = function() {
    if(true) console.log.apply(this,arguments);
};



/* Game server functions */

// Find a game
game_server.findGame = function(player, sio) {

    this.log('\t :: Game Server :: Player ' + player.username + ' (' + player.userid + ') looking for a game.');
    player.emit('update wait status', 'Searching for a game...');

    // Check, if there is a game waiting for other players
    if (this.game_waiting && this.game_waiting_player < MAX_PLAYER) {

        // => there is a game waiting for players
        this.log('\t :: Game Server :: Game ' + this.game_waiting_instance.id + ' is waiting for players (' + this.game_waiting_player + '/' + MAX_PLAYER + ').');
        player.emit('update wait status', 'Game found');

        var game_instance = this.game_waiting_instance;

        // Add the player to the game
        player.game = game_instance;
        this.game_waiting_players.push(player);
        game_instance.player_clients.push(player);
        game_instance.player_count += 1;
        this.log('\t :: Game Server :: Player ' + player.username + ' (' + player.userid + ') joined game ' + this.game_waiting_instance.id + '.');
        player.join(this.game_waiting_instance.id);
        this.log('\t :: Game Server :: Player ' + player.username + ' (' + player.userid + ') joined room ' + this.game_waiting_instance.id);
        player.emit('update wait status', 'Joining game');

        // Check, if max player count is reached
        if (game_instance.player_count == MAX_PLAYER) {

            // => enough player for game
            this.log('\t :: Game Server :: Game ' + this.game_waiting_instance.id + ' has enough players (' + game_instance.player_count + '/' + MAX_PLAYER + ').');
            sio.sockets.to(this.game_waiting_instance.id).emit('update wait status', 'Game starting');

            // Start game
            this.startGame(game_instance);
            this.log('\t :: Game Server :: Game ' + this.game_waiting_instance.id + ' has been started.');
            this.log('\t :: Game Server :: ' + this.games_active_count + ' active games running.');

            // Set values
            this.game_waiting = false;
            this.game_waiting_instance = '';
            this.game_waiting_player = 0;

        } else {

            // => not enough player for game
            this.log('\t :: Game Server :: Game ' + this.game_waiting_instance.id + ' has not enough players (' + game_instance.player_count + '/' + MAX_PLAYER + ').');
            sio.sockets.to(this.game_waiting_instance.id).emit('update wait status', 'Waiting for other players (' + game_instance.player_count + '/' + MAX_PLAYER + ')');

            // Wait for other players

            // Set values
            this.game_waiting = true;
            this.game_waiting_instance = game_instance;
            this.game_waiting_player += 1;

        }

    } else {

        // => there is no game waiting for players
        this.log('\t :: Game Server :: There is no game waiting.')
        player.emit('update wait status', 'No game found. Creating a game...');

        // Create a new game, so other players can join
        this.createGame(player, sio);
        this.log('\t :: Game Server :: Game ' + this.game_waiting_instance.id + ' has been created and is waiting for other players (' + this.game_waiting_player + '/' + MAX_PLAYER + ').');
        player.join(this.game_waiting_instance.id);
        this.log('\t :: Game Server :: Player ' + player.username + ' (' + player.userid + ') joined room ' + this.game_waiting_instance.id);
        player.emit('update wait status', 'Waiting for other players (' + this.game_waiting_player + '/' + MAX_PLAYER + ')');

        // Add player to waiting game
        this.game_waiting_players.push(player);
        this.game_waiting_instance.player_clients.push(player);
    }

}


// Create a game
game_server.createGame = function(player, sio) {

    //Create a new game instance
    var game_instance = {
        id : UUID(),                 //generate a new id for the game
        player_clients : [],         //nobody else joined yet, since its new
        player_count : 1             //for simple checking of state
    };

    //Store it as the current waiting game
    this.game_waiting = true;
    this.game_waiting_instance = game_instance;
    this.game_waiting_player = 1;

    //Create a new game core instance and start the game loop
    game_instance.gamecore = new game_core( game_instance, sio );

    //Set game for player
    player.game = game_instance;
    
    this.log('\t :: Game Server :: Game ' + player.game.id + ' has been opened by player ' + player.username + ' (' + player.userid + ').');

    //Return the game
    return game_instance;

};



// Start a game
game_server.startGame = function(game_instance) {

    // Init the game
    game_instance.gamecore.init(game_instance);

    //Add game to list
    this.games_active[game_instance.id] = game_instance;
    this.games_active_count += 1;

    // Start the game
    game_instance.gamecore.start();

};