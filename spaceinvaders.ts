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

import { fromEvent, interval, merge, zip } from 'rxjs'; 
import { map, filter, scan, take} from 'rxjs/operators';

type Key = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'Space' 
type Event = 'keydown' | 'keyup'

function spaceinvaders() {
  
    const 
    Constants = {
      CanvasSize: 600,
      BulletRadius: 3,
      StartAlienRadius: 15,
      StartAliensCount: 40,
      StartAlienRow: 4,
      Alien1Score: 4,
      Alien2Score: 3,
      Alien3Score: 2,
      Alien4Score: 1,
      
    } as const  

    // our game has the following view element types:
    type ViewType = 'ship' | 'shipBullet' | 'alien1' | 'alien2' | 'alien3'| 'alien4' | 'alienBullet' | 'shield1'
    | 'shield2'| 'shield3'

    // classes to allow for the creation of new instances which will be captured by our reduceState function
    class Shoot { constructor() {} }
    class Move { constructor(public readonly direction:number) {} }
    class Tick { constructor(public readonly elapsed:number) {} }

    // This we get the element id from html file so we can show the score and level from our state.
    const scoreInPage = document.getElementById("score_id");
    const levelInPage = document.getElementById("level_id");
    

    // a seedable pseudo-random number generator for alienBullets
    // (adapted from Week 4 Lab PiApproximation solution)
  class RNG {
    // LCG using GCC's constants
   readonly m = 0x80000000// 2**31
   readonly a = 1103515245
   readonly c = 12345
   
    constructor(readonly state:number) {}    
    int() {
      return (this.a*this.state+this.c) % this.m;
    }
    float() {
      // returns in range [0,1]
      return this.int() / (this.m - 1);
    }
    next() {
      return new RNG(this.int()) // doesnt mutate, gives back new RNG
    }
  }

  const randomNumberStream = (seed:number) => interval(500).pipe(
    scan((r,_) => r.next(), new RNG(seed)),
    map(r =>1 + 5.5* r.float())  // now range is from [0.5 to 5.5]
  ),

  // To scale the random x,y numbers to our Canvas size: 600
  scalex = (v:number)=> (v)*100,
  scaley= (v:number) => (v-1)*100

  
  const randomZip = zip(randomNumberStream(1),randomNumberStream(2)) // Zip allows us to pair 2 observables to create (x,y) coordinates through Vector Class
  .pipe(map(([x,y])=>new Vec (scalex(x),scaley(y))))


  // Our game clock which operates on discrete timesteps (obtained by interval)
  const gameClock = interval(10)
    .pipe(map(elapsed=>new Tick(elapsed))),


  keyObservable = <T>(e:Event, k:Key, result:()=>T)=>
    fromEvent<KeyboardEvent>(document,e)
      .pipe(
        filter(({code})=>code === k),
          filter(({repeat})=>!repeat),
        map(result)),


      startLeftMove = keyObservable('keydown','ArrowLeft',()=>new Move(-10)),
      startRightMove = keyObservable('keydown','ArrowRight',()=>new Move(10)),
      stopLeftMove = keyObservable('keyup','ArrowLeft',()=>new Move(0)),
      stopRightMove = keyObservable('keyup','ArrowRight',()=>new Move(0)),
      shoot = keyObservable('keydown','Space', ()=>new Shoot())
      
    // we define type interfaces for Body and State
    type Body = Readonly<{
      id:string,
      viewType: ViewType,
      pos: Vec,
      vel: Vec,
      radius:number,
      scale: number,
      createTime:number
      defaultScore: number
    }>

    type State = Readonly<{
      time:number,
      ship:Body,
      shield1: Body,
      shield2: Body,
      shield3: Body,
      bullets:ReadonlyArray<Body>,
      alienBullets: ReadonlyArray<Body>
      alien:ReadonlyArray<Body>,
      exit:ReadonlyArray<Body>,
      objCount:number,
      score: number,
      level: number,
      alienTime: number
      gameOver:boolean,
    }>
    

    // Allows us to create the Aliens which are circles
    const createCircle = (viewType: ViewType)=> (oid:number)=> (time:number)=> (radius:number)=> (pos:Vec)=> (vel:Vec)=>(score:number) =>//(xVal:Number)=>(yVal:Number)=> //(vel:Vec)=>
      <Body>{
        createTime: time,
        vel: vel, 
        pos: pos, 
        radius: radius,
        id: viewType+oid,
        viewType: viewType,
        defaultScore: score
      }

      // Create bullets for Ship
      function createShipBullet(s:State):Body {
        const d = Vec.unitVecInDirection(0);
        return {
          id: `shipBullet${s.objCount}`,
          pos:s.ship.pos.add(d.scale(20)),
          vel:s.ship.vel.add(d.scale(3)),
          createTime:s.time,
          scale: 1,
          radius:3,
          viewType: 'shipBullet',
          defaultScore: 0
        }
      }

      // Create bullets for Aliens
      function createAlienBullet(s:State, pos:Vec):Body {
        const d = Vec.unitVecInDirection(0);
        return {
          id: `alienBullet${s.objCount}`,
          pos: pos,
          vel:s.ship.vel.add(d.scale(-2)), 
          createTime:s.time,
          scale: 1,
          radius:3,
          viewType: 'alienBullet',
          defaultScore: 0
        }
      }

    // Create Ship
    function createShip():Body {
      return {
        id: 'ship',
        pos: new Vec(25,555),
        scale: 1,
        vel: Vec.Zero,
        radius:20,
        createTime:0,
        viewType: 'ship',
        defaultScore: 0
      }
    }

    // We have 3 shields. We need to create a body for each so that they behave individually.
    function createShield1():Body {
      return {
        id: 'shield1',
        pos: new Vec(50,400),
        scale: 1,
        vel: Vec.Zero,
        radius:60,
        createTime:0,
        viewType: 'shield1',
        defaultScore: 0
      }
    }

    function createShield2():Body {
      return {
        id: 'shield2',
        pos: new Vec(250,400), 
        scale: 1,
        vel: Vec.Zero,
        radius:60,
        createTime:0,
        viewType: 'shield2',
        defaultScore: 0
      }
    }

    function createShield3():Body {
      return {
        id: 'shield3',
        pos: new Vec(450,400),
        scale: 1,
        vel: Vec.Zero,
        radius:60,
        createTime:0,
        viewType: 'shield3',
        defaultScore: 0
      }
    }

      // our initial array of Aliens derived from the createCircle function.
      // We have 4 types of aliens, each with their own default score.
      const startAliens1 = [...Array(Constants.StartAliensCount/Constants.StartAlienRow)]
      .map((_,i)=>createCircle("alien1")(i)(0)(Constants.StartAlienRadius)(new Vec (10+i*2*Constants.StartAlienRadius,20))(new Vec(1, 0))(Constants.Alien1Score))

      const startAliens2 = [...Array(Constants.StartAliensCount/Constants.StartAlienRow)]
      .map((_,i)=>createCircle("alien2")(i)(0)(Constants.StartAlienRadius)(new Vec (10+i*2*Constants.StartAlienRadius,20+2*Constants.StartAlienRadius))(new Vec(1, 0))(Constants.Alien2Score))

      const startAliens3 = [...Array(Constants.StartAliensCount/Constants.StartAlienRow)]
      .map((_,i)=>createCircle("alien3")(i)(0)(Constants.StartAlienRadius)(new Vec (10+i*2*Constants.StartAlienRadius,20+4*Constants.StartAlienRadius))(new Vec(1, 0))(Constants.Alien3Score))

      const startAliens4 = [...Array(Constants.StartAliensCount/Constants.StartAlienRow)]
      .map((_,i)=>createCircle("alien4")(i)(0)(Constants.StartAlienRadius)(new Vec (10+i*2*Constants.StartAlienRadius,20+6*Constants.StartAlienRadius))(new Vec(1, 0))(Constants.Alien4Score))



    // we setup our initial state from which our game will begin.
    const initialState:State = {
      time:0,
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
      alien: startAliens1.concat(startAliens2,startAliens3,startAliens4),
      gameOver:false,
    }

   
    // All changes in movement and appearance go through thses block of codes
    const shieldDamage = (o:Body) => <Body>{
      ...o,
      scale: o.scale > 0? o.scale - 1/50  : 0,
      radius: o.radius > 0? o.radius - 1/150  : 0
    }
   
    const moveBody = (o:Body) => <Body>{
      ...o,
      pos: new Vec (o.pos.x < 10 ? 10 : o.pos.x >= 600 - 10 ? 600 - 10 : o.pos.x, o.pos.y).add(o.vel),
      vel:o.vel,
    }

    const removeBody = (o:Body) => <Body>{
      ...o,
      pos: Vec.Zero, 
      vel:Vec.Zero,
    }


    const moveAlienBullet = (o:Body) => <Body>{
      ...o,
      pos: o.pos.add(o.vel),
      vel:o.vel,
    }

    const moveAlienRight = (o:Body)  => <Body>{
      ...o,
      pos:  o.pos.x == Constants.CanvasSize/2? o.pos.moveDownright(10 /* circle radius */) : o.pos.add(o.vel) ,
      vel:o.vel
    }

    const moveAlienLeft = (o:Body) => <Body>{
      ...o,
      pos: o.pos.x == Constants.CanvasSize/2? o.pos.moveDownleft(10 /* circle radius */) : o.pos.switch(o.vel),
      vel:o.vel
    }
    


    // Checks the state for collisions
    // Adapted from the Asteroid Game
    const handleCollisions = (s:State) => {
      
      const
        bodiesCollided = ([a,b]:[Body,Body]) => a.pos.sub(b.pos).len() < a.radius + b.radius,
        
        shipCollided = s.alien.filter(r=>bodiesCollided([s.ship,r])).length > 0, //check if alien collided with ship
        
        filterCollided = (a:Body) =>  s.alienBullets.filter(r=>bodiesCollided([a,r])), //filter those collided
        
        alienBulletsCollidedShield1 = filterCollided(s.shield1).length > 0,
        alienBulletsCollidedShield2 = filterCollided(s.shield2).length > 0,
        alienBulletsCollidedShield3 = filterCollided(s.shield3).length > 0,
        
        
        allAlienBulletCollided = filterCollided(s.shield1).concat(filterCollided(s.shield2),filterCollided(s.shield3)),

        filterCollidedShipShield = (a:Body) =>  s.bullets.filter(r=>bodiesCollided([a,r])),
        shipBulletsCollidedShield1 = filterCollidedShipShield(s.shield1).length > 0,
        shipBulletsCollidedShield2 = filterCollidedShipShield(s.shield2).length > 0,
        shipBulletsCollidedShield3 = filterCollidedShipShield(s.shield3).length > 0,
        
        allShipBulletCollided = filterCollidedShipShield(s.shield1).concat(filterCollidedShipShield(s.shield2),filterCollidedShipShield(s.shield3)),

        shipBulletCollided = s.alienBullets.filter(r=>bodiesCollided([s.ship,r])).length > 0,
        
        allBulletsAndAliens = flatMap(s.bullets, b=> s.alien.map(r=>([b,r]))),
        collidedBulletsAndAliens = allBulletsAndAliens.filter(bodiesCollided),
        collidedBullets = collidedBulletsAndAliens.map(([bullet,_])=>bullet),
        collidedAliens = collidedBulletsAndAliens.map(([_,alien])=>alien),

        acc = (accumulator:number, currentValue:number) => accumulator + currentValue,
        scoreCount = collidedAliens.map((a:Body) => a.defaultScore),
        
        cut = except((a:Body)=>(b:Body)=>a.id === b.id)
        
       // at this stage, we use cut to remove those bodies that have collided by concatenating them and placing them in exit
      return <State>{
        ...s,
        gameOver: shipCollided || shipBulletCollided,
        bullets: cut(s.bullets)(collidedBullets.concat(allShipBulletCollided)),
        alienBullets: cut(s.alienBullets)(allAlienBulletCollided),
        alien: s.alien.length <= 0? (startAliens1.concat(startAliens2,startAliens3,startAliens4)) : cut(s.alien)(collidedAliens),//.concat(newRocks),
        
        shield1: alienBulletsCollidedShield1? shieldDamage(s.shield1): shipBulletsCollidedShield1? shieldDamage(s.shield1) :s.shield1,
        shield2: alienBulletsCollidedShield2? shieldDamage(s.shield2):shipBulletsCollidedShield2? shieldDamage(s.shield2) : s.shield2,
        shield3: alienBulletsCollidedShield3? shieldDamage(s.shield3): shipBulletsCollidedShield3? shieldDamage(s.shield3) :s.shield3,
        exit: s.exit.concat(collidedBullets,collidedAliens,allAlienBulletCollided,allShipBulletCollided),
        
        objCount: s.objCount ,
        
        score: s.score + scoreCount.reduce(acc,0),

      }
    }


    // at each tick, bodies move and bullets expire.
    const tick = (s:State,elapsed:number) => {
      
      scoreInPage.innerHTML = String(s.score)
      levelInPage.innerHTML = String(s.level)
      
      const 
      // set expiration time for bullets. Prevents bullets from existing and travelling in the background
        expired = (b:Body)=>(elapsed - b.createTime) > 150,
        expiredBullets:Body[] = s.bullets.filter(expired),
        activeBullets = s.bullets.filter(not(expired)),
        expiredAlienBullets:Body[] = s.alienBullets.filter(expired),
        
        activeAlienBullets = s.alienBullets.filter(not(expired));
        
   
        
      return handleCollisions({...s, 
        time: elapsed,
        alienTime: s.alien.length <= 0? elapsed: s.alienTime,
        ship:moveBody(s.ship), 
        alien: (elapsed - s.alienTime )% 600 >= 300? s.alien.map(moveAlienLeft) : s.alien.map(moveAlienRight),  //Switch direction according to elapsed time per level
        bullets: s.gameOver? activeBullets.map(removeBody) :activeBullets.map(moveBody),
        alienBullets: activeAlienBullets.map(moveAlienBullet),
        level: s.alien.length <= 0? s.level + 1 : s.level,
        exit:s.gameOver?s.bullets.concat(s.alienBullets):  expiredBullets.concat(expiredAlienBullets),        
      })
    }
    

    var randomPos:Vec = Vec.Zero // the only mutable variable. Needed for dicrete concatenation of alienBullet body into the array.
    randomZip.subscribe(x=> randomPos = x) //Get pseudo random position
  
    // state transducer
    const reduceState = (s:State, e:Move|Tick|Shoot)=>
      e instanceof Move ? {...s,
        ship: {...s.ship,pos:new Vec(s.ship.pos.x + e.direction,s.ship.pos.y)},
        
      } :
      e instanceof Shoot ? {...s,
        bullets: s.bullets.concat([ createShipBullet(s) ]),
        objCount: s.objCount + 1,
        alienBullets:  s.alienBullets.concat([createAlienBullet(s,randomPos)]) 
      } : 
     
      tick(s,e.elapsed)


  // main game stream
  const subscription =
    merge(gameClock,
      startLeftMove,startRightMove,
      stopLeftMove,stopRightMove,
      shoot)
    .pipe(
      scan(reduceState, initialState))
    .subscribe(updateView)



  // Update the svg scene.  
  // This is an impure function in this program
  function updateView(s: State) {

      const restart: HTMLElement = document.getElementById('button_id');
      const button = document.createElement('button');
      button.textContent = 'restart';
    const 
      svg = document.getElementById("canvas")!,
      ship = document.getElementById("ship")!,
      shield1 = document.getElementById("shield1")!,
      shield2 = document.getElementById("shield2")!,
      shield3 = document.getElementById("shield3")!,
      
      updateBodyView = (b:Body) => {
        function createBodyView() {
          const v = document.createElementNS(svg.namespaceURI, "ellipse")!;
          attr(v,{id:b.id,rx:b.radius,ry:b.radius});
          v.classList.add(b.viewType)
          svg.appendChild(v)
          return v;
        }
   
        const v = document.getElementById(b.id) ||  createBodyView();
        attr(v,{cx:b.pos.x,cy:b.pos.y});
      };
    attr(ship,{transform:`translate(${s.ship.pos.x},${s.ship.pos.y})`});
    attr(shield1,{transform:`translate(${s.shield1.pos.x},${s.shield1.pos.y}) scale(${s.shield1.scale})` });
    //attr(shield1,{transform:`scale(${s.shield1.x},${s.shield1.y})`});
    attr(shield2,{transform:`translate(${s.shield2.pos.x},${s.shield2.pos.y}) scale(${s.shield2.scale})`});
    attr(shield3,{transform:`translate(${s.shield3.pos.x},${s.shield3.pos.y}) scale(${s.shield3.scale})`});

     s.bullets.forEach(updateBodyView);
     s.alien.forEach(updateBodyView);
     s.alienBullets.forEach(updateBodyView);
    s.exit.map(o=>document.getElementById(o.id))
          .filter(isNotNullOrUndefined)
          .forEach(v=>{
            try {
              svg.removeChild(v)
            } catch(e) {
              // When bullets are both in exit and they expire,
              // this exception will occur
              console.log("Already removed: "+v.id)
            }
          })
    

    if(s.gameOver) {

      const v = document.createElementNS(svg.namespaceURI, "text")!;
      attr(v,{x:600/6,y:600/2,class:"gameover"});
      v.textContent = "Game Over";
      svg.appendChild(v);
   
      restart.appendChild(button);
      subscription.unsubscribe();

      const click = fromEvent<MouseEvent>(button, 'click'); // get the restart buttton
      click.pipe(
      take(1))
      .subscribe(ev => { 
        spaceinvaders() //recall the function which would also include subscription
        svg.removeChild(v)
        restart.removeChild(button)
        s.bullets.concat(s.alienBullets).map(o=>document.getElementById(o.id))
          .filter(isNotNullOrUndefined)
          .forEach(v=>{
            try {
              svg.removeChild(v)
            } catch(e) {
              // When bullets are both in exit and they expire,
              // this exception will occur
              console.log("Already removed: "+v.id)
            }
          })

      }); 

      
    }
  }   

}
  
