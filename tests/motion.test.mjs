import assert from "node:assert/strict";
import test from "node:test";
import { landingInstability, movementResponse } from "../app/game/motion.js";

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
