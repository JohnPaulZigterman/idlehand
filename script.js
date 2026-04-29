let game = {
chips: 9999999,
autoUnlocked: false,
autoRunning: false,
interval: 900,

autoCost: 50,
speedCost: 100,
deckCost: 250,

combo: 0,
multiplier: 1,

blackjackUnlocked: false,
blackjackInRound: false,

decks: [{
type: "Normal",
emoji: "♠",
hands: 1,
maxHands: 8,
handCost: 75
}],

spinning: false,
autoLoop: null
};

let lastRenderData = [];

// ---------------- ELEMENTS ----------------
const scoreEl = document.querySelector("#score");
const chipLayer = document.querySelector("#chipLayer");

const autoBtn = document.querySelector("#auto");
const buyAutoBtn = document.querySelector("#buyAuto");
const speedBtn = document.querySelector("#speedUpgrade");
const buyDeckBtn = document.querySelector("#buyDeck");
const dealBtn = document.querySelector("#generate");

const buyBlackjackBtn = document.querySelector("#buyBlackjack");
const blackjackBtn = document.querySelector("#blackjackBtn");
const betInput = document.querySelector("#betInput");
const blackjackPanel = document.querySelector("#blackjackPanel");

const bjPlayer = document.querySelector("#bjPlayer");
const bjDealer = document.querySelector("#bjDealer");

// 🔒 KEEP BLACKJACK HIDDEN UNTIL UNLOCKED
if (blackjackPanel) {
blackjackPanel.style.display = "none";
}

// ---------------- TOAST ----------------
function toast(msg) {
const t = document.createElement("div");
t.className = "toast";
t.textContent = msg;
document.querySelector("#toastContainer").appendChild(t);
requestAnimationFrame(() => t.classList.add("show"));
setTimeout(() => {
t.classList.remove("show");
setTimeout(() => t.remove(), 200);
}, 1200);
}

// ---------------- SCORE ----------------
function updateScore() {
scoreEl.textContent = `💰 ${game.chips}`;
updateButtons();
}

//BJBestScore
function bjBestScore(hand) {
  return Math.max(...bjScore(hand).split("/").map(Number));
}

// ---------------- BUTTONS ----------------
function updateButtons() {
buyAutoBtn.textContent =
game.autoUnlocked ? "Auto Unlocked" : `Unlock Auto (${game.autoCost})`;

speedBtn.textContent = `Speed (${game.speedCost})`;
buyDeckBtn.textContent = `Buy Deck (${game.deckCost})`;

buyAutoBtn.disabled = game.autoUnlocked || game.chips < game.autoCost;
speedBtn.disabled = game.chips < game.speedCost;
buyDeckBtn.disabled = game.chips < game.deckCost;

if (buyBlackjackBtn) {
  if (game.blackjackUnlocked) {
    buyBlackjackBtn.remove(); // 🔥 fully removes button from DOM
  } else {
    buyBlackjackBtn.disabled = game.chips < 500;
    buyBlackjackBtn.textContent = "Unlock Blackjack (500)";
  }
}
}

// ---------------- CHIP FX ----------------
function spawnChips(amount, mode = "normal") {
const rect = scoreEl.getBoundingClientRect();

let count =
mode === "burst" ? 90 :
mode === "big" ? 60 : 35;

for (let i = 0; i < Math.min(amount, count); i++) {

const chip = document.createElement("div");
chip.className = "chip";

let sx, sy;

if (mode === "burst") {
const angle = Math.random() * Math.PI * 2;
const radius = 160;
sx = window.innerWidth / 2 + Math.cos(angle) * radius;
sy = window.innerHeight / 2 + Math.sin(angle) * radius;
} else if (mode === "big") {
sx = window.innerWidth * (0.3 + Math.random() * 0.4);
sy = window.innerHeight * 0.2;
} else {
sx = Math.random() * window.innerWidth;
sy = window.innerHeight;
}

chip.style.left = sx + "px";
chip.style.top = sy + "px";
chip.style.setProperty("--x", (rect.left - sx) + "px");
chip.style.setProperty("--y", (rect.top - sy) + "px");

chipLayer.appendChild(chip);
setTimeout(() => chip.remove(), 900);
}
}

// ---------------- DEALER / CASINO HELPERS ----------------
function delay(ms) {
return new Promise(res => setTimeout(res, ms));
}