// the following simply runs your pong function on window load.  Make sure to leave it in place.
if (typeof window != 'undefined'){
  window.onload = ()=>{
    spaceinvaders();
  }
}

// Adapted from the Asteroid Game. Highlights the button being pressed
function showKeys() {
  function showKey(k:Key) {
    const arrowKey = document.getElementById(k)!,
      o = (e:Event) => fromEvent<KeyboardEvent>(document,e).pipe(
        filter(({code})=>code === k))
    o('keydown').subscribe(e => arrowKey.classList.add("highlight"))
    o('keyup').subscribe(_=>arrowKey.classList.remove("highlight"))
  }
  showKey('ArrowLeft');
  showKey('ArrowRight');
  showKey('ArrowUp');
  showKey('Space');

}

setTimeout(showKeys, 0)



// The rest of the block are functions taken from The Asteroid Game
const 
/**
 * Composable not: invert boolean result of given function
 * @param f a function returning boolean
 * @param x the value that will be tested with f
 */
  not = <T>(f:(x:T)=>boolean)=> (x:T)=> !f(x),

/**
 * set a number of attributes on an Element at once
 * @param e the Element
 * @param o a property bag
 */         
   attr = (e:Element,o:Object) =>
   { for(const k in o) e.setAttribute(k,String(o[k])) }  // Has 'any' type, but needed for function implementation. (obtained from Asteroid Game)

   function isNotNullOrUndefined<T extends Object>(input: null | undefined | T): input is T {
    return input != null;
  }

  /**
 * apply f to every element of a and return the result in a flat array
 * @param a an array
 * @param f a function that produces an array
 */
