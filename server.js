require('dotenv').config();
const express    = require('express');
const bodyParser = require('body-parser');
const expect     = require('chai');
const helmet     = require('helmet');

const fccTestingRoutes = require('./routes/fcctesting.js');
const runner           = require('./test-runner.js');
const { Socket } = require('dgram');

const app    = express();
const server = require('http').createServer(app);
const io     = require('socket.io')(server);

app.use('/public', express.static(process.cwd() + '/public'));
app.use('/assets', express.static(process.cwd() + '/assets'));

//set helmet
app.use(helmet());

//additionally, manually set required headers
app.use(function (req, res, next){
  res.set({
    'surrogate-control': 'no-store',
    'cache-control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'pragma': 'no-cache',
    'expires': '0',
    'x-powered-by': 'PHP 7.4.3'
  });
  next();
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Index page (static HTML)
app.route('/')
  .get(function (req, res) {
    res.sendFile(process.cwd() + '/views/index.html');
  });

app.route('/img/:file')
  .get(function (req, res) {
    res.sendFile(process.cwd() + '/img/' + req.params.file);
  }); 

//For FCC testing purposes
fccTestingRoutes(app);
    
// 404 Not Found Middleware
app.use(function(req, res, next) {
  res.status(404)
    .type('text')
    .send('Not Found');
});

var gameOver = false;
var currentPlayers = [];
var validPlayers = [1,2,3,4]
var chkpt = {
  x: 320,
  y: 240,
  value: 1,
  id: 'chkpt1',
  locations: [[400,240]]
}
var distance = (arr1, arr2) => {
  if (arr1.length === 0 || arr2.lenth === 0){
    console.log('Something broke in the distance checker');
  }
  let x1 = arr1[0], y1 = arr1[1];
  let x2 = arr2[0], y2 = arr2[1];
  return Math.sqrt( (x1-x2)**2 + (y1-y2)**2 )
}

//set up the current games collectible positions, default to 20
//always start in middle
function genChkptLocations(){
  for(let i=1; i<20; i++){
    let newX=Math.random()*480+160, newY = Math.random()*479;
    let prevChkpt = chkpt.locations[i-1];
    while(  newX<160 || newY<1 ||
            newX>592 || newY>432 ||
            distance([newX, newY], [prevChkpt[0], prevChkpt[1]]) < 125){
      newX = Math.random()*479+160;
      newY = Math.random()*479;
    }
    chkpt.locations.push([newX, newY]);
  }
}

genChkptLocations();
//console.log('Generated checkpoint locations: ');
//console.log(chkpt.locations);

currentPlayers.push(chkpt)

var defaultPlayerStart = (playerId) => {
  switch (playerId) {
    case 1:
      return [192, 32];
    case 2:
      return [544, 32];
    case 3:
      return [192, 384];
    case 4:
      return [544, 384];
  }
}


//main socket stuff
io.on('connection', client => {
  var thisPlayer = {};
  if (currentPlayers.length < 5){

    //if no players, assign player 1
    if(currentPlayers.length === 0){
      thisPlayer.id = 1;
    //otherwise, return the lowest number not yet logged in
    } else {
      thisPlayer.id = validPlayers.filter( value => {
        var exists = false;
        currentPlayers.forEach( player => {
          if (player.id === value)
            exists = true;
        })
        return !exists;
      })[0]
    }
    //assign starting pos based on number
    let startCoords = defaultPlayerStart(thisPlayer.id);
    thisPlayer.x = startCoords[0];
    thisPlayer.y = startCoords[1];

    thisPlayer.score = 0;
    thisPlayer.currDir = '';
    currentPlayers.push(thisPlayer)
    console.log(currentPlayers);
  }
  else {
    thisPlayer = {
      id: 'obs',
      x: 0,
      y: 0,
      score: 0,
      counter: 0
    }
  }

  function pIndex (playerArray, player) {
    return playerArray.findIndex( object => object.id === player.id )
  }

  //send new player their info and the game state
  client.emit('connected', thisPlayer, currentPlayers);
  console.log(`Player ${thisPlayer.id} connected.`);

  //send other players the new player info
  io.emit('playerupdate', thisPlayer);

  //on receiving a moving player, update server and others on its location
  client.on('playermove', function(newPlayer) {
    let moveIndex = pIndex(currentPlayers, newPlayer);

    if (moveIndex !== -1){
      Object.assign(currentPlayers[moveIndex], newPlayer);
      io.emit('playerupdate', newPlayer);
    }
  });

  //on receiving a chkpt touch, update server and everyone on its location
  client.on('chkpt-get', function (playerId, chkptId) {
    if (chkptId === currentPlayers[0].id) {
      let scoringPlayerInd = currentPlayers.findIndex(value => value.id === playerId);
      let nextChkptNum = Number(chkptId.slice(chkptId.split('').findIndex( value => Number.isInteger(Number(value)))))+1;
      currentPlayers[scoringPlayerInd].score += 1;

      //was that the last checkpoint?
      if (nextChkptNum == 21){
        //end the game
        gameOver = true;
        io.emit('game-over', playerId);
        console.log('Last checkpoint reached!');
      }
      else {
        //increase chkpt number
        currentPlayers[0].id = `chkpt${nextChkptNum}`;

        //set new coords
        currentPlayers[0].x  = chkpt.locations[nextChkptNum-1][0];
        currentPlayers[0].y  = chkpt.locations[nextChkptNum-1][1];

        //send the new chkpt info, and the id of the player who scored
        io.emit('chkpt-update', currentPlayers[0], playerId);
        console.log(`Checkpoint #${nextChkptNum-1} 'get' by Player #${playerId}`);
      }
    }
  });

  //handle game reset request
  client.on('reset-request', client => {
    if (gameOver == true){
      gameOver = false;

      //new checkpoint locations, reset to default;
      chkpt.locations = [[400,240]];
      genChkptLocations();
      currentPlayers[0].locations = chkpt.locations;
      currentPlayers[0].id = 'chkpt1';
      currentPlayers[0].x = chkpt.locations[0][0];
      currentPlayers[0].y = chkpt.locations[0][1];

      //reset players
      currentPlayers.forEach(object => {
        if (Number.isInteger(object.id)){
          let startCoords = defaultPlayerStart(object.id);
          object.x     = startCoords[0];
          object.y     = startCoords[1];
          object.score = 0;
        }
      });

      //send out the new game state info
      io.emit('new-game', currentPlayers);

    }
    else{
      console.log(`Reset requested, game isn't over yet!`);
    }
  });

  //handle client disconnect
  client.on('disconnect', client => {
    console.log(`Player ${thisPlayer.id} disconnected.`);
    currentPlayers.splice(currentPlayers.findIndex(value => {
      if (value.id === thisPlayer.id) return true;
      else return false;
    }), 1);
    io.emit('player-disconnect', thisPlayer.id);

    //reset the game if game is empty
    if (currentPlayers.length === 1) {
      chkpt.locations = [[400,240]];
      genChkptLocations();
      currentPlayers[0].locations = chkpt.locations;
      currentPlayers[0].id = 'chkpt1';
      currentPlayers[0].x = chkpt.locations[0][0];
      currentPlayers[0].y = chkpt.locations[0][1];
      console.log('Game is empty, resetting checkpoints.');
    }
  });
});

const portNum = process.env.PORT || 3000;

// Set up server and tests
server.listen(portNum, () => {
  console.log(`Listening on port ${portNum}`);
  if (process.env.NODE_ENV==='test') {
    console.log('Running Tests...');
    setTimeout(function () {
      try {
        runner.run();
      } catch (error) {
        console.log('Tests are not valid:');
        console.error(error);
      }
    }, 1500);
  }
});

module.exports = app; // For testing