// ---------------- DECK ----------------
function rollDeck() {
const r = Math.random();
if (r < .33) return { type: "Lucky", emoji: "🍀", hands: 1, maxHands: 8, handCost: 75 };
if (r < .66) return { type: "Crit", emoji: "⚡", hands: 1, maxHands: 8, handCost: 75 };
return { type: "Wild", emoji: "🔥", hands: 1, maxHands: 8, handCost: 75 };
}

// ---------------- DEAL ----------------
function deal() {
const ranks = [2,3,4,5,6,7,8,9,10,"J","Q","K","A"];
const suits = ["hearts","diamonds","clubs","spades"];

let deck = [];
for (let s of suits) {
for (let r of ranks) {
deck.push({ rank: r, suit: s });
}
}

for (let i = deck.length - 1; i > 0; i--) {
let j = Math.floor(Math.random() * (i + 1));
[deck[i], deck[j]] = [deck[j], deck[i]];
}

return deck.slice(0, 5);
}

// ---------------- RANK / SUIT ----------------
function rankValue(r) {
if (r === "J") return 11;
if (r === "Q") return 12;
if (r === "K") return 13;
if (r === "A") return 14;
return r;
}

function suitIcon(s) {
return { hearts:"♥", diamonds:"♦", clubs:"♣", spades:"♠" }[s];
}

// ---------------- EVALUATE ----------------
function evaluate(hand) {
const values = hand.map(c => rankValue(c.rank)).sort((a,b)=>a-b);

let counts = {};
values.forEach(v => counts[v] = (counts[v] || 0) + 1);

const groups = Object.values(counts).sort((a,b)=>b-a);
const flush = hand.every(c => c.suit === hand[0].suit);
const unique = [...new Set(values)];

let straight = unique.length === 5 && unique[4] - unique[0] === 4;
if (JSON.stringify(unique) === "[2,3,4,5,14]") straight = true;

let name = "High Card";

if (straight && flush) name = "Straight Flush";
else if (groups[0] === 4) name = "Four of a Kind";
else if (groups[0] === 3 && groups[1] === 2) name = "Full House";
else if (flush) name = "Flush";
else if (straight) name = "Straight";
else if (groups[0] === 3) name = "Three of a Kind";
else if (groups[0] === 2 && groups[1] === 2) name = "Two Pair";
else if (groups[0] === 2) name = "One Pair";

return { name };
}

// ---------------- POKER ----------------
function upgradeDeck(i) {
let d = game.decks[i];
if (d.hands >= d.maxHands || game.chips < d.handCost) return;

game.chips -= d.handCost;
d.hands++;
d.handCost = Math.floor(d.handCost * 1.7);

toast(`Deck ${i+1} +1 Hand`);
updateScore();
render(lastRenderData);
}

function tick() {
if (game.spinning) return;

game.spinning = true;
dealBtn.disabled = true;

let total = 0;
let output = [];

game.decks.forEach(deck => {
let hands = [];

for (let h = 0; h < deck.hands; h++) {
let hand = deal();
let result = evaluate(hand);

let points = Math.floor(Math.random() * 10) + 1;
total += points;

hands.push({ hand, result });
}

output.push({ deck, hands });
});

game.chips += total;

spawnChips(total, total > 250 ? "burst" : total > 120 ? "big" : "normal");

updateScore();
lastRenderData = output;
render(output);

setTimeout(() => {
game.spinning = false;
dealBtn.disabled = false;
}, 300);
}

// ---------------- POKER RENDER ----------------
function render(data = lastRenderData) {

const wrap = document.querySelector("#handsContainer");
wrap.innerHTML = "";

data.forEach((obj, i) => {

let deck = document.createElement("div");
deck.className = "deck";

deck.innerHTML = `
<div>${obj.deck.emoji} ${obj.deck.type}</div>
<div>Hands ${obj.deck.hands}/8</div>
`;

obj.hands.forEach(handObj => {

let row = document.createElement("div");

row.innerHTML = `
<div class="hand">
${handObj.hand.map(card => `
<div class="card ${card.suit}" data-suit="${suitIcon(card.suit)}">
<div class="rank">${card.rank}</div>
</div>
`).join("")}
</div>
<div class="result">${handObj.result.name}</div>
`;

deck.appendChild(row);
});

let up = document.createElement("button");
up.className = "btn deck-upgrade";
up.textContent = "Upgrade Hand";
up.onclick = () => upgradeDeck(i);

deck.appendChild(up);
wrap.appendChild(deck);
});
}

