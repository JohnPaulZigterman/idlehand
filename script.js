let game = {
  chips: 9999999,
  autoUnlocked: false,
  autoRunning: false,
  interval: 1200,

  autoCost: 50,
  speedCost: 100,
  speedLevel: 0,
  maxSpeedLevel: 20,
  deckCost: 250,

  combo: 0,
  multiplier: 1,

  blackjackUnlocked: false,
  blackjackCost: 500,

  plinkoUnlocked: false,
  plinkoCost: 750,
  plinkoAutoUnlocked: false,
  plinkoAutoRunning: false,
  plinkoAutoCost: 1500,

  decks: [{
    type: "Normal",
    emoji: "S",
    hands: 1,
    maxHands: 8,
    handCost: 75,
    hotspins: false,
    hotspinCost: 2500
  }],

  spinning: false,
  autoLoop: null,
  plinkoAutoLoop: null
};

const scoreEl = document.querySelector("#score");
const chipLayer = document.querySelector("#chipLayer");
const handsContainer = document.querySelector("#handsContainer");

const autoBtn = document.querySelector("#auto");
const buyAutoBtn = document.querySelector("#buyAuto");
const speedBtn = document.querySelector("#speedUpgrade");
const buyDeckBtn = document.querySelector("#buyDeck");
const dealBtn = document.querySelector("#generate");

const sideGames = document.querySelector("#sideGames");
const buyBlackjackBtn = document.querySelector("#buyBlackjack");
const blackjackBtn = document.querySelector("#blackjackBtn");
const betInput = document.querySelector("#betInput");
const clearBjBetBtn = document.querySelector("#clearBjBet");
const bjBetDisplay = document.querySelector("#bjBetDisplay");
const bjChipBtns = document.querySelectorAll(".bet-chip");
const blackjackPanel = document.querySelector("#blackjackPanel");
const bjPlayer = document.querySelector("#bjPlayer");
const bjDealer = document.querySelector("#bjDealer");

const buyPlinkoBtn = document.querySelector("#buyPlinko");
const plinkoPanel = document.querySelector("#plinkoPanel");
const plinkoRiskSlider = document.querySelector("#plinkoRiskSlider");
const plinkoRiskLabel = document.querySelector("#plinkoRiskLabel");
const plinkoLayersSlider = document.querySelector("#plinkoLayersSlider");
const plinkoLayersLabel = document.querySelector("#plinkoLayersLabel");
const plinkoBetInput = document.querySelector("#plinkoBetInput");
const clearPlinkoBetBtn = document.querySelector("#clearPlinkoBet");
const plinkoBetDisplay = document.querySelector("#plinkoBetDisplay");
const plinkoBetChipBtns = document.querySelectorAll(".plinko-bet-chip");
const plinkoDropBtn = document.querySelector("#plinkoDropBtn");
const buyPlinkoAutoBtn = document.querySelector("#buyPlinkoAuto");
const plinkoAutoBtn = document.querySelector("#plinkoAutoBtn");
const plinkoBoard = document.querySelector("#plinkoBoard");
const plinkoPegs = document.querySelector("#plinkoPegs");
const plinkoSlots = document.querySelector("#plinkoSlots");
const plinkoResult = document.querySelector("#plinkoResult");
const panelToggleBtns = document.querySelectorAll(".panel-toggle");

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

function updateScore() {
  scoreEl.textContent = `$ ${Math.floor(game.chips)}`;
  updateButtons();
}

function updateSideGames() {
  const hasSideGame = game.blackjackUnlocked || game.plinkoUnlocked;
  sideGames.style.display = hasSideGame ? "contents" : "none";
  blackjackPanel.style.display = game.blackjackUnlocked ? "block" : "none";
  plinkoPanel.style.display = game.plinkoUnlocked ? "block" : "none";
}

function getAutoDealDelay() {
  return Math.round(Math.max(280, 1200 * Math.pow(0.93, game.speedLevel)));
}

function getDealAnimationScale() {
  return Math.max(0.35, Math.pow(0.95, game.speedLevel));
}

function getChipAnimationMs() {
  return Math.round(Math.max(360, 900 * getDealAnimationScale()));
}

function formatSeconds(ms) {
  return `${(ms / 1000).toFixed(ms < 1000 ? 2 : 1)}s`;
}

function togglePanelMinimized(panelId) {
  const panel = document.querySelector(`#${panelId}`);
  if (!panel) return;

  const minimized = panel.classList.toggle("minimized");
  const button = panel.querySelector(".panel-toggle");
  if (button) {
    button.textContent = minimized ? "+" : "_";
    button.setAttribute("aria-label", `${minimized ? "Restore" : "Minimize"} ${panel.querySelector("h2")?.textContent || "panel"}`);
  }
}

