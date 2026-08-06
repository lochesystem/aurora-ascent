const LEVEL_NAMES = [
  "Primeira Luz", "Jardins Suspensos", "Curva Celeste", "Passos de Bruma", "Ninho do Vento",
  "Tubos do Poente", "Arcos de Jade", "Salto das Nuvens", "Vigia Carmesim", "Coroa Solar",
  "Vale Invertido", "Trilha do Trovão", "Torres Gêmeas", "Rota Safira", "Cerco do Céu",
  "Espiral Dourada", "Jardim dos Ecos", "Escada Estelar", "Olho da Tempestade", "Bastião Rubro",
  "Último Horizonte", "Marcha da Aurora", "Picos Radiantes", "Portões do Amanhã", "Cume Infinito",
];

const GIMMICKS = [
  "Subida guiada", "Jardins em zigue-zague", "Curvas sobre o vazio", "Primeiras ilhas estreitas", "Arena dos guardiões",
  "Escadaria de canos", "Travessia em arcos", "Plataformas de impulso", "Corredor de atiradores", "Torre em espiral",
  "Descer para voltar a subir", "Impulsos sobre o abismo", "Duas torres intercaladas", "Pontes estreitas", "Cerco em três frentes",
  "Canos em espiral", "Rota ampla de exploração", "Escada de precisão", "Fogo cruzado e impulsos", "Fortaleza vertical",
  "Ilhas mínimas", "Escalada por canos", "Picos e espinhos", "Prova de todas as técnicas", "Ascensão final",
];

const PALETTES = [
  [0x57a875,0x62bc82,0x4e9f78], [0x5aa9a0,0x69c0aa,0x4c958f], [0x6c83b5,0x7597c8,0x526ca0],
  [0xa56c83,0xbc7d91,0x8c5975], [0xb8914f,0xd0aa62,0x9e783e],
];

const COURSE_VOCABULARIES = [
  ["block","beam","island","slab"], ["pipeDeck","block","beam","column"], ["slab","small","block","beam"],
  ["column","beam","ruin","block"], ["arena","block","slab","beam"], ["pipeDeck","column","block","beam"],
  ["beam","scaffold","block","slab"], ["small","jumpDeck","beam","block"], ["bunker","beam","slab","column"],
  ["column","small","beam","ruin"], ["ruin","block","slab","small"], ["jumpDeck","beam","column","block"],
];

function topology(number){
  const family=(number-1)%12;
  const layouts=[
    [[4,1.6,-7,7,6],[-2,3.1,-12,6,6],[-7,4.5,-17,5,5],[-1,5.7,-21,6,5],[5,7,-25,5,5],[0,8.4,-30,7,7]],
    [[0,1.5,-8,9,8],[-6,3,-12,6,6],[6,3.2,-12,6,6],[-8,4.2,-18,5,5],[8,4.5,-18,5,5],[0,5.6,-20,8,7],[0,7.2,-27,7,7]],
    [[0,1.3,-5,6,6],[5,2.1,-7,5,5],[7,2.9,-12,5,5],[5,3.5,-17,5,5],[0,4,-19,5,5],[-5,3.4,-17,5,5],[-7,2.8,-12,5,5],[-5,2.1,-7,5,5],[0,5.6,-12,7,7]],
    [[0,1.5,-8,9,8],[-7,2.8,-8,5,5],[7,3.1,-8,5,5],[0,3.2,-15,6,6],[-7,4.3,-15,5,5],[7,4.6,-15,5,5],[0,5.8,-21,8,7]],
    [[0,1.7,-10,14,11],[-8,3.1,-10,5,5],[8,3.4,-10,5,5],[-5,4.6,-17,5,5],[5,4.9,-17,5,5],[0,6.1,-22,8,7]],
    [[-5,1.2,-7,6,6],[4,1.4,-8,6,6],[-5,2.7,-14,6,6],[4,3,-15,6,6],[0,4.2,-21,8,7],[-6,5.5,-25,5,5],[0,6.8,-29,7,7]],
    [[0,1.2,-9,2.8,8,"beam"],[0,2.5,-15,6,5],[-5,3.5,-19,8,2.6,"beam"],[-9,4.6,-19,5,5],[-9,5.8,-26,2.7,8,"beam"],[-4,7,-31,6,6],[2,8.2,-34,7,7]],
    [[-5,-.7,-7,6,6],[3,-1.5,-11,6,6],[8,-.4,-16,5,5],[3,1.2,-21,6,6],[-3,2.8,-24,5,5],[-8,4.3,-20,5,5],[-4,5.8,-14,6,6],[1,7.2,-10,7,7]],
    [[-4,1.4,-8,5,8],[4,1.6,-8,5,8],[-4,3,-15,5,6],[4,3.2,-15,5,6],[-4,4.7,-21,5,6],[4,5,-21,5,6],[0,6.4,-27,8,7]],
    [[-4,1.4,-6,5,5],[-7,2.8,-11,5,5],[-6,4.1,-17,5,5],[-2,5.4,-21,5,5],[4,6.6,-20,5,5],[7,7.8,-15,5,5],[6,9,-9,5,5],[1,10.2,-6,7,7]],
    [[-5,1.2,-8,5,5],[3,1.8,-10,5,5],[8,2.5,-6,5,5],[9,3.2,-14,5,5],[2,4,-18,5,5],[-5,4.8,-16,5,5],[-9,5.5,-21,5,5],[-3,6.8,-25,7,7]],
    [[-5,1.5,-8,6,6],[5,1.8,-8,6,6],[-5,3.3,-15,6,6],[5,3.6,-15,6,6],[-5,5.1,-22,6,6],[5,5.4,-22,6,6],[0,6.8,-28,8,7]],
  ];
  if(number===25)return [[0,1.2,-7,8,7],[-7,2.5,-11,5,5],[7,2.8,-11,5,5],[-10,4,-18,5,5],[0,3.8,-15,6,6],[10,4.3,-18,5,5],[-7,5.5,-25,5,5],[7,5.8,-25,5,5],[0,7,-30,3,9,"beam"],[0,8.4,-37,8,8],[-6,9.8,-41,5,5],[6,10.1,-41,5,5],[0,11.6,-47,9,9]];
  return layouts[family];
}

