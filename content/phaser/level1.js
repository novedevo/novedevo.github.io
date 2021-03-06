
var gravity = 800;

var config = {
    type: Phaser.WEBGL,
    width: 300,
    height: 128,
    input: {
        gamepad: true
    },
    backgroundColor: '#2d2d2d',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    parent: 'phaser-example',
    pixelArt: true,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: gravity },
            tileBias: 10,
            debug: false
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

let soundtrack;

var maxFallSpeed = 150;
var maxSpeed = 75;
let jumpSpeed = 250;
let shortJumpSpeed = jumpSpeed/3;
var accel = 300;
var friction = 0.5;
var startRunVelocity = 30;
let hoverThreshold = 15;
var drag = 0.1;
let dashSpeed = 250;
let dashDistance = 40;
let maxWallSlide = 40;
let smallJumpHeight = 30;
let wallJumpGracePeriod = 100; //ms
let wallJumpForcedPeriod = 70; //ms

let forceHoldRight = false;
let forceHoldLeft = false;


let jumpStartPoint;

let startPoint;
let oldVelocity;
let dash = '';

let particles;
let emitter;
let dashSparkTimer;

//let dashVelocities = new 


var game = new Phaser.Game(config);
var player;
var controls = Phaser.Input.Keyboard;

let left = false;
let right = false;
let a = false;
let x = false;
let dashable = true;
let wallSliding = false;
let wallGrace = false;

let lastWallSlide = null;

let dashDirs = {
    horz: false,
    vert: false,
}

var pad = null;

let dashVelocities = {
    left: new Phaser.Math.Vector2(-maxSpeed, 0),
    right: new Phaser.Math.Vector2(maxSpeed, 0),
    up: new Phaser.Math.Vector2(0, -maxSpeed),
    down: new Phaser.Math.Vector2(0, maxSpeed),
    upleft: new Phaser.Math.Vector2(-maxSpeed, -maxSpeed),
    upright: new Phaser.Math.Vector2(maxSpeed, -maxSpeed),
    downleft: new Phaser.Math.Vector2(-maxSpeed, maxSpeed),
    downright: new Phaser.Math.Vector2(maxSpeed, maxSpeed)
}

function preload() {
    this.load.image('tiles', '/assets/tiles.png');
    this.load.tilemapTiledJSON('map', '/assets/untitled.json');
    this.load.spritesheet('heart', '/assets/heart.png', { frameWidth: 8, frameHeight: 8 }, '/phaser/heart.json');
    this.load.image('spark', '/assets/spark.png');
    this.load.audio('soundtrack', '/assets/soundtrack.opus');
}

function create() {
    var map = this.make.tilemap({ key: 'map' });

    var tileset = map.addTilesetImage('tiles', 'tiles');

    var tile_layer = map.createLayer(0, tileset, 0, 0);

    soundtrack = this.sound.add('soundtrack', {loop: true})
    soundtrack.play();

    //var map = this.make.tilemap({ key: 'map', tileWidth: 16, tileHeight: 16 });
    //var tileset = map.addTilesetImage("tileset-images", 'tiles');
    //var tile_layer = map.createLayer('walls', tileset, 0, 0);

    cursors = this.input.keyboard.createCursorKeys();

    player = this.physics.add.sprite(64, 16, 'heart');
    player.setCollideWorldBounds(true);

    ground = this.physics.add.group();
    ground.create(map);

    ground.getChildren()[0].body.setFrictionX(100);

    // Set collision with player (can also be a group)
    tile_layer.setCollisionByExclusion([-1]);
    this.physics.add.collider(player, tile_layer);

    player.anims.create({
        key: 'pulse',
        frames: this.anims.generateFrameNumbers('heart'),
        frameRate: 8,
        repeat: -1
    });
    player.play('pulse');

    player.body.useDamping = true;

    player.body.drag.x = drag;


}