function updateButtons() {
  const speedMaxed = game.speedLevel >= game.maxSpeedLevel;
  buyAutoBtn.style.display = game.autoUnlocked ? "none" : "inline-block";
  buyAutoBtn.textContent = `Unlock Auto (${game.autoCost})`;
  speedBtn.textContent = speedMaxed
    ? `Speed Max (${formatSeconds(getAutoDealDelay())})`
    : `Speed Lv ${game.speedLevel}/${game.maxSpeedLevel} (${game.speedCost}) - ${formatSeconds(getAutoDealDelay())}`;
  buyDeckBtn.textContent = `Buy Deck (${game.deckCost})`;

  buyAutoBtn.disabled = game.autoUnlocked || game.chips < game.autoCost;
  speedBtn.disabled = speedMaxed || game.chips < game.speedCost;
  buyDeckBtn.disabled = game.chips < game.deckCost;
  autoBtn.classList.toggle("hidden", !game.autoUnlocked);
  autoBtn.textContent = game.autoRunning ? "Stop Auto" : "Auto Deal";

  buyBlackjackBtn.style.display = game.blackjackUnlocked ? "none" : "inline-block";
  buyBlackjackBtn.disabled = game.chips < game.blackjackCost;
  buyBlackjackBtn.textContent = `Unlock Blackjack (${game.blackjackCost})`;

  buyPlinkoBtn.style.display = game.plinkoUnlocked ? "none" : "inline-block";
  buyPlinkoBtn.disabled = game.chips < game.plinkoCost;
  buyPlinkoBtn.textContent = `Unlock Plinko (${game.plinkoCost})`;

  buyPlinkoAutoBtn.style.display = game.plinkoAutoUnlocked ? "none" : "inline-block";
  buyPlinkoAutoBtn.disabled = !game.plinkoUnlocked || game.chips < game.plinkoAutoCost;
  buyPlinkoAutoBtn.textContent = `Unlock Autoplay (${game.plinkoAutoCost})`;
  plinkoAutoBtn.classList.toggle("hidden", !game.plinkoAutoUnlocked);
  plinkoAutoBtn.textContent = game.plinkoAutoRunning ? "Stop Autoplay" : "Autoplay";
  plinkoDropBtn.disabled = !game.plinkoUnlocked;
  plinkoRiskSlider.disabled = plinko.activeDrops > 0 || !game.plinkoUnlocked;
  plinkoLayersSlider.disabled = plinko.activeDrops > 0 || !game.plinkoUnlocked;
  plinkoBetInput.disabled = !game.plinkoUnlocked;
  clearPlinkoBetBtn.disabled = !game.plinkoUnlocked;
  plinkoBetChipBtns.forEach(button => {
    const value = Number(button.dataset.chipValue);
    button.disabled = !game.plinkoUnlocked || game.chips < value;
  });
  blackjackBtn.disabled = bj.active;
  betInput.disabled = bj.active;
  clearBjBetBtn.disabled = bj.active;
  bjChipBtns.forEach(button => {
    const value = Number(button.dataset.chipValue);
    button.disabled = bj.active || game.chips < value;
  });

  document.querySelectorAll(".deck-upgrade").forEach(button => {
    const deck = game.decks[Number(button.dataset.deckIndex)];
    if (!deck) return;
    const maxed = deck.hands >= deck.maxHands;
    button.disabled = maxed || game.chips < deck.handCost;
    button.textContent = maxed ? "Max Hands" : `+ Hand (${deck.handCost})`;
  });

  document.querySelectorAll(".hotspin-upgrade").forEach(button => {
    const deck = game.decks[Number(button.dataset.deckIndex)];
    if (!deck) return;
    button.disabled = deck.hotspins || game.chips < deck.hotspinCost;
    button.textContent = deck.hotspins ? "Hotspins On" : `Hotspins (${deck.hotspinCost})`;
  });
}

function spend(cost) {
  if (game.chips < cost) return false;
  game.chips -= cost;
  updateScore();
  return true;
}

