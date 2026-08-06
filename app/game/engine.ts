import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { classifyEnemyContact, coinWithinPickup } from "./collision.js";
import { generateLevel } from "./levels.js";
import { animateGuardianModel, animatePlayerModel, createGuardianModel, createPlayerModel, type GuardianRig, type PlayerRig } from "./models";
import type { GameSettings } from "./settings";

export interface GameSnapshot {
  coins: number;
  totalCoins: number;
  health: number;
  enemies: number;
  totalEnemies: number;
  gamepad: string;
}

interface Callbacks {
  onSnapshot: (snapshot: GameSnapshot) => void;
  onDeath: () => void;
  onVictory: () => void;
  onToast: (message: string) => void;
  onDamage: () => void;
  onPause: () => void;
}

type Coin = { mesh: THREE.Group; position: THREE.Vector3; collected: boolean; phase: number };
type Enemy = { mesh: THREE.Group; rig: GuardianRig; position: THREE.Vector3; origin: THREE.Vector3; alive: boolean; phase: number; hit: number; shooter:boolean; lastShot:number };
type Projectile = { mesh:THREE.Mesh; velocity:THREE.Vector3; life:number };
type JumpPad = { mesh:THREE.Group; position:THREE.Vector3; power:number; cooldown:number };

export class AuroraGame {
  private canvas: HTMLCanvasElement;
  private callbacks: Callbacks;
  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(55, 1, .1, 300);
  private composer!: EffectComposer;
  private bloom!: UnrealBloomPass;
  private clock = new THREE.Clock();
  private frame = 0;
  private world!: RAPIER.World;
  private character!: RAPIER.KinematicCharacterController;
  private playerBody!: RAPIER.RigidBody;
  private playerCollider!: RAPIER.Collider;
  private player = new THREE.Group();
  private playerVisual = new THREE.Group();
  private playerRig!: PlayerRig;
  private coins: Coin[] = [];
  private enemies: Enemy[] = [];
  private particles!: THREE.Points;
  private goal = new THREE.Group();
  private settings!: GameSettings;
  private keys = new Set<string>();
  private pressed = new Set<string>();
  private mouseDown = false;
  private paused = true;
  private initialized = false;
  private destroyed = false;
  private verticalVelocity = 0;
  private grounded = false;
  private jumpsRemaining = 2;
  private yaw = .55;
  private pitch = .5;
  private attackTimer = 0;
  private hurtCooldown = 0;
  private coinsCollected = 0;
  private health = 3;
  private remainingEnemies = 0;
  private gamepadIndex: number | null = null;
  private gamepadButtons = new Set<number>();
  private lastGamepadName = "";
  private goalUnlocked = false;
  private listeners: Array<() => void> = [];
  private projectiles: Projectile[] = [];
  private jumpPads: JumpPad[] = [];
  private level: ReturnType<typeof generateLevel>;