// =====================================================
// 🃏 BLACKJACK (CASINO UPGRADE)
// =====================================================

let bj = {
  hands: [],
  dealer: [],
  active: false,
  wager: 0,
  revealing: false,
  currentHand: 0
};

function drawCard() {
const suits = ["hearts","diamonds","clubs","spades"];
const ranks = [2,3,4,5,6,7,8,9,10,10,10,10,11];

return {
value: ranks[Math.floor(Math.random() * ranks.length)],
suit: suits[Math.floor(Math.random() * suits.length)]
};
}

function bjScore(hand) {
let total = 0;
let aces = 0;

for (let c of hand) {
total += c.value;
if (c.value === 11) aces++;
}

let soft = total;
while (soft > 21 && aces > 0) {
soft -= 10;
aces--;
}

return soft !== total ? `${soft}/${total}` : `${total}`;
}

function checkBust(hand) {
  const score = parseInt(bjScore(hand.cards));

  if (score > 21) {
    hand.busted = true;
    hand.done = true;
    return true;
  }

  return false;
}

// ---------------- BLACKJACK RENDER ----------------
function renderBJ(revealDealer = false) {

if (!bjPlayer || !bjDealer) return;

bjPlayer.innerHTML = `
<div class="bj-label">Player</div>

${bj.hands.map((h, i) => `
  <div class="bj-hand-wrapper ${h.busted ? "busted" : ""} ${i === bj.currentHand ? "active-hand" : ""}">
    
    <div class="bj-hand-value">
      ${bjScore(h.cards)}
    </div>

    <div class="hand">
      ${h.cards.map(c => `
        <div class="card ${c.suit}" data-suit="${suitIcon(c.suit)}">
          <div class="rank">${c.value === 11 ? "A" : c.value}</div>
        </div>
      `).join("")}
    </div>

  </div>
`).join("")}
`;

bjDealer.innerHTML = `
<div class="bj-label">
Dealer (${(bj.active && !revealDealer) ? "?" : bjScore(bj.dealer)})
</div>
<div class="hand">
${bj.dealer.map((c, i) => {
const isHole = i === 0 && bj.active && !revealDealer;

return `
<div class="card ${isHole ? "back" : c.suit}" data-suit="${isHole ? "" : suitIcon(c.suit)}">

<div class="card-inner">
<div class="card-face card-back">${isHole ? "🂠" : ""}</div>
<div class="card-face card-front">
<div class="rank">${isHole ? "" : (c.value === 11 ? "A" : c.value)}</div>
</div>
</div>

</div>
`;
}).join("")}
</div>
`;

setTimeout(() => {
document.querySelectorAll(".card").forEach(c => {
c.classList.remove("deal-in");
void c.offsetWidth;
c.classList.add("deal-in");
});
}, 10);

}
//Round Dead Checker
function isRoundDead() {
  return bj.hands.every(h => h.done || h.busted);
}

// ---------------- START ----------------
function startBJ(wager) {
  if (bj.active || game.chips < wager) return;

  game.chips -= wager;
  bj.active = true;
  bj.wager = wager;
  bj.currentHand = 0;

  bj.hands = [{
    cards: [drawCard(), drawCard()],
    done: false,
    busted: false
  }];

  bj.dealer = [drawCard(), drawCard()];

  renderBJ(false);
  updateBJControls();
  updateScore();
}

// ---------------- HIT ----------------
function bjHit() {
  if (!bj.active) return;

  let hand = bj.hands[bj.currentHand];
  if (!hand || hand.done) return;

  hand.cards.push(drawCard());

  if (checkBust(hand)) {
    toast("💥 Bust!");

    // FORCE AUTO-ADVANCE
    setTimeout(() => {
      let next = bj.hands.findIndex(h => !h.done && !h.busted);

      if (next !== -1) {
        bj.currentHand = next;
      }

      renderBJ(false);
      updateBJControls();
    }, 300);

    if (isRoundDead()) {
  bjStand(); // auto-resolve if everything is done
}

    return;
  }

  renderBJ(false);
}

