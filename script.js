let game={
chips:0,
autoUnlocked:false,
autoRunning:false,

interval:900,

autoCost:50,
speedCost:100,
deckCost:250,

combo:0,
multiplier:1,

decks:[
{
type:"Normal",
emoji:"♠",
hands:1,
maxHands:8,
handCost:75
}
],

spinning:false,
autoLoop:null
};

let lastRenderData=[];

const scoreEl=document.querySelector("#score");
const chipLayer=document.querySelector("#chipLayer");

const autoBtn=document.querySelector("#auto");
const buyAutoBtn=document.querySelector("#buyAuto");
const speedBtn=document.querySelector("#speedUpgrade");
const buyDeckBtn=document.querySelector("#buyDeck");
const dealBtn=document.querySelector("#generate");

autoBtn.classList.add("hidden");


function toast(msg){
const t=document.createElement("div");
t.className="toast";
t.textContent=msg;

document.querySelector("#toastContainer").appendChild(t);

requestAnimationFrame(()=>t.classList.add("show"));

setTimeout(()=>{
t.classList.remove("show");
setTimeout(()=>t.remove(),200);
},1400);
}



function spawnChips(amount){

const rect=scoreEl.getBoundingClientRect();

for(let i=0;i<Math.min(amount,35);i++){

const chip=document.createElement("div");
chip.className="chip";

let sx=Math.random()*window.innerWidth;
let sy=window.innerHeight;

chip.style.left=sx+"px";
chip.style.top=sy+"px";

chip.style.setProperty("--x",(rect.left-sx)+"px");
chip.style.setProperty("--y",(rect.top-sy)+"px");

chipLayer.appendChild(chip);

setTimeout(()=>chip.remove(),700);

}
}



function updateScore(){
scoreEl.textContent=`💰 ${game.chips}`;
updateButtons();
}

function updateButtons(){

buyAutoBtn.textContent=
game.autoUnlocked ?
"Auto Unlocked":
`Unlock Auto (${game.autoCost})`;

speedBtn.textContent=
`Speed (${game.speedCost})`;

buyDeckBtn.textContent=
`Buy Deck (${game.deckCost})`;

buyAutoBtn.disabled=
game.autoUnlocked||
game.chips<game.autoCost;

speedBtn.disabled=
game.chips<game.speedCost;

buyDeckBtn.disabled=
game.chips<game.deckCost;

updateDeckButtons();
}


function updateDeckButtons(){

document
.querySelectorAll(".deck-upgrade")
.forEach(btn=>{

let i=parseInt(btn.dataset.index);
let d=game.decks[i];

btn.disabled=
d.hands>=d.maxHands||
game.chips<d.handCost;

btn.textContent=
d.hands>=d.maxHands
? "Max Hands"
: `+ Hand (${d.handCost})`;

});

}


function rollDeck(){

const r=Math.random();

if(r<.33){
return {type:"Lucky",emoji:"🍀",hands:1,maxHands:8,handCost:75};
}

if(r<.66){
return {type:"Crit",emoji:"⚡",hands:1,maxHands:8,handCost:75};
}

return {type:"Wild",emoji:"🔥",hands:1,maxHands:8,handCost:75};

}


function deal(){

const ranks=[
2,3,4,5,6,7,8,9,10,
"J","Q","K","A"
];

const suits=[
"hearts","diamonds","clubs","spades"
];

let deck=[];

for(let s of suits){
for(let r of ranks){
deck.push({rank:r,suit:s});
}
}

for(let i=deck.length-1;i>0;i--){
let j=Math.floor(Math.random()*(i+1));
[deck[i],deck[j]]=[deck[j],deck[i]];
}

return deck.slice(0,5);

}


function rankValue(r){
if(r==="J") return 11;
if(r==="Q") return 12;
if(r==="K") return 13;
if(r==="A") return 14;
return r;
}

function suitIcon(s){
if(s==="hearts") return "♥";
if(s==="diamonds") return "♦";
if(s==="clubs") return "♣";
return "♠";
}


function evaluate(hand){

const values=
hand.map(
c=>rankValue(c.rank)
).sort((a,b)=>a-b);

let counts={};

values.forEach(v=>{
counts[v]=(counts[v]||0)+1;
});

const groups=
Object.values(counts)
.sort((a,b)=>b-a);

const flush=
hand.every(
c=>c.suit===hand[0].suit
);

const unique=
[...new Set(values)];

let straight=
unique.length===5 &&
unique[4]-unique[0]===4;

if(
JSON.stringify(unique)===
JSON.stringify([2,3,4,5,14])
){
straight=true;
}

let name="High Card";

if(straight&&flush) name="Straight Flush";
else if(groups[0]===4) name="Four of a Kind";
else if(groups[0]===3&&groups[1]===2) name="Full House";
else if(flush) name="Flush";
else if(straight) name="Straight";
else if(groups[0]===3) name="Three of a Kind";
else if(groups[0]===2&&groups[1]===2) name="Two Pair";
else if(groups[0]===2) name="One Pair";

const scores={
"High Card":1,
"One Pair":2,
"Two Pair":5,
"Three of a Kind":10,
"Straight":20,
"Flush":30,
"Full House":50,
"Four of a Kind":100,
"Straight Flush":250
};

return{
name,
points:scores[name]
};

}



