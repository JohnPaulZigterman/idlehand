"use strict";

const APP_CONFIG = {
  appVersion: 4,
  storageKey: "idlehand:state:v4",
  forceFreshOnLoad: true,
  saveDebounceMs: 700,
  timing: {
    baseAutoDelayMs: 1200,
    minAutoDelayMs: 280,
    autoDelayScale: 0.93,
    toastMs: 1200,
    offlineCatchupMaxCycles: 2500,
    offlineSimulationSampleCycles: 320,
    saveIntervalMs: 1200
  },
  animation: {
    chipCount: {
      burst: 90,
      big: 60,
      normal: 35,
      deckBurst: 14,
      deckBig: 24,
      deckNormal: 16
    },
    chipBaseDurationMs: 900,
    chipFloorMs: 360,
    cardSpinMs: 55,
    cardSettleMs: 180,
    dealScaleMin: 0.35,
    dealScaleDrop: 0.95
  },
  upgrade: {
    autoCost: 50,
    speedCost: 100,
    speedCostGrowth: 1.22,
    speedCostFlat: 15,
    maxSpeedLevel: 20,
    deckStartCost: 250,
    deckCostGrowth: 1.75,
    blackjackCost: 500,
    plinkoCost: 750,
    plinkoAutoCost: 1500,
    deckHandCost: 75,
    deckHandCostGrowth: 1.55,
    hotspinCostBase: 2500,
    hotspinCostGrowth: 2.2,
    deckVerticalHandsCost: 10000,
    deckAceCostBase: 900,
    deckAceCostGrowth: 1.45,
    deckRemoveLowestBaseCost: 650,
    deckRemoveLowestCostGrowth: 1.32
  },
  blackjack: {
    initialChips: 0,
    defaultBet: 25
  },
  decks: {
    maxHands: 8,
    handSize: 5
  },
  plinko: {
    riskSettings: {
      1: { edge: 2.25, center: 0.45, curve: 1.4 },
      2: { edge: 5, center: 0.15, curve: 1.85 },
      3: { edge: 11, center: 0, curve: 2.35 }
    },
    minLayers: 5,
    maxLayers: 12,
    defaultLayers: 7,
    riskLabel: {
      1: "Low",
      2: "Medium",
      3: "High"
    },
    initialBet: 25
  },
  payouts: {
    poker: {
      "High Card": 0,
      "Pair": 2,
      "Two Pair": 5,
      "Three of a Kind": 10,
      "Straight": 20,
      "Flush": 25,
      "Full House": 40,
      "Four of a Kind": 80,
      "Five of a Kind": 150,
      "Flush Five": 450,
      "Straight Flush": 150,
      "Royal Flush": 300
    }
  },
  telemetry: {
    defaults: {
      sessions: 1,
      totalClicks: 0,
      totalPokerCycles: 0,
      totalPokerHands: 0,
      totalPokerPayout: 0,
      totalBlackjackWager: 0,
      totalBlackjackPayout: 0,
      totalBlackjackHands: 0,
      totalPlinkoDrops: 0,
      totalPlinkoPayout: 0,
      totalOfflineCycles: 0,
      totalOfflineEarnings: 0,
      maxChipEver: 0,
      chipsSpent: 0,
      chipsEarned: 0,
      lastUpdatedMs: 0
    }
  },
  pokerHandRanks: {
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
  }
};

function createEventBus() {
  const listeners = new Map();
  return {
    on(eventName, handler) {
      if (!listeners.has(eventName)) listeners.set(eventName, new Set());
      listeners.get(eventName).add(handler);
      return handler;
    },
    off(eventName, handler) {
      const bucket = listeners.get(eventName);
      if (!bucket) return;
      bucket.delete(handler);
    },
    emit(eventName, payload = null) {
      const bucket = listeners.get(eventName);
      if (!bucket) return;
      for (const handler of [...bucket]) {
        try {
          handler(payload);
        } catch (error) {
          console.error("[event-bus]", eventName, error);
        }
      }
    }
  };
}

function createTimerManager() {
  const timeouts = new Set();
  const intervals = new Set();

  return {
    setTimeout(callback, delayMs) {
      const id = window.setTimeout(() => {
        timeouts.delete(id);
        callback();
      }, delayMs);
      timeouts.add(id);
      return id;
    },
    setInterval(callback, intervalMs) {
      const id = window.setInterval(callback, intervalMs);
      intervals.add(id);
      return id;
    },
    clearTimeout(id) {
      window.clearTimeout(id);
      timeouts.delete(id);
    },
    clearInterval(id) {
      window.clearInterval(id);
      intervals.delete(id);
    },
    clearAll() {
      for (const id of timeouts) window.clearTimeout(id);
      for (const id of intervals) window.clearInterval(id);
      timeouts.clear();
      intervals.clear();
    }
  };
}

const SOUND = {
  context: null,
  master: null,
  userPrimed: false
};

function primeAudio() {
  if (SOUND.context || SOUND.master) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;

  const context = new AudioCtx();
  const master = context.createGain();
  master.gain.value = 0.32;
  master.connect(context.destination);

  SOUND.context = context;
  SOUND.master = master;
}

function ensureAudioReady() {
  if (SOUND.userPrimed) return;
  primeAudio();
  SOUND.userPrimed = true;
}

function withAudio(callback) {
  if (!SOUND.context || !SOUND.master) return;
  if (SOUND.context.state === "suspended") {
    SOUND.context.resume().then(callback).catch(() => {});
    return;
  }
  callback();
}

function playTone({
  startFrequency = 620,
  endFrequency = startFrequency,
  durationMs = 48,
  type = "triangle",
  gain = 0.026
} = {}) {
  if (!SOUND.context || !SOUND.master) return;
  withAudio(() => {
    const context = SOUND.context;
    const now = context.currentTime;
    const dur = Math.max(0.02, durationMs / 1000);
    const gainNode = context.createGain();
    const osc = context.createOscillator();

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(gain, now + 0.004);
    gainNode.gain.exponentialRampToValueAtTime(0.0002, now + dur);

    osc.type = type;
    osc.frequency.setValueAtTime(startFrequency, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFrequency), now + dur * 0.9);

    osc.connect(gainNode);
    gainNode.connect(SOUND.master);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  });
}

function playDealClick() {
  playTone({ startFrequency: 560, endFrequency: 260, durationMs: 42, type: "triangle", gain: 0.18 });
  playTone({ startFrequency: 210, endFrequency: 340, durationMs: 30, type: "square", gain: 0.11 });
}

function playUpgradeClick() {
  playTone({ startFrequency: 760, endFrequency: 430, durationMs: 38, type: "triangle", gain: 0.15 });
  playTone({ startFrequency: 290, endFrequency: 520, durationMs: 24, type: "square", gain: 0.09 });
}

function playCardOut() {
  playTone({ startFrequency: 980, endFrequency: 540, durationMs: 32, type: "triangle", gain: 0.14 });
}

function playChipDrop() {
  playTone({ startFrequency: 620, endFrequency: 860, durationMs: 46, type: "square", gain: 0.10 });
}

function createRng(seed) {
  let value = seed >>> 0 || 1;
  return {
    next() {
      value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
      return value / 0x100000000;
    },
    nextInt(maxExclusive) {
      return Math.floor(this.next() * maxExclusive);
    }
  };
}

function drawFromDeckRng(deck, rng) {
  if (deck.length === 0) deck.push(...createStandardDeck());
  const index = rng.nextInt(deck.length);
  return deck.splice(index, 1)[0];
}

function createDeckTemplate(index = 1) {
  return {
    type: `Deck ${index}`,
    emoji: "S",
    hands: 1,
    maxHands: APP_CONFIG.decks.maxHands,
    handCost: APP_CONFIG.upgrade.deckHandCost,
    hotspins: 0,
    hotspinCost: APP_CONFIG.upgrade.hotspinCostBase,
    verticalHands: false,
    verticalHandsCost: APP_CONFIG.upgrade.deckVerticalHandsCost,
    aceAddCost: APP_CONFIG.upgrade.deckAceCostBase,
    addedAces: 0,
    removeLowestCost: APP_CONFIG.upgrade.deckRemoveLowestBaseCost,
    removedLowestCards: 0
  };
}

function createBaseState() {
  return {
    version: APP_CONFIG.appVersion,
    game: {
      chips: APP_CONFIG.blackjack.initialChips,
      autoUnlocked: false,
      autoRunning: false,
      interval: APP_CONFIG.timing.baseAutoDelayMs,
      autoCost: APP_CONFIG.upgrade.autoCost,
      speedCost: APP_CONFIG.upgrade.speedCost,
      speedLevel: 0,
      maxSpeedLevel: APP_CONFIG.upgrade.maxSpeedLevel,
      deckCost: APP_CONFIG.upgrade.deckStartCost,
      combo: 0,
      multiplier: 1,
      blackjackUnlocked: false,
      blackjackCost: APP_CONFIG.upgrade.blackjackCost,
      plinkoUnlocked: false,
      plinkoCost: APP_CONFIG.upgrade.plinkoCost,
      plinkoAutoUnlocked: false,
      plinkoAutoRunning: false,
      plinkoAutoCost: APP_CONFIG.upgrade.plinkoAutoCost,
      decks: [createDeckTemplate(1)],
      spinning: false,
      autoLoop: null,
      plinkoAutoLoop: null
    },
    blackjack: {
      hands: [],
      dealer: [],
      active: false,
      wager: 0,
      revealing: false,
      currentHand: 0,
      lastBet: APP_CONFIG.blackjack.defaultBet
    },
    plinko: {
      activeDrops: 0,
      lastBet: APP_CONFIG.plinko.initialBet,
      risk: 2,
      layers: APP_CONFIG.plinko.defaultLayers,
      multipliers: []
    },
    telemetry: {
      ...APP_CONFIG.telemetry.defaults
    },
    runtime: {
      lastSavedMs: Date.now(),
      offlineSeed: 0,
      lastAutosaveSource: "boot"
    }
  };
}

function sanitizeDeck(deck, index) {
  const template = createDeckTemplate(index + 1);
  if (!deck || typeof deck !== "object") return template;
  const hotspinLegacy = deck.hotspins === true ? 1 : Number(deck.hotspins);
  const hotspinCount = Number.isFinite(hotspinLegacy) ? Math.max(0, Math.floor(hotspinLegacy)) : 0;
  const out = {
    type: typeof deck.type === "string" && deck.type.trim() ? deck.type : template.type,
    emoji: typeof deck.emoji === "string" ? deck.emoji : template.emoji,
    hands: Math.max(1, Number(deck.hands) || 1),
    maxHands: APP_CONFIG.decks.maxHands,
    handCost: Math.max(1, Number(deck.handCost) || template.handCost),
    hotspins: Math.max(0, hotspinCount || 0),
    hotspinCost: Math.max(1, Number(deck.hotspinCost) || template.hotspinCost),
    verticalHands: deck.verticalHands === true,
    verticalHandsCost: Math.max(1, Number(deck.verticalHandsCost) || template.verticalHandsCost),
    aceAddCost: Math.max(1, Number(deck.aceAddCost) || template.aceAddCost),
    addedAces: Math.max(0, Math.floor(Number(deck.addedAces) || 0)),
    removeLowestCost: Math.max(1, Number(deck.removeLowestCost) || template.removeLowestCost),
    removedLowestCards: Math.max(0, Math.floor(Number(deck.removedLowestCards) || 0))
  };
  out.hands = Math.min(out.hands, out.maxHands);
  return out;
}

function sanitizeState(raw) {
  const base = createBaseState();
  if (!raw || typeof raw !== "object") return base;

  const sanitized = {
    ...base,
    ...raw
  };

  sanitized.game = { ...base.game, ...(raw.game || {}) };
  sanitized.game.decks = Array.isArray(raw?.game?.decks) ? raw.game.decks.map((deck, index) => sanitizeDeck(deck, index)) : base.game.decks;
  sanitized.blackjack = { ...base.blackjack, ...(raw.blackjack || {}) };
  sanitized.plinko = { ...base.plinko, ...(raw.plinko || {}) };
  sanitized.telemetry = { ...base.telemetry, ...(raw.telemetry || {}) };
  sanitized.runtime = { ...base.runtime, ...(raw.runtime || {}) };
  sanitized.version = APP_CONFIG.appVersion;
  sanitized.game.maxSpeedLevel = APP_CONFIG.upgrade.maxSpeedLevel;
  return sanitized;
}

function loadState() {
  if (APP_CONFIG.forceFreshOnLoad) {
    try {
      localStorage.removeItem(APP_CONFIG.storageKey);
    } catch (error) {
      console.warn("Could not clear persisted state", error);
    }
    return createBaseState();
  }

  try {
    const rawPayload = localStorage.getItem(APP_CONFIG.storageKey);
    if (!rawPayload) return createBaseState();
    const parsed = JSON.parse(rawPayload);
    return sanitizeState(parsed);
  } catch (error) {
    console.warn("State load failed, using fresh state", error);
    return createBaseState();
  }
}

const gameState = loadState();
const game = gameState.game;
const bj = gameState.blackjack;
const plinko = gameState.plinko;

const bus = createEventBus();
const timerManager = createTimerManager();
let saveTimer = null;
const miniGameModules = new Map();

function registerMiniGame(module) {
  if (!module || !module.id) return;
  miniGameModules.set(module.id, module);
}

function emitMiniGameEvent(name, payload = {}) {
  for (const module of miniGameModules.values()) {
    module?.onEvent?.(name, payload);
  }
}

function recordTelemetry(key, amount = 1) {
  if (typeof gameState.telemetry[key] !== "number") {
    gameState.telemetry[key] = 0;
  }
  gameState.telemetry[key] += amount;
  gameState.telemetry.lastUpdatedMs = Date.now();
}

function markDirty(reason = "state") {
  gameState.telemetry.maxChipEver = Math.max(gameState.telemetry.maxChipEver, game.chips);
  gameState.runtime.lastAutosaveSource = reason;
  gameState.runtime.lastSavedMs = Date.now();
  if (saveTimer) return;
  saveTimer = timerManager.setTimeout(() => {
    saveTimer = null;
    try {
      localStorage.setItem(APP_CONFIG.storageKey, JSON.stringify(gameState));
    } catch (error) {
      console.error("State save failed", error);
    }
  }, APP_CONFIG.saveDebounceMs);
}

function notifyStateChanged(reason = "state") {
  bus.emit("state:changed", { reason });
  markDirty(reason);
}

function saveState(reason = "explicit") {
  markDirty(reason);
}

function saveStateNow(reason = "explicit") {
  gameState.runtime.lastAutosaveSource = reason;
  gameState.runtime.lastSavedMs = Date.now();
  gameState.telemetry.lastUpdatedMs = gameState.runtime.lastSavedMs;
  try {
    localStorage.setItem(APP_CONFIG.storageKey, JSON.stringify(gameState));
  } catch (error) {
    console.error("State save failed", error);
  }
}

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
const bjControls = document.querySelector(".bjControls");

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

function installAudioPrimers() {
  ["pointerdown", "keydown", "touchstart"].forEach(eventName => {
    document.addEventListener(eventName, () => {
      ensureAudioReady();
    }, { once: true });
  });
}

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.querySelector("#toastContainer").appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.remove(), 200);
  }, APP_CONFIG.timing.toastMs);
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
  return Math.round(Math.max(APP_CONFIG.timing.minAutoDelayMs, APP_CONFIG.timing.baseAutoDelayMs * Math.pow(APP_CONFIG.timing.autoDelayScale, game.speedLevel)));
}

function getDealAnimationScale() {
  return Math.max(APP_CONFIG.animation.dealScaleMin, Math.pow(APP_CONFIG.animation.dealScaleDrop, game.speedLevel));
}

function getChipAnimationMs() {
  return Math.round(Math.max(APP_CONFIG.animation.chipFloorMs, APP_CONFIG.animation.chipBaseDurationMs * getDealAnimationScale()));
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
    const heading = panel.querySelector("h2")?.textContent || "panel";
    button.setAttribute("aria-label", `${minimized ? "Restore" : "Minimize"} ${heading}`);
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
    button.disabled = game.chips < deck.hotspinCost;
    button.textContent = deck.hotspins > 0 ? `Hotspins x${deck.hotspins} (${deck.hotspinCost})` : `Unlock Hotspins (${deck.hotspinCost})`;
  });

  document.querySelectorAll(".vertical-hands-upgrade").forEach(button => {
    const deck = game.decks[Number(button.dataset.deckIndex)];
    if (!deck) return;
    if (deck.verticalHands) {
      button.disabled = true;
      button.textContent = "Vertical Hands (Active)";
      return;
    }
    if (deck.hands < 5) {
      button.disabled = true;
      button.textContent = "Need 5 Hands";
      return;
    }
    button.disabled = game.chips < deck.verticalHandsCost;
    button.textContent = `Vertical Hands (${deck.verticalHandsCost})`;
  });

  document.querySelectorAll(".ace-upgrade").forEach(button => {
    const deck = game.decks[Number(button.dataset.deckIndex)];
    if (!deck) return;
    button.disabled = game.chips < deck.aceAddCost;
    button.textContent = `+ Ace (${deck.aceAddCost})`;
  });

  document.querySelectorAll(".trim-lowest-upgrade").forEach(button => {
    const deck = game.decks[Number(button.dataset.deckIndex)];
    if (!deck) return;
    const canTrim = canRemoveLowestCard(deck);
    button.disabled = game.chips < deck.removeLowestCost || !canTrim;
    button.textContent = canTrim ? `Remove Low Card (${deck.removeLowestCost})` : "No Low Card Left";
  });
}

function spend(cost) {
  if (game.chips < cost) return false;
  game.chips -= cost;
  recordTelemetry("chipsSpent", cost);
  notifyStateChanged("spend");
  return true;
}

