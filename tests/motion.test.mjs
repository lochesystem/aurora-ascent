import assert from "node:assert/strict";
import test from "node:test";
import { landingInstability, movementResponse, stepPlanarVelocity } from "../app/game/motion.js";

test("quedas fortes criam instabilidade proporcional ao impacto e à velocidade",()=>{
  assert.equal(landingInstability(5.9,7),0);
  assert.ok(landingInstability(10,6)>landingInstability(8,3));
  assert.ok(landingInstability(30,20)<=.78);
});

test("o controle no ar e durante o desequilíbrio é menos responsivo",()=>{
  const stable=movementResponse(true,false),unstable=movementResponse(true,true),air=movementResponse(false,false);
  assert.ok(air.acceleration<stable.acceleration);
  assert.ok(unstable.acceleration<stable.acceleration);
  assert.ok(air.drag<stable.drag);
});

test("soltar o direcional conserva velocidade e desacelera pelo atrito",()=>{
  const running={x:7,z:0};
  const afterOneFrame=stepPlanarVelocity(running,{x:0,z:0},1/60,true,false);
  const afterQuarterSecond=stepPlanarVelocity(running,{x:0,z:0},.25,true,false);
  assert.ok(afterOneFrame.x>6.4,"a velocidade não deve desaparecer ao soltar");
  assert.ok(afterQuarterSecond.x>1.8&&afterQuarterSecond.x<3,"a continuidade deve ser curta e controlável");
});

test("reverter a direção exige vencer a inércia atual",()=>{
  let velocity={x:7,z:0};
  velocity=stepPlanarVelocity(velocity,{x:-1,z:0},.1,true,false);
  assert.ok(velocity.x>0,"um toque contrário não deve inverter a velocidade instantaneamente");
  for(let step=0;step<12;step++)velocity=stepPlanarVelocity(velocity,{x:-1,z:0},.1,true,false);
  assert.ok(velocity.x<0,"manter a direção contrária deve completar a reversão");
});

test("no ar o momento é quase totalmente preservado sem comando",()=>{
  const airborne=stepPlanarVelocity({x:5,z:1},{x:0,z:0},.5,false,false);
  assert.ok(airborne.x>4.3);
  assert.ok(airborne.z>.86);
});