function flatMap<T,U>(
  a:ReadonlyArray<T>,
  f:(a:T)=>ReadonlyArray<U>
): ReadonlyArray<U> {
  return Array.prototype.concat(...a.map(f));
}


/**
 * array a except anything in b
 * @param eq equality test function for two Ts
 * @param a array to be filtered
 * @param b array of elements to be filtered out of a
 */ 
 const except = 
 <T>(eq: (_:T)=>(_:T)=>boolean)=>
   (a:ReadonlyArray<T>)=> 
     (b:ReadonlyArray<T>)=> a.filter(not(elem(eq)(b)))

/**
 * is e an element of a using the eq function to test equality?
 * @param eq equality test function for two Ts
 * @param a an array that will be searched
 * @param e an element to search a for
 */
 const elem = 
 <T>(eq: (_:T)=>(_:T)=>boolean)=> 
   (a:ReadonlyArray<T>)=> 
     (e:T)=> a.findIndex(eq(e)) >= 0

/**
 * Returns a random integer between min and max
 * @param min Minimum num
 * @param max Maximum num
 */
function getRandomNum(min:number,max:number){
  return Math.floor(Math.random() * (max-min +1)) + min;
}
  
  /**
 * A simple immutable vector class
 */
class Vec {
  constructor(public readonly x: number = 0, public readonly y: number = 0) {}
  add = (b:Vec) => new Vec(this.x + b.x, this.y + b.y)
  sub = (b:Vec) => this.add(b.scale(-1))
  len = ()=> Math.sqrt(this.x*this.x + this.y*this.y)
  scale = (s:number) => new Vec(this.x*s,this.y*s)
  switch = (b:Vec) => new Vec(this.x - b.x, this.y)
  moveDownright = (s:number) => new Vec(this.x + 1,this.y+s) //move y position of alien row downright
  moveDownleft = (s:number) => new Vec(this.x - 1,this.y+s) //move y position of alien row downleft
  ortho = ()=> new Vec(this.y,-this.x)
  rotate = (deg:number) =>
            (rad =>(
                (cos,sin,{x,y})=>new Vec(x*cos - y*sin, x*sin + y*cos)
              )(Math.cos(rad), Math.sin(rad), this)
            )(Math.PI * deg / 180)

  static unitVecInDirection = (deg: number) => new Vec(0,-1).rotate(deg)
  static Zero = new Vec();
}