  constructor(canvas: HTMLCanvasElement, callbacks: Callbacks, levelNumber=1) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.level=generateLevel(levelNumber);
  }

  async init(settings: GameSettings) {
    this.settings = settings;
    await RAPIER.init();
    if (this.destroyed) return;
    this.world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    this.character = this.world.createCharacterController(.06);
    this.character.enableAutostep(.35, .18, true);
    this.character.enableSnapToGround(.22);
    this.character.setMaxSlopeClimbAngle(50 * Math.PI / 180);
    this.setupRenderer();
    this.setupWorld();
    this.setupInput();
    this.applySettings(settings);
    this.reset();
    this.initialized = true;
    this.clock.start();
    this.loop();
  }

  private setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({ canvas:this.canvas, antialias:true, powerPreference:"high-performance" });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .34, .55, 1.02);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.resize();
  }

  private setupWorld() {
    this.scene.background = new THREE.Color(0x86c9e5);
    this.scene.fog = new THREE.FogExp2(0x86c9e5, .009);

    const hemi = new THREE.HemisphereLight(0xfff4cf, 0x395184, 1.45);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff0c4, 2.65);
    sun.position.set(-18, 34, 14);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048,2048);
    sun.shadow.camera.left = -35; sun.shadow.camera.right = 35; sun.shadow.camera.top = 42; sun.shadow.camera.bottom = -18;
    sun.shadow.bias = -.0003;
    this.scene.add(sun);

    const sunBall = new THREE.Mesh(new THREE.SphereGeometry(8,24,24), new THREE.MeshBasicMaterial({color:0xffe8a3, fog:false}));
    sunBall.position.set(-55,52,-90); this.scene.add(sunBall);

    this.makeCloudSea();
    this.level.platforms.forEach((item, i) => this.addIsland(item.p, item.s, item.c, i, item.kind));
    this.addBridgesAndDecor();
    this.makePipes();
    this.makeCourseObstacles();
    this.makePlayer();
    this.makeCoins();
    this.makeEnemies();
    this.makeGoal();
    this.makeParticles();

    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0,2,0);
    this.playerBody = this.world.createRigidBody(bodyDesc);
    this.playerCollider = this.world.createCollider(RAPIER.ColliderDesc.capsule(.55,.38), this.playerBody);
    this.scene.add(this.player);
    this.camera.position.set(9,8,12);
  }

  private addIsland(position: readonly number[], size: readonly number[], color: number, index: number, kind="island") {
    const [x,y,z] = position, [w,h,d] = size;
    const group = new THREE.Group();
    group.position.set(x,y,z);
    const cliffMat = new THREE.MeshStandardMaterial({color: index % 2 ? 0x8b6c7c : 0x75657d, roughness:.88, flatShading:true});
    const topMat = new THREE.MeshStandardMaterial({color, roughness:.76, flatShading:true});
    const organic=kind==="island"||kind==="small";
    if(organic){
      const cliff=new THREE.Mesh(new THREE.CylinderGeometry(Math.min(w,d)*.42,Math.min(w,d)*.25,h+3,8),cliffMat);cliff.scale.x=w/d;cliff.position.y=-1.5;cliff.castShadow=cliff.receiveShadow=true;group.add(cliff);
      const top=new THREE.Mesh(new THREE.CylinderGeometry(Math.min(w,d)*.5,Math.min(w,d)*.46,.55,8),topMat);top.scale.x=w/d;top.position.y=h/2+.12;top.castShadow=top.receiveShadow=true;group.add(top);
      const rimMat=new THREE.MeshStandardMaterial({color:new THREE.Color(color).multiplyScalar(.68),roughness:.9,flatShading:true});const rim=new THREE.Mesh(new THREE.CylinderGeometry(Math.min(w,d)*.465,Math.min(w,d)*.43,.2,8),rimMat);rim.scale.x=w/d;rim.position.y=h/2-.19;rim.castShadow=rim.receiveShadow=true;group.add(rim);
      const grassMat=new THREE.MeshStandardMaterial({color:new THREE.Color(color).offsetHSL(.02,.08,.08),roughness:.92,flatShading:true});const tuftGeometry=new THREE.ConeGeometry(.08,.34,4);for(let tuftIndex=0;tuftIndex<4;tuftIndex++){const angle=index*1.31+tuftIndex*2.17;const tuft=new THREE.Mesh(tuftGeometry,grassMat);tuft.position.set(Math.cos(angle)*w*.3,h/2+.49,Math.sin(angle)*d*.3);tuft.rotation.y=angle;tuft.castShadow=true;group.add(tuft)}
    }else{
      const industrial=["beam","slab","scaffold","pipeDeck","jumpDeck"].includes(kind);const bodyMat=new THREE.MeshStandardMaterial({color:industrial?(kind==="scaffold"?0xb9844f:0x5a5263):kind==="ruin"?0x8f786f:0x69758a,roughness:industrial?.58:.82,metalness:industrial?.24:.05,flatShading:true});
      const body=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),bodyMat);body.position.y=.395;body.castShadow=body.receiveShadow=true;group.add(body);
      const trim=new THREE.Mesh(new THREE.BoxGeometry(w+.08,.12,d+.08),new THREE.MeshStandardMaterial({color:kind==="jumpDeck"?0x69e6d1:kind==="pipeDeck"?0x3fb37a:new THREE.Color(color).multiplyScalar(.8),roughness:.5,metalness:.28}));trim.position.y=h/2+.42;trim.castShadow=true;group.add(trim);
      if(kind==="scaffold"){const railMat=new THREE.MeshStandardMaterial({color:0xe5b56a,metalness:.45,roughness:.4});for(const side of [-1,1]){const rail=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,w,6),railMat);rail.rotation.z=Math.PI/2;rail.position.set(0,h/2+.72,side*d*.42);group.add(rail);for(const end of [-1,1]){const post=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,.65,6),railMat);post.position.set(end*w*.45,h/2+.68,side*d*.42);group.add(post)}}}
      if(kind==="column"||kind==="bunker"){const band=new THREE.Mesh(new THREE.BoxGeometry(w+.16,.18,d+.16),topMat);band.position.y=.395;group.add(band)}
    }
    this.scene.add(group);
    // A tampa verde se projeta 0,395 unidade acima do volume rochoso.
    // O collider acompanha essa superfície visível para os pés não afundarem.
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(w/2,h/2,d/2).setTranslation(x,y+.395,z));
    if (organic && (index === 7 || index === 15)) {
      for (let i=0;i<3;i++) this.addTree(x-w*.25+i*w*.22, y+h/2+.1, z+d*.28-(i%2)*1.2, .8+(i%2)*.2);
    }
  }

  private addTree(x:number,y:number,z:number,scale:number) {
    const tree = new THREE.Group(); tree.position.set(x,y,z); tree.scale.setScalar(scale);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.18,.27,1.5,7), new THREE.MeshStandardMaterial({color:0x765269, roughness:1})); trunk.position.y=.75; trunk.castShadow=true; tree.add(trunk);
    const crownMat = new THREE.MeshStandardMaterial({color:0x2e8d72, roughness:.8, flatShading:true});
    for (const [px,py,pz,s] of [[0,1.8,0,1],[-.5,1.55,.1,.7],[.45,1.65,0,.75]] as const) { const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(.82,1),crownMat); crown.position.set(px,py,pz); crown.scale.setScalar(s); crown.castShadow=true; tree.add(crown); }
    this.scene.add(tree);
  }

  private addBridgesAndDecor() {
    const crystals: Array<[number,number,number]> = [[-4,1.4,-5],[5,1.4,5],[1,12.9,10],[-12,19.2,1],[3,25.6,-13]];
    crystals.forEach(([x,y,z],i) => {
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(.35+i%2*.16), new THREE.MeshStandardMaterial({color:0x78f0dc,emissive:0x1d8f94,emissiveIntensity:1.4,roughness:.2}));
      crystal.position.set(x,y,z); crystal.rotation.z=.18; crystal.castShadow=true; this.scene.add(crystal);
    });
    for(let i=0;i<10;i++) {
      const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(.35+Math.random()*.4,0),new THREE.MeshStandardMaterial({color:0x817188,roughness:1,flatShading:true}));
      rock.position.set((Math.random()-.5)*14,1.25,(Math.random()-.5)*11); rock.rotation.set(Math.random(),Math.random(),Math.random()); rock.castShadow=true; this.scene.add(rock);
    }
  }

  private makeCloudSea() {
    const mat = new THREE.MeshStandardMaterial({color:0xeaf8f1,roughness:1,transparent:true,opacity:.82});
    for(let i=0;i<48;i++) {
      const cloud=new THREE.Group(); const x=(Math.random()-.5)*150, z=(Math.random()-.5)*150, y=-5+Math.random()*4;
      cloud.position.set(x,y,z);
      for(let j=0;j<3+(i%3);j++){const puff=new THREE.Mesh(new THREE.SphereGeometry(2+Math.random()*2,9,7),mat);puff.position.set(j*2.6,Math.random(),(Math.random()-.5)*2);puff.scale.y=.55;cloud.add(puff)}
      this.scene.add(cloud);
    }
  }

  private makePlayer() {
    this.playerRig=createPlayerModel();this.playerVisual=this.playerRig.group;
    this.player.add(this.playerVisual);
  }

  private makeCoins() {
    const mat = new THREE.MeshStandardMaterial({color:0xffd45c,emissive:0xe59a25,emissiveIntensity:1.8,metalness:.65,roughness:.22});
    this.coins = this.level.coins.map((p,i) => {
      const group=new THREE.Group(); const ring=new THREE.Mesh(new THREE.TorusGeometry(.28,.09,8,18),mat); ring.castShadow=true; group.add(ring);
      const core=new THREE.Mesh(new THREE.OctahedronGeometry(.14),new THREE.MeshBasicMaterial({color:0xfff1a1}));group.add(core);
      group.position.set(...p); this.scene.add(group); return {mesh:group,position:new THREE.Vector3(...p),collected:false,phase:i*.7};
    });
  }

  private makeEnemies() {
    this.enemies = this.level.enemies.map((definition,i) => {
      const p=definition.p;
      const rig=createGuardianModel(i);const group=rig.group;
      if(definition.shooter){const cannon=new THREE.Mesh(new THREE.CylinderGeometry(.13,.2,.65,8),new THREE.MeshStandardMaterial({color:0x263b62,metalness:.55,roughness:.3}));cannon.position.set(0,.72,.55);cannon.rotation.x=Math.PI/2;group.add(cannon)}
      group.position.set(...p); this.scene.add(group); const pos=new THREE.Vector3(...p);return {mesh:group,rig,position:pos.clone(),origin:pos.clone(),alive:true,phase:i*1.7,hit:0,shooter:definition.shooter,lastShot:0};
    });
  }

  private makePipes(){
    const green=new THREE.MeshStandardMaterial({color:0x3fb37a,roughness:.35,metalness:.18});
    const dark=new THREE.MeshStandardMaterial({color:0x20725b,roughness:.48});
    for(const pipe of this.level.pipes){
      const [x,y,z]=pipe.p;const group=new THREE.Group();group.position.set(x,y,z);
      const body=new THREE.Mesh(new THREE.CylinderGeometry(pipe.radius*.78,pipe.radius*.78,pipe.height,16),green);body.position.y=pipe.height/2;body.castShadow=body.receiveShadow=true;group.add(body);
      const lip=new THREE.Mesh(new THREE.CylinderGeometry(pipe.radius,pipe.radius,.3,16),dark);lip.position.y=pipe.height;lip.castShadow=lip.receiveShadow=true;group.add(lip);this.scene.add(group);
      this.world.createCollider(RAPIER.ColliderDesc.cylinder(pipe.height/2+.15,pipe.radius).setTranslation(x,y+pipe.height/2,z));
    }
  }

  private makeCourseObstacles(){
    const spikeMat=new THREE.MeshStandardMaterial({color:0xff765d,metalness:.3,roughness:.42,emissive:0x8d261e,emissiveIntensity:.45});
    for(const hazard of this.level.hazards){const group=new THREE.Group();group.position.set(...hazard.p);for(let i=0;i<5;i++){const spike=new THREE.Mesh(new THREE.ConeGeometry(.13,.48,6),spikeMat);const a=i*Math.PI*2/5;spike.position.set(Math.cos(a)*.32,.24,Math.sin(a)*.32);spike.castShadow=true;group.add(spike)}group.userData.hazard=hazard;this.scene.add(group)}
    const padMat=new THREE.MeshStandardMaterial({color:0x66ecd1,emissive:0x23bda9,emissiveIntensity:2.5,metalness:.32,roughness:.24});
    for(const pad of this.level.jumpPads){const group=new THREE.Group();group.position.set(...pad.p);const base=new THREE.Mesh(new THREE.CylinderGeometry(.65,.72,.15,16),new THREE.MeshStandardMaterial({color:0x183d63,metalness:.5,roughness:.34}));group.add(base);const core=new THREE.Mesh(new THREE.CylinderGeometry(.46,.46,.17,16),padMat);core.position.y=.06;group.add(core);this.scene.add(group);this.jumpPads.push({mesh:group,position:new THREE.Vector3(...pad.p),power:pad.power,cooldown:0})}
  }

  private makeGoal() {
    const base=new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.9,.65,10),new THREE.MeshStandardMaterial({color:0xebe1c5,roughness:.7}));base.position.y=.3;base.castShadow=base.receiveShadow=true;this.goal.add(base);
    for(let i=0;i<3;i++){const pillar=new THREE.Mesh(new THREE.CylinderGeometry(.14,.2,3.5,7),new THREE.MeshStandardMaterial({color:0xf7e9c8,roughness:.6}));const a=i*Math.PI*2/3;pillar.position.set(Math.cos(a)*.9,2,Math.sin(a)*.9);pillar.rotation.z=Math.cos(a)*.08;pillar.castShadow=true;this.goal.add(pillar)}
    const orb=new THREE.Mesh(new THREE.IcosahedronGeometry(.65,2),new THREE.MeshStandardMaterial({color:0x7995a3,emissive:0x253846,emissiveIntensity:.2,roughness:.2}));orb.name="orb";orb.position.y=3.5;this.goal.add(orb);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(1.05,.06,8,32),new THREE.MeshBasicMaterial({color:0x778797,transparent:true,opacity:.45}));ring.name="ring";ring.position.y=3.5;ring.rotation.x=Math.PI/2;this.goal.add(ring);
    this.goal.position.set(...this.level.goal);this.scene.add(this.goal);
  }

  private makeParticles() {
    const count=180;const positions=new Float32Array(count*3);
    for(let i=0;i<count;i++){positions[i*3]=(Math.random()-.5)*70;positions[i*3+1]=Math.random()*38;positions[i*3+2]=(Math.random()-.5)*70;}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.BufferAttribute(positions,3));
    this.particles=new THREE.Points(geometry,new THREE.PointsMaterial({color:0xfff0ad,size:.09,transparent:true,opacity:.65,blending:THREE.AdditiveBlending,depthWrite:false}));this.scene.add(this.particles);
  }

  private setupInput() {
    const onKeyDown=(event:KeyboardEvent)=>{const key=event.key.toLowerCase();if(!this.keys.has(key))this.pressed.add(key);this.keys.add(key);if([" ","arrowup","arrowdown","arrowleft","arrowright"].includes(key))event.preventDefault();};
    const onKeyUp=(event:KeyboardEvent)=>this.keys.delete(event.key.toLowerCase());
    const onPointerDown=(event:PointerEvent)=>{this.mouseDown=true;this.canvas.setPointerCapture?.(event.pointerId);if(event.button===0)this.pressed.add("attack");};
    const onPointerUp=()=>{this.mouseDown=false};
    const onPointerMove=(event:PointerEvent)=>{if(!this.mouseDown||this.paused)return;this.yaw-=event.movementX*.003*this.settings.cameraSensitivity;this.pitch+=(this.settings.invertY?-1:1)*event.movementY*.0025*this.settings.cameraSensitivity;this.pitch=THREE.MathUtils.clamp(this.pitch,.12,1.05);};
    const onWheel=(event:WheelEvent)=>{this.pitch=THREE.MathUtils.clamp(this.pitch+event.deltaY*.00035,.12,1.05)};
    const onResize=()=>this.resize();
    const bind=<K extends keyof WindowEventMap>(type:K,fn:(e:WindowEventMap[K])=>void)=>{window.addEventListener(type,fn as EventListener);this.listeners.push(()=>window.removeEventListener(type,fn as EventListener));};
    bind("keydown",onKeyDown);bind("keyup",onKeyUp);bind("pointerup",onPointerUp);bind("resize",onResize);
    this.canvas.addEventListener("pointerdown",onPointerDown);this.canvas.addEventListener("pointermove",onPointerMove);this.canvas.addEventListener("wheel",onWheel,{passive:true});
    this.listeners.push(()=>this.canvas.removeEventListener("pointerdown",onPointerDown),()=>this.canvas.removeEventListener("pointermove",onPointerMove),()=>this.canvas.removeEventListener("wheel",onWheel));
  }

  private loop = () => {
    if(this.destroyed)return;this.frame=requestAnimationFrame(this.loop);
    const dt=Math.min(this.clock.getDelta(),.033);this.updateGamepad();
    if(!this.paused&&this.initialized)this.update(dt);else this.updateAmbient(dt);
    this.composer.render();this.pressed.clear();
  };

  private update(dt:number) {
    if(this.pressed.has("escape")||this.consumePad(9)){this.callbacks.onPause();return;}
    if(this.pressed.has("r")){this.yaw=.55;this.pitch=.5;}
    this.attackTimer=Math.max(0,this.attackTimer-dt);this.hurtCooldown=Math.max(0,this.hurtCooldown-dt);
    const pad=this.getPad();const left=this.deadzone(pad?.axes[0]??0,pad?.axes[1]??0);
    let mx=left.x,my=left.y;
    if(this.keys.has("a")||this.keys.has("arrowleft"))mx-=1;if(this.keys.has("d")||this.keys.has("arrowright"))mx+=1;
    if(this.keys.has("w")||this.keys.has("arrowup"))my-=1;if(this.keys.has("s")||this.keys.has("arrowdown"))my+=1;
    const len=Math.hypot(mx,my);if(len>1){mx/=len;my/=len;}
    if(pad){const right=this.deadzone(pad.axes[2]??0,pad.axes[3]??0);this.yaw-=right.x*2.2*dt*this.settings.cameraSensitivity;this.pitch+=(this.settings.invertY?-1:1)*right.y*1.8*dt*this.settings.cameraSensitivity;this.pitch=THREE.MathUtils.clamp(this.pitch,.12,1.05);}
    const jump=this.pressed.has(" ")||this.consumePad(0);const attack=this.pressed.has("f")||this.pressed.has("k")||this.pressed.has("attack")||this.consumePad(2)||this.consumePad(7);
    if(this.grounded)this.jumpsRemaining=2;
    if(jump&&this.jumpsRemaining>0){
      const isDoubleJump=this.jumpsRemaining===1;
      this.verticalVelocity=isDoubleJump?9.4:10.8;
      this.jumpsRemaining--;
      this.grounded=false;
      this.playerVisual.rotation.x=isDoubleJump?-.55:-.18;
      this.pulse(isDoubleJump?.42:.28,isDoubleJump?95:70);
    }
    this.verticalVelocity+=-25*dt;
    const forward=new THREE.Vector3(-Math.sin(this.yaw),0,-Math.cos(this.yaw));const right=new THREE.Vector3(Math.cos(this.yaw),0,-Math.sin(this.yaw));
    const move=forward.multiplyScalar(-my).add(right.multiplyScalar(mx));if(move.lengthSq()>.001){move.normalize();this.playerVisual.rotation.y=THREE.MathUtils.lerp(this.playerVisual.rotation.y,Math.atan2(move.x,move.z),.18);}
    const speed=this.grounded?6.8:5.3;const desired={x:move.x*speed*dt,y:this.verticalVelocity*dt,z:move.z*speed*dt};
    this.character.computeColliderMovement(this.playerCollider,desired,undefined,undefined,(collider)=>collider!==this.playerCollider);
    const actual=this.character.computedMovement();const t=this.playerBody.translation();this.playerBody.setNextKinematicTranslation({x:t.x+actual.x,y:t.y+actual.y,z:t.z+actual.z});
    this.grounded=this.character.computedGrounded();if(this.grounded&&this.verticalVelocity<0)this.verticalVelocity=-.5;
    this.world.step();const pos=this.playerBody.translation();this.player.position.set(pos.x,pos.y-.89,pos.z);
    this.animatePlayer(dt,move.length());
    if(attack&&this.attackTimer<=0)this.attack();
    this.updateCoins(dt);this.updateEnemies(dt);this.updateProjectiles(dt);this.updateCourseObstacles(dt);this.updateGoal(dt);this.updateCamera(dt);this.updateAmbient(dt);
    if(pos.y<-8)this.die();
  }

  private animatePlayer(dt:number,speed:number) {
    const t=performance.now()*.009;this.playerVisual.position.y=this.grounded?Math.abs(Math.sin(t))*speed*.06:0;
    this.playerVisual.rotation.z=THREE.MathUtils.lerp(this.playerVisual.rotation.z,this.attackTimer>.2?-.35:0,.18);
    if(!this.grounded)this.playerVisual.rotation.x=THREE.MathUtils.lerp(this.playerVisual.rotation.x,-.12,.12);else this.playerVisual.rotation.x*=.82;
    animatePlayerModel(this.playerRig,t,speed,this.grounded,this.verticalVelocity,this.attackTimer>.12);
  }

  private updateCoins(dt:number) {
    const pickupCenter={x:this.player.position.x,y:this.player.position.y+.75,z:this.player.position.z};
    for(const coin of this.coins){if(coin.collected)continue;coin.mesh.rotation.y+=dt*2.8;coin.mesh.position.y=coin.position.y+Math.sin(performance.now()*.0025+coin.phase)*.16;if(coinWithinPickup(pickupCenter,coin.mesh.position)){coin.collected=true;coin.mesh.visible=false;this.coinsCollected++;this.pulse(.18,45);this.callbacks.onToast(this.coinsCollected===this.level.coins.length?"Todos os fragmentos reunidos!":"Fragmento solar +1");this.emitSnapshot();this.checkUnlock();}}
  }

  private updateEnemies(dt:number) {
    const now=performance.now()*.001;
    for(const enemy of this.enemies){if(!enemy.alive)continue;enemy.hit=Math.max(0,enemy.hit-dt);const a=now*.72+enemy.phase;enemy.position.set(enemy.origin.x+Math.cos(a)*1.05,enemy.origin.y,enemy.origin.z+Math.sin(a)*1.05);enemy.mesh.position.copy(enemy.position);enemy.mesh.rotation.y=-a+.6;enemy.mesh.position.y+=Math.sin(now*3+enemy.phase)*.08;
      animateGuardianModel(enemy.rig,now,enemy.phase);
      const dx=this.player.position.x-enemy.position.x,dz=this.player.position.z-enemy.position.z,dist=Math.hypot(dx,dz);
      if(enemy.shooter&&dist<14&&now-enemy.lastShot>Math.max(1.45,2.7-this.level.difficulty*.2)){enemy.lastShot=now;this.fireProjectile(enemy)}
      const enemyTop=enemy.mesh.position.y+.98;
      const contact=classifyEnemyContact({horizontalDistance:dist,playerFeetY:this.player.position.y-.04,enemyTopY:enemyTop,verticalVelocity:this.verticalVelocity});
      if(contact==="stomp"){
        const body=this.playerBody.translation();
        const bounceHeight=enemyTop+.98;
        if(body.y<bounceHeight){this.playerBody.setTranslation({x:body.x,y:bounceHeight,z:body.z},true);this.playerBody.setNextKinematicTranslation({x:body.x,y:bounceHeight,z:body.z});this.player.position.y=bounceHeight-.89;}
        this.killEnemy(enemy,true);this.verticalVelocity=8.2;this.jumpsRemaining=1;
      }else if(contact==="hurt"&&this.hurtCooldown<=0){this.health--;this.hurtCooldown=1.5;this.verticalVelocity=5.5;this.jumpsRemaining=1;this.callbacks.onDamage();this.pulse(.8,180);this.emitSnapshot();if(this.health<=0)this.die();}
    }
  }

  private fireProjectile(enemy:Enemy){
    const mesh=new THREE.Mesh(new THREE.IcosahedronGeometry(.18,1),new THREE.MeshStandardMaterial({color:0xff875c,emissive:0xff3e28,emissiveIntensity:3,roughness:.2}));
    mesh.position.copy(enemy.mesh.position).add(new THREE.Vector3(0,.72,0));this.scene.add(mesh);
    const target=this.player.position.clone().add(new THREE.Vector3(0,.65,0));const velocity=target.sub(mesh.position).normalize().multiplyScalar(4.5+this.level.difficulty*.45);
    this.projectiles.push({mesh,velocity,life:4.5});
  }

  private updateProjectiles(dt:number){
    for(let i=this.projectiles.length-1;i>=0;i--){const shot=this.projectiles[i];shot.life-=dt;shot.mesh.position.addScaledVector(shot.velocity,dt);shot.mesh.rotation.x+=dt*7;shot.mesh.rotation.y+=dt*5;
      if(shot.mesh.position.distanceTo(this.player.position.clone().add(new THREE.Vector3(0,.65,0)))<.72){if(this.hurtCooldown<=0){this.health--;this.hurtCooldown=1.4;this.verticalVelocity=4.5;this.callbacks.onDamage();this.pulse(.75,160);this.emitSnapshot();if(this.health<=0)this.die()}shot.life=0}
      if(shot.life<=0){this.scene.remove(shot.mesh);shot.mesh.geometry.dispose();(shot.mesh.material as THREE.Material).dispose();this.projectiles.splice(i,1)}
    }
  }

  private updateCourseObstacles(dt:number){
    const now=performance.now()*.002;
    for(const object of this.scene.children){const hazard=object.userData.hazard as {p:number[];radius:number}|undefined;if(!hazard)continue;object.rotation.y+=dt*.55;const horizontal=Math.hypot(this.player.position.x-hazard.p[0],this.player.position.z-hazard.p[2]);if(horizontal<hazard.radius+.28&&Math.abs(this.player.position.y-hazard.p[1])<1&&this.hurtCooldown<=0){this.health--;this.hurtCooldown=1.35;this.verticalVelocity=5;this.callbacks.onDamage();this.pulse(.8,170);this.emitSnapshot();if(this.health<=0)this.die()}}
    for(const pad of this.jumpPads){pad.cooldown=Math.max(0,pad.cooldown-dt);pad.mesh.children[1].scale.setScalar(1+Math.sin(now*3)*.08);const horizontal=Math.hypot(this.player.position.x-pad.position.x,this.player.position.z-pad.position.z);if(horizontal<.78&&Math.abs(this.player.position.y-pad.position.y)<.75&&pad.cooldown<=0){pad.cooldown=.8;this.verticalVelocity=pad.power;this.grounded=false;this.jumpsRemaining=1;this.callbacks.onToast("Impulso da Aurora!");this.pulse(.45,95)}}
  }

  private attack() {
    this.attackTimer=.42;this.pulse(.22,55);const forward=new THREE.Vector3(Math.sin(this.playerVisual.rotation.y),0,Math.cos(this.playerVisual.rotation.y));
    for(const enemy of this.enemies){if(!enemy.alive)continue;const delta=enemy.position.clone().sub(this.player.position);if(delta.length()<1.8&&delta.normalize().dot(forward)>.05){this.killEnemy(enemy,false);break;}}
  }

  private killEnemy(enemy:Enemy,stomp:boolean) {
    enemy.alive=false;enemy.mesh.visible=false;this.remainingEnemies--;this.pulse(.5,100);this.callbacks.onToast(stomp?"Salto perfeito!":"Guardião dispersado!");this.emitSnapshot();this.checkUnlock();
  }

  private checkUnlock(){if(this.coinsCollected===this.level.coins.length&&this.remainingEnemies===0&&!this.goalUnlocked){this.goalUnlocked=true;this.callbacks.onToast("O Farol da Aurora despertou!");}}

  private updateGoal(dt:number) {
    const orb=this.goal.getObjectByName("orb") as THREE.Mesh;const ring=this.goal.getObjectByName("ring") as THREE.Mesh;ring.rotation.z+=dt*(this.goalUnlocked?1.8:.4);orb.rotation.y+=dt;
    const mat=orb.material as THREE.MeshStandardMaterial;if(this.goalUnlocked){mat.color.setHex(0xffe475);mat.emissive.setHex(0xffb52e);mat.emissiveIntensity=2.6;ring.material=(ring.material as THREE.MeshBasicMaterial);(ring.material as THREE.MeshBasicMaterial).color.setHex(0xffdc68);}
    if(this.goalUnlocked&&this.player.position.distanceTo(new THREE.Vector3(...this.level.goal).add(new THREE.Vector3(0,.5,0)))<2.2){this.paused=true;this.callbacks.onVictory();}
  }

  private updateCamera(dt:number) {
    const target=this.player.position.clone().add(new THREE.Vector3(0,1.25,0));const distance=10.6;const desired=target.clone().add(new THREE.Vector3(Math.sin(this.yaw)*Math.cos(this.pitch)*distance,Math.sin(this.pitch)*distance+1.1,Math.cos(this.yaw)*Math.cos(this.pitch)*distance));
    const alpha=1-Math.pow(.001,dt);this.camera.position.lerp(desired,alpha);this.camera.lookAt(target);
  }

  private updateAmbient(dt:number) {
    if(this.particles)this.particles.rotation.y+=dt*.012;
    if(this.goal){const orb=this.goal.getObjectByName("orb");if(orb)orb.position.y=3.5+Math.sin(performance.now()*.002)*.13;}
  }

  private updateGamepad() {
    if(!this.settings?.gamepadEnabled)return;const pads=navigator.getGamepads?.()??[];let pad=this.gamepadIndex===null?null:pads[this.gamepadIndex];if(!pad?.connected)pad=Array.from(pads).find(Boolean)??null;
    const previous=this.gamepadIndex;this.gamepadIndex=pad?.index??null;const next=new Set<number>();pad?.buttons.forEach((b,i)=>{if(b.pressed||b.value>.55)next.add(i)});for(const i of next)if(!this.gamepadButtons.has(i))this.pressed.add(`pad-${i}`);this.gamepadButtons=next;
    const name=pad?(/dualsense|wireless controller/i.test(pad.id)?"DualSense conectado":`${pad.id.slice(0,24)} conectado`):"";if(name!==this.lastGamepadName||previous!==this.gamepadIndex){this.lastGamepadName=name;this.emitSnapshot();}
  }

  private getPad(){return this.gamepadIndex===null?null:navigator.getGamepads?.()[this.gamepadIndex]??null}
  private consumePad(index:number){const key=`pad-${index}`;if(!this.pressed.has(key))return false;this.pressed.delete(key);return true}
  private deadzone(x:number,y:number){const len=Math.hypot(x,y),dead=this.settings.deadzone;if(len<=dead)return{x:0,y:0};const scaled=Math.min(1,(len-dead)/(1-dead));return{x:x/len*scaled,y:y/len*scaled}}

  private pulse(strength:number,duration:number) {
    if(!this.settings.gamepadEnabled||this.settings.vibration<=0)return;const pad=this.getPad() as (Gamepad&{vibrationActuator?:{playEffect?:(type:string,opts:Record<string,number>)=>Promise<unknown>}})|null;const actuator=pad?.vibrationActuator;if(!actuator?.playEffect)return;const mag=Math.min(1,strength*this.settings.vibration);void actuator.playEffect("dual-rumble",{duration,startDelay:0,strongMagnitude:mag,weakMagnitude:mag*.65}).catch(()=>undefined);
  }

  testVibration(){this.pulse(1,220)}

  reset() {
    if(!this.world)return;this.coinsCollected=0;this.health=3;this.remainingEnemies=this.level.enemies.length;this.verticalVelocity=0;this.grounded=false;this.jumpsRemaining=2;this.goalUnlocked=false;this.attackTimer=0;this.hurtCooldown=0;
    const [sx,sy,sz]=this.level.spawn;this.playerBody.setNextKinematicTranslation({x:sx,y:sy,z:sz});this.playerBody.setTranslation({x:sx,y:sy,z:sz},true);this.player.position.set(sx,sy-.89,sz);
    this.coins.forEach(c=>{c.collected=false;c.mesh.visible=true});this.enemies.forEach(e=>{e.alive=true;e.mesh.visible=true;e.position.copy(e.origin);e.lastShot=0});this.projectiles.forEach(p=>this.scene.remove(p.mesh));this.projectiles=[];
    const orb=this.goal.getObjectByName("orb") as THREE.Mesh;const mat=orb.material as THREE.MeshStandardMaterial;mat.color.setHex(0x7995a3);mat.emissive.setHex(0x253846);mat.emissiveIntensity=.2;
    this.emitSnapshot();
  }

  private die(){if(this.paused)return;this.paused=true;this.callbacks.onDeath()}
  private emitSnapshot(){this.callbacks.onSnapshot({coins:this.coinsCollected,totalCoins:this.level.coins.length,health:this.health,enemies:this.remainingEnemies,totalEnemies:this.level.enemies.length,gamepad:this.lastGamepadName})}
  setPaused(value:boolean){this.paused=value;if(!value)this.clock.getDelta()}

  applySettings(settings:GameSettings) {
    this.settings=settings;if(!this.renderer)return;const ratio=settings.quality==="high"?Math.min(devicePixelRatio,2):settings.quality==="medium"?Math.min(devicePixelRatio,1.5):1;this.renderer.setPixelRatio(ratio);this.renderer.shadowMap.enabled=settings.shadows;this.bloom.enabled=settings.bloom;this.bloom.strength=settings.quality==="high"?.42:.28;this.particles.visible=settings.quality!=="low";this.resize();
  }

  private resize(){if(!this.renderer)return;const w=this.canvas.clientWidth||innerWidth,h=this.canvas.clientHeight||innerHeight;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);this.composer.setSize(w,h)}

  destroy(){this.destroyed=true;cancelAnimationFrame(this.frame);this.listeners.forEach(fn=>fn());this.renderer?.dispose();this.composer?.dispose();if(this.world&&this.character)this.world.removeCharacterController(this.character)}
}