function applyBonus(deck,points){

if(deck.type==="Lucky"&&Math.random()<.25){
points=Math.floor(points*1.5);
}

if(deck.type==="Crit"&&Math.random()<.15){
points*=2;
toast("⚡ CRIT");
}

if(deck.type==="Wild"&&Math.random()<.08){
points*=3;
toast("🔥 WILD");
}

return points;

}



/* FAST SIMULTANEOUS REEL */
function spinCard(cardEl,rank){

const symbols=[
2,3,4,5,6,7,8,9,10,
"J","Q","K","A"
];

cardEl.classList.add("dealing");

let count=0;

let reel=setInterval(()=>{

cardEl.querySelector(".rank").textContent=
symbols[
Math.floor(
Math.random()*symbols.length
)];

count++;

if(count>=10){

clearInterval(reel);

cardEl.querySelector(".rank").textContent=rank;

cardEl.classList.remove("dealing");
cardEl.classList.add("reveal-pop");

}

},18);

}



function upgradeDeck(i){

let d=game.decks[i];

if(
d.hands>=d.maxHands||
game.chips<d.handCost
)return;

game.chips-=d.handCost;

d.hands++;

d.handCost=
Math.floor(d.handCost*1.7);

updateScore();
render(lastRenderData);

}



function tick(){

if(game.spinning) return;

game.spinning=true;
dealBtn.disabled=true;

let total=0;
let output=[];

game.decks.forEach(deck=>{

let hands=[];

for(let h=0;h<deck.hands;h++){

let hand=deal();

let result=evaluate(hand);

let points=
applyBonus(
deck,
result.points
);

total+=points;

hands.push({
hand,
result:{
name:result.name,
points
}
});

}

output.push({
deck,
hands
});

});

game.chips+=total;

spawnChips(total);

updateScore();

lastRenderData=output;

render(output);

setTimeout(()=>{
game.spinning=false;
dealBtn.disabled=false;
},350);

}



function render(data){

const wrap=
document.querySelector(
"#handsContainer"
);

wrap.innerHTML="";

data.forEach((obj,i)=>{

let deck=
document.createElement("div");

deck.className="deck";

deck.innerHTML=`
<div class='deck-title'>
Deck ${i+1}
</div>

<div class='deck-type'>
${obj.deck.emoji}
${obj.deck.type}
</div>

<div class='hand-count'>
Hands ${obj.deck.hands}/8
</div>
`;

obj.hands.forEach((handObj,h)=>{

let row=document.createElement("div");

row.innerHTML=`
<div class='hand'>
${handObj.hand.map(
(card,c)=>
`
<div
class="card ${card.suit}"
id="card-${i}-${h}-${c}"
data-suit="${suitIcon(card.suit)}"
>
<div class="rank">?</div>
</div>
`
).join("")}
</div>

<div class='result'>
${handObj.result.name}
(+${handObj.result.points})
</div>
`;

deck.appendChild(row);

setTimeout(()=>{

handObj.hand.forEach((card,c)=>{

let el=
document.getElementById(
`card-${i}-${h}-${c}`
);

spinCard(el,card.rank);

});

},20);

});

let up=
document.createElement("button");

up.className=
"btn deck-upgrade";

up.dataset.index=i;

up.onclick=
()=>upgradeDeck(i);

deck.appendChild(up);

wrap.appendChild(deck);

});

updateDeckButtons();

}



dealBtn.onclick=tick;

buyAutoBtn.onclick=()=>{
if(game.chips<game.autoCost)return;

game.chips-=game.autoCost;
game.autoUnlocked=true;

autoBtn.classList.remove("hidden");

updateScore();
};


autoBtn.onclick=()=>{
if(game.autoRunning){
clearInterval(game.autoLoop);
game.autoRunning=false;
autoBtn.textContent="Auto Deal";
}
else{
game.autoLoop=
setInterval(
tick,
game.interval
);
game.autoRunning=true;
autoBtn.textContent="Stop Auto";
}
};


speedBtn.onclick=()=>{
if(game.chips<game.speedCost)return;

game.chips-=game.speedCost;

game.interval=
Math.max(
150,
game.interval*.8
);

updateScore();
};


buyDeckBtn.onclick=()=>{

if(game.chips<game.deckCost)
return;

game.chips-=game.deckCost;

game.decks.push(
rollDeck()
);

game.deckCost=
Math.floor(
game.deckCost*1.8
);

updateScore();

};


updateScore();
render([]);