function spawnChips(amount, mode = "normal", source = null) {
  const targetRect = scoreEl.getBoundingClientRect();
  const count = mode === "burst" ? 90 : mode === "big" ? 60 : 35;
  const sourceRect = source?.getBoundingClientRect?.();
  const targetX = targetRect.left + targetRect.width / 2;
  const targetY = targetRect.top + targetRect.height / 2;
  const chipDuration = getChipAnimationMs();

  for (let i = 0; i < Math.min(amount, count); i++) {
    const chip = document.createElement("div");
    chip.className = "chip";
    let sx;
    let sy;

    if (sourceRect && (sourceRect.width > 0 || sourceRect.height > 0 || sourceRect.left !== 0 || sourceRect.top !== 0)) {
      sx = sourceRect.left + sourceRect.width / 2 + (Math.random() - 0.5) * Math.max(18, sourceRect.width * 0.65);
      sy = sourceRect.top + sourceRect.height / 2 + (Math.random() - 0.5) * Math.max(18, sourceRect.height * 0.65);
    } else if (source && Number.isFinite(source.x) && Number.isFinite(source.y)) {
      sx = source.x + (Math.random() - 0.5) * Math.max(18, (source.width || 42) * 0.65);
      sy = source.y + (Math.random() - 0.5) * Math.max(18, (source.height || 24) * 0.65);
    } else if (mode === "burst") {
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

    chip.style.left = `${sx}px`;
    chip.style.top = `${sy}px`;
    chip.style.setProperty("--x", `${targetX - sx}px`);
    chip.style.setProperty("--y", `${targetY - sy}px`);
    chip.style.setProperty("--chip-duration", `${chipDuration}ms`);
    chipLayer.appendChild(chip);
    setTimeout(() => chip.remove(), chipDuration);
  }

  scoreEl.classList.add("pop");
  setTimeout(() => scoreEl.classList.remove("pop"), 160);
}

function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

function randomCard() {
  const suits = ["hearts", "diamonds", "clubs", "spades"];
  const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  return {
    rank: ranks[Math.floor(Math.random() * ranks.length)],
    suit: suits[Math.floor(Math.random() * suits.length)]
  };
}

function createStandardDeck() {
  const suits = ["hearts", "diamonds", "clubs", "spades"];
  const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const cards = [];

  suits.forEach(suit => {
    ranks.forEach(rank => cards.push({ rank, suit }));
  });

  return cards;
}

function drawFromDeck(deck) {
  if (deck.length === 0) {
    deck.push(...createStandardDeck());
  }

  const index = Math.floor(Math.random() * deck.length);
  return deck.splice(index, 1)[0];
}

function cardValue(card) {
  if (card.rank === "A") return 11;
  if (["J", "Q", "K"].includes(card.rank)) return 10;
  return Number(card.rank);
}

function createCardEl(card, hidden = false) {
  const el = document.createElement("div");
  el.className = hidden ? "card back" : `card ${card.suit}`;
  el.dataset.suit = hidden ? "" : card.suit[0].toUpperCase();

  const rank = document.createElement("div");
  rank.className = "rank";
  rank.textContent = hidden ? "?" : card.rank;
  el.appendChild(rank);
  return el;
}

function setCardFace(el, card) {
  el.className = `card ${card.suit}`;
  el.dataset.suit = card.suit[0].toUpperCase();
  el.querySelector(".rank").textContent = card.rank;
}

function animatePokerCard(el, finalCard, delayMs, speedScale = 1) {
  const spinMs = Math.max(22, 55 * speedScale);
  const settleMs = Math.max(80, 180 * speedScale);
  el.style.setProperty("--slot-roll-duration", `${Math.max(70, 120 * speedScale)}ms`);
  el.style.setProperty("--slot-settle-duration", `${settleMs}ms`);
  el.classList.add("slot-rolling");

  const spin = setInterval(() => {
    setCardFace(el, randomCard());
  }, spinMs);

  setTimeout(() => {
    clearInterval(spin);
    setCardFace(el, finalCard);
    el.classList.remove("slot-rolling");
    el.classList.add("slot-settle");
    setTimeout(() => el.classList.remove("slot-settle"), settleMs);
  }, delayMs);
}

function animatePokerCardReroll(el, finalCard, startMs, durationMs, speedScale = 1) {
  const spinMs = Math.max(22, 55 * speedScale);
  const settleMs = Math.max(80, 180 * speedScale);

  setTimeout(() => {
    el.classList.add("hotspin-rerolling", "slot-rolling");
    el.style.setProperty("--slot-roll-duration", `${Math.max(70, 120 * speedScale)}ms`);
    el.style.setProperty("--slot-settle-duration", `${settleMs}ms`);

    const spin = setInterval(() => {
      setCardFace(el, randomCard());
    }, spinMs);

    setTimeout(() => {
      clearInterval(spin);
      setCardFace(el, finalCard);
      el.classList.remove("slot-rolling", "hotspin-rerolling");
      el.classList.add("slot-settle");
      setTimeout(() => el.classList.remove("slot-settle"), settleMs);
    }, durationMs);
  }, startMs);
}

function pokerHandDetails(cards) {
  const rankValues = {
    "2": 2,
    "3": 3,
    "4": 4,
    "5": 5,
    "6": 6,
    "7": 7,
    "8": 8,
    "9": 9,
    "10": 10,
    J: 11,
    Q: 12,
    K: 13,
    A: 14
  };
  const values = cards.map(card => rankValues[card.rank]);
  const sortedValues = [...values].sort((a, b) => a - b);
  const rankCounts = cards.reduce((acc, card) => {
    acc[card.rank] = (acc[card.rank] || 0) + 1;
    return acc;
  }, {});
  const counts = Object.values(rankCounts).sort((a, b) => b - a);
  const flush = cards.every(card => card.suit === cards[0].suit);
  const uniqueValues = [...new Set(sortedValues)];
  const wheel = uniqueValues.join(",") === "2,3,4,5,14";
  const straight = uniqueValues.length === 5 && (wheel || uniqueValues[4] - uniqueValues[0] === 4);
  const allCards = cards.map((_, index) => index);
  const ranksWithCount = count => Object.keys(rankCounts).filter(rank => rankCounts[rank] === count);
  const indicesForRanks = ranks => cards
    .map((card, index) => ranks.includes(card.rank) ? index : -1)
    .filter(index => index !== -1);

  if (straight && flush && uniqueValues[0] === 10) return { name: "Royal Flush", indices: allCards, premium: true };
  if (straight && flush) return { name: "Straight Flush", indices: allCards, premium: true };
  if (counts[0] === 4) return { name: "Four of a Kind", indices: indicesForRanks(ranksWithCount(4)), premium: true };
  if (counts[0] === 3 && counts[1] === 2) return { name: "Full House", indices: allCards, premium: false };
  if (flush) return { name: "Flush", indices: allCards, premium: false };
  if (straight) return { name: "Straight", indices: allCards, premium: false };
  if (counts[0] === 3) return { name: "Three of a Kind", indices: indicesForRanks(ranksWithCount(3)), premium: false };
  if (counts[0] === 2 && counts[1] === 2) return { name: "Two Pair", indices: indicesForRanks(ranksWithCount(2)), premium: false };
  if (counts[0] === 2) return { name: "Pair", indices: indicesForRanks(ranksWithCount(2)), premium: false };
  return { name: "High Card", indices: [], premium: false };
}

function pokerHandName(cards) {
  return pokerHandDetails(cards).name;
}

function pokerHandPayout(handName) {
  const payouts = {
    "High Card": 0,
    Pair: 2,
    "Two Pair": 5,
    "Three of a Kind": 10,
    Straight: 20,
    Flush: 25,
    "Full House": 40,
    "Four of a Kind": 80,
    "Straight Flush": 150,
    "Royal Flush": 300
  };

  return payouts[handName] || 0;
}

function pokerResultText(handName, payout) {
  return payout ? `${handName} +${payout}` : `${handName} +0`;
}

function clearPokerHighlights(row, cardEls) {
  cardEls.forEach(card => {
    card.classList.remove("win-card", "hotspin-card");
  });
  row.classList.remove("winning-hand", "premium-win");
}

function highlightPokerWin(row, cardEls, details, options = {}) {
  if (details.indices.length === 0) return;

  details.indices.forEach(index => {
    cardEls[index]?.classList.add("win-card");
  });

  row.classList.add("winning-hand");
  if (details.premium && !options.preview) {
    row.classList.add("premium-win");
    setTimeout(() => row.classList.remove("premium-win"), 1200);
  }
}

function applyHotspins(cards, shoe) {
  const details = pokerHandDetails(cards);
  const scoring = new Set(details.indices);
  const rerollIndices = details.indices.length === 0
    ? cards.map((_, index) => index)
    : cards.map((_, index) => index).filter(index => !scoring.has(index));

  rerollIndices.forEach(index => {
    cards[index] = drawFromDeck(shoe);
  });

  return rerollIndices;
}

function upgradeDeckHands(index) {
  const deck = game.decks[index];
  if (!deck || deck.hands >= deck.maxHands || !spend(deck.handCost)) return;

  deck.hands++;
  deck.handCost = Math.ceil(deck.handCost * 1.55);
  toast(`${deck.type} upgraded to ${deck.hands} hands`);
  renderDecks();
}

function upgradeDeckHotspins(index) {
  const deck = game.decks[index];
  if (!deck || deck.hotspins || !spend(deck.hotspinCost)) return;

  deck.hotspins = true;
  toast(`${deck.type} Hotspins unlocked`);
  renderDecks();
}

function renderDecks(animateWins = false) {
  handsContainer.innerHTML = "";
  const winningHands = [];
  const speedScale = animateWins ? getDealAnimationScale() : 1;
  let longestAnimationMs = 0;

  game.decks.forEach((deck, index) => {
    const deckEl = document.createElement("div");
    deckEl.className = "deck";
    deckEl.innerHTML = `
      <div class="deck-header">
        <span>${deck.type} Deck - ${deck.hands}/${deck.maxHands} hands</span>
        <div class="deck-actions">
          <button class="btn deck-upgrade" data-deck-index="${index}">+ Hand (${deck.handCost})</button>
          <button class="btn hotspin-upgrade" data-deck-index="${index}">Hotspins (${deck.hotspinCost})</button>
        </div>
      </div>
    `;
    deckEl.querySelector(".deck-upgrade").onclick = () => upgradeDeckHands(index);
    deckEl.querySelector(".hotspin-upgrade").onclick = () => upgradeDeckHotspins(index);
    const shoe = createStandardDeck();

    for (let i = 0; i < deck.hands; i++) {
      const row = document.createElement("div");
      row.className = "hand";
      const cards = Array.from({ length: 5 }, () => drawFromDeck(shoe));
      const firstRollCards = cards.map(card => ({ ...card }));
      const firstRollDetails = pokerHandDetails(firstRollCards);
      const hotspinIndices = deck.hotspins ? applyHotspins(cards, shoe) : [];
      const cardEls = cards.map((card, cardIndex) => {
        const face = animateWins ? randomCard() : card;
        return createCardEl(hotspinIndices.includes(cardIndex) && !animateWins ? card : face);
      });
      cardEls.forEach(card => row.appendChild(card));

      const handDetails = pokerHandDetails(cards);
      const handName = handDetails.name;
      const payout = Math.ceil(pokerHandPayout(handName) * game.multiplier);
      if (payout) game.chips += payout;

      const result = document.createElement("span");
      result.className = "result";
      result.textContent = animateWins ? "..." : pokerResultText(handName, payout);
      row.appendChild(result);
      deckEl.appendChild(row);
      let handChipDelay = 0;

      if (animateWins) {
        const handDelay = (420 + (i * 55)) * speedScale;
        const firstRollEnd = handDelay + 4 * 95 * speedScale;
        const hotspinStart = firstRollEnd + 180 * speedScale;
        const hotspinDuration = 360 * speedScale;
        const hotspinEnd = hotspinStart + hotspinDuration + Math.max(0, hotspinIndices.length - 1) * 55 * speedScale + 120 * speedScale;
        const revealDelay = hotspinIndices.length > 0 ? hotspinEnd : handDelay + 490 * speedScale;
        handChipDelay = revealDelay + 220 * speedScale;
        longestAnimationMs = Math.max(longestAnimationMs, handChipDelay);
        cardEls.forEach((cardEl, cardIndex) => {
          animatePokerCard(cardEl, firstRollCards[cardIndex], handDelay + cardIndex * 95 * speedScale, speedScale);
        });
        if (hotspinIndices.length > 0) {
          setTimeout(() => {
            highlightPokerWin(row, cardEls, firstRollDetails, { preview: true });
          }, firstRollEnd + 40 * speedScale);
        }
        if (hotspinIndices.length > 0) {
          hotspinIndices.forEach((cardIndex, rerollIndex) => {
            animatePokerCardReroll(
              cardEls[cardIndex],
              cards[cardIndex],
              hotspinStart + rerollIndex * 55 * speedScale,
              hotspinDuration,
              speedScale
            );
          });
        }
        setTimeout(() => {
          clearPokerHighlights(row, cardEls);
          hotspinIndices.forEach(cardIndex => cardEls[cardIndex]?.classList.add("hotspin-card"));
          result.textContent = pokerResultText(handName, payout);
          if (payout) highlightPokerWin(row, cardEls, handDetails);
        }, revealDelay);
      } else if (payout) {
        hotspinIndices.forEach(cardIndex => cardEls[cardIndex]?.classList.add("hotspin-card"));
        highlightPokerWin(row, cardEls, handDetails);
      } else {
        hotspinIndices.forEach(cardIndex => cardEls[cardIndex]?.classList.add("hotspin-card"));
      }

      if (animateWins && payout) {
        winningHands.push({ row, payout, chipDelay: handChipDelay });
      }
    }

    handsContainer.appendChild(deckEl);
  });

  updateScore();

  if (winningHands.length > 0) {
    requestAnimationFrame(() => {
      winningHands.forEach(({ row, payout, chipDelay }, index) => {
        const rect = row.getBoundingClientRect();
        const source = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          width: rect.width,
          height: rect.height
        };
        const mode = payout >= 25 ? "big" : "normal";
        setTimeout(() => spawnChips(payout, mode, source), chipDelay + index * 90 * speedScale);
      });
    });
  }

  return animateWins ? Math.max(1120 * speedScale, longestAnimationMs) + winningHands.length * 90 * speedScale : 0;
}

