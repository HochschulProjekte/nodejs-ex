$(function() {


	//Global variables
	var socket;
	var userid;
	var username;
	var gameid;
	var user;
	var drawer = false;

	initUserInputListeners();


	function initUserInputListeners() {

		// Login-Button
		$('#loginBtn').click( function(){ login( cleanInput( $('.usernameInput').val().trim() ) ) });

		$(window).keydown(function (event) {
			if (event.which === 13) {
				login( cleanInput( $('.usernameInput').val().trim() ) );
			}
		});

	}



	function login(i_username) {

		username = i_username;

		// Connect the client
		socket = io.connect();

		// Get the userid and send the username to the server
		socket.on('send userid get username', function(data, callback) {
			userid = data.userid;
			callback(username);

			if (userid) {
				// Continue to waiting overview
				wait();
			}
		});

	}

	function wait() {
		// Show waiting overview
		$('.login.page').fadeOut();
		$('.wait.page').show();

		// Get new status updates
		socket.on('update wait status', function(text) {
			$('.wait.page .title').html(text);
		});

		// Get starting moment
		socket.on('start game', function(data) {
			gameid = data.gameid;
			initGame();
		});
	}

	function initGame() {
		// Show game overview
		$('.wait.page').fadeOut();
		$('.game.page').show();

		// Update player names
		socket.on('send players', function(data) {
			$('#username-1').html(data.user1);
			$('#username-2').html(data.user2);
			$('#username-3').html(data.user3);
			$('#username-4').html(data.user4);
		});

		// Get my player
		socket.on('whoami', function(me) {
			user = me;
			$('#user-' + user).addClass('me');
		});

		// Set chat-scrollbar
		$('#chat').mCustomScrollbar({
			axis: 'y',
			theme: 'minimal-dark',
			scrollbarPosition: 'inside'
		});

		// Init drawable canvas
		var canvasDiv = document.getElementById('drawing-area');
		var canvas = document.getElementById('drawing-canvas');
		canvas.setAttribute('width', canvasDiv.offsetWidth);
    	canvas.setAttribute('height', canvasDiv.offsetHeight);
		if(typeof G_vmlCanvasManager != 'undefined') {
			canvas = G_vmlCanvasManager.initElement(canvas);
		}
		var context = canvas.getContext("2d");
		var current = {};
		var drawing = false;

		canvas.addEventListener('mousedown', onMouseDown, false);
		canvas.addEventListener('mouseup', onMouseUp, false);
		canvas.addEventListener('mouseout', onMouseUp, false);
		canvas.addEventListener('mouseleave', onMouseUp, false);
		canvas.addEventListener('mousemove', throttle(onMouseMove, 10), false);
		canvas.addEventListener("touchstart", onMouseDown, false);
		canvas.addEventListener("touchmove", throttle(onMouseMove, 10), false);
		canvas.addEventListener("touchend", onMouseUp, false);
		canvas.addEventListener("touchcancel", onMouseUp, false);

		function onMouseDown(e){
			if (drawer){
				drawing = true;
				current.x = (e.changedTouches ? e.changedTouches[0].clientX : e.clientX) - canvas.offsetLeft;
				current.y = (e.changedTouches ? e.changedTouches[0].clientY : e.clientY) - canvas.offsetTop - document.getElementById('header').offsetHeight;
			}
		}

		function onMouseUp(e){
			if (drawer){
				if (!drawing) { return; }
				drawing = false;
				drawLine(current.x, current.y, (e.changedTouches ? e.changedTouches[0].clientX : e.clientX) - canvas.offsetLeft, (e.changedTouches ? e.changedTouches[0].clientY : e.clientY) - canvas.offsetTop - document.getElementById('header').offsetHeight, true);
			}
		}

		function onMouseMove(e){
			if (drawer){
				if (!drawing) { return; }

				drawLine(current.x, current.y, (e.changedTouches ? e.changedTouches[0].clientX : e.clientX) - canvas.offsetLeft, (e.changedTouches ? e.changedTouches[0].clientY : e.clientY) - canvas.offsetTop - document.getElementById('header').offsetHeight, true);
				current.x = (e.changedTouches ? e.changedTouches[0].clientX : e.clientX);
				current.y = (e.changedTouches ? e.changedTouches[0].clientY : e.clientY) - canvas.offsetTop - document.getElementById('header').offsetHeight;

				e.preventDefault();
			}
		}

		function throttle(callback, delay) {
			var previousCall = new Date().getTime();
			return function() {
				var time = new Date().getTime();

				if ((time - previousCall) >= delay) {
				previousCall = time;
				callback.apply(null, arguments);
				}
			};
		}

		function onDrawingEvent(data){
			var w = canvas.width;
			var h = canvas.height;
			drawLine(data.x0 * w, data.y0 * h, data.x1 * w, data.y1 * h);
		}

		socket.on('drawing', onDrawingEvent);

		function drawLine(x0, y0, x1, y1, emit){
			context.beginPath();
			context.moveTo(x0, y0);
			context.lineTo(x1, y1);
			context.strokeStyle = 'black';
			context.lineJoin = "round";
			context.lineWidth = 1;
			context.stroke();
			context.closePath();

			if (!emit) { return; }
			var w = canvas.width;
			var h = canvas.height;

			socket.emit('drawing', {
				x0: x0 / w,
				y0: y0 / h,
				x1: x1 / w,
				y1: y1 / h
			});
		}

		startGame();
	}

	function startGame() {

		var round;
		var drawer_pos;
		var drawer_username;
		var word;

		// Event Listeners
		$('#input-send').click(function() {
			socketGuessWord( $('#input-word').val() );
			$('#input-word').val('');
		});

		$(window).keydown(function (event) {
			if (event.which === 13) {
				socketGuessWord( $('#input-word').val() );
				$('#input-word').val('');
			}
		});

		// Change-ui functions

		function updateUI() {
			console.log('updateUI called');
			$('#header .word').html(word);
			$('.user').each(function(){
				$(this).removeClass('active');
				$(this).children().children().children('strong').html('Rater');
			});
			$('#user-' + drawer_pos).addClass('active');
			$('#role-' + drawer_pos).html('Zeichner');
			if (drawer) {
				$('#input-word').prop('disabled', true);
			} else {
				$('#input-word').prop('disabled', false);
			}
			var canvas = document.getElementById('drawing-canvas');
			var context = canvas.getContext("2d");
			context.clearRect(0, 0, canvas.width, canvas.height);
		}

		function updateTimer(time) {
			$('#header .time').html(time);
		}

		function addWordToChat(word, username) {
			console.log('addWordToChat called');
			var html = ' \
				<div class="message"> \
					<div class="username">' + username + '</div> \
					<div class="text">' + word + '</div> \
				</div> \
			';
			$('#chat .mCSB_container').append(html);
			$('#chat').mCustomScrollbar('scrollTo', 'last');
		}

		function addEndRoundToChat(text) {
			console.log('addEndRoundToChat called');
			var html = ' \
			 	<div class="message"> \
				 	<div class="system">' + text + '</div> \
				</div> \
			';
			$('#chat .mCSB_container').append(html);
			$('#chat').mCustomScrollbar('scrollTo', 'last');
		}

		function announceNewRound() {
			console.log('announceNewRound called');
			$('#popupNew').html('Runde: ' + round + '<br /><br />Zeichner: ' + drawer_username);
			$('#overlayNew').fadeIn('slow', function () {
				console.log('New round overlay faded in');
				$(this).delay(2500).fadeOut('slow', function () {
					console.log('New round overlay faded out');
				});
			});
		}

		function announceEndRound(text) {
			console.log('announceEndRound called');
			$('#popupEnd').html(text);
			$('#overlayEnd').fadeIn('slow', function () {
				console.log('End round overlay faded in');
				$(this).delay(2500).fadeOut('slow', function () {
					console.log('End round overlay faded out');
				});
			});
		}

		// Socket Senders

		// Send a guess
		function socketGuessWord(word) {
			console.log('socketGuessWord called');
			
			// Check, if word is empty
			if (!word.trim()) {
				return 0;
			} else {
				
				socket.emit('guess word', word);

			}

		}

		// Socket Listeners

		// New round
		socket.on('new round', function(data) {
			console.log('Server send "new round"');

			round = data.round;
			drawer_pos = data.drawer.pos;
			drawer_username = data.drawer.username;
			word = data.word;
			if (drawer_pos == user) {
				drawer = true;
			} else {
				drawer = false;
			}

			announceNewRound();
			updateUI();
		});

		// End round
		socket.on('end round', function(text) {
			console.log('Server send "end round"');
			
			announceEndRound(text);
			addEndRoundToChat(text);
		});

		// Timer update
		socket.on('update timer', function(time) {
			updateTimer(time);
		});

		// Word guessed
		socket.on('word guessed', function(data) {
			console.log('Server send "word guessed"');

			addWordToChat(data.word, data.username);
		});

		// End game
		socket.on('end game', function(data) {
			console.log('Server send "end game"');

			endGame();
		});

	}

	function endGame() {

		// Show game overview
		$('.game.page').fadeOut();
		$('.end.page').show();

		function setRanklist(data) {
			$('#rank-1').html(data.rank1);
			$('#rank-2').html(data.rank2);
			$('#rank-3').html(data.rank3);
			$('#rank-4').html(data.rank4);
		}

		socket.on('game result', function(data) {
			setRanklist(data);
		});

	}




	// Prevents input from having injected markup
	function cleanInput (input) {
		return $('<div/>').text(input).html();
	}


});