export function generateLevel(levelNumber){
  const number=Math.max(1,Math.min(25,Math.round(levelNumber)));const difficulty=(number-1)/24;const region=Math.floor((number-1)/5)+1;
  const palette=PALETTES[region-1];const raw=topology(number);const cycle=Math.floor((number-1)/12);const vocabulary=COURSE_VOCABULARIES[(number-1)%12];
  const startWidth=14-(number%3)*.7,startDepth=12.5-(number%4)*.55;
  const platforms=[{p:[0,0,0],s:[startWidth,2,startDepth],c:palette[0],kind:number%4===0?"ruin":"island"}];
  const verticalScale=3.75+number*.025;let previous={p:[0,0,0],s:[startWidth,2,startDepth]};
  raw.forEach((item,index)=>{
    const [baseX,baseY,baseZ,w,d,requestedKind]=item;const mirror=cycle%2?-1:1;
    const target={p:[baseX*mirror+(cycle?Math.sin(index*1.7)*.65:0),baseY*verticalScale+cycle*index*.08,baseZ-(cycle?Math.cos(index*1.3)*.55:0)],s:[w,1.15+(index%2)*.2,d]};
    const horizontalSpan=Math.hypot(target.p[0]-previous.p[0],target.p[2]-previous.p[2]);const verticalSpan=Math.abs(target.p[1]-previous.p[1]);const segments=Math.max(3,Math.ceil(horizontalSpan/5.5),Math.ceil(verticalSpan/2.45));
    for(let step=1;step<segments;step++){
      const t=step/segments;const kind=vocabulary[(index*2+step)%vocabulary.length];const p=previous.p.map((value,axis)=>value+(target.p[axis]-value)*t);const dx=target.p[0]-previous.p[0],dz=target.p[2]-previous.p[2],span=Math.max(.001,Math.hypot(dx,dz));const lateral=(step%2?1:-1)*Math.sin(Math.PI*t)*(1.45+(number%4)*.18);p[0]+=(-dz/span)*lateral;p[2]+=(dx/span)*lateral;
      const dimensions=kindDimensions(kind,difficulty,index+step);platforms.push({p,s:dimensions,c:palette[(index+step)%3],kind});
    }
    const anchorKind=requestedKind||vocabulary[(index+3)%vocabulary.length];const precision=w<=5&&d<=5;
    platforms.push({p:target.p,s:safeSize([w-difficulty*(precision?.28:.08),target.s[1],d-difficulty*(precision?.28:.08)]),c:palette[(index+1)%3],kind:anchorKind==="island"&&precision?"small":anchorKind});previous=target;
  });

  const coins=buildCoinPlacements(platforms,number);
  const enemyCount=Math.min(10,3+Math.floor((number-1)/3));const enemies=[];
  for(let i=0;i<enemyCount;i++){const platformIndex=1+((i*2+number)%Math.max(1,platforms.length-2));const platform=platforms[platformIndex];const [x,y,z]=platform.p,[,h]=platform.s;enemies.push({p:[x+(i%2?-.45:.45),y+h/2+.48,z],shooter:number>=5&&((i+number)%2===0||[9,15,19,20,24,25].includes(number))})}

  const pipeFocus=[2,6,10,16,22,24,25].includes(number);const pipeCount=pipeFocus?Math.min(6,2+Math.floor(number/6)):number>7?1:0;const pipes=[];
  for(let i=0;i<pipeCount;i++){const platformIndex=1+((i*2+1)%Math.max(1,platforms.length-2));const platform=platforms[platformIndex];const [x,y,z]=platform.p,[w,h,d]=platform.s;pipes.push({p:[x+(i%2?1:-1)*Math.min(1,w*.18),y+h/2+.4,z+(i%2?-1:1)*Math.min(.7,d*.15)],height:1.05+difficulty*.9+(i%2)*.35,radius:.58})}

  const hazardFocus=[4,9,12,15,18,19,20,21,23,24,25].includes(number);const hazards=[];
  if(hazardFocus){const count=Math.min(5,1+Math.floor(number/7));for(let i=0;i<count;i++){const platform=platforms[1+((i*3+2)%Math.max(1,platforms.length-2))];const [x,y,z]=platform.p,[w,h]=platform.s;hazards.push({p:[x+(i%2?1:-1)*Math.min(.8,w*.16),y+h/2+.42,z],radius:.62})}}
  const jumpFocus=[3,8,12,16,19,22,24,25].includes(number);const jumpPads=[];
  if(jumpFocus){const count=number>18?2:1;for(let i=0;i<count;i++){const platform=platforms[1+((i*4+1)%Math.max(1,platforms.length-2))];const [x,y,z]=platform.p,[,h]=platform.s;jumpPads.push({p:[x,y+h/2+.44,z],power:12.8+difficulty*2.2})}}

  const last=platforms.at(-1);const [gx,gy,gz]=last.p,[,gh]=last.s;
  return {number,name:LEVEL_NAMES[number-1],gimmick:GIMMICKS[number-1],region,difficulty:region,platforms,coins,enemies,pipes,hazards,jumpPads,spawn:[0,2.5,0],goal:[gx,gy+gh/2+.42,gz]};
}

