//import { throws } from "assert";

class Player {
  constructor({x, y, score, id}) {
    this.x      = x;
    this.y      = y;
    this.score  = score;
    this.id     = id;

    this.currDir    = '';
    this.momentum = [];
    this.lastFacing = 'up';
  }

  movePlayer(dir, speed) {
    if (dir.includes('up') && this.y-speed > 0)
        this.y -= speed;
    if (dir.includes('left') && this.x-speed > 160)
        this.x -= speed;
    if (dir.includes('down') && this.y+speed < 432)
        this.y += speed;
    if (dir.includes('right') && this.x+speed < 592)
        this.x += speed;
  }

  driftPlayer() {
    // this modifies the momentum array by adjusting speed and removing negative values in one pass.
    // the array is modified in place
    this.momentum.filter( vector => {
      let dir = vector[0];
      let speed = vector[1];

      if(speed <= 0) return false

      if (dir == 'up' && this.y-speed > 0){
        this.y -= speed;
        vector[1] -= 0.1;
      } else if (dir == 'left' && this.x-speed > 160){
        this.x -= speed;
        vector[1] -= 0.1;
      } else if (dir == 'down' && this.y+speed < 432){
        this.y += speed;
        vector[1] -= 0.1;
      } else if (dir == 'right' && this.x+speed < 592){
        this.x += speed;
        vector[1] -= 0.1;
      }
      
      return true;
    });

  }

  collision(item) {
    /* stuff for doing stricter detection, not yet implemented
    let direction = this.currDir;
    let diag = '';

    if (direction.startsWith('upleft') || direction.startsWith('leftup') ||
        direction.startsWith('downright') || direction.startsWith('rightdown'))
      diag = 'bck';
    else if (direction.startsWith('upright') || direction.startsWith('rightup') ||
             direction.startsWith('downleft') || direction.startsWith('leftdown'))
      diag = 'fwd';
    */
    if (
        this.x + 6 < item.x + 43 && this.x + 42 > item.x + 5 &&
        this.y + 6 < item.y + 43 && this.y + 42 > item.y + 5
       ){
      return true;
    }
    return false;
  }

  calculateRank(arr) {
    //take an array of objects containing playerid and score
    let playerArr = arr.filter(value => Number.isInteger(value.id));
    let sortedScores = playerArr.sort( (a,b) => b.score - a.score);
    
    return  `Rank: ${sortedScores.findIndex( player => player.id === this.id) + 1}/${playerArr.length}`;
  }
}

export default Player;
