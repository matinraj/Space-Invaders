"use strict";
/**
 * Author: Matin Raj Sundara Raj
 * Student Id: 32124260
 *
 * This program runs a similar version of the classic arcade game 'Space Invaders' using
 * the RxJS Observable stream and SVG elements, done through Functional Reactive Programming.
 *
 * Some of the function are adapted from  Asteroids in FRP: https://tgdwyer.github.io/asteroids/
 * and Asteroid Game code.
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var rxjs_1 = require("rxjs");
var operators_1 = require("rxjs/operators");
function spaceinvaders() {
    var Constants = {
        CanvasSize: 600,
        BulletRadius: 3,
        StartAlienRadius: 15,
        StartAliensCount: 40,
        StartAlienRow: 4,
        Alien1Score: 4,
        Alien2Score: 3,
        Alien3Score: 2,
        Alien4Score: 1,
    };
    // classes to allow for the creation of new instances which will be captured by our reduceState function
    var Shoot = /** @class */ (function () {
        function Shoot() {
        }
        return Shoot;
    }());
    var Move = /** @class */ (function () {
        function Move(direction) {
            this.direction = direction;
        }
        return Move;
    }());
    var Tick = /** @class */ (function () {
        function Tick(elapsed) {
            this.elapsed = elapsed;
        }
        return Tick;
    }());
    // This we get the element id from html file so we can show the score and level from our state.
    var scoreInPage = document.getElementById("score_id");
    var levelInPage = document.getElementById("level_id");
    // a seedable pseudo-random number generator for alienBullets
    // (adapted from Week 4 Lab PiApproximation solution)
    var RNG = /** @class */ (function () {
        function RNG(state) {
            this.state = state;
            // LCG using GCC's constants
            this.m = 0x80000000; // 2**31
            this.a = 1103515245;
            this.c = 12345;
        }
        RNG.prototype.int = function () {
            return (this.a * this.state + this.c) % this.m;
        };
        RNG.prototype.float = function () {
            // returns in range [0,1]
            return this.int() / (this.m - 1);
        };
        RNG.prototype.next = function () {
            return new RNG(this.int()); // doesnt mutate, gives back new RNG
        };
        return RNG;
    }());
    var randomNumberStream = function (seed) { return (0, rxjs_1.interval)(500).pipe((0, operators_1.scan)(function (r, _) { return r.next(); }, new RNG(seed)), (0, operators_1.map)(function (r) { return 1 + 5.5 * r.float(); }) // now range is from [0.5 to 5.5]
    ); }, 
    // To scale the random x,y numbers to our Canvas size: 600
    scalex = function (v) { return (v) * 100; }, scaley = function (v) { return (v - 1) * 100; };
    var randomZip = (0, rxjs_1.zip)(randomNumberStream(1), randomNumberStream(2)) // Zip allows us to pair 2 observables to create (x,y) coordinates through Vector Class
        .pipe((0, operators_1.map)(function (_a) {
        var x = _a[0], y = _a[1];
        return new Vec(scalex(x), scaley(y));
    }));
    // Our game clock which operates on discrete timesteps (obtained by interval)
    var gameClock = (0, rxjs_1.interval)(10)
        .pipe((0, operators_1.map)(function (elapsed) { return new Tick(elapsed); })), keyObservable = function (e, k, result) {
        return (0, rxjs_1.fromEvent)(document, e)
            .pipe((0, operators_1.filter)(function (_a) {
            var code = _a.code;
            return code === k;
        }), (0, operators_1.filter)(function (_a) {
            var repeat = _a.repeat;
            return !repeat;
        }), (0, operators_1.map)(result));
    }, startLeftMove = keyObservable('keydown', 'ArrowLeft', function () { return new Move(-10); }), startRightMove = keyObservable('keydown', 'ArrowRight', function () { return new Move(10); }), stopLeftMove = keyObservable('keyup', 'ArrowLeft', function () { return new Move(0); }), stopRightMove = keyObservable('keyup', 'ArrowRight', function () { return new Move(0); }), shoot = keyObservable('keydown', 'Space', function () { return new Shoot(); });
    // Allows us to create the Aliens which are circles
    var createCircle = function (viewType) { return function (oid) { return function (time) { return function (radius) { return function (pos) { return function (vel) { return function (score) {
        return ({
            createTime: time,
            vel: vel,
            pos: pos,
            radius: radius,
            id: viewType + oid,
            viewType: viewType,
            defaultScore: score
        });
    }; }; }; }; }; }; };
    // Create bullets for Ship
    function createShipBullet(s) {
        var d = Vec.unitVecInDirection(0);
        return {
            id: "shipBullet".concat(s.objCount),
            pos: s.ship.pos.add(d.scale(20)),
            vel: s.ship.vel.add(d.scale(3)),
            createTime: s.time,
            scale: 1,
            radius: 3,
            viewType: 'shipBullet',
            defaultScore: 0
        };
    }
    // Create bullets for Aliens
    function createAlienBullet(s, pos) {
        var d = Vec.unitVecInDirection(0);
        return {
            id: "alienBullet".concat(s.objCount),
            pos: pos,
            vel: s.ship.vel.add(d.scale(-2)),
            createTime: s.time,
            scale: 1,
            radius: 3,
            viewType: 'alienBullet',
            defaultScore: 0
        };
    }
    // Create Ship
    function createShip() {
        return {
            id: 'ship',
            pos: new Vec(25, 555),
            scale: 1,
            vel: Vec.Zero,
            radius: 20,
            createTime: 0,
            viewType: 'ship',
            defaultScore: 0
        };
    }
    // We have 3 shields. We need to create a body for each so that they behave individually.
    function createShield1() {
        return {
            id: 'shield1',
            pos: new Vec(50, 400),
            scale: 1,
            vel: Vec.Zero,
            radius: 60,
            createTime: 0,
            viewType: 'shield1',
            defaultScore: 0
        };
    }
    function createShield2() {
        return {
            id: 'shield2',
            pos: new Vec(250, 400),
            scale: 1,
            vel: Vec.Zero,
            radius: 60,
            createTime: 0,
            viewType: 'shield2',
            defaultScore: 0
        };
    }
    function createShield3() {
        return {
            id: 'shield3',
            pos: new Vec(450, 400),
            scale: 1,
            vel: Vec.Zero,
            radius: 60,
            createTime: 0,
            viewType: 'shield3',
            defaultScore: 0
        };
    }
    // our initial array of Aliens derived from the createCircle function.
    // We have 4 types of aliens, each with their own default score.
    var startAliens1 = __spreadArray([], Array(Constants.StartAliensCount / Constants.StartAlienRow), true).map(function (_, i) { return createCircle("alien1")(i)(0)(Constants.StartAlienRadius)(new Vec(10 + i * 2 * Constants.StartAlienRadius, 20))(new Vec(1, 0))(Constants.Alien1Score); });
    var startAliens2 = __spreadArray([], Array(Constants.StartAliensCount / Constants.StartAlienRow), true).map(function (_, i) { return createCircle("alien2")(i)(0)(Constants.StartAlienRadius)(new Vec(10 + i * 2 * Constants.StartAlienRadius, 20 + 2 * Constants.StartAlienRadius))(new Vec(1, 0))(Constants.Alien2Score); });
    var startAliens3 = __spreadArray([], Array(Constants.StartAliensCount / Constants.StartAlienRow), true).map(function (_, i) { return createCircle("alien3")(i)(0)(Constants.StartAlienRadius)(new Vec(10 + i * 2 * Constants.StartAlienRadius, 20 + 4 * Constants.StartAlienRadius))(new Vec(1, 0))(Constants.Alien3Score); });
    var startAliens4 = __spreadArray([], Array(Constants.StartAliensCount / Constants.StartAlienRow), true).map(function (_, i) { return createCircle("alien4")(i)(0)(Constants.StartAlienRadius)(new Vec(10 + i * 2 * Constants.StartAlienRadius, 20 + 6 * Constants.StartAlienRadius))(new Vec(1, 0))(Constants.Alien4Score); });
    // we setup our initial state from which our game will begin.
    var initialState = {
        time: 0,
        ship: createShip(),
        bullets: [],
        alienBullets: [],
        shield1: createShield1(),
        shield2: createShield2(),
        shield3: createShield3(),
        exit: [],
        score: 0,
        level: 1,
        alienTime: 0,
        objCount: Constants.StartAliensCount,
        alien: startAliens1.concat(startAliens2, startAliens3, startAliens4),
        gameOver: false,
    };
    // All changes in movement and appearance go through thses block of codes
    var shieldDamage = function (o) { return (__assign(__assign({}, o), { scale: o.scale > 0 ? o.scale - 1 / 50 : 0, radius: o.radius > 0 ? o.radius - 1 / 150 : 0 })); };
    var moveBody = function (o) { return (__assign(__assign({}, o), { pos: new Vec(o.pos.x < 10 ? 10 : o.pos.x >= 600 - 10 ? 600 - 10 : o.pos.x, o.pos.y).add(o.vel), vel: o.vel })); };
    var removeBody = function (o) { return (__assign(__assign({}, o), { pos: Vec.Zero, vel: Vec.Zero })); };
    var moveAlienBullet = function (o) { return (__assign(__assign({}, o), { pos: o.pos.add(o.vel), vel: o.vel })); };
    var moveAlienRight = function (o) { return (__assign(__assign({}, o), { pos: o.pos.x == Constants.CanvasSize / 2 ? o.pos.moveDownright(10 /* circle radius */) : o.pos.add(o.vel), vel: o.vel })); };
    var moveAlienLeft = function (o) { return (__assign(__assign({}, o), { pos: o.pos.x == Constants.CanvasSize / 2 ? o.pos.moveDownleft(10 /* circle radius */) : o.pos.switch(o.vel), vel: o.vel })); };
    // Checks the state for collisions
    // Adapted from the Asteroid Game
    var handleCollisions = function (s) {
        var bodiesCollided = function (_a) {
            var a = _a[0], b = _a[1];
            return a.pos.sub(b.pos).len() < a.radius + b.radius;
        }, shipCollided = s.alien.filter(function (r) { return bodiesCollided([s.ship, r]); }).length > 0, //check if alien collided with ship
        filterCollided = function (a) { return s.alienBullets.filter(function (r) { return bodiesCollided([a, r]); }); }, //filter those collided
        alienBulletsCollidedShield1 = filterCollided(s.shield1).length > 0, alienBulletsCollidedShield2 = filterCollided(s.shield2).length > 0, alienBulletsCollidedShield3 = filterCollided(s.shield3).length > 0, allAlienBulletCollided = filterCollided(s.shield1).concat(filterCollided(s.shield2), filterCollided(s.shield3)), filterCollidedShipShield = function (a) { return s.bullets.filter(function (r) { return bodiesCollided([a, r]); }); }, shipBulletsCollidedShield1 = filterCollidedShipShield(s.shield1).length > 0, shipBulletsCollidedShield2 = filterCollidedShipShield(s.shield2).length > 0, shipBulletsCollidedShield3 = filterCollidedShipShield(s.shield3).length > 0, allShipBulletCollided = filterCollidedShipShield(s.shield1).concat(filterCollidedShipShield(s.shield2), filterCollidedShipShield(s.shield3)), shipBulletCollided = s.alienBullets.filter(function (r) { return bodiesCollided([s.ship, r]); }).length > 0, allBulletsAndAliens = flatMap(s.bullets, function (b) { return s.alien.map(function (r) { return ([b, r]); }); }), collidedBulletsAndAliens = allBulletsAndAliens.filter(bodiesCollided), collidedBullets = collidedBulletsAndAliens.map(function (_a) {
            var bullet = _a[0], _ = _a[1];
            return bullet;
        }), collidedAliens = collidedBulletsAndAliens.map(function (_a) {
            var _ = _a[0], alien = _a[1];
            return alien;
        }), acc = function (accumulator, currentValue) { return accumulator + currentValue; }, scoreCount = collidedAliens.map(function (a) { return a.defaultScore; }), cut = except(function (a) { return function (b) { return a.id === b.id; }; });
        // at this stage, we use cut to remove those bodies that have collided by concatenating them and placing them in exit
        return __assign(__assign({}, s), { gameOver: shipCollided || shipBulletCollided, bullets: cut(s.bullets)(collidedBullets.concat(allShipBulletCollided)), alienBullets: cut(s.alienBullets)(allAlienBulletCollided), alien: s.alien.length <= 0 ? (startAliens1.concat(startAliens2, startAliens3, startAliens4)) : cut(s.alien)(collidedAliens), shield1: alienBulletsCollidedShield1 ? shieldDamage(s.shield1) : shipBulletsCollidedShield1 ? shieldDamage(s.shield1) : s.shield1, shield2: alienBulletsCollidedShield2 ? shieldDamage(s.shield2) : shipBulletsCollidedShield2 ? shieldDamage(s.shield2) : s.shield2, shield3: alienBulletsCollidedShield3 ? shieldDamage(s.shield3) : shipBulletsCollidedShield3 ? shieldDamage(s.shield3) : s.shield3, exit: s.exit.concat(collidedBullets, collidedAliens, allAlienBulletCollided, allShipBulletCollided), objCount: s.objCount, score: s.score + scoreCount.reduce(acc, 0) });
    };
    // at each tick, bodies move and bullets expire.
    var tick = function (s, elapsed) {
        scoreInPage.innerHTML = String(s.score);
        levelInPage.innerHTML = String(s.level);
        var 
        // set expiration time for bullets. Prevents bullets from existing and travelling in the background
        expired = function (b) { return (elapsed - b.createTime) > 150; }, expiredBullets = s.bullets.filter(expired), activeBullets = s.bullets.filter(not(expired)), expiredAlienBullets = s.alienBullets.filter(expired), activeAlienBullets = s.alienBullets.filter(not(expired));
        return handleCollisions(__assign(__assign({}, s), { time: elapsed, alienTime: s.alien.length <= 0 ? elapsed : s.alienTime, ship: moveBody(s.ship), alien: (elapsed - s.alienTime) % 600 >= 300 ? s.alien.map(moveAlienLeft) : s.alien.map(moveAlienRight), bullets: s.gameOver ? activeBullets.map(removeBody) : activeBullets.map(moveBody), alienBullets: activeAlienBullets.map(moveAlienBullet), level: s.alien.length <= 0 ? s.level + 1 : s.level, exit: s.gameOver ? s.bullets.concat(s.alienBullets) : expiredBullets.concat(expiredAlienBullets) }));
    };
    var randomPos = Vec.Zero; // the only mutable variable. Needed for dicrete concatenation of alienBullet body into the array.
    randomZip.subscribe(function (x) { return randomPos = x; }); //Get pseudo random position
    // state transducer
    var reduceState = function (s, e) {
        return e instanceof Move ? __assign(__assign({}, s), { ship: __assign(__assign({}, s.ship), { pos: new Vec(s.ship.pos.x + e.direction, s.ship.pos.y) }) }) :
            e instanceof Shoot ? __assign(__assign({}, s), { bullets: s.bullets.concat([createShipBullet(s)]), objCount: s.objCount + 1, alienBullets: s.alienBullets.concat([createAlienBullet(s, randomPos)]) }) :
                tick(s, e.elapsed);
    };
    // main game stream
    var subscription = (0, rxjs_1.merge)(gameClock, startLeftMove, startRightMove, stopLeftMove, stopRightMove, shoot)
        .pipe((0, operators_1.scan)(reduceState, initialState))
        .subscribe(updateView);
    // Update the svg scene.  
    // This is an impure function in this program
    function updateView(s) {
        var restart = document.getElementById('button_id');
        var button = document.createElement('button');
        button.textContent = 'restart';
        var svg = document.getElementById("canvas"), ship = document.getElementById("ship"), shield1 = document.getElementById("shield1"), shield2 = document.getElementById("shield2"), shield3 = document.getElementById("shield3"), updateBodyView = function (b) {
            function createBodyView() {
                var v = document.createElementNS(svg.namespaceURI, "ellipse");
                attr(v, { id: b.id, rx: b.radius, ry: b.radius });
                v.classList.add(b.viewType);
                svg.appendChild(v);
                return v;
            }
            var v = document.getElementById(b.id) || createBodyView();
            attr(v, { cx: b.pos.x, cy: b.pos.y });
        };
        attr(ship, { transform: "translate(".concat(s.ship.pos.x, ",").concat(s.ship.pos.y, ")") });
        attr(shield1, { transform: "translate(".concat(s.shield1.pos.x, ",").concat(s.shield1.pos.y, ") scale(").concat(s.shield1.scale, ")") });
        //attr(shield1,{transform:`scale(${s.shield1.x},${s.shield1.y})`});
        attr(shield2, { transform: "translate(".concat(s.shield2.pos.x, ",").concat(s.shield2.pos.y, ") scale(").concat(s.shield2.scale, ")") });
        attr(shield3, { transform: "translate(".concat(s.shield3.pos.x, ",").concat(s.shield3.pos.y, ") scale(").concat(s.shield3.scale, ")") });
        s.bullets.forEach(updateBodyView);
        s.alien.forEach(updateBodyView);
        s.alienBullets.forEach(updateBodyView);
        s.exit.map(function (o) { return document.getElementById(o.id); })
            .filter(isNotNullOrUndefined)
            .forEach(function (v) {
            try {
                svg.removeChild(v);
            }
            catch (e) {
                // When bullets are both in exit and they expire,
                // this exception will occur
                console.log("Already removed: " + v.id);
            }
        });
        if (s.gameOver) {
            var v_1 = document.createElementNS(svg.namespaceURI, "text");
            attr(v_1, { x: 600 / 6, y: 600 / 2, class: "gameover" });
            v_1.textContent = "Game Over";
            svg.appendChild(v_1);
            restart.appendChild(button);
            subscription.unsubscribe();
            var click = (0, rxjs_1.fromEvent)(button, 'click'); // get the restart buttton
            click.pipe((0, operators_1.take)(1))
                .subscribe(function (ev) {
                spaceinvaders(); //recall the function which would also include subscription
                svg.removeChild(v_1);
                restart.removeChild(button);
                s.bullets.concat(s.alienBullets).map(function (o) { return document.getElementById(o.id); })
                    .filter(isNotNullOrUndefined)
                    .forEach(function (v) {
                    try {
                        svg.removeChild(v);
                    }
                    catch (e) {
                        // When bullets are both in exit and they expire,
                        // this exception will occur
                        console.log("Already removed: " + v.id);
                    }
                });
            });
        }
    }
}
// the following simply runs your pong function on window load.  Make sure to leave it in place.
if (typeof window != 'undefined') {
    window.onload = function () {
        spaceinvaders();
    };
}
// Adapted from the Asteroid Game. Highlights the button being pressed
function showKeys() {
    function showKey(k) {
        var arrowKey = document.getElementById(k), o = function (e) { return (0, rxjs_1.fromEvent)(document, e).pipe((0, operators_1.filter)(function (_a) {
            var code = _a.code;
            return code === k;
        })); };
        o('keydown').subscribe(function (e) { return arrowKey.classList.add("highlight"); });
        o('keyup').subscribe(function (_) { return arrowKey.classList.remove("highlight"); });
    }
    showKey('ArrowLeft');
    showKey('ArrowRight');
    showKey('ArrowUp');
    showKey('Space');
}
setTimeout(showKeys, 0);
// The rest of the block are functions taken from The Asteroid Game
var 
/**
 * Composable not: invert boolean result of given function
 * @param f a function returning boolean
 * @param x the value that will be tested with f
 */
