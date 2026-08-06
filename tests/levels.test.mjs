import assert from "node:assert/strict";
import test from "node:test";
import { CAMPAIGN_LEVELS, generateLevel, validateCoinPlacements, validateLevel } from "../app/game/levels.js";

test("a campanha contém 25 fases determinísticas e completáveis",()=>{
  assert.equal(CAMPAIGN_LEVELS.length,25);
  for(let number=1;number<=25;number++){
    const level=generateLevel(number);
    assert.deepEqual(level,generateLevel(number));
    assert.deepEqual(validateLevel(level),[],`fase ${number}: ${validateLevel(level).join(", ")}`);
    assert.equal(level.number,number);
    assert.ok(level.coins.length>=Math.ceil(level.platforms.length/2));
    assert.ok(level.enemies.length>=2);
  }
});

test("dificuldade acrescenta plataformas, canos, inimigos e atiradores",()=>{
  const first=generateLevel(1),middle=generateLevel(13),last=generateLevel(25);
  assert.ok(last.platforms.length>first.platforms.length);
  assert.ok(last.pipes.length>first.pipes.length);
  assert.ok(last.enemies.length>first.enemies.length);
  assert.equal(first.enemies.some(enemy=>enemy.shooter),false);
  assert.equal(middle.enemies.some(enemy=>enemy.shooter),true);
  assert.equal(last.enemies.some(enemy=>enemy.shooter),true);
});

test("cada fase tem identidade mecânica e geometria próprias",()=>{
  const levels=Array.from({length:25},(_,index)=>generateLevel(index+1));
  const geometrySignatures=new Set(levels.map(level=>JSON.stringify(level.platforms.map(platform=>[...platform.p,...platform.s,platform.kind]))));
  assert.equal(geometrySignatures.size,25);
  assert.equal(new Set(levels.map(level=>level.gimmick)).size,25);
  assert.ok(levels.some(level=>level.hazards.length>0));
  assert.ok(levels.some(level=>level.jumpPads.length>0));
  assert.ok(levels.some(level=>level.platforms.some(platform=>platform.kind==="beam")));
});

test("a campanha não se limita a escadas lineares",()=>{
  const ring=generateLevel(3),hub=generateLevel(4),basin=generateLevel(8),finale=generateLevel(25);
  assert.ok(Math.min(...ring.platforms.map(platform=>platform.p[0]))<0);
  assert.ok(Math.max(...ring.platforms.map(platform=>platform.p[0]))>0);
  assert.ok(ring.goal[2]>Math.min(...ring.platforms.map(platform=>platform.p[2])),"o circuito deve retornar ao centro");
  assert.ok(hub.platforms.filter(platform=>Math.abs(platform.p[2]+8)<1).length>=3,"o hub precisa ter ramificações laterais");
  assert.ok(Math.min(...basin.platforms.map(platform=>platform.p[1]))<0,"a fase de bacia precisa descer antes de subir");
  assert.ok(finale.platforms.length>=14,"a fase final deve ser uma prova ampla, não uma escada curta");
});

test("cada fase é longa, vertical e mistura estruturas",()=>{
  for(let number=1;number<=25;number++){
    const level=generateLevel(number);const kinds=new Set(level.platforms.map(platform=>platform.kind));
    assert.ok(level.platforms.length>=19,`fase ${number} curta demais`);
    assert.ok(level.goal[1]>20,`fase ${number} sem verticalidade suficiente`);
    assert.ok(kinds.size>=4,`fase ${number} repete poucas estruturas`);
    assert.ok(level.platforms.filter(platform=>platform.kind==="island"||platform.kind==="small").length<level.platforms.length*.6,`fase ${number} ainda depende demais de ilhas`);
  }
});

test("todas as moedas ficam acima de um bloco e com espaço livre",()=>{
  for(let number=1;number<=25;number++){
    const level=generateLevel(number);
    assert.deepEqual(validateCoinPlacements(level),[],`fase ${number}: ${validateCoinPlacements(level).join(", ")}`);
  }
});