async function deal() {
  if (game.spinning) return;
  game.spinning = true;
  const animationMs = renderDecks(true);
  await delay(animationMs);
  game.spinning = false;
}

async function runAutoDealLoop() {
  if (!game.autoRunning) return;

  await deal();
  if (!game.autoRunning) return;

  game.autoLoop = setTimeout(runAutoDealLoop, getAutoDealDelay());
}

function toggleAutoDeal() {
  if (!game.autoUnlocked) return;
  game.autoRunning = !game.autoRunning;
  clearTimeout(game.autoLoop);

  if (game.autoRunning) {
    runAutoDealLoop();
  }

  updateButtons();
}

let bj = {
  hands: [],
  dealer: [],
  active: false,
  wager: 0,
  revealing: false,
  currentHand: 0,
  lastBet: 25
};

function getBjBet() {
  return Math.max(1, Math.floor(Number(betInput.value) || bj.lastBet || 25));
}

function setBjBet(value) {
  const wager = Math.max(1, Math.floor(Number(value) || 1));
  betInput.value = wager;
  bjBetDisplay.textContent = wager;
  updateButtons();
}

function addBjChip(value) {
  if (bj.active) return;
  setBjBet((Number(betInput.value) || 0) + value);
}

function drawCard() {
  const card = randomCard();
  return {
    value: cardValue(card),
    rank: card.rank,
    suit: card.suit
  };
}