not = function (f) { return function (x) { return !f(x); }; }, 
/**
 * set a number of attributes on an Element at once
 * @param e the Element
 * @param o a property bag
 */
attr = function (e, o) { for (var k in o)
    e.setAttribute(k, String(o[k])); }; // Has 'any' type, but needed for function implementation. (obtained from Asteroid Game)
function isNotNullOrUndefined(input) {
    return input != null;
}
/**
* apply f to every element of a and return the result in a flat array
* @param a an array
* @param f a function that produces an array
*/
function flatMap(a, f) {
    var _a;
    return (_a = Array.prototype).concat.apply(_a, a.map(f));
}
/**
 * array a except anything in b
 * @param eq equality test function for two Ts
 * @param a array to be filtered
 * @param b array of elements to be filtered out of a
 */
var except = function (eq) {
    return function (a) {
        return function (b) { return a.filter(not(elem(eq)(b))); };
    };
};
/**
 * is e an element of a using the eq function to test equality?
 * @param eq equality test function for two Ts
 * @param a an array that will be searched
 * @param e an element to search a for
 */
var elem = function (eq) {
    return function (a) {
        return function (e) { return a.findIndex(eq(e)) >= 0; };
    };
};
/**
 * Returns a random integer between min and max
 * @param min Minimum num
 * @param max Maximum num
 */
