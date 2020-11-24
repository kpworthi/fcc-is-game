import Player from './Player.mjs';
import Collectible from './Collectible.mjs';

const socket = io();
const canvas = document.getElementById('game-window');
const context = canvas.getContext('2d');

//cache image function
const loadImg = (src) => {
  const tempImg = new Image();
  tempImg.src = src;
  return tempImg;
}

//images to load
const ship1 = loadImg('../img/ship1.png');
const ship2 = loadImg('../img/ship2.png');
const ship3 = loadImg('../img/ship3.png');
const ship4 = loadImg('../img/ship4.png');
const collect = loadImg('../img/collect.png');
const ships = {ship1: ship1, ship2: ship2, ship3: ship3, ship4: ship4};
const plyrColors = ['Red','Yellow','Blue','Green'];

//list of valid key press codes and corresponding argument to pass
const validKeys        = ["KeyW", "ArrowUp", "KeyA", "ArrowLeft", "KeyS", "ArrowDown", "KeyD", "ArrowRight"]
const playerDirections = ["up",   "up",      "left", "left",      "down", "down",      "right", "right"    ]

//movement speed and direction
const playerSpeed = 4;

//game states
var currentPlayer = {}; //the client's player object
var currentGame = [];   //the client's list of everything in the game
var gameTick;           //the animation time
var gameMessage = '';   //message in the score area
var gameMessageTimer;   //timer id for timing-out the gameMessage
var superMessage = '';  //message on game-over
var currChkpt    = 'chkpt1';
var currChkptNum = '1';

document.addEventListener('keydown', keyListener);
document.addEventListener('keyup', keyListener);

//add the movement key listener
function keyListener (event) {
  const keyIndex = validKeys.indexOf(event.code);
  if (event.code === 'KeyR') socket.emit('reset-request');
  else if (keyIndex === -1) return null;
  event.preventDefault();

  let dir = playerDirections[keyIndex];
  let playerInd = currentGame.findIndex(value => value.id == currentPlayer.id);

  //if key is being released, remove direction from movement
  //add momentum============================================
  if (event.type === 'keyup'){
    currentPlayer.lastFacing = currentPlayer.currDir;
    currentPlayer.currDir    = currentPlayer.currDir.replace(dir, '');

    //if momentum list doesn't include this dir, add it. if it does, refresh the speed on it
    if (currentGame[playerInd].momentum.every(vector => vector[0] !== dir)) currentGame[playerInd].momentum.push([dir, playerSpeed]);
    else currentGame[playerInd].momentum.find(vector => vector[0] === dir)[1] = playerSpeed;
    currentGame[playerInd].currDir    = currentPlayer.currDir;
    currentGame[playerInd].lastFacing = currentPlayer.lastFacing;
    if (currentPlayer.currDir.length === 0)
      socket.emit('playermove', currentGame[playerInd]);
  }
  else{
    //add key to movement list if it isn't there already, otherwise ignore
    if (!currentPlayer.currDir.includes(dir)){
      currentGame[playerInd].currDir =  currentPlayer.currDir += dir;
    }
  }
}

//doing canvas draws
function canvasDraw (){
  //context.clearRect(0,0,640,480);
  context.fillStyle = 'black';
  context.fillRect(0, 0, canvas.width, canvas.height);

  //dividing line
  context.strokeStyle = 'white';
  context.strokeRect(160, 0, 2, 480)
  context.stroke();


  //game text
  context.fillStyle = 'white';
  context.font = '20px serif';
  context.fillText('Space Race', 5, 25, 155);
  context.fillStyle = '#EEE';
  context.fillText(`Score: ${currentGame.find(object => object.id === currentPlayer.id).score}`, 5, 50, 155);
  context.fillText(`${currentPlayer.calculateRank(currentGame)}`, 5, 80, 155);
  context.fillText(`Checkpoint#${currChkptNum}`, 5, 110, 155);

  //chkpt-get alert
  if (gameMessage){
    fillColor(gameMessage)
    context.fillText(gameMessage, 5, 140, 155);
  }
  
  //game over message
  if (superMessage){
    context.fillStyle = 'white';
    context.font = '40px serif';
    context.fillText(superMessage, 260, 200);
    context.fillText('Press "R" to restart.', 200, 300)
  }

  //draw players
  let players = currentGame.filter(value => Number.isInteger(value.id));
  players.forEach( player => {
    if (player.currDir.length > 0 || player.momentum.length > 0) {
      //move client's player from key press
      player.movePlayer(player.currDir, playerSpeed);

      //move client's player from momentum
      player.driftPlayer();

      if (currentPlayer.id == player.id) socket.emit('playermove', player);
      if (player.collision(currChkpt) && currentPlayer.id == player.id){
        currChkpt.x = -50; currChkpt.y = -50;
        socket.emit('chkpt-get', currentPlayer.id, currChkpt.id);
      }
    }
    context.save();
    rotateShip(player);
    context.drawImage(ships['ship'+player.id], player.x, player.y);
    context.restore();
  });
  context.drawImage(collect, currChkpt.x, currChkpt.y);

  gameTick = requestAnimationFrame(canvasDraw);

}

