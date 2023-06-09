/*
---------------------------------------
           www.pentago.net
---------------------------------------

https://github.com/basedryo/pentago.net
*/

// Board module contains game rules and methods
import Board from './game-board.js';

var HOST = location.origin.replace(/^http/, 'ws')
const IP = 'pentago.herokuapp.com/';
console.log('[DATA] Host: ', HOST);
var el;
const playername = localStorage.getItem("nickname");
console.log('[DATA] Player name: ', playername);
const gType = localStorage.getItem("gType");
console.log('[DATA] Game type (0: public, 1: private): ', gType);
const gKey = localStorage.getItem("gKey");
console.log("[DATA] Game R-Key: ", gKey);

function truncate(str, length) {
  if (str.length > length) {
    return str.slice(0, length) + '...';
  } else return str;
}

// Takes the screenshot of the game with html2canvas implicitly imported
async function captureGameBoard(scene, x, y, width, height) {
  return new Promise((resolve) => {
    scene.game.renderer.snapshot((image) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      context.drawImage(image, x, y, width, height, 0, 0, width, height);
      resolve(canvas.toDataURL('image/png'));
    });
  });
}

// Main game class
class GameScene extends Phaser.Scene {
  constructor() {
    super("gameScene");
    this.ready = false;
    this.gameStateUpdated = false;
    this.game_state_received = false;
    this.timersStarted = false;
  }

  // Runs a real-time timer
  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  updateDisplayedTimers(timers, color) {
    let timerValue1 = timers[0] < 0 ? 0 : timers[0];
    let timerValue2 = timers[1] < 0 ? 0 : timers[1];
    const formattedTime1 = this.formatTime(timerValue1);
    const formattedTime2 = this.formatTime(timerValue2);
    if (color === '0') {
      this.timerText1.setText(`${formattedTime1}`);
    }
    else if (color === '1'){
      this.timerText2.setText(`${formattedTime2}`);
    }
  }

  // Refreshes the game-window with the necessary parameters
  redraw_window(scene, bo, p1, p2, color, ready, p1Text, p2Text, statusText, has_placed, has_selected_q, alpha, log) {
    scene.cameras.main.setBackgroundColor('#232323');
    const offset_x = this.cameras.main.width / 2 + 150;
    const offset_y = this.cameras.main.height / 2 - 40;

    /* GUI */
    scene.add.image(offset_x, offset_y, 'white_square');
    scene.add.image(offset_x - 142 + 0.75, offset_y - 142 + 0.75, 'quarter_board');
    scene.add.image(offset_x + 142 + 0.75, offset_y + 142 + 0.75, 'quarter_board');
    scene.add.image(offset_x - 142 + 0.75, offset_y + 142 + 0.75, 'quarter_board');
    scene.add.image(offset_x + 142 + 0.75, offset_y - 142 + 0.75, 'quarter_board');

    const textStyle = {
      fontFamily: 'Arial',
      fontSize: 30,
      color: '#FFFFFF'
    };

    const textStyle2 = {
      fontFamily: 'Arial',
      fontSize: 50,
      color: '#FFFFFF'
    };

    const textStyle3 = {
      fontFamily: 'Arial',
      fontSize: 18,
      color: '#FFFFFF'
    };

    const textStyle4 = {
      fontFamily: 'Arial',
      fontSize: 23,
      color: '#FFFFFF'
    };

    const textStyle5 = {
      fontFamily: 'Arial',
      fontSize: 20,
      color: '#FFFFFF'
    };

    if (bo.turn === '0') {
      scene.time_label = this.add.image(308, 130, 'white_label')
    }
    else if (bo.turn === '1') {
      scene.time_label = this.add.image(308, 130, 'black_label')
    }

    /*
    COMING SOON - MOVE LOG
    if (ready) {
      scene.log_text = scene.add.text(1080, 350, scene.move_log, textStyle5);
      //console.log(scene.move_log);
    }
    */

    if (!has_placed && bo.turn === color && ready) {
      scene.add.image(850, 30, 'message');
      const has_placed_text = scene.add.text(705, 20, 'Click on the board to place a marble', textStyle3);
    }
    else if (has_placed && !has_selected_q && bo.turn === color && ready) {
      scene.add.image(850, 30, 'message');
      const has_placed_text = scene.add.text(650, 20, 'Click on the board to select a quadrant and rotate it', textStyle3);
    }
    else if (!has_placed && bo.turn !== color || !ready) {
      scene.add.image(850, 30, 'message');
      const has_placed_text = scene.add.text(766, 20, 'Waiting for player', textStyle3);
    }

    // Updates the marble placed on the board
    for (let l = 0; l < 6; l++) {
      for (let m = 0; m < 6; m++) {
        if (bo.config[l][m] === '0') {
          if (l === 1 || l === 4) {
            this.p1 = scene.add.image(offset_x - 236 - 0.15 + 94.6 * m, offset_y - 236 + 94.6 * l, 'p1');
          } else {
            this.p1 = scene.add.image(offset_x - 236 + 94.6 * m, offset_y - 236 + 94.6 * l, 'p1');
          }
        } else if (bo.config[l][m] === '1') {
          if (l === 1 || l === 4) {
            this.p2 = scene.add.image(offset_x - 236 - 0.15 + 94.6 * m, offset_y - 236 + 94.6 * l, 'p2');
          } else {
            this.p2 = scene.add.image(offset_x - 236 + 94.6 * m, offset_y - 236 + 94.6 * l, 'p2');
          }
        }
      }
    }
  }