function getRandomNum(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
/**
* A simple immutable vector class
*/
var Vec = /** @class */ (function () {
    function Vec(x, y) {
        if (x === void 0) { x = 0; }
        if (y === void 0) { y = 0; }
        var _this = this;
        this.x = x;
        this.y = y;
        this.add = function (b) { return new Vec(_this.x + b.x, _this.y + b.y); };
        this.sub = function (b) { return _this.add(b.scale(-1)); };
        this.len = function () { return Math.sqrt(_this.x * _this.x + _this.y * _this.y); };
        this.scale = function (s) { return new Vec(_this.x * s, _this.y * s); };
        this.switch = function (b) { return new Vec(_this.x - b.x, _this.y); };
        this.moveDownright = function (s) { return new Vec(_this.x + 1, _this.y + s); }; //move y position of alien row downright
        this.moveDownleft = function (s) { return new Vec(_this.x - 1, _this.y + s); }; //move y position of alien row downleft
        this.ortho = function () { return new Vec(_this.y, -_this.x); };
        this.rotate = function (deg) {
            return (function (rad) { return (function (cos, sin, _a) {
                var x = _a.x, y = _a.y;
                return new Vec(x * cos - y * sin, x * sin + y * cos);
            })(Math.cos(rad), Math.sin(rad), _this); })(Math.PI * deg / 180);
        };
    }
    Vec.unitVecInDirection = function (deg) { return new Vec(0, -1).rotate(deg); };
    Vec.Zero = new Vec();
    return Vec;
}());
