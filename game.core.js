/* The game_core class */

var game_core = function(game_instance, sio){

    //Store the instance, if any
    this.instance = game_instance;
    this.sio = sio;
    this.user1;
    this.user2;
    this.user3;
    this.user4;
    this.wins = [];

    //Wrapper for simply toggle logging
    this.log = function() {
        if(true) console.log.apply(this,arguments);
    };

};

//server side we set the 'game_core' class to a global type, so that it can use it anywhere.
if( 'undefined' != typeof global ) {
    module.exports = global.game_core = game_core;
}

game_core.prototype.init = function(game_instance){

    var usersConnected = [];

    this.log('\t ::  Game Core  :: Starting game ' + this.instance.id);

    // Update instance
    this.instance = game_instance;

    // Start game on clients
    this.sio.sockets.to(this.instance.id).emit('start game', {gameid : this.instance.id});
    this.log('\t ::  Game Core  :: Game started on clients');

    // Set users
    this.user1 = this.instance.player_clients[0];
    this.user2 = this.instance.player_clients[1];
    this.user3 = this.instance.player_clients[2];
    this.user4 = this.instance.player_clients[3];
    this.user1.pos = 1;
    this.user2.pos = 2;
    this.user3.pos = 3;
    this.user4.pos = 4;
    this.log('\t ::  Game Core  :: User 1: ' + this.user1.username);
    this.log('\t ::  Game Core  :: User 2: ' + this.user2.username);
    this.log('\t ::  Game Core  :: User 3: ' + this.user3.username);
    this.log('\t ::  Game Core  :: User 4: ' + this.user4.username);

    // Send each client all usernames and then who they are
    this.sio.sockets.to(this.instance.id).emit('send players', { user1 : this.user1.username,
                                                                user2 : this.user2.username,
                                                                user3 : this.user3.username,
                                                                user4 : this.user4.username
    });
    var i = 1;
    this.instance.player_clients.forEach(function(player) {
        player.emit('whoami', i);
        i += 1;
    }, this);
    this.log('\t ::  Game Core  :: Usernames send to clients');

    // Init drawing event
    this.instance.player_clients.forEach(function(player) {
        player.on('drawing', function (data) {
            player.broadcast.emit('drawing', data);
        });
    }, this);

}