  // Implements client-side connection and data handling
  connect() {
    const offset_x = this.cameras.main.width / 2 + 150;
    const offset_y = this.cameras.main.height / 2 - 40;
    const initialConnectionMessage = {
      type: 'initialConnection',
      playerName: playername,
      gType: gType,
      gKey: gKey,
    };
    let flag = 0;
    let count = 0;
    this.socket = new WebSocket('wss://pentago.herokuapp.com/');
    this.socket.addEventListener('open', (event) => {
      this.socket.send(JSON.stringify(initialConnectionMessage));
      console.log('Connected to the server');
    });

    this.socket.addEventListener('close', (event) => {
      console.log('Disconnected from the server');
    });

    this.socket.addEventListener('error', (event) => {
      console.log('Error:', event);
    });

    this.socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
    
      // If both players are ready, start the timers
      if (data.type === 'gameState') {
        if (data.ready && !this.timersStarted) {
          this.timersStarted = true;
          if (data.type === 'updateTimers') {
            const timers = data.timers;
            this.updateDisplayedTimers(timers, this.color);
          }
        }
      }

      const textStyle4 = {
        fontFamily: 'Arial',
        fontSize: 23,
        color: '#FFFFFF'
      };

      if (data.type === 'gameState' && flag <= 1) { // looping problem
        let serial = 'Room number #';
        if (data.key !== undefined) {
          serial += data.key;
        } else {
          serial += '';
        }
        if (count < 1){
          this.add.text(270, 490, serial, textStyle4);
          count++;
        }
        if (data.ready && data.p1Name !== '' && data.p2Name !== '') {
          this.add.text(270, 537, truncate(this.bo.p1Name, 11), {fontFamily: 'Arial', fontSize: 23, color: '#000000'});
          this.add.text(270, 577, truncate(this.bo.p2Name, 11), {fontFamily: 'Arial', fontSize: 23, color: '#FFFFFF'});
          serial = '';
          flag++;
        }
      }
  
      // Handles the data if the game ends and takes the screenshot of the current game-board
      if (data.type === 'end') {
        captureGameBoard(this, offset_x - 284, offset_y - 284, 580, 580).then(gameBoardScreenshot => {
          sessionStorage.setItem('gameBoardScreenshot', gameBoardScreenshot);
      
          if (data.result === 'win') {
            setTimeout(() => {
              window.location.href = 'pentago-win.html';
            }, 500); // Delay
          } else if (data.result === 'lose') {
            setTimeout(() => {
              window.location.href = 'pentago-lose.html';
            }, 500);
          } else if (data.result === 'tie') {
            setTimeout(() => {
              window.location.href = 'pentago-tie.html';
            }, 500);
          }
        });
      }

      if (data.type === 'error') {
        alert('Invalid room number, you are being redirected to the homepage...');
        setTimeout(() => {
          window.location.href = 'index.html';
        }, 500);
      }

    //console.log(this.move_log);
    //console.log('[GAME] Data received from server:', data);
    //console.log(data);
  
    // Updates the client game-state
    if (data.type === 'gameState') {
      this.game_state_received = true;
      this.gameStateUpdated = true;
      this.bo.timers = data.timers;
      this.bo.config = data.board;
      this.bo.ready = data.ready
      this.bo.turn = data.turn;
      this.bo.time1 = data.time1;
      this.bo.time2 = data.time2;
      this.bo.p1Name = data.p1Name;
      this.bo.p2Name = data.p2Name;
      this.color = data.color;
      this.key = data.key;
      this.move_log = data.log;
  
      if (data.ready !== undefined) { // Check if the ready status is available in the gameState message
        this.ready = data.ready;
      }

      if (data.board !== this.bo.config) {
        this.bo.config = data.board;
      }
      
      this.needRedraw = true;
      }
    };