function safeSize(size){return size.map(value=>Math.max(1,value))}

function kindDimensions(kind,difficulty,index){
  if(kind==="beam")return [2.25-difficulty*.18,1,6.2+(index%2)*1.2];
  if(kind==="slab"||kind==="pipeDeck"||kind==="jumpDeck")return [6.3-difficulty*.35,.8,2.8+(index%2)*.8];
  if(kind==="column")return [3.2-difficulty*.2,2.2,3.2-difficulty*.2];
  if(kind==="scaffold")return [5.4,.7,3.3];
  if(kind==="bunker")return [5.2,1.8,4.2];
  if(kind==="arena")return [8.2,1.1,7.2];
  if(kind==="ruin")return [4.6,1.5,4.6];
  if(kind==="small")return [3.5-difficulty*.2,1.05,3.5-difficulty*.2];
  return [4.1-difficulty*.25,1.2,4.1-difficulty*.25];
}

function buildCoinPlacements(platforms,number){
  const coins=[];const priority=platforms.map((_,index)=>index).filter(index=>index%2===0||index===platforms.length-1);
  const order=[...priority,...platforms.map((_,index)=>index).filter(index=>!priority.includes(index))];
  for(const platformIndex of order){
    if(coins.length>=Math.max(Math.ceil(platforms.length/2),priority.length))break;
    const candidate=findClearCoinPoint(platforms,platformIndex,number);if(!candidate)continue;
    if(coins.some(coin=>Math.hypot(coin[0]-candidate[0],coin[2]-candidate[2])<1&&Math.abs(coin[1]-candidate[1])<1.4))continue;
    coins.push(candidate);
  }
  return coins;
}