game_core.prototype.start = function() {

    const START_TIME = 60;
    const MAX_ROUNDS = 8;

    var obj = this;

    var sio = this.sio;
    var instance = this.instance;
    var user1 = this.user1;
    var user2 = this.user2;
    var user3 = this.user3;
    var user4 = this.user4;
    var userList = [user1, user2, user3, user4];

    var round;
    var drawer;
    var word;
    var timer;
    var time;
    var wins = [];

    newRound(1, user1, getRandomWord());

    // Start a new round
    function newRound(i_round, i_drawer, i_word) {

        round = i_round;
        drawer = i_drawer;
        word = i_word;

        obj.log('\t ::  Game Core  :: Send new round information');

        drawer.broadcast.emit('new round', {round   : round,
                                            drawer  : {
                                                    pos         : drawer.pos,
                                                    username    : drawer.username
                                            },
                                            word    : '?'});

        drawer.emit('new round', {  round   : round,
                                    drawer  : {
                                            pos         : drawer.pos,
                                            username    : drawer.username
                                    },
                                    word    : word});

        obj.log('\t ::  Game Core  :: Start timer');
        startTimer(START_TIME);

    }

    // Check, if game ends else set new drawer and word and initiate new round
    function checkNewRound() {

        obj.log('\t ::  Game Core  :: Check for new round');
        var new_round = round + 1;

        if (new_round <= MAX_ROUNDS) {

            var new_drawer;
            switch (drawer.pos) {
                case 1:
                    new_drawer = user2;
                    break;
                case 2:
                    new_drawer = user3;
                    break;
                case 3:
                    new_drawer = user4;
                    break;
                default:
                    new_drawer = user1;
            }

            newRound(new_round, new_drawer, getRandomWord());

        } else {

            obj.log('\t ::  Game Core  :: Send end game');
            sio.sockets.to(instance.id).emit('end game', 'Das Spiel ist beendet.');
            obj.wins = wins;
            obj.end();

        }

    }

    // Initiates and runs the timer
    function startTimer(start_time) {

        obj.log('\t ::  Game Core  :: Timer started');
        var time = start_time;

        timer = setInterval(function() {

            updateTimer(time);

            time -= 1;

        }, 1000);
    }

    // Updates the timer on clients side and checks, if time is over
    function updateTimer(i_time) {

        obj.log('\t ::  Game Core  :: Check timer update');

        if (i_time >= 0) {

            obj.log('\t ::  Game Core  :: Update timer');
            time = i_time;
            sio.sockets.to(instance.id).emit('update timer', i_time);

        } else {

            obj.log('\t ::  Game Core  :: Round ended');
            clearInterval(timer);
            wins.push({user : 'none', time : 'none'});
            sio.sockets.to(instance.id).emit('end round', 'Die Zeit ist abgelaufen.');
            setTimeout(checkNewRound, 3000);

        }

    }

    // Get word guesses
    userList.forEach(function(user) {
        user.on('guess word', function(i_word) {
            
             sio.sockets.to(instance.id).emit('word guessed', {word : i_word, username : user.username});

             if (wordIsOk(i_word)) {

                clearInterval(timer);
                var timeNeeded = START_TIME - time;
                wins.push({user : user, time : timeNeeded});
                sio.sockets.to(instance.id).emit('end round', user.username + ' hat das Wort erraten!<br /><br />Das Wort war: ' + word + '.');
                setTimeout(checkNewRound, 3000);

             }

        });
    }, this);

    // Function to verify if the guessed word is considered right
    function wordIsOk(i_word) {

        if (i_word == word) {
            return true;
        } else {
            return false
        }

    }

    function getRandomWord() {
        // TODO: Wort wird noch statisch gesetzt
        return 'Elefant';
    }

}

game_core.prototype.end = function() {

    var obj = this;

    var sio = this.sio;
    var instance = this.instance;
    var wins = this.wins;
    var user1 = this.user1;
    var user2 = this.user2;
    var user3 = this.user3;
    var user4 = this.user4;
    var userList = [user1, user2, user3, user4];

    var winsPerUser = [];

    // Get wins per user
    this.log('\t ::  Game Core  :: End game');
    getWinsPerUser();
    sortWinsPerUser();
    sendResults();

    function sendResults() {
        sio.sockets.to(instance.id).emit('game result', {   rank1 : winsPerUser[0].user.username + ' (' + winsPerUser[0].wins + ' Richtige, ' + winsPerUser[0].time + ' Sekunden)',
                                                            rank2 : winsPerUser[1].user.username + ' (' + winsPerUser[1].wins + ' Richtige, ' + winsPerUser[1].time + ' Sekunden)',
                                                            rank3 : winsPerUser[2].user.username + ' (' + winsPerUser[2].wins + ' Richtige, ' + winsPerUser[2].time + ' Sekunden)',
                                                            rank4 : winsPerUser[3].user.username + ' (' + winsPerUser[3].wins + ' Richtige, ' + winsPerUser[3].time + ' Sekunden)'
                                                        });
    }

    function getWinsPerUser() {

        userList.forEach(function(user) {

            var winsOfUser = 0;
            var timeOfUser = 0;
            
            wins.forEach(function(round) {

                if (round.user.userid === user.userid) {
                    // => user won the round
                    winsOfUser += 1;
                    timeOfUser += round.time;
                }

            }, this);

            winsPerUser.push({user : user, wins : winsOfUser, time : timeOfUser});

        }, this);

    }

    function sortWinsPerUser() {

        winsPerUser.sort(function(x, y) {
            var n = y.wins - x.wins;
            if(n != 0) {
                return n;
            }
            return x.time - y.time;
        });

    }

}