function bjNumericScore(hand) {
  let total = 0;
  let aces = 0;

  for (const c of hand) {
    total += c.value;
    if (c.value === 11) aces++;
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }

  return total;
}

function bjScore(hand) {
  return `${bjNumericScore(hand)}`;
}

function renderBJ(showDealer = false) {
  bjDealer.innerHTML = "";
  bjPlayer.innerHTML = "";

  if (bj.dealer.length > 0) {
    const dealerValue = document.createElement("div");
    dealerValue.className = "bj-hand-value";
    const visibleDealerCards = showDealer || !bj.active ? bj.dealer : [bj.dealer[0]];
    dealerValue.textContent = showDealer || !bj.active
      ? `Dealer: ${bjScore(bj.dealer)}`
      : `Dealer: ${bjScore(visibleDealerCards)}`;
    bjDealer.appendChild(dealerValue);
  }

  bj.dealer.forEach((card, index) => {
    bjDealer.appendChild(createCardEl(card, index === 1 && bj.active && !showDealer));
  });

  bj.hands.forEach((hand, index) => {
    const wrap = document.createElement("div");
    wrap.className = `bj-hand-wrapper ${index === bj.currentHand && bj.active ? "active-hand" : ""} ${hand.busted ? "busted" : ""}`;

    const value = document.createElement("div");
    value.className = "bj-hand-value";
    value.textContent = `Hand ${index + 1}: ${bjScore(hand.cards)}`;
    wrap.appendChild(value);

    const row = document.createElement("div");
    row.className = "hand";
    hand.cards.forEach(card => row.appendChild(createCardEl(card)));
    wrap.appendChild(row);
    bjPlayer.appendChild(wrap);
  });
}

function renderBJControls() {
  const panel = document.querySelector(".bjControls");
  if (!panel) return;

  if (!bj.active) {
    panel.innerHTML = `
      <button class="btn" onclick="rebetBJ()">Rebet & Deal</button>
      <button class="btn" onclick="rebetDoubleBJ()">Rebet x2 & Deal</button>
    `;
    return;
  }

  panel.innerHTML = `
    <button class="btn bj-control" onclick="bjHit()">Hit</button>
    <button class="btn bj-control" onclick="bjStand()">Stand</button>
    <button class="btn bj-control" onclick="bjDouble()">Double</button>
    <button class="btn bj-control" onclick="bjSplit()">Split</button>
  `;
}

function rebetBJ() {
  startBJ(bj.lastBet);
}

function rebetDoubleBJ() {
  startBJ(bj.lastBet * 2);
}

function startBJ(wager) {
  wager = Math.max(1, Math.floor(Number(wager) || getBjBet()));
  if (bj.active || !spend(wager)) return;

  bj.active = true;
  bj.wager = wager;
  bj.lastBet = wager;
  setBjBet(wager);
  bj.currentHand = 0;
  bj.hands = [{ cards: [drawCard(), drawCard()], done: false, busted: false }];
  bj.dealer = [drawCard(), drawCard()];

  renderBJ(false);
  renderBJControls();
  updateScore();
}

async function advanceBJRound() {
  const next = bj.hands.findIndex(h => !h.done && !h.busted);
  if (next !== -1) {
    bj.currentHand = next;
    renderBJ(false);
    renderBJControls();
    return;
  }

  bj.revealing = true;
  renderBJ(true);
  await delay(500);

  while (bjNumericScore(bj.dealer) < 17) {
    bj.dealer.push(drawCard());
    renderBJ(true);
    await delay(450);
  }

  const dealerScore = bjNumericScore(bj.dealer);
  let payout = 0;

  for (const h of bj.hands) {
    const playerScore = bjNumericScore(h.cards);
    if (h.busted || playerScore > 21) continue;
    if (dealerScore > 21 || playerScore > dealerScore) payout += bj.wager * 2;
    else if (playerScore === dealerScore) payout += bj.wager;
  }

  game.chips += payout;
  if (payout > 0) spawnChips(payout, "big", bjPlayer);
  toast(`Blackjack payout: ${payout}`);
  bj.active = false;
  bj.revealing = false;
  updateScore();
  renderBJControls();
  renderBJ(true);
}

async function bjHit() {
  if (!bj.active) return;
  const hand = bj.hands[bj.currentHand];
  if (!hand || hand.done) return;

  hand.cards.push(drawCard());

  if (bjNumericScore(hand.cards) > 21) {
    hand.busted = true;
    hand.done = true;
    toast("Bust!");
    renderBJ(false);
    renderBJControls();
    await delay(350);
    await advanceBJRound();
    return;
  }

  renderBJ(false);
  renderBJControls();
}

async function bjStand() {
  if (!bj.active) return;
  bj.hands[bj.currentHand].done = true;
  await advanceBJRound();
}

function bjDouble() {
  if (!bj.active || game.chips < bj.wager) return;
  game.chips -= bj.wager;
  bj.wager *= 2;
  bjHit();
  bjStand();
}

function bjSplit() {
  const hand = bj.hands[bj.currentHand];
  if (!bj.active || !hand || hand.cards.length !== 2) return;

  const [c1, c2] = hand.cards;
  if (c1.value !== c2.value || game.chips < bj.wager) return;
  game.chips -= bj.wager;

  bj.hands.splice(
    bj.currentHand,
    1,
    { cards: [c1, drawCard()], done: false, busted: false },
    { cards: [c2, drawCard()], done: false, busted: false }
  );

  renderBJ(false);
  renderBJControls();
  updateScore();
}

let plinko = {
  activeDrops: 0,
  lastBet: 25,
  risk: 2,
  layers: 7,
  multipliers: []
};

const plinkoRiskNames = {
  1: "Low",
  2: "Medium",
  3: "High"
};

function formatMultiplier(value) {
  return Number.isInteger(value) ? `${value}` : `${value.toFixed(value < 1 ? 2 : 1).replace(/0+$/, "").replace(/\.$/, "")}`;
}

function buildPlinkoMultipliers() {
  const slots = plinko.layers + 2;
  const center = (slots - 1) / 2;
  const riskSettings = {
    1: { edge: 2.25, center: 0.45, curve: 1.4 },
    2: { edge: 5, center: 0.15, curve: 1.85 },
    3: { edge: 11, center: 0, curve: 2.35 }
  };
  const settings = riskSettings[plinko.risk];

  plinko.multipliers = Array.from({ length: slots }, (_, index) => {
    const distance = Math.abs(index - center) / center;
    const raw = settings.center + (settings.edge - settings.center) * Math.pow(distance, settings.curve);
    return Math.max(0, Math.round(raw * 4) / 4);
  });
}

function updatePlinkoSettings() {
  plinko.risk = Number(plinkoRiskSlider.value);
  plinko.layers = Number(plinkoLayersSlider.value);
  plinkoRiskLabel.textContent = plinkoRiskNames[plinko.risk];
  plinkoLayersLabel.textContent = plinko.layers;
  buildPlinkoMultipliers();
  renderPlinkoBoard();
}

function getPlinkoBet() {
  return Math.max(1, Math.floor(Number(plinkoBetInput.value) || plinko.lastBet || 25));
}

function setPlinkoBet(value) {
  const wager = Math.max(1, Math.floor(Number(value) || 1));
  plinkoBetInput.value = wager;
  plinkoBetDisplay.textContent = wager;
  updateButtons();
}

function addPlinkoChip(value) {
  setPlinkoBet((Number(plinkoBetInput.value) || 0) + value);
}

function renderPlinkoBoard(activeSlot = null) {
  plinkoPegs.innerHTML = "";
  plinkoSlots.innerHTML = "";
  const slots = plinko.multipliers.length;
  const horizontalStep = 88 / Math.max(1, slots - 1);
  const verticalStep = 68 / Math.max(1, plinko.layers - 1);

  for (let row = 0; row < plinko.layers; row++) {
    const rowTop = 12 + row * verticalStep;
    const leftEdge = 50 - (row / 2 + 1) * horizontalStep;
    const rightEdge = 50 + (row / 2 + 1) * horizontalStep;

    [leftEdge, rightEdge].forEach(edge => {
      const peg = document.createElement("div");
      peg.className = "plinko-peg plinko-peg-rail";
      peg.style.left = `${edge}%`;
      peg.style.top = `${rowTop}%`;
      plinkoPegs.appendChild(peg);
    });

    for (let col = 0; col <= row; col++) {
      const peg = document.createElement("div");
      peg.className = "plinko-peg";
      peg.style.left = `${50 + (col - row / 2) * horizontalStep}%`;
      peg.style.top = `${rowTop}%`;
      plinkoPegs.appendChild(peg);
    }
  }

  plinkoSlots.style.gridTemplateColumns = `repeat(${slots}, minmax(0, 1fr))`;
  plinko.multipliers.forEach((multiplier, index) => {
    const slot = document.createElement("div");
    slot.className = `plinko-slot ${index === activeSlot ? "hit" : ""}`;
    const edgeFactor = Math.abs(index - (slots - 1) / 2) / ((slots - 1) / 2);
    slot.style.background = edgeFactor > 0.75
      ? "#f1d66c"
      : edgeFactor > 0.45
        ? "#d5b14a"
        : "#8e3d38";
    slot.style.color = edgeFactor > 0.45 ? "#10140f" : "#fff";
    slot.style.fontWeight = edgeFactor > 0.75 ? "800" : "600";
    slot.textContent = `${formatMultiplier(multiplier)}x`;
    plinkoSlots.appendChild(slot);
  });
}

function animatePlinkoChipTo(chip, x, y, duration, direction = 0) {
  const fromX = parseFloat(chip.style.left) || x;
  const fromY = parseFloat(chip.style.top) || y;
  const start = performance.now();

  return new Promise(resolve => {
    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      const gravity = t * t;
      const drift = 1 - Math.pow(1 - t, 3);
      const bounce = Math.sin(t * Math.PI) * 2.1;

      chip.style.left = `${fromX + (x - fromX) * drift + direction * bounce}%`;
      chip.style.top = `${fromY + (y - fromY) * gravity - bounce * 0.18}%`;
      chip.style.transform = `translate(-50%, -50%) rotate(${direction * t * 120}deg)`;

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        chip.style.left = `${x}%`;
        chip.style.top = `${y}%`;
        chip.style.transform = "translate(-50%, -50%)";
        resolve();
      }
    }

    requestAnimationFrame(frame);
  });
}