//context text-fill color chooser based on player
function fillColor (gameString) {
  if (gameString.includes('Red'))
    context.fillStyle = 'red';
  else if (gameString.includes('Yellow'))
    context.fillStyle = 'yellow';
  else if (gameString.includes('green'))
    context.fillStyle = 'green';
  else if (gameString.includes('blue'))
    context.fillStyle = 'blue';
  else 
    context.fillStyle = 'white';
}

//rotating ship sprites
function rotateShip (player){
  let rotation = 0,
      direction = player.currDir || player.lastFacing || '';
  if (direction==='up')
    return null; //up is default facing
  else if (direction.startsWith('upleft') || direction.startsWith('leftup'))
    rotation = 315;
  else if (direction.startsWith('upright') || direction.startsWith('rightup'))
    rotation = 45;
  else if (direction.startsWith('downleft') || direction.startsWith('leftdown'))
    rotation = 225;
  else if (direction.startsWith('downright') || direction.startsWith('rightdown'))
    rotation = 135;
  else if (direction.startsWith('right'))
    rotation = 90;
  else if (direction.startsWith('down'))
    rotation = 180;
  else if (direction.startsWith('left'))
    rotation = 270;
  
  //do something transform-y here
  context.translate(player.x + 24, player.y + 24);
  context.rotate((rotation*Math.PI) / 180);
  context.translate(-(player.x + 24), -(player.y + 24));
}

//setting game messages
function displayMessage (messageStr){
  if (gameMessageTimer) window.clearTimeout(gameMessageTimer);
  gameMessage = messageStr;
  gameMessageTimer = window.setTimeout(() => {
    gameMessage = '';
    gameMessageTimer = null;
  }, 3*1000);
}

//set initial player data
socket.on('connected', (playerInfo, gameState) => {
  console.log(`Connected as Player ${playerInfo.id}!`)

  //reset instance if reconnection due to server restart
  if (gameTick) cancelAnimationFrame(gameTick);
  superMessage = '';
  currentGame = [];

  currentPlayer = new Player(playerInfo);
  gameState.forEach( object => {
    if (Number.isInteger(object.id)){
      currentGame.push(new Player(object));
    }
    else if (object.id.startsWith('chkpt')) {
      currentGame.push(new Collectible(object))//object.x, object.y, object.value, object.id))
      currChkpt = currentGame[currentGame.length-1];
      currChkptNum = currChkpt.id.slice(currChkpt.id.split('').findIndex( value => Number.isInteger(Number(value))))
    }
  });
  canvasDraw();
})

//handle a single player updating
socket.on('playerupdate', function(newPlayer){
  if (newPlayer.id !== currentPlayer.id) {
    //get the player-to-update's index in the game state
    let updPlayerInd = currentGame.findIndex( object => object.id == newPlayer.id);
    if (updPlayerInd !== -1) {
      Object.assign(currentGame[updPlayerInd], newPlayer);
    }
    else {
      currentGame.push(new Player(newPlayer));
    }
  }
});

//handle a player disconnect
socket.on('player-disconnect', function(playerId){
  let playerIndex = currentGame.findIndex(object => object.id == playerId);
  currentGame.splice(playerIndex, 1);
});

//handle receiving new checkpoint info
//this is passed the scoring player info
//and the new coords for the chkpt
socket.on('chkpt-update', function (newChkpt, playerId){
  Object.assign(currChkpt, newChkpt);
  currChkptNum = currChkpt.id.slice(currChkpt.id.split('').findIndex( value => Number.isInteger(Number(value))));
  currentGame.filter(value => value.id === playerId)[0].score += 1;
  displayMessage(`+1pt for ${plyrColors[playerId-1]}!`);
});

//handle game-over
socket.on('game-over', function (playerId){
  displayMessage(`+1pt for ${plyrColors[playerId-1]}!`);
  currentGame.filter(value => value.id === playerId)[0].score += 1;
  let sortedPlayerList = currentGame.filter(value => Number.isInteger(value.id)).sort( (a,b) => b.score - a.score);
  let winningPlayer = plyrColors[sortedPlayerList[0].id-1];
  superMessage = `${winningPlayer} won!!`;
  if (playerId !== currentPlayer.id) currChkpt.x = -50; currChkpt.y = -50;
});

//handle new-game
socket.on('new-game', function (gameState){
  displayMessage(`A new game has started!!`)
  superMessage = '';
  currentGame = [];
  console.log(gameState);
  gameState.forEach( object => {
    if (Number.isInteger(object.id)){
      currentGame.push(new Player(object));
      if (object.id === currentPlayer.id){
        Object.assign(currentPlayer, object);
      }
    }
    else if (object.id.startsWith('chkpt')) {
      currentGame.push(new Collectible(object))//object.x, object.y, object.value, object.id))
      currChkpt = currentGame[currentGame.length-1];
      currChkptNum = currChkpt.id.slice(currChkpt.id.split('').findIndex( value => Number.isInteger(Number(value))))
    }
  });
  console.log(currentGame);
});
