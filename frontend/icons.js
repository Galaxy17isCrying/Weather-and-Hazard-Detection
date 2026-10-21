// Pixel-art icons: 12x12 grids. Legend: Y sun, O orange, W cloud, G shade, B rain, L bolt, S snow, F fog
const GRIDS={
sun:["....Y..Y....","..Y.YYYY.Y..","...YYYYYY...",".YYYYYYYYYY.","YYYYYYYYYYYY",".YYYYYYYYYY.","...YYYYYY...","..Y.YYYY.Y..","....Y..Y...."].map(r=>r.slice(0,12)),
cloud:["............","....WWWW....","..WWWWWWWW..",".WWWWWWWWWW.","WWWWWWWWWWWW","WGGGGGGGGGGW",".WWWWWWWWWW.","............"],
rain:["....WWWW....","..WWWWWWWW..",".WWWWWWWWWW.","WWWWWWWWWWWW",".WWWWWWWWWW.","............","..B..B..B...","...B..B..B..","..B..B..B..."],
storm:["....GGGG....","..GGGGGGGG..",".GGGGGGGGGG.","GGGGGGGGGGGG",".GGGGGGGGGG.","......LL....",".....LL.....","....LLLL....","......LL...."],
snow:["....WWWW....","..WWWWWWWW..",".WWWWWWWWWW.","WWWWWWWWWWWW",".WWWWWWWWWW.","............","..S..S..S...","....S..S....","..S..S..S..."],
fog:["............","..WWWWWWWW..","............",".FFFFFFFFFF.","............","..FFFFFFFF..","............",".FFFFFFFFFF."],
part:["......YY....","....YYYYYY..","...YYYYYYYY.","..WWWYYYYYY.",".WWWWWWYYY..","WWWWWWWWW...","WWWWWWWWWW..",".WWWWWWWW..."]};
const COL={Y:"#ffd23f",O:"#e8590c",W:"#fffaf0",G:"#7a6a5a",B:"#2b7de9",L:"#ffe600",S:"#bfe9ff",F:"#d9c9b0"};
function pixelIcon(name){
  const g=GRIDS[name]||GRIDS.cloud,h=g.length;let r="";
  g.forEach((row,y)=>[...row].forEach((c,x)=>{if(COL[c])r+=`<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${COL[c]}"/>`}));
  return `<svg viewBox="0 0 12 ${h}" shape-rendering="crispEdges" role="img" aria-label="${name}">${r}</svg>`;
}
function codeInfo(c){ // WMO weather codes from Open-Meteo
  if(c===0)return["sun","Clear"];if(c<=2)return["part","Partly cloudy"];if(c===3)return["cloud","Overcast"];
  if(c<=48)return["fog","Fog"];if(c<=57)return["rain","Drizzle"];if(c<=67)return["rain","Rain"];
  if(c<=77)return["snow","Snow"];if(c<=82)return["rain","Showers"];if(c<=86)return["snow","Snow showers"];return["storm","Thunderstorm"];
}