function spawnChips(amount, mode = "normal", source = null) {
  if (!Number.isFinite(amount) || amount <= 0) return;
  const targetRect = scoreEl.getBoundingClientRect();
  const count = mode === "burst" ? APP_CONFIG.animation.chipCount.burst : mode === "big" ? APP_CONFIG.animation.chipCount.big : APP_CONFIG.animation.chipCount.normal;
  const sourceRect = source?.getBoundingClientRect?.();
  const isDeckSource = source?.dataset?.isDeckSource || source?.classList?.contains("deck") || source?.id === "pokerPanel";
  const chipCount = isDeckSource
    ? Math.min(count, mode === "burst" ? APP_CONFIG.animation.chipCount.deckBurst : mode === "big" ? APP_CONFIG.animation.chipCount.deckBig : APP_CONFIG.animation.chipCount.deckNormal)
    : count;
  const targetX = targetRect.left + targetRect.width / 2;
  const targetY = targetRect.top + targetRect.height / 2;
  const chipDuration = getChipAnimationMs();
  const shouldSound = amount > 0 && SOUND.context;

  for (let i = 0; i < Math.min(amount, chipCount); i++) {
    const chip = document.createElement("div");
    chip.className = "chip";
    let sx;
    let sy;

    if (sourceRect && (sourceRect.width > 0 || sourceRect.height > 0 || sourceRect.left !== 0 || sourceRect.top !== 0)) {
      const spreadX = Math.max(14, (sourceRect.width || 120) * (isDeckSource ? 0.85 : 0.65));
      const spreadY = Math.max(14, (sourceRect.height || 80) * (isDeckSource ? 0.55 : 0.65));
      sx = sourceRect.left + sourceRect.width / 2 + (Math.random() - 0.5) * spreadX;
      sy = sourceRect.top + sourceRect.height / 2 + (Math.random() - 0.5) * spreadY;
      sx = Math.min(Math.max(sx, sourceRect.left), sourceRect.left + sourceRect.width);
      sy = Math.min(Math.max(sy, sourceRect.top), sourceRect.top + sourceRect.height);
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

  if (shouldSound) {
    timerManager.setTimeout(() => playChipDrop(), 40);
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

const DECK_RANK_ORDER = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const DECK_SUITS = ["hearts", "diamonds", "clubs", "spades"];

function buildDeckForHand(deck) {
  const cards = createStandardDeck();
  const addedAces = Math.max(0, Math.floor(Number(deck?.addedAces) || 0));
  for (let i = 0; i < addedAces; i++) {
    cards.push({
      rank: "A",
      suit: DECK_SUITS[i % DECK_SUITS.length]
    });
  }

  const removedCount = Math.max(0, Math.floor(Number(deck?.removedLowestCards) || 0));
  for (let removed = 0; removed < removedCount; removed++) {
    let removedIndex = -1;
    for (const rank of DECK_RANK_ORDER) {
      const candidateIndex = cards.findIndex(card => card.rank === rank);
      if (candidateIndex >= 0) {
        removedIndex = candidateIndex;
        break;
      }
    }
    if (removedIndex < 0) break;
    cards.splice(removedIndex, 1);
  }

  return cards;
}

function canRemoveLowestCard(deck) {
  const next = {
    ...deck,
    removedLowestCards: Math.floor(Number(deck.removedLowestCards || 0)) + 1
  };
  const cards = buildDeckForHand(next);
  const required = Math.max(APP_CONFIG.decks.handSize, (Number(deck.hands) || 1) * APP_CONFIG.decks.handSize);
  return cards.length >= required;
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
  const spinMs = Math.max(22, APP_CONFIG.animation.cardSpinMs * speedScale);
  const settleMs = Math.max(80, APP_CONFIG.animation.cardSettleMs * speedScale);
  el.style.setProperty("--slot-roll-duration", `${Math.max(70, 120 * speedScale)}ms`);
  el.style.setProperty("--slot-settle-duration", `${settleMs}ms`);
  el.classList.add("slot-rolling");
  timerManager.setTimeout(() => playCardOut(), Math.max(0, delayMs - 6));

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
  const spinMs = Math.max(22, APP_CONFIG.animation.cardSpinMs * speedScale);
  const settleMs = Math.max(80, APP_CONFIG.animation.cardSettleMs * speedScale);
  setTimeout(() => {
    playCardOut();
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
  const values = cards.map(card => APP_CONFIG.pokerHandRanks[card.rank]);
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

  if (counts[0] === 5 && flush) return { name: "Flush Five", indices: allCards, premium: true };
  if (counts[0] === 5) return { name: "Five of a Kind", indices: allCards, premium: true };
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
  return APP_CONFIG.payouts.poker[handName] || 0;
}

function formatPokerHandName(handName) {
  const shortNames = {
    "High Card": "High",
    "Pair": "Pair",
    "Two Pair": "2 Pair",
    "Three of a Kind": "Trips",
    "Straight": "Str",
    "Flush": "Flush",
    "Full House": "Boat",
    "Four of a Kind": "Quads",
    "Straight Flush": "SF",
    "Royal Flush": "Royal",
    "Five of a Kind": "5Kind",
    "Flush Five": "Flush5"
  };
  return shortNames[handName] || handName;
}

function pokerResultText(handName, payout) {
  const label = formatPokerHandName(handName);
  return payout ? `${label} +${payout}` : `${label} +0`;
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

function applyHotspins(cards, shoe, spinCount = 0) {
  const spins = [];
  const totalSpins = Math.max(0, Math.floor(Number(spinCount) || 0));
  for (let spin = 0; spin < totalSpins; spin++) {
    const details = pokerHandDetails(cards);
    const scoring = new Set(details.indices);
    const rerollIndices = details.indices.length === 0
      ? cards.map((_, index) => index)
      : cards.map((_, index) => index).filter(index => !scoring.has(index));
    if (rerollIndices.length === 0) break;
    spins.push([...rerollIndices]);
    rerollIndices.forEach(index => {
      cards[index] = drawFromDeck(shoe);
    });
  }
  return spins;
}

function applyHotspinsSim(cards, shoe, rng, spinCount = 0) {
  const totalSpins = Math.max(0, Math.floor(Number(spinCount) || 0));
  for (let spin = 0; spin < totalSpins; spin++) {
    const details = pokerHandDetails(cards);
    const scoring = new Set(details.indices);
    const rerollIndices = details.indices.length === 0
      ? cards.map((_, index) => index)
      : cards.map((_, index) => index).filter(index => !scoring.has(index));
    if (rerollIndices.length === 0) break;
    rerollIndices.forEach(index => {
      cards[index] = drawFromDeckRng(shoe, rng);
    });
  }
  return cards;
}

function simulateOfflinePokerGain(cycles) {
  const sampleCycles = Math.min(cycles, APP_CONFIG.timing.offlineSimulationSampleCycles);
  if (!sampleCycles) return 0;
  const rng = createRng(gameState.runtime.offlineSeed || gameState.runtime.lastSavedMs || Date.now());
  let sampleGain = 0;

  for (let i = 0; i < sampleCycles; i++) {
    game.decks.forEach(deck => {
      const shoe = buildDeckForHand(deck);
      const handRows = [];
      for (let handIndex = 0; handIndex < deck.hands; handIndex++) {
        const cards = Array.from({ length: APP_CONFIG.decks.handSize }, () => drawFromDeckRng(shoe, rng));
        const finalCards = deck.hotspins ? applyHotspinsSim(cards, shoe, rng, deck.hotspins) : cards;
        handRows.push(finalCards);
        const handName = pokerHandName(finalCards);
        const payout = Math.ceil(pokerHandPayout(handName) * game.multiplier);
        sampleGain += payout;
      }
      if (deck.verticalHands && deck.hands >= APP_CONFIG.decks.handSize) {
        for (let col = 0; col < APP_CONFIG.decks.handSize; col++) {
          for (let start = 0; start + APP_CONFIG.decks.handSize <= deck.hands; start++) {
            const cards = [];
            for (let rowOffset = 0; rowOffset < APP_CONFIG.decks.handSize; rowOffset++) {
              cards.push(handRows[start + rowOffset][col]);
            }
            const handName = pokerHandName(cards);
            const payout = Math.ceil(pokerHandPayout(handName) * game.multiplier);
            sampleGain += payout;
          }
        }
      }
    });
  }

  return Math.floor((sampleGain / sampleCycles) * cycles);
}

function applyOfflineProgress() {
  const now = Date.now();
  const last = gameState.runtime.lastSavedMs || now;
  const elapsed = now - last;
  if (!game.autoUnlocked || !game.autoRunning || elapsed <= 0) {
    gameState.runtime.lastSavedMs = now;
    return;
  }

  const cyclesPossible = Math.floor(elapsed / getAutoDealDelay());
  const cycles = Math.min(cyclesPossible, APP_CONFIG.timing.offlineCatchupMaxCycles);
  if (cycles <= 0) {
    gameState.runtime.lastSavedMs = now;
    return;
  }

  const estimated = simulateOfflinePokerGain(cycles);
  game.chips += estimated;
  recordTelemetry("totalOfflineCycles", cycles);
  recordTelemetry("totalOfflineEarnings", estimated);
  recordTelemetry("chipsEarned", estimated);
  gameState.runtime.lastSavedMs = now;
  gameState.runtime.offlineSeed = (gameState.runtime.offlineSeed || 1) + cycles;
  notifyStateChanged("offline");
  if (estimated > 0) toast(`Offline catch-up: +${estimated} chips`);
}

function upgradeDeckHands(index) {
  const deck = game.decks[index];
  if (!deck || deck.hands >= deck.maxHands || !spend(deck.handCost)) return;
  ensureAudioReady();
  playUpgradeClick();
  deck.hands++;
  deck.handCost = Math.ceil(deck.handCost * APP_CONFIG.upgrade.deckHandCostGrowth);
  toast(`${deck.type} upgraded to ${deck.hands} hands`);
  renderDecks();
  notifyStateChanged("deck-upgrade");
}

function upgradeDeckHotspins(index) {
  const deck = game.decks[index];
  if (!deck || !spend(deck.hotspinCost)) return;
  ensureAudioReady();
  playUpgradeClick();
  deck.hotspins++;
  deck.hotspinCost = Math.ceil(deck.hotspinCost * APP_CONFIG.upgrade.hotspinCostGrowth);
  toast(`${deck.type} hotspins increased to ${deck.hotspins}`);
  renderDecks();
  notifyStateChanged("deck-hotspins");
}

function upgradeDeckVerticalHands(index) {
  const deck = game.decks[index];
  if (!deck || deck.verticalHands || deck.hands < 5 || !spend(deck.verticalHandsCost)) return;
  ensureAudioReady();
  playUpgradeClick();
  deck.verticalHands = true;
  toast(`${deck.type} unlocked Vertical Hands`);
  renderDecks();
  notifyStateChanged("deck-vertical-hands");
}

function upgradeDeckAces(index) {
  const deck = game.decks[index];
  if (!deck || !spend(deck.aceAddCost)) return;
  ensureAudioReady();
  playUpgradeClick();
  deck.addedAces++;
  deck.aceAddCost = Math.ceil(deck.aceAddCost * APP_CONFIG.upgrade.deckAceCostGrowth);
  toast(`${deck.type} gained +1 Ace (${deck.addedAces} total)`);
  renderDecks();
  notifyStateChanged("deck-ace");
}

function upgradeDeckTrimLowest(index) {
  const deck = game.decks[index];
  if (!deck || !canRemoveLowestCard(deck)) return;
  if (!spend(deck.removeLowestCost)) return;
  ensureAudioReady();
  playUpgradeClick();
  deck.removedLowestCards++;
  deck.removeLowestCost = Math.ceil(deck.removeLowestCost * APP_CONFIG.upgrade.deckRemoveLowestCostGrowth);
  toast(`${deck.type} removed one lowest card`);
  renderDecks();
  notifyStateChanged("deck-trim-lowest");
}

function renderDecks(animateWins = false) {
  handsContainer.innerHTML = "";
  const deckPayouts = [];
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
          <button class="btn hotspin-upgrade" data-deck-index="${index}">${deck.hotspins > 0 ? `Hotspins x${deck.hotspins}` : "Unlock Hotspins"} (${deck.hotspinCost})</button>
          <button class="btn vertical-hands-upgrade" data-deck-index="${index}">Vertical Hands (${deck.verticalHandsCost})</button>
          <button class="btn ace-upgrade" data-deck-index="${index}">Add Ace (${deck.aceAddCost})</button>
          <button class="btn trim-lowest-upgrade" data-deck-index="${index}">Remove Low Card (${deck.removeLowestCost})</button>
        </div>
      </div>
    `;

    const shoe = buildDeckForHand(deck);
    const handRows = [];
    let deckRevealDelay = 0;

    for (let i = 0; i < deck.hands; i++) {
      const row = document.createElement("div");
      row.className = "hand";
      const cards = Array.from({ length: APP_CONFIG.decks.handSize }, () => drawFromDeck(shoe));
      const firstRollCards = cards.map(card => ({ ...card }));
      const firstRollDetails = pokerHandDetails(firstRollCards);
      const hotspinPlan = deck.hotspins > 0 ? applyHotspins(cards, shoe, deck.hotspins) : [];
      const hotspinIndices = [...new Set(hotspinPlan.flatMap(indices => indices))];
      const cardEls = cards.map((card, cardIndex) => {
        const face = animateWins ? randomCard() : card;
        return createCardEl(hotspinIndices.includes(cardIndex) && !animateWins ? card : face);
      });
      cardEls.forEach(card => row.appendChild(card));

      const handDetails = pokerHandDetails(cards);
      const handName = handDetails.name;
      const payout = Math.ceil(pokerHandPayout(handName) * game.multiplier);
      if (payout) {
        recordTelemetry("chipsEarned", payout);
        recordTelemetry("totalPokerPayout", payout);
      }

      recordTelemetry("totalPokerHands", 1);

      const result = document.createElement("span");
      result.className = "result";
      result.textContent = animateWins ? "..." : pokerResultText(handName, payout);
      row.appendChild(result);
      deckEl.appendChild(row);
      handRows.push({ cards });
      let handChipDelay = 0;

      if (animateWins) {
        const handDelay = (420 + (i * 55)) * speedScale;
        const firstRollEnd = handDelay + 4 * 95 * speedScale;
        const hotspinDuration = 360 * speedScale;
        let spinStart = firstRollEnd + 180 * speedScale;
        const spinDurations = hotspinPlan.length > 0
          ? hotspinPlan.map(spin => {
            return hotspinDuration + Math.max(0, spin.length - 1) * 55 * speedScale + 120 * speedScale;
          })
          : [];
        let revealDelay = spinStart;
        if (spinDurations.length > 0) {
          spinDurations.forEach(duration => {
            spinStart += duration;
          });
          revealDelay = spinStart;
        } else {
          revealDelay = handDelay + 490 * speedScale;
        }
        handChipDelay = revealDelay + 220 * speedScale;
        longestAnimationMs = Math.max(longestAnimationMs, handChipDelay);
        deckRevealDelay = Math.max(deckRevealDelay, handChipDelay);

        cardEls.forEach((cardEl, cardIndex) => {
          animatePokerCard(cardEl, firstRollCards[cardIndex], handDelay + cardIndex * 95 * speedScale, speedScale);
        });

        if (hotspinPlan.length > 0) {
          setTimeout(() => {
            highlightPokerWin(row, cardEls, firstRollDetails, { preview: true });
          }, firstRollEnd + 40 * speedScale);
        }

        if (spinDurations.length > 0) {
          let spinIterationStart = firstRollEnd + 180 * speedScale;
          hotspinPlan.forEach((spin, spinIndex) => {
            const duration = spinDurations[spinIndex];
            spin.forEach((cardIndex, rerollIndex) => {
              animatePokerCardReroll(
                cardEls[cardIndex],
                cards[cardIndex],
                spinIterationStart + rerollIndex * 55 * speedScale,
                hotspinDuration,
                speedScale
              );
            });
            spinIterationStart += duration;
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
        deckPayouts[index] ||= { deckEl, payout: 0, chipDelay: 0 };
        deckPayouts[index].payout += payout;
        deckPayouts[index].chipDelay = Math.max(deckPayouts[index].chipDelay, handChipDelay);
      }
    }

    if (deck.verticalHands && deck.hands >= APP_CONFIG.decks.handSize) {
      let verticalIndex = 0;
      const verticalRevealBase = animateWins ? deckRevealDelay : 0;
      for (let col = 0; col < APP_CONFIG.decks.handSize; col++) {
        for (let start = 0; start + APP_CONFIG.decks.handSize <= deck.hands; start++) {
          const cards = [];
          for (let rowOffset = 0; rowOffset < APP_CONFIG.decks.handSize; rowOffset++) {
            cards.push(handRows[start + rowOffset].cards[col]);
          }
          const verticalDetails = pokerHandDetails(cards);
          const verticalHandName = verticalDetails.name;
          const verticalPayout = Math.ceil(pokerHandPayout(verticalHandName) * game.multiplier);

          recordTelemetry("totalPokerHands", 1);
          if (verticalPayout) {
            recordTelemetry("chipsEarned", verticalPayout);
            recordTelemetry("totalPokerPayout", verticalPayout);
          }

          const vRow = document.createElement("div");
          vRow.className = "hand vertical-hand";
          const vResult = document.createElement("span");
          vResult.className = "result";
          const prefix = `V${col + 1}.${start + 1}`;
          vResult.textContent = animateWins ? "..." : `${prefix} ${pokerResultText(verticalHandName, verticalPayout)}`;
          vRow.appendChild(vResult);
          deckEl.appendChild(vRow);

          const verticalRevealDelay = verticalRevealBase + verticalIndex * 70 * speedScale;
          if (animateWins) {
            setTimeout(() => {
              vResult.textContent = `${prefix} ${pokerResultText(verticalHandName, verticalPayout)}`;
              if (verticalPayout) {
                vRow.classList.add("winning-hand");
                if (verticalDetails.premium) {
                  vRow.classList.add("premium-win");
                  setTimeout(() => vRow.classList.remove("premium-win"), 1200);
                }
              }
            }, verticalRevealDelay);
          }

          if (animateWins && verticalPayout) {
            deckPayouts[index] ||= { deckEl, payout: 0, chipDelay: 0 };
            deckPayouts[index].payout += verticalPayout;
            deckPayouts[index].chipDelay = Math.max(deckPayouts[index].chipDelay, verticalRevealDelay + 220 * speedScale);
          }
          verticalIndex++;
        }
      }
    }

    deckEl.dataset.isDeckSource = "true";
    handsContainer.appendChild(deckEl);
  });

  const pendingPayout = deckPayouts.reduce((sum, deck) => sum + (deck?.payout || 0), 0);
  updateScore();
  markDirty("render-decks");
  const chipAnimationMs = animateWins ? getChipAnimationMs() : 0;
  const lastChipDelay = pendingPayout
    ? Math.max(...deckPayouts.filter(Boolean).map(({ chipDelay }, index) => chipDelay + index * 90 * speedScale))
    : 0;
  const payoutDelay = lastChipDelay + chipAnimationMs;

  if (pendingPayout && animateWins) {
    timerManager.setTimeout(() => {
      game.chips += pendingPayout;
      updateScore();
      markDirty("poker-payout");
    }, payoutDelay);
  }

  if (deckPayouts.length > 0) {
    requestAnimationFrame(() => {
      deckPayouts.forEach(({ deckEl, payout, chipDelay }, index) => {
        if (!deckEl) return;
        const mode = payout >= 25 ? "big" : "normal";
        setTimeout(() => spawnChips(payout, mode, deckEl), chipDelay + index * 90 * speedScale);
        });
      });
    }

    const winningDecksCount = deckPayouts.filter(Boolean).length;
    return animateWins ? Math.max(1120 * speedScale, longestAnimationMs) + winningDecksCount * 90 * speedScale + chipAnimationMs : 0;
  }

async function deal() {
  if (game.spinning) return;
  game.spinning = true;
  recordTelemetry("totalPokerCycles", 1);
  const animationMs = renderDecks(true);
  await delay(animationMs);
  game.spinning = false;
}

async function runAutoDealLoop() {
  if (!game.autoRunning) return;
  await deal();
  if (!game.autoRunning) return;
  game.autoLoop = timerManager.setTimeout(runAutoDealLoop, getAutoDealDelay());
}

function toggleAutoDeal() {
  if (!game.autoUnlocked) return;
  game.autoRunning = !game.autoRunning;
  timerManager.clearTimeout(game.autoLoop);
  if (game.autoRunning) runAutoDealLoop();
  updateButtons();
  notifyStateChanged("auto-toggle");
}

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
    dealerValue.textContent = showDealer || !bj.active ? `Dealer: ${bjScore(bj.dealer)}` : `Dealer: ${bjScore(visibleDealerCards)}`;
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
      <button class="btn bj-control" data-bj-control="rebet">Rebet & Deal</button>
      <button class="btn bj-control" data-bj-control="rebet-double">Rebet x2 & Deal</button>
    `;
    return;
  }

  panel.innerHTML = `
    <button class="btn bj-control" data-bj-control="hit">Hit</button>
    <button class="btn bj-control" data-bj-control="stand">Stand</button>
    <button class="btn bj-control" data-bj-control="double">Double</button>
    <button class="btn bj-control" data-bj-control="split">Split</button>
  `;
}

function handleBjControl(event) {
  const action = event.target?.dataset?.bjControl;
  if (!action) return;
  switch (action) {
    case "hit":
      bjHit();
      break;
    case "stand":
      bjStand();
      break;
    case "double":
      bjDouble();
      break;
    case "split":
      bjSplit();
      break;
    case "rebet":
      rebetBJ();
      break;
    case "rebet-double":
      rebetDoubleBJ();
      break;
    default:
      return;
  }
  recordTelemetry("totalClicks", 1);
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
  updateButtons();
  recordTelemetry("totalBlackjackHands", 1);
  recordTelemetry("totalBlackjackWager", wager);
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
  if (payout > 0) {
    spawnChips(payout, "big", bjPlayer);
    recordTelemetry("chipsEarned", payout);
    recordTelemetry("totalBlackjackPayout", payout);
  }
  toast(`Blackjack payout: ${payout}`);

  bj.active = false;
  bj.revealing = false;
  updateScore();
  renderBJControls();
  renderBJ(true);
  notifyStateChanged("blackjack-resolve");
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
  recordTelemetry("chipsSpent", bj.wager);
  bjHit();
  bjStand();
  notifyStateChanged("bj-double");
}

function bjSplit() {
  const hand = bj.hands[bj.currentHand];
  if (!bj.active || !hand || hand.cards.length !== 2) return;
  const [c1, c2] = hand.cards;
  if (c1.value !== c2.value || game.chips < bj.wager) return;
  game.chips -= bj.wager;
  recordTelemetry("chipsSpent", bj.wager);
  bj.hands.splice(
    bj.currentHand,
    1,
    { cards: [c1, drawCard()], done: false, busted: false },
    { cards: [c2, drawCard()], done: false, busted: false }
  );
  renderBJ(false);
  renderBJControls();
  updateScore();
  notifyStateChanged("bj-split");
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

function buildPlinkoMultipliers() {
  const slots = plinko.layers + 2;
  const center = (slots - 1) / 2;
  const settings = APP_CONFIG.plinko.riskSettings[plinko.risk];
  plinko.multipliers = Array.from({ length: slots }, (_, index) => {
    const distance = Math.abs(index - center) / center;
    const raw = settings.center + (settings.edge - settings.center) * Math.pow(distance, settings.curve);
    return Math.max(0, Math.round(raw * 4) / 4);
  });
}

function updatePlinkoSettings() {
  plinko.risk = Number(plinkoRiskSlider.value);
  plinko.layers = Number(plinkoLayersSlider.value);
  plinkoRiskLabel.textContent = APP_CONFIG.plinko.riskLabel[plinko.risk];
  plinkoLayersLabel.textContent = plinko.layers;
  buildPlinkoMultipliers();
  renderPlinkoBoard();
}

function formatMultiplier(value) {
  return Number.isInteger(value) ? `${value}` : `${value.toFixed(value < 1 ? 2 : 1).replace(/0+$/, "").replace(/\.$/, "")}`;
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
  if (!game.plinkoUnlocked || plinko.activeDrops > 0) return;
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

  if (payout > 0) {
    spawnChips(payout, payout >= wager * 2 ? "big" : "normal", plinkoSlots.children[slotIndex]);
    recordTelemetry("chipsEarned", payout);
    recordTelemetry("totalPlinkoPayout", payout);
  }

  renderPlinkoBoard(slotIndex);
  plinkoResult.textContent = `Landed ${formatMultiplier(multiplier)}x. Payout: ${payout}`;
  toast(`Plinko payout: ${payout}`);
  await delay(350);
  chip.style.opacity = "0";
  setTimeout(() => chip.remove(), 150);
  plinko.activeDrops = Math.max(0, plinko.activeDrops - 1);
  updateScore();
  notifyStateChanged("plinko-drop");
}

function togglePlinkoAuto() {
  if (!game.plinkoAutoUnlocked) return;
  game.plinkoAutoRunning = !game.plinkoAutoRunning;
  timerManager.clearInterval(game.plinkoAutoLoop);
  if (game.plinkoAutoRunning) {
    game.plinkoAutoLoop = timerManager.setInterval(() => {
      dropPlinkoChip();
    }, 1200);
  }
  updateButtons();
}

function setupMiniModules() {
  registerMiniGame({
    id: "poker",
    name: "Poker",
    isUnlocked: () => true,
    onEvent: (name, payload) => {
      if (name === "state:tick") {
        recordTelemetry("totalPokerCycles", payload?.cycles || 0);
      }
    },
    render: () => renderDecks()
  });
  registerMiniGame({
    id: "blackjack",
    name: "Blackjack",
    isUnlocked: () => game.blackjackUnlocked,
    render: () => renderBJControls()
  });
  registerMiniGame({
    id: "plinko",
    name: "Plinko",
    isUnlocked: () => game.plinkoUnlocked,
    render: () => renderPlinkoBoard()
  });
}

function renderMiniGames() {
  for (const module of miniGameModules.values()) {
    if (!module.isUnlocked || module.isUnlocked()) {
      module.render?.();
    }
  }
}

function bindDeckControls() {
  handsContainer.addEventListener("click", event => {
    const button = event.target.closest(".deck-upgrade, .hotspin-upgrade, .vertical-hands-upgrade, .ace-upgrade, .trim-lowest-upgrade");
    if (!button || !handsContainer.contains(button)) return;
    const index = Number(button.dataset.deckIndex);
    if (!Number.isFinite(index)) return;
    recordTelemetry("totalClicks", 1);
    if (button.classList.contains("deck-upgrade")) {
      upgradeDeckHands(index);
    } else if (button.classList.contains("hotspin-upgrade")) {
      upgradeDeckHotspins(index);
    } else if (button.classList.contains("vertical-hands-upgrade")) {
      upgradeDeckVerticalHands(index);
    } else if (button.classList.contains("ace-upgrade")) {
      upgradeDeckAces(index);
    } else if (button.classList.contains("trim-lowest-upgrade")) {
      upgradeDeckTrimLowest(index);
    }
  });
}

function bindControls() {
  buyAutoBtn.addEventListener("click", () => {
    ensureAudioReady();
    if (!spend(game.autoCost)) return;
    playUpgradeClick();
    game.autoUnlocked = true;
    toast("Auto deal unlocked");
    notifyStateChanged("buy-auto");
    recordTelemetry("totalClicks", 1);
  });

  speedBtn.addEventListener("click", () => {
    ensureAudioReady();
    if (game.speedLevel >= game.maxSpeedLevel) return;
    if (!spend(game.speedCost)) return;
    playUpgradeClick();
    game.speedLevel++;
    game.interval = getAutoDealDelay();
    game.speedCost = Math.ceil(game.speedCost * APP_CONFIG.upgrade.speedCostGrowth + APP_CONFIG.upgrade.speedCostFlat);
    if (game.autoRunning && !game.spinning) {
      timerManager.clearTimeout(game.autoLoop);
      runAutoDealLoop();
    }
    toast(`Speed improved: ${formatSeconds(game.interval)} auto delay`);
    updateButtons();
    notifyStateChanged("buy-speed");
    recordTelemetry("totalClicks", 1);
  });

  buyDeckBtn.addEventListener("click", () => {
    ensureAudioReady();
    if (!spend(game.deckCost)) return;
    playUpgradeClick();
    const next = game.decks.length + 1;
    game.decks.push(createDeckTemplate(next));
    game.deckCost = Math.ceil(game.deckCost * APP_CONFIG.upgrade.deckCostGrowth);
    renderDecks();
    notifyStateChanged("buy-deck");
    recordTelemetry("totalClicks", 1);
  });

  buyBlackjackBtn.addEventListener("click", () => {
    ensureAudioReady();
    if (!spend(game.blackjackCost)) return;
    playUpgradeClick();
    game.blackjackUnlocked = true;
    updateSideGames();
    updateButtons();
    toast("Blackjack unlocked");
    notifyStateChanged("buy-blackjack");
    recordTelemetry("totalClicks", 1);
  });

  buyPlinkoBtn.addEventListener("click", () => {
    ensureAudioReady();
    if (!spend(game.plinkoCost)) return;
    playUpgradeClick();
    game.plinkoUnlocked = true;
    updateSideGames();
    updateButtons();
    toast("Plinko unlocked");
    notifyStateChanged("buy-plinko");
    recordTelemetry("totalClicks", 1);
  });

  buyPlinkoAutoBtn.addEventListener("click", () => {
    ensureAudioReady();
    if (!spend(game.plinkoAutoCost)) return;
    playUpgradeClick();
    game.plinkoAutoUnlocked = true;
    updateButtons();
    notifyStateChanged("buy-plinko-auto");
    recordTelemetry("totalClicks", 1);
  });

  dealBtn.addEventListener("click", () => {
    ensureAudioReady();
    playDealClick();
    recordTelemetry("totalClicks", 1);
    emitMiniGameEvent("state:tick", { cycles: 1 });
    deal();
  });
  autoBtn.addEventListener("click", () => {
    recordTelemetry("totalClicks", 1);
    toggleAutoDeal();
  });
  blackjackBtn.addEventListener("click", () => {
    recordTelemetry("totalClicks", 1);
    startBJ(betInput.value);
  });
  clearBjBetBtn.addEventListener("click", () => {
    recordTelemetry("totalClicks", 1);
    setBjBet(1);
  });
  betInput.addEventListener("input", () => {
    bjBetDisplay.textContent = getBjBet();
    updateButtons();
  });
  bjChipBtns.forEach(button => button.addEventListener("click", () => {
    addBjChip(Number(button.dataset.chipValue));
    recordTelemetry("totalClicks", 1);
  }));
  if (bjControls) bjControls.addEventListener("click", handleBjControl);

  plinkoDropBtn.addEventListener("click", () => {
    recordTelemetry("totalClicks", 1);
    dropPlinkoChip();
  });
  plinkoRiskSlider.addEventListener("input", updatePlinkoSettings);
  plinkoLayersSlider.addEventListener("input", updatePlinkoSettings);
  clearPlinkoBetBtn.addEventListener("click", () => {
    recordTelemetry("totalClicks", 1);
    setPlinkoBet(1);
  });
  plinkoBetInput.addEventListener("input", () => {
    plinkoBetDisplay.textContent = getPlinkoBet();
    updateButtons();
  });
  plinkoBetChipBtns.forEach(button => button.addEventListener("click", () => {
    addPlinkoChip(Number(button.dataset.chipValue));
    recordTelemetry("totalClicks", 1);
  }));
  plinkoAutoBtn.addEventListener("click", () => {
    recordTelemetry("totalClicks", 1);
    togglePlinkoAuto();
  });
  panelToggleBtns.forEach(button => button.addEventListener("click", () => {
    togglePanelMinimized(button.dataset.target);
  }));
}

bus.on("state:changed", () => {
  updateButtons();
  updateSideGames();
  updateScore();
  renderMiniGames();
});

function initialize() {
  setupMiniModules();
  installAudioPrimers();
  if (gameState.runtime.offlineSeed <= 0) gameState.runtime.offlineSeed = Date.now() & 0x7fffffff;
  recordTelemetry("sessions", 1);
  applyOfflineProgress();
  renderDecks();
  renderBJControls();
  buildPlinkoMultipliers();
  renderPlinkoBoard();
  updateSideGames();
  setBjBet(bj.lastBet);
  setPlinkoBet(plinko.lastBet);
  bindDeckControls();
  bindControls();
  window.addEventListener("beforeunload", () => {
    saveStateNow("beforeunload");
    timerManager.clearAll();
  });
  notifyStateChanged("boot");
  saveState("boot");
}

initialize();