    console.log('Socket connection:', this.socket);
  }    
  
  // Loads the necessary assets
  preload(){
    this.load.spritesheet(
      "title",
      "data/assets/img/title_game.png",
      {
        frameWidth: 137,
        frameHeight: 40
      }
    );
    
    this.load.spritesheet(
      "time_label",
      "data/assets/img/time_label.png",
      {
        frameWidth: 200,
        frameHeight: 95
      }
    );

    this.load.spritesheet(
      "key_label",
      "data/assets/img/key_label.png",
      {
        frameWidth: 320,
        frameHeight: 40
      }
    );

    this.load.spritesheet(
      "white_label",
      "data/assets/img/white_label.png",
      {
        frameWidth: 200,
        frameHeight: 30
      }
    );

    this.load.spritesheet(
      "black_label",
      "data/assets/img/black_label.png",
      {
        frameWidth: 200,
        frameHeight: 30
      }
    );

    this.load.spritesheet(
      "timer",
      "data/assets/img/timer.png",
      {
        frameWidth: 72.4,
        frameHeight: 72,
      }
    );

    this.load.spritesheet(
      "message",
      "data/assets/img/message_label.png",
      {
        frameWidth: 450,
        frameHeight: 30,
      }
    );

    this.load.spritesheet(
      "p1",
      "data/assets/img/p1.png",
      {
        frameWidth: 47,
        frameHeight: 47
      }
    );

    this.load.spritesheet(
      "p2",
      "data/assets/img/p2.png",
      {
        frameWidth: 47,
        frameHeight: 47
      }
    );

    this.load.spritesheet(
      "quarter_board",
      "data/assets/img/quarter_board.png",
      {
        frameWidth: 284,
        frameHeight: 284
      }
    );

    this.load.spritesheet(
      "white_square",
      "data/assets/img/white_square.png",
      {
        frameWidth: 80,
        frameHeight: 80
      }
    );

    this.load.spritesheet(
      "pass_on",
      "data/assets/img/pass_on.png",
      {
        frameWidth: 203,
        frameHeight: 123
      }
    )

    this.load.spritesheet(
      "ra_on",
      "data/assets/img/ra_on.png",
      {
        frameWidth: 84,
        frameHeight: 84
      }
    )

    this.load.spritesheet(
      "rc_on",
      "data/assets/img/rc_on.png",
      {
        frameWidth: 84,
        frameHeight: 84
      }
    )

    this.load.spritesheet(
      "widget",
      "data/assets/img/widget_label.png",
      {
        frameWidth: 432,
        frameHeight: 260
      }
    )

    this.load.spritesheet(
      "control",
      "data/assets/img/control_label.png",
      {
        frameWidth: 275,
        frameHeight: 315
      }
    )

    this.load.spritesheet(
      "moon",
      "data/assets/img/moon.png",
      {
        frameWidth: 21,
        frameHeight: 30
      }
    )

    this.load.spritesheet(
      "select_1",
      "data/assets/img/select_1.png",
      {
        frameWidth: 295,
        frameHeight: 295
      }
    )

    this.load.spritesheet(
      "select_2",
      "data/assets/img/select_2.png",
      {
        frameWidth: 295,
        frameHeight: 295
      }
    )

    this.load.spritesheet(
      "select_3",
      "data/assets/img/select_3.png",
      {
        frameWidth: 295,
        frameHeight: 295
      }
    )

    this.load.spritesheet(
      "select_4",
      "data/assets/img/select_4.png",
      {
        frameWidth: 295,
        frameHeight: 295
      }
    )

    this.load.spritesheet(
      "names",
      "data/assets/img/names.png",
      {
        frameWidth: 280,
        frameHeight: 80,
      }
    )
             
    this.load.audio(
       "marble_placement",
       "data/assets/audio/marble_placement_sfx.mp3"
    );
    
    this.load.audio(
       "quarter_rotation",
       "data/assets/audio/quarter_rotation_sfx.mp3"
    );
  }
  
  // Inits variables, defines animations, sounds, displays assets, handles clicks
  create() {
    /* Game variables and contants */
    const offset_x = this.cameras.main.width / 2 + 150;
    const offset_y = this.cameras.main.height / 2 - 40;
    const dx = offset_x - 283;
    const dy = offset_y - 283;
    const q1_coord = (offset_x - 142 + 0.75, offset_y - 142 + 0.75);
    const q2_coord = (offset_x + 142 + 0.75, offset_y + 142 + 0.75);
    const q3_coord = (offset_x - 142 + 0.75, offset_y + 142 + 0.75);
    const q4_coord = (offset_x + 142 + 0.75, offset_y - 142 + 0.75);
    const marble_placement_sfx = this.sound.add('marble_placement');
    const quarter_rotation_sfx = this.sound.add('quarter_rotation');

    this.updateCounter = 0;
    this.cameras.main.setBounds(0, 0, 1366, 768);
    this.count = 0;
    this.has_placed = false;
    this.has_selected_q = false;
    this.first_move = true;
    this.alpha = 0;
    this.bo = new Board(566, 566);
    this.name = 'player';
    this.running = true;
    this.serial_key = '';
    this.handlersSet = false;
    this.connect();
    this.counterClockwiseBtn = new Phaser.Geom.Rectangle(780 - 40, 685 - 40, 84, 84);
    this.clockwiseBtn = new Phaser.Geom.Rectangle(885 - 40, 685 - 40, 84, 84);
    this.copykeyBtn = new Phaser.Geom.Rectangle(270, 490, 250, 20);
    this.q1Btn = new Phaser.Geom.Rectangle(offset_x - 142 + 0.75, offset_y - 142 + 0.75, 284, 284);
    this.q2Btn = new Phaser.Geom.Rectangle(offset_x + 142 + 0.75, offset_y + 142 + 0.75, 284, 284);
    this.q3Btn = new Phaser.Geom.Rectangle(offset_x - 142 + 0.75, offset_y + 142 + 0.75, 284, 284);
    this.q4Btn = new Phaser.Geom.Rectangle(offset_x + 142 + 0.75, offset_y - 142 + 0.75, 284, 284);
    this.p1Text = this.add.text(1080, 250, '', { fontFamily: 'Arial', fontSize: 30, color: '#000000' });
    this.p2Text = this.add.text(1105, 50, '', { fontFamily: 'Arial', fontSize: 30, color: '#FFFFFF' });
    this.statusText = this.add.text(this.cameras.main.width / 2, 700, '', { fontFamily: 'Arial', fontSize: 30, color: '#FFFFFF' }).setOrigin(0.5, 0);
    this.waitingText = this.add.text(this.cameras.main.width / 2, 100, '', { fontFamily: 'Arial', fontSize: 50, color: '#FFFFFF' }).setOrigin(0.5, 0);
    this.move = '';
    this.string_color = '';
    this.moon = null;
    this.hover_1 = null;
    this.hover_2 = null;
    this.hover_3 = null;
    this.hover_4 = null;
    this.p1 = null;
    this.p2 = null;

    /* GUI initialization */
    this.time_label = this.add.image(400, 130, 'time_label');
    this.timerText1 = this.add.text(375, 115, '', { fontFamily: 'Arial', fontSize: "30px", color: "#FFFFFF" });
    this.timerText2 = this.add.text(375, 115, '', { fontFamily: 'Arial', fontSize: "30px", color: "#FFFFFF" });
    this.add.image(395, 570, 'names');
    this.add.image(780, 685, 'rc_on');
    this.add.image(885, 685, 'ra_on');

    const textStyle = {
      fontFamily: 'Arial',
      fontSize: 30,
      color: '#FFFFFF'
    };

    const textStyle2 = {
      fontFamily: 'Arial',
      fontSize: 50,
      color: '#FFFFFF'
    };

    const textStyle3 = {
      fontFamily: 'Arial',
      fontSize: 15,
      color: '#FFFFFF'
    };

    const textStyle4 = {
      fontFamily: 'Arial',
      fontSize: 23,
      color: '#FFFFFF'
    };

    const textStyle5 = {
      fontFamily: 'Arial',
      fontSize: 18,
      fontStyle: 'italic',
      color: '#FFFFFF',
      wordWrap: { width: 310 }
    };

    /*
    COMING SOON - MOVE LOG
    var graphics = this.make.graphics();
    graphics.fillRect(1195, 495, 260, 318);
    var mask = new Phaser.Display.Masks.GeometryMask(this, graphics);
    this.log_text = this.add.text(1080, 350, '', textStyle5); //.setOrigin(0);
    this.log_text.setMask(mask);
    var zone = this.add.zone(1195, 495, 260, 318).setInteractive(); //.setOrigin(0)
    */
    

    // Animations and sprites
    /*
    this.anims.create({
      key: 'time_flowing',
      frames: this.anims.generateFrameNumbers('timer', { frames: [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }),
      frameRate: 8,
      repeat: -1
    });
    const timer_sprite = this.add.sprite(1120, 160, 'timer');
    timer_sprite.setScale(0.7);
    timer_sprite.play('time_flowing');
    */
  
    // Register event listeners
    this.input.on('pointerup', (pointer) => {
      //console.log('[GAME]THIS BO CONFIG RIGHT BEFORE CLICKING: ', this.bo.config);
      //console.log('Click event captured:', pointer.x, pointer.y);
      //console.log('this.color:', this.color);
      //console.log('this.bo.ready:', this.bo.ready);
      if (this.game_state_received && this.color !== 's' && this.bo.ready) {
        console.log('[DEBUG] Passed the first condition');
        if (this.color === this.bo.turn) {
          console.log('[DEBUG] Passed the second condition');
          const pos = { x: pointer.x, y: pointer.y };
          if (pos.x >= offset_x - 284 && pos.x <= offset_x + 284 && pos.y >= offset_y - 284 && pos.y <= offset_y + 284) {
            marble_placement_sfx.play();
            console.log('[DEBUG] Passed the third condition');
            console.log("[GAME] Game state:");
            console.log("[GAME] this.has_placed:", this.has_placed);
            console.log("[GAME] this.has_selected_q:", this.has_selected_q);
            console.log("[GAME] this.q:", this.q);
            console.log("[GAME] this.alpha:", this.alpha);
            console.log("[GAME] this.color:", this.color);
            console.log("[GAME] this.bo.ready:", this.bo.ready);
            console.log("[GAME] this.bo.turn:", this.bo.turn);
            if (!this.has_placed) {
              console.log('[DEBUG] has placed');
              console.log('[GAME] pos: ', pos)
              const [i, j] = this.bo.handle_click(pos, this.color, dx, dy);
              console.log("[DEBUG] j: ", i);
              console.log("[DEBUG] i: ", j);
              console.log('[DEBUG] ij: ', this.bo.config[j][i]);
              // Check if the clicked cell is empty
              if (this.bo.config[j][i] === '-1') {
                this.socket.send(JSON.stringify({ type: 'select', i, j, color: this.color }));
                console.log('[GAME] Data sent to server (select):', { type: 'select', i, j, color: this.color });
                this.has_placed = true;
                this.q = this.bo.get_quarter_from_pos(pos, dx, dy);
              } else {
                console.log('[GAME] Warning! invalid placement, please select a free cell');
                this.has_placed = false;
              }
            } else {
              this.q = this.bo.get_quarter_from_pos(pos, dx, dy);
              // Displays the value of the quarter based on the value of q
              if (this.q === 1) {
                if (this.hover_1) {
                  this.hover_1.destroy();
                }
                if (this.hover_2) {
                  this.hover_2.destroy();
                }
                if (this.hover_3) {
                  this.hover_3.destroy();
                }
                if (this.hover_4) {
                  this.hover_4.destroy();
                }
                this.hover_1 = this.add.image(offset_x - 142 + 0.75, offset_y - 142 + 0.75, 'select_1');
              } else if (this.q === 2) {
                if (this.hover_1) {
                  this.hover_1.destroy();
                }
                if (this.hover_2) {
                  this.hover_2.destroy();
                }
                if (this.hover_3) {
                  this.hover_3.destroy();
                }
                if (this.hover_4) {
                  this.hover_4.destroy();
                }
                this.hover_2 = this.add.image(offset_x + 142 + 0.75, offset_y - 142 + 0.75, 'select_2');
              } else if (this.q === 3) {
                if (this.hover_1) {
                  this.hover_1.destroy();
                }
                if (this.hover_2) {
                  this.hover_2.destroy();
                }
                if (this.hover_3) {
                  this.hover_3.destroy();
                }
                if (this.hover_4) {
                  this.hover_4.destroy();
                }
                this.hover_3 = this.add.image(offset_x - 142 + 0.75, offset_y + 142 + 0.75, 'select_3');
              } else if (this.q === 4) {
                if (this.hover_1) {
                  this.hover_1.destroy();
                }
                if (this.hover_2) {
                  this.hover_2.destroy();
                }
                if (this.hover_3) {
                  this.hover_3.destroy();
                }
                if (this.hover_4) {
                  this.hover_4.destroy();
                }
                this.hover_4 = this.add.image(offset_x + 142 + 0.75, offset_y + 142 + 0.75, 'select_4');
              }
              this.tweens.add({
                targets: this.hover_1,
                alpha: 0.25,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
              this.tweens.add({
                targets: this.hover_2,
                alpha: 0.25,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
              this.tweens.add({
                targets: this.hover_3,
                alpha: 0.25,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
              this.tweens.add({
                targets: this.hover_4,
                alpha: 0.25,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });

              console.log("[GAME] Has selected quarter: ", this.q)
              this.has_selected_q = true;
            }
          }
        }
      }

      if (Phaser.Geom.Rectangle.Contains(this.copykeyBtn, pointer.x, pointer.y)) {
        console.log('[GAME] Game key copied to the clipboard');
        const tempInput = document.createElement("input");
        tempInput.value = this.key;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand("copy");
        document.body.removeChild(tempInput);
        this.cp_warning = this.add.text(310, 460, ' Copied to the clipboard! ', { fontFamily: 'Arial', fontSize: "15px", color: "#FFFFFF"});
        var cp_delay = 1000;
        this.time.delayedCall(cp_delay, function() {
            this.cp_warning.destroy();
        }, [], this);
      }

      if (Phaser.Geom.Rectangle.Contains(this.clockwiseBtn, pointer.x, pointer.y)) {
        console.log('[GAME] Clockwise rotation event captured');
        if (this.has_placed === true && this.q !== null) {
          this.alpha = 1;
          console.log(this.alpha);
        }

        console.log('[GAME] Pass turn event captured');
        if (this.alpha !== 0) {
          if (this.color === this.bo.turn && this.bo.ready && this.q !== null) {
            quarter_rotation_sfx.play();
            this.socket.send(JSON.stringify({ type: 'quarter', q: this.q, alpha: this.alpha }));
            console.log('[GAME] Data sent to server (quarter):', { type: 'quarter', q: this.q, alpha: this.alpha });
            this.has_placed = false;
            this.has_selected_q = false;
            this.first_move = true;
            this.alpha = 0;
            this.q = null;
            if (this.hover_1) {
              this.hover_1.destroy();
            }
            if (this.hover_2) {
              this.hover_2.destroy();
            }
            if (this.hover_3) {
              this.hover_3.destroy();
            }
            if (this.hover_4) {
              this.hover_4.destroy();
            }
          }
        }
      }
    
      // Counterclockwise rotation
      if (Phaser.Geom.Rectangle.Contains(this.counterClockwiseBtn, pointer.x, pointer.y)) {
        console.log('[GAME] Counterclockwise rotation event captured');
        if (this.has_placed === true && this.q !== null) {
          this.alpha = -1;
          console.log(this.alpha);
        }

        console.log('[GAME] Pass turn event captured');
        if (this.alpha !== 0) {
          if (this.color === this.bo.turn && this.bo.ready && this.q !== null) {
            this.socket.send(JSON.stringify({ type: 'quarter', q: this.q, alpha: this.alpha }));
            console.log('[GAME] Data sent to server (quarter):', { type: 'quarter', q: this.q, alpha: this.alpha });
            this.has_placed = false;
            this.has_selected_q = false;
            this.first_move = true;
            this.alpha = 0;
            this.q = null;
            if (this.hover_1) {
              this.hover_1.destroy();
            }
            if (this.hover_2) {
              this.hover_2.destroy();
            }
            if (this.hover_3) {
              this.hover_3.destroy();
            }
            if (this.hover_4) {
              this.hover_4.destroy();
            }
          }
        }
      }
    });

    /*
    COMING SOON - MOVE LOG
    zone.on('pointermove', function (pointer) {
      if (pointer.isDown)
      {
          this.log_text.y += (pointer.velocity.y / 10);

          this.log_text.y = Phaser.Math.Clamp(text.y, -400, 300);
      }

    });
    */
  }
  
  // Loops the attributes of various game objects per game logic
  update() {
    console.log(this.width);
    if (this.gameStateUpdated) {
      this.gameStateUpdated = false;
      console.log('game state is updated');
      console.log("winner: ", this.bo.winner);
      this.redraw_window(this, this.bo, this.bo.time1, this.bo.time2, this.color, this.ready, this.p1Text, this.p2Text, this.statusText, this.has_placed, this.has_selected_q, this.alpha, this.log_text);
      this.updateDisplayedTimers(this.bo.timers, this.color);
    }
  
    if (this.needRedraw) {
      this.needRedraw = false;
      this.waitingText.visible = !this.ready;
      
      if (this.ready) {
        const p1_time = this.bo.time1;
        const p2_time = this.bo.time2;
        this.redraw_window(this, this.bo, p1_time, p2_time, this.color, this.ready, this.p1Text, this.p2Text, this.statusText, this.has_placed, this.has_selected_q, this.alpha, this.log_text);
      }
    }
  
    this.updateCounter++;
    if (this.updateCounter % 60 === 0) {
      this.redraw_window(this, this.bo, this.bo.time1, this.bo.time2, this.color, this.ready, this.p1Text, this.p2Text, this.statusText, this.has_placed, this.has_selected_q, this.alpha, this.log_text);
    }
  }    
}

const config = {
  width: 1366,
  height: 768,
  backgroundColor: "#232323",
  parent: "gameContainer",
  scale: {
    // Fit to window
    mode: Phaser.Scale.FIT,
    // Center vertically and horizontally
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [GameScene],
};

const game = new Phaser.Game(config);