function findClearCoinPoint(platforms,platformIndex,number){
  const platform=platforms[platformIndex];const [x,y,z]=platform.p,[w,h,d]=platform.s;const top=y+.395+h/2;const maxX=Math.max(0,w/2-.62),maxZ=Math.max(0,d/2-.62);
  const offsets=[[0,0],[maxX*.72,0],[-maxX*.72,0],[0,maxZ*.72],[0,-maxZ*.72],[maxX*.62,maxZ*.62],[-maxX*.62,maxZ*.62],[maxX*.62,-maxZ*.62],[-maxX*.62,-maxZ*.62]];
  const shift=(number+platformIndex)%offsets.length;
  for(let offsetIndex=0;offsetIndex<offsets.length;offsetIndex++){
    const [ox,oz]=offsets[(offsetIndex+shift)%offsets.length];const candidate=[x+ox,top+1.02,z+oz];
    const blocked=platforms.some((other,otherIndex)=>{if(otherIndex===platformIndex)return false;const [otherX,otherY,otherZ]=other.p,[otherW,otherH,otherD]=other.s;if(Math.abs(candidate[0]-otherX)>otherW/2+.34||Math.abs(candidate[2]-otherZ)>otherD/2+.34)return false;const bottom=otherY+.395-otherH/2,otherTop=otherY+.395+otherH/2;const intersects=candidate[1]+.38>=bottom&&candidate[1]-.38<=otherTop;const cramped=bottom>top&&bottom-top<2.05;return intersects||cramped});
    if(!blocked)return candidate;
  }
  return null;
}

export function validateCoinPlacements(level){
  const issues=[];level.coins.forEach((coin,coinIndex)=>{const containing=level.platforms.filter(platform=>{const [x,y,z]=platform.p,[w,h,d]=platform.s;const bottom=y+.395-h/2,top=y+.395+h/2;return Math.abs(coin[0]-x)<=w/2+.34&&Math.abs(coin[2]-z)<=d/2+.34&&coin[1]+.38>=bottom&&coin[1]-.38<=top});if(containing.length)issues.push(`moeda ${coinIndex} dentro de bloco`);const support=level.platforms.find(platform=>{const [x,y,z]=platform.p,[w,h,d]=platform.s;const top=y+.395+h/2;return Math.abs(coin[0]-x)<=w/2-.2&&Math.abs(coin[2]-z)<=d/2-.2&&Math.abs(coin[1]-(top+1.02))<.04});if(!support){issues.push(`moeda ${coinIndex} sem apoio`);return}const supportTop=support.p[1]+.395+support.s[1]/2;const cramped=level.platforms.some(platform=>{if(platform===support)return false;const [x,y,z]=platform.p,[w,h,d]=platform.s;const bottom=y+.395-h/2;return Math.abs(coin[0]-x)<=w/2+.34&&Math.abs(coin[2]-z)<=d/2+.34&&bottom>supportTop&&bottom-supportTop<2.05});if(cramped)issues.push(`moeda ${coinIndex} sem altura livre`)});return issues;
}

export function validateLevel(level){
  const issues=[];const visited=new Set([0]);const queue=[0];while(queue.length){const fromIndex=queue.shift();const from=level.platforms[fromIndex];level.platforms.forEach((to,toIndex)=>{if(visited.has(toIndex)||toIndex===fromIndex)return;const horizontal=Math.hypot(to.p[0]-from.p[0],to.p[2]-from.p[2]);const reach=(Math.max(from.s[0],from.s[2])+Math.max(to.s[0],to.s[2]))*.34;const edgeGap=horizontal-reach;const rise=to.p[1]-from.p[1];if(edgeGap<=5.15&&rise<=3.05&&rise>=-5){visited.add(toIndex);queue.push(toIndex)}})}if(visited.size!==level.platforms.length)issues.push(`${level.platforms.length-visited.size} plataformas inacessíveis`);if(level.coins.length<Math.ceil(level.platforms.length/2))issues.push("poucas moedas");if(level.goal.length!==3)issues.push("objetivo ausente");issues.push(...validateCoinPlacements(level));return issues
}

const MAP_X=[170,290,445,590,520,350,185,245,420,585,530,355,180,255,435,590,500,325,170,270,455,590,505,330,180];
export const CAMPAIGN_LEVELS=LEVEL_NAMES.map((name,index)=>{const x=MAP_X[index],y=70+index*112;const previous=index?{x:MAP_X[index-1],y:70+(index-1)*112}:null;return {number:index+1,name,gimmick:GIMMICKS[index],region:Math.floor(index/5)+1,map:{x,y},connector:previous?{x:previous.x,y:previous.y,length:Math.hypot(x-previous.x,y-previous.y),angle:Math.atan2(y-previous.y,x-previous.x)*180/Math.PI}:null}});