function update(time, delta) {

    if (dash) {
        console.log(dash);
        if (dashSparkTimer.getRemaining() != 0) {
            return;
        }
        if (player.body.velocity.fuzzyEquals(Phaser.Math.Vector2.ZERO)
            || player.body.position.distance(startPoint) > dashDistance) {

            player.visible = true;
            particles.destroy();
            console.log(dash);
            console.log(dashVelocities);
            console.log(dashVelocities[dash]);
            player.body.velocity = dashVelocities[dash].clone();
            player.body.allowDrag = true;
            player.body.allowGravity = true;
            dash = "";
            dashDirs['vert'] = false;
            dashDirs['horz'] = false;
        }
        else {
            return;
        }
    }

    pad = this.input.gamepad.getPad(0);

    if (player.body.velocity.y > maxFallSpeed) {
        player.body.allowGravity = false;
    }

    if (player.body.blocked.down) {

        player.body.allowGravity = true;
        player.body.drag.x = drag / 1000;
        dashable = true;
    }
    else {
        player.body.drag.x = drag;
    }

    let leftPressed;
    let rightPressed;
    let upPressed;
    let downPressed;
    let jumpPressed;
    let dashPressed;

    if (pad) {
        leftPressed = pad.left;
        rightPressed = pad.right;
        upPressed = pad.up;
        downPressed = pad.down;
        jumpPressed = pad.A;
        dashPressed = pad.X;
    } else {
        leftPressed = cursors.left.isDown;
        rightPressed = cursors.right.isDown;
        upPressed = cursors.up.isDown;
        downPressed = cursors.down.isDown;
        jumpPressed = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE).isDown;
        dashPressed = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT).isDown;
    }


    if (leftPressed || (forceHoldLeft && forceHoldLeft.getRemaining() != 0)) {
        facing = 'left';
        if (!left && player.body.blocked.down) {
            player.setVelocityX(-maxSpeed);
        }
        else if (player.body.velocity.x < -maxSpeed) {
            player.setAccelerationX(0);
        }
        else {
            player.setAccelerationX(-accel);
        }
        left = true;
        right = false;

        if (player.body.blocked.left && player.body.velocity.y > maxWallSlide) {
            player.body.setVelocityY(maxWallSlide);
            wallSliding = true;
            lastWallSlide = 'left';
        }
        else {
            if (wallSliding){
                wallGrace = this.time.addEvent({ delay: wallJumpGracePeriod })
            }
            wallSliding = false;
        }
    }

    else if (rightPressed || (forceHoldRight && forceHoldRight.getRemaining() != 0)) {
        facing = 'right'
        if (!right && player.body.blocked.down) {
            player.setVelocityX(maxSpeed);
        }
        else if (player.body.velocity.x > maxSpeed) {
            player.setAccelerationX(0);
        }
        else {
            player.setAccelerationX(accel);
        }
        right = true;
        left = false;

        if (player.body.blocked.right && player.body.velocity.y > maxWallSlide) {
            player.body.setVelocityY(maxWallSlide);
            wallSliding = true;
            lastWallSlide = 'right';
        }
        else {
            if (wallSliding){
                wallGrace = this.time.addEvent({ delay: wallJumpGracePeriod });
            }
            wallSliding = false;
        }
    }

    else {
        player.setAccelerationX(0);
        left = false;
        right = false;
    }

    if (a && !jumpPressed) {

        if (player.body.velocity.y < -shortJumpSpeed) {
            player.body.velocity.y = -shortJumpSpeed;
        }

        a = false;
        player.body.allowGravity = true;
        player.body.setGravity(0, 0);
        //jumpStartPoint = null;
    }

    //jump
    else if (!a && jumpPressed && player.body.blocked.down) {
        //jumpStartPoint = player.body.position.clone();
        player.setVelocityY(-jumpSpeed);
        a = true;
        if (leftPressed && player.body.velocity.x > -maxSpeed) {
            player.setVelocityX(-maxSpeed);
        }
        if (rightPressed && player.body.velocity.x < maxSpeed) {
            player.setVelocityX(maxSpeed);
        }
    }

    //walljump
    else if (!a && jumpPressed && (wallSliding || (wallGrace && wallGrace.getRemaining() != 0))) {
        if (lastWallSlide === 'left') {
            player.setVelocityY(-jumpSpeed);
            player.setVelocityX(maxSpeed);
            a = true;
            forceHoldRight = this.time.addEvent({ delay: wallJumpForcedPeriod });
        }
        else if (lastWallSlide === 'right') {
            player.setVelocityY(-jumpSpeed);
            player.setVelocityX(-maxSpeed);
            a = true;
            forceHoldLeft = this.time.addEvent({ delay: wallJumpForcedPeriod });
        }
    }
    //midair hover
    else if (jumpPressed && Math.abs(player.body.velocity.y) < hoverThreshold) {
        player.body.setGravity(0, -200);
        a = true;
    }
    else {
        if (!(player.body.velocity.y > maxFallSpeed)){
            player.body.allowGravity = true;
        }
        
        player.body.setGravity(0, 0);
        jumpStartPoint = null;
    }

    //dash
    if (dashable && !x && dashPressed && (facing || upPressed || downPressed)) {
        startPoint = player.body.position.clone();
        player.body.allowDrag = false;
        oldVelocity = player.body.velocity.clone();
        player.body.setVelocityX(0).setVelocityY(0);
        player.body.allowGravity = false;
        player.body.setAccelerationX(0).setVelocityY(0);


        dashSparkTimer = this.time.addEvent({ delay: 150 });

        if (upPressed) {
            dash += 'up';
            dashDirs['vert'] = true;
            player.body.setVelocityY(-dashSpeed);
        }
        else if (downPressed) {
            dash += 'down';
            dashDirs['vert'] = true;
            player.body.setVelocityY(dashSpeed);
        }
        if (facing === 'left') {
            if (!dash) {
                dash += 'left';
                dashDirs['horz'] = true;
                player.body.setVelocityX(-dashSpeed);
            }
            else {
                if (leftPressed) {
                    dash += 'left';
                    dashDirs['horz'] = true;
                    player.body.setVelocityX(-dashSpeed);
                }
            }
        }
        if (facing === 'right') {
            if (!dash) {
                dash += 'right';
                dashDirs['horz'] = true;
                player.body.setVelocityX(dashSpeed);
            }
            else {
                if (rightPressed) {
                    dash += 'right';
                    dashDirs['horz'] = true;
                    player.body.setVelocityX(dashSpeed);
                }
            }
        }

        x = true;
        dashable = false;
        player.visible = false;
        particles = this.add.particles('spark');
        emitter = particles.createEmitter({
            speed: 100,
            frequency: 0.001,
            blend: 'add'
        });
        emitter.startFollow(player);
    }
    else if (dashPressed) {
        x = true;
    }
    else if (!dashPressed) {
        x = false;
    }
}

function frictionCalc(velocity) {
    // console.log(-friction * velocity);
    return -friction * velocity;

}


document.querySelector('#play-button').addEventListener('click', function() {
    soundtrack.resume();
  });

document.querySelector('#pause-button').addEventListener('click', function() {
    soundtrack.pause();
  });