async function dropPlinkoChip() {
  if (!game.plinkoUnlocked) return;

  const wager = getPlinkoBet();
  if (!spend(wager)) return;

  plinko.lastBet = wager;
  setPlinkoBet(wager);
  plinko.activeDrops++;
  updateButtons();
  plinkoResult.textContent = "Dropping...";

  const slots = plinko.multipliers.length;
  const horizontalStep = 88 / Math.max(1, slots - 1);
  const verticalStep = 68 / Math.max(1, plinko.layers - 1);
  const startRow = 1;
  const startX = 50;
  const startY = 12 + verticalStep * 0.52;
  let position = Math.floor((slots - 1) / 2);
  const steps = [];
  for (let row = startRow; row < plinko.layers; row++) {
    const direction = Math.random() < 0.5 ? -1 : 1;
    position += direction;
    position = Math.max(0, Math.min(slots - 1, position));
    steps.push({ row, position, direction });
  }

  const chip = document.createElement("div");
  chip.className = "plinko-chip dropping";
  chip.style.transition = "none";
  chip.style.opacity = "0";
  chip.style.left = `${startX}%`;
  chip.style.top = `${startY}%`;
  plinkoBoard.appendChild(chip);
  chip.getBoundingClientRect();
  chip.style.transition = "";
  chip.style.opacity = "1";
  await delay(120);

  for (const step of steps) {
    await animatePlinkoChipTo(
      chip,
      6 + step.position * horizontalStep,
      18 + step.row * verticalStep,
      170,
      step.direction
    );
  }

  const slotIndex = steps[steps.length - 1]?.position ?? position;
  const multiplier = plinko.multipliers[slotIndex];
  const payout = Math.floor(wager * multiplier);
  game.chips += payout;

  renderPlinkoBoard(slotIndex);
  plinkoResult.textContent = `Landed ${formatMultiplier(multiplier)}x. Payout: ${payout}`;
  if (payout > 0) {
    spawnChips(payout, payout >= wager * 2 ? "big" : "normal", plinkoSlots.children[slotIndex]);
  }
  toast(`Plinko payout: ${payout}`);

  await delay(350);
  chip.style.opacity = "0";
  setTimeout(() => chip.remove(), 150);
  plinko.activeDrops = Math.max(0, plinko.activeDrops - 1);
  updateScore();
}

function togglePlinkoAuto() {
  if (!game.plinkoAutoUnlocked) return;
  game.plinkoAutoRunning = !game.plinkoAutoRunning;
  clearInterval(game.plinkoAutoLoop);

  if (game.plinkoAutoRunning) {
    game.plinkoAutoLoop = setInterval(() => {
      dropPlinkoChip();
    }, 1200);
  }

  updateButtons();
}

buyAutoBtn.onclick = () => {
  if (!spend(game.autoCost)) return;
  game.autoUnlocked = true;
  toast("Auto deal unlocked");
  updateButtons();
};

speedBtn.onclick = () => {
  if (game.speedLevel >= game.maxSpeedLevel) return;
  if (!spend(game.speedCost)) return;
  game.speedLevel++;
  game.interval = getAutoDealDelay();
  game.speedCost = Math.ceil(game.speedCost * 1.22 + 15);
  if (game.autoRunning && !game.spinning) {
    clearTimeout(game.autoLoop);
    runAutoDealLoop();
  }
  toast(`Speed improved: ${formatSeconds(game.interval)} auto delay`);
  updateButtons();
};

buyDeckBtn.onclick = () => {
  if (!spend(game.deckCost)) return;
  const next = game.decks.length + 1;
  game.decks.push({
    type: `Deck ${next}`,
    emoji: "S",
    hands: 1,
    maxHands: 8,
    handCost: 75,
    hotspins: false,
    hotspinCost: 2500 * next
  });
  game.deckCost = Math.ceil(game.deckCost * 1.75);
  renderDecks();
};

buyBlackjackBtn.onclick = () => {
  if (!spend(game.blackjackCost)) return;
  game.blackjackUnlocked = true;
  updateSideGames();
  updateButtons();
  toast("Blackjack unlocked");
};

buyPlinkoBtn.onclick = () => {
  if (!spend(game.plinkoCost)) return;
  game.plinkoUnlocked = true;
  updateSideGames();
  updateButtons();
  toast("Plinko unlocked");
};

buyPlinkoAutoBtn.onclick = () => {
  if (!spend(game.plinkoAutoCost)) return;
  game.plinkoAutoUnlocked = true;
  updateButtons();
  toast("Plinko autoplay unlocked");
};

dealBtn.onclick = deal;
autoBtn.onclick = toggleAutoDeal;
blackjackBtn.onclick = () => startBJ(betInput.value);
clearBjBetBtn.onclick = () => setBjBet(1);
betInput.oninput = () => {
  bjBetDisplay.textContent = getBjBet();
  updateButtons();
};
bjChipBtns.forEach(button => {
  button.onclick = () => addBjChip(Number(button.dataset.chipValue));
});
plinkoDropBtn.onclick = dropPlinkoChip;
plinkoRiskSlider.oninput = updatePlinkoSettings;
plinkoLayersSlider.oninput = updatePlinkoSettings;
clearPlinkoBetBtn.onclick = () => setPlinkoBet(1);
plinkoBetInput.oninput = () => {
  plinkoBetDisplay.textContent = getPlinkoBet();
  updateButtons();
};
plinkoBetChipBtns.forEach(button => {
  button.onclick = () => addPlinkoChip(Number(button.dataset.chipValue));
});
plinkoAutoBtn.onclick = togglePlinkoAuto;
panelToggleBtns.forEach(button => {
  button.onclick = () => togglePanelMinimized(button.dataset.target);
});

renderDecks();
renderBJControls();
buildPlinkoMultipliers();
renderPlinkoBoard();
updateSideGames();
setBjBet(bj.lastBet);
setPlinkoBet(plinko.lastBet);
updateScore();