// ---------------- STAND ----------------
async function bjStand() {
  bj.hands[bj.currentHand].done = true;

  // move to next hand
    let next = bj.hands.findIndex(h => !h.done && !h.busted);

  if (next !== -1) {
    bj.currentHand = next;
    renderBJ(false);
    return;
  }

  // all hands done → dealer plays
  bj.revealing = true;
  renderBJ(true);

  await delay(700);

  while (parseInt(bjScore(bj.dealer)) < 17) {
    bj.dealer.push(drawCard());
    renderBJ(true);
    await delay(650);
  }

  let dealerScore = parseInt(bjScore(bj.dealer));

  let payout = 0;

  for (let h of bj.hands) {
    let playerScore = parseInt(bjScore(h.cards));

    if (h.busted) continue;
    if (playerScore > 21) continue;

    if (dealerScore > 21 || playerScore > dealerScore) {
      payout += bj.wager * 2;
    } else if (playerScore === dealerScore) {
      payout += bj.wager;
    }
  }

  game.chips += payout;
  toast(`🃏 Payout: ${payout}`);

  endBJ();
}

// ---------------- DOUBLE ----------------
function bjDouble() {
if (game.chips < bj.wager) return;

game.chips -= bj.wager;
bj.wager *= 2;

bjHit();
bjStand();
}

//SPLIT
function bjSplit() {
  const hand = bj.hands[bj.currentHand];
  if (!hand || hand.cards.length !== 2) return;

  const [c1, c2] = hand.cards;

  if (c1.value !== c2.value) return;
  if (game.chips < bj.wager) return;

  game.chips -= bj.wager;

  bj.hands.splice(bj.currentHand, 1, 
    { cards: [c1, drawCard()], done: false, busted: false },
    { cards: [c2, drawCard()], done: false, busted: false }
  );

  renderBJ(false);
  updateScore();
  updateBJControls();
}

// ---------------- END ----------------
function endBJ(result) {

if (result === "win") {
game.chips += bj.wager * 2;
toast("🃏 WIN");
}
if (result === "push") {
game.chips += bj.wager;
toast("🤝 PUSH");
}
if (result === "lose") {
toast("💀 LOST");
}

bj.active = false;
bj.revealing = false;

updateScore();
renderBJ(true);
updateBJControls();
}

// ---------------- BUTTONS ----------------
dealBtn.onclick = tick;

buyAutoBtn.onclick = () => {
if (game.chips < game.autoCost) return;
game.chips -= game.autoCost;
game.autoUnlocked = true;
autoBtn.classList.remove("hidden");
updateScore();
};

autoBtn.onclick = () => {
if (game.autoRunning) {
clearInterval(game.autoLoop);
game.autoRunning = false;
autoBtn.textContent = "Auto Deal";
} else {
game.autoLoop = setInterval(tick, game.interval);
game.autoRunning = true;
autoBtn.textContent = "Stop Auto";
}
};

speedBtn.onclick = () => {
if (game.chips < game.speedCost) return;
game.chips -= game.speedCost;
game.interval = Math.max(120, game.interval * 0.8);
updateScore();
};

buyDeckBtn.onclick = () => {
if (game.chips < game.deckCost) return;
game.chips -= game.deckCost;
game.decks.push(rollDeck());
game.deckCost = Math.floor(game.deckCost * 1.8);
updateScore();
};

if (buyBlackjackBtn) {
buyBlackjackBtn.onclick = () => {
if (game.chips < 500) return;
game.chips -= 500;
game.blackjackUnlocked = true;
blackjackPanel.style.display = "block";
toast("Blackjack Unlocked!");
updateScore();
};
}

if (blackjackBtn) {
blackjackBtn.onclick = () => {
startBJ(parseInt(betInput.value || 0));
};
}

function updateBJControls() {
  const hand = bj.hands[bj.currentHand];
  const controls = document.querySelectorAll(".bj-control");

  if (!bj.active) {
    controls.forEach(b => b.style.display = "none");
    return;
  }

  // ❌ If busted → only allow Stand (auto-skip feeling)
  if (hand && hand.busted) {
    controls.forEach(b => {
      if (b.textContent === "Stand") b.style.display = "inline-block";
      else b.style.display = "none";
    });
    return;
  }

  controls.forEach(b => b.style.display = "inline-block");
}

window.bjHit = bjHit;
window.bjStand = bjStand;
window.bjDouble = bjDouble;

// INIT
updateScore();
render();
renderBJ();