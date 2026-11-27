const refs = {
  stats: document.querySelector("#stats"),
  notice: document.querySelector("#notice"),
  teamGrid: document.querySelector("#team-grid"),
  selectionHint: document.querySelector("#selection-hint"),
  petShop: document.querySelector("#pet-shop"),
  shopCapacity: document.querySelector("#shop-capacity"),
  foodShop: document.querySelector("#food-shop"),
  rewardSection: document.querySelector("#reward-section"),
  rewardShop: document.querySelector("#reward-shop"),
  rollButton: document.querySelector("#roll-button"),
  endTurn: document.querySelector("#end-turn"),
  endTurnTop: document.querySelector("#end-turn-top"),
  recentLog: document.querySelector("#recent-log"),
  battleLog: document.querySelector("#battle-log"),
  battleDialog: document.querySelector("#battle-dialog"),
  newRunDialog: document.querySelector("#new-run-dialog"),
  newRunButton: document.querySelector("#new-run"),
  confirmNewRun: document.querySelector("#confirm-new-run"),
  closeBattle: document.querySelector("#close-battle"),
  showBattle: document.querySelector("#show-battle"),
  seedInput: document.querySelector("#seed-input"),
  busy: document.querySelector("#busy"),
  battleTitle: document.querySelector("#battle-title"),
  battleResult: document.querySelector("#battle-result"),
  playerBattleTeam: document.querySelector("#player-battle-team"),
  enemyBattleTeam: document.querySelector("#enemy-battle-team"),
  attackEffect: document.querySelector("#attack-effect"),
  battlePlay: document.querySelector("#battle-play"),
  battleReplay: document.querySelector("#battle-replay"),
  battleSpeed: document.querySelector("#battle-speed"),
  battleProgress: document.querySelector("#battle-progress"),
  battleStep: document.querySelector("#battle-step"),
  battleFeed: document.querySelector("#battle-feed"),
  battleLine: document.querySelector("#battle-line"),
  battleLines: document.querySelector("#battle-lines"),
  runStatePill: document.querySelector("#run-state-pill"),
  gameOverDialog: document.querySelector("#game-over-dialog"),
  gameOverTitle: document.querySelector("#game-over-title"),
  gameOverReason: document.querySelector("#game-over-reason"),
  gameOverMark: document.querySelector("#game-over-mark"),
  gameOverAccolade: document.querySelector("#game-over-accolade"),
  gameOverAccoladeTitle: document.querySelector("#game-over-accolade-title"),
  gameOverAccoladeDetail: document.querySelector("#game-over-accolade-detail"),
  gameOverStats: document.querySelector("#game-over-stats"),
  gameOverTeam: document.querySelector("#game-over-team"),
  gameOverReview: document.querySelector("#game-over-review"),
  gameOverNew: document.querySelector("#game-over-new"),
  gameOverDismiss: document.querySelector("#game-over-dismiss")
};

let game = null;
let selectedUid = null;
let pendingPurchase = null;
let pendingMergeSource = null;
let lastBattleLog = [];
let requestInFlight = false;
let battlePlayback = null;
let battleTimer = null;
let attackVisualToken = 0;
let gameOverTimer = null;
const battleCards = new Map();
const battleStats = new Map();

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label, className, onClick, options = {}) {
  const node = el("button", className, label);
  node.type = "button";
  if (options.disabled) node.disabled = true;
  if (options.title) node.title = options.title;
  if (onClick) {
    node.addEventListener("click", (event) => {
      event.stopPropagation();
      onClick(event);
    });
  }
  return node;
}

function showNotice(message, type = "") {
  refs.notice.textContent = message;
  refs.notice.className = `notice ${type}`.trim();
}

function setBusy(value) {
  requestInFlight = value;
  refs.busy.classList.toggle("hidden", !value);
  refs.busy.setAttribute("aria-hidden", String(!value));
  if (!value && game) render();
}

function showGameOver(state = game?.state) {
  if (!state || state.phase !== "gameOver") return;
  clearTimeout(gameOverTimer);
  if (refs.battleDialog.open) refs.battleDialog.close();
  if (refs.newRunDialog.open) refs.newRunDialog.close();
  refs.runStatePill.classList.remove("hidden");
  const won = state.wins >= 10;
  refs.gameOverDialog.classList.toggle("victory", won);
  refs.gameOverDialog.classList.toggle("defeat", !won);
  refs.gameOverMark.textContent = won ? "WIN" : "GG";
  refs.gameOverTitle.textContent = won ? "10 胜达成" : "生命耗尽";
  refs.gameOverReason.textContent = won
    ? `你完成了 SAP Normal Arena，最终战绩 ${state.wins} 胜、剩余 ${state.lives} 命。种子：${state.seed}`
    : `本局在第 ${state.turn} 回合结束。种子：${state.seed}`;
  const hasLevelThree = state.team.some((pet) => pet.level === 3);
  refs.gameOverAccolade.classList.toggle("hidden", !won);
  refs.gameOverAccoladeTitle.textContent = hasLevelThree
    ? "满级阵容成就"
    : "标准通关";
  refs.gameOverAccoladeDetail.textContent = hasLevelThree
    ? "最终阵容包含至少一只 3 级宠物，获得 SAP 官方通关纪念：红丝带。"
    : "最终阵容没有 3 级宠物，本次不会获得红丝带纪念。";
  refs.runStatePill.textContent = won ? "本局胜利" : "本局失败";
  refs.gameOverStats.replaceChildren();
  for (const [label, value] of [
    ["最终回合", state.turn],
    ["最终胜场", `${state.wins}/10`],
    ["剩余生命", `${state.lives}/5`]
  ]) {
    const item = el("div", "game-over-stat");
    item.append(el("b", "", String(value)), el("span", "", label));
    refs.gameOverStats.append(item);
  }
  refs.gameOverTeam.replaceChildren();
  if (state.team.length === 0) {
    refs.gameOverTeam.append(el("span", "muted", "无存活阵容"));
  } else {
    for (const pet of state.team) {
      refs.gameOverTeam.append(
        el(
          "span",
          "game-over-pet",
          `${pet.nameZh} · Lv.${pet.level} · ${pet.attack}/${pet.health}`
        )
      );
    }
  }
  showNotice(
    won ? "10 胜达成，本局胜利。" : "生命耗尽，本局结束。",
    won ? "ok" : "error"
  );
  if (!refs.gameOverDialog.open) refs.gameOverDialog.showModal();
  refs.gameOverNew.focus();
}

function scheduleGameOver(delay = 900) {
  clearTimeout(gameOverTimer);
  if (game?.state.phase !== "gameOver") return;
  gameOverTimer = setTimeout(() => showGameOver(), delay);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = await response.json().catch(() => ({
    ok: false,
    error: `服务器返回了无法解析的响应 (${response.status})`
  }));
  if (!response.ok && data.ok !== false) {
    throw new Error(data.error ?? `请求失败 (${response.status})`);
  }
  return data;
}

async function loadGame() {
  setBusy(true);
  try {
    const data = await api("/api/state");
    game = data.view;
    selectedUid = null;
    pendingPurchase = null;
    pendingMergeSource = null;
    render();
    showNotice("点击商店购买，点击队伍宠物选择食物目标。", "ok");
    if (game.state.phase === "gameOver") scheduleGameOver(350);
  } catch (error) {
    showNotice(error instanceof Error ? error.message : String(error), "error");
  } finally {
    setBusy(false);
  }
}

async function performAction(action, successMessage) {
  if (requestInFlight) return;
  setBusy(true);
  try {
    const data = await api("/api/action", {
      method: "POST",
      body: JSON.stringify(action)
    });
    if (!data.ok) {
      showNotice(data.message ?? data.error ?? "操作失败", "error");
      return null;
    }
    game = data.view;
    selectedUid = game.state.team.some((pet) => pet.uid === selectedUid)
      ? selectedUid
      : null;
    pendingPurchase = null;
    pendingMergeSource = null;
    render();
    if (data.addedLog?.length) lastBattleLog = data.addedLog;
    showNotice(successMessage ?? data.message ?? "操作成功。", "ok");
    return data;
  } catch (error) {
    showNotice(error instanceof Error ? error.message : String(error), "error");
    return null;
  } finally {
    setBusy(false);
  }
}

function render() {
  if (!game) return;
  renderStats();
  renderTeam();
  renderShop();
  renderLog();
  const gameOver = game.state.phase === "gameOver";
  refs.runStatePill.classList.toggle("hidden", !gameOver);
  refs.rollButton.disabled =
    requestInFlight || gameOver || game.state.gold < 1;
  refs.endTurn.disabled = requestInFlight || gameOver;
  refs.endTurnTop.disabled = requestInFlight || gameOver;
}

function renderStats() {
  refs.stats.replaceChildren();
  const stats = [
    ["回合", game.state.turn],
    ["胜场", `${game.state.wins}/10`],
    ["生命", `${game.state.lives}/5`],
    ["金币", game.state.gold],
    ["商店", `${game.state.shopTier} 档`]
  ];
  if (game.state.lastBattleOutcome) {
    stats.push([
      "上场",
      game.state.lastBattleOutcome === "win"
        ? "胜利"
        : game.state.lastBattleOutcome === "loss"
          ? "失败"
          : "平局"
    ]);
  }
  for (const [label, value] of stats) {
    const card = el("div", "stat");
    card.append(el("b", "", String(value)), el("span", "", label));
    refs.stats.append(card);
  }
  if (game.state.phase === "gameOver") {
    const card = el("div", "stat");
    card.append(el("b", "", game.state.wins >= 10 ? "胜利" : "结束"));
    card.append(el("span", "", "GAME OVER"));
    refs.stats.append(card);
  }
}

function renderTeam() {
  refs.teamGrid.replaceChildren();
  const bySlot = new Map(game.state.team.map((pet) => [pet.index, pet]));
  for (let index = 1; index <= game.state.maxTeamSize; index++) {
    const pet = bySlot.get(index);
    if (!pet) {
      const empty = el("div", "pet-card empty");
      empty.append(el("b", "", `${index}`), el("span", "", "空槽位"));
      refs.teamGrid.append(empty);
      continue;
    }
    refs.teamGrid.append(renderPetCard(pet));
  }

  if (pendingPurchase) {
    refs.selectionHint.textContent = "请选择一只同名队伍宠物作为合并目标。";
  } else if (pendingMergeSource) {
    refs.selectionHint.textContent =
      "请选择另一只同名宠物，将当前宠物合并到它身上。";
  } else if (selectedUid) {
    const selected = game.state.team.find((pet) => pet.uid === selectedUid);
    refs.selectionHint.textContent = selected
      ? `已选中 ${selected.nameZh}（${selected.name}），可对它使用单体食物，或点击其他宠物改选。`
      : "";
  } else {
    refs.selectionHint.textContent =
      "单体食物和队伍内合并需要先点击宠物选择目标。";
  }
}

function renderPetCard(pet) {
  const source = pendingMergeSource
    ? game.state.team.find((entry) => entry.uid === pendingMergeSource)
    : null;
  const validMergeTarget =
    pendingMergeSource &&
    source &&
    source.uid !== pet.uid &&
    source.templateId === pet.templateId;
  const card = el(
    "article",
    [
      "pet-card",
      selectedUid === pet.uid ? "selected" : "",
      validMergeTarget ? "merge-target" : ""
    ]
      .filter(Boolean)
      .join(" ")
  );
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `选择 ${pet.nameZh}`);
  card.addEventListener("click", () => handleTeamClick(pet));
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleTeamClick(pet);
    }
  });

  card.append(el("span", "slot-badge", `${pet.index}`));
  const heading = el("div", "pet-heading");
  heading.append(el("h3", "pet-title", pet.nameZh));
  heading.append(el("span", "pet-name-en", pet.name));
  card.append(heading);

  const meta = el("div", "pet-meta");
  meta.append(el("span", "pill", `${pet.tier} 阶`));
  meta.append(
    el(
      "span",
      "pill",
      pet.nextLevelXp
        ? `Lv.${pet.level} · XP ${pet.xp}/${pet.nextLevelXp}`
        : "Lv.3 · 已满级"
    )
  );
  for (const perk of pet.perks) {
    meta.append(el("span", "pill perk", perk));
  }
  if (pet.copiedAbilityName) {
    meta.append(el("span", "pill copy", `复制：${pet.copiedAbilityName}`));
  }
  card.append(meta);

  const statLine = el("div", "stat-line");
  statLine.append(
    el("strong", "attack", String(pet.attack)),
    el("span", "", "攻击"),
    el("strong", "health", String(pet.health)),
    el("span", "", "生命")
  );
  card.append(statLine);
  if (pet.battleAttackBonus || pet.battleHealthBonus) {
    card.append(
      el(
        "div",
        "battle-bonus",
        `本场加成：+${pet.battleAttackBonus}/+${pet.battleHealthBonus}`
      )
    );
  }

  card.append(el("p", "ability", pet.ability));

  const actions = el("div", "card-actions");
  actions.append(
    button(
      "←",
      "mini-button",
      () => performAction({ type: "move", uid: pet.uid, targetSlot: pet.index - 1 }),
      { disabled: pet.index <= 1, title: "向前移动" }
    ),
    button(
      "→",
      "mini-button",
      () => performAction({ type: "move", uid: pet.uid, targetSlot: pet.index + 1 }),
      {
        disabled: pet.index >= game.state.teamSize,
        title: "向后移动"
      }
    ),
    button("合并", "mini-button", () => beginMerge(pet), {
      disabled: game.state.teamSize < 2
    }),
    button(
      `出售 +${pet.sellValue}`,
      "mini-button danger",
      () => performAction({ type: "sell", uid: pet.uid }, "宠物已出售。")
    )
  );
  card.append(actions);
  return card;
}

function handleTeamClick(pet) {
  if (pendingPurchase) {
    if (!pendingPurchase.duplicates.includes(pet.uid)) {
      showNotice("这只宠物不是该商品的同名合并目标。", "error");
      return;
    }
    const action = {
      type: "buyPet",
      targetUid: pet.uid,
      ...(pendingPurchase.slot !== undefined
        ? { slot: pendingPurchase.slot }
        : {}),
      ...(pendingPurchase.rewardIndex !== undefined
        ? { rewardIndex: pendingPurchase.rewardIndex }
        : {})
    };
    performAction(action, `已购买并合并到 ${pet.nameZh}。`);
    return;
  }
  if (pendingMergeSource) {
    if (pendingMergeSource === pet.uid) {
      showNotice("不能与自身合并。", "error");
      return;
    }
    const source = game.state.team.find(
      (entry) => entry.uid === pendingMergeSource
    );
    if (!source || source.templateId !== pet.templateId) {
      showNotice("请选择另一只同名宠物。", "error");
      return;
    }
    performAction(
      {
        type: "merge",
        sourceUid: pendingMergeSource,
        targetUid: pet.uid
      },
      `已合并到 ${pet.nameZh}。`
    );
    return;
  }
  selectedUid = selectedUid === pet.uid ? null : pet.uid;
  renderTeam();
}

function beginMerge(pet) {
  pendingPurchase = null;
  pendingMergeSource = pet.uid;
  selectedUid = null;
  renderTeam();
  showNotice("请选择另一只同名宠物作为合并目标。");
}

function renderShop() {
  refs.petShop.replaceChildren();
  refs.foodShop.replaceChildren();
  const petBySlot = new Map(game.state.pets.map((offer) => [offer.slot, offer]));
  for (let slot = 0; slot < game.state.petSlotCount; slot++) {
    const offer = petBySlot.get(slot);
    refs.petShop.append(
      offer ? renderPetOffer(offer) : renderEmptyShopCard("宠物槽位")
    );
  }

  const foodBySlot = new Map(game.state.foods.map((offer) => [offer.slot, offer]));
  for (let slot = 0; slot < game.state.foodSlotCount; slot++) {
    const offer = foodBySlot.get(slot);
    refs.foodShop.append(
      offer
        ? renderFoodOffer(offer)
        : renderEmptyShopCard(
            slot >= game.state.ordinaryFoodSlotCount
              ? "生成食物槽位"
              : "普通食物槽位"
          )
    );
  }

  const buff = game.state.shopPetBuff;
  refs.shopCapacity.textContent = [
    `当前宠物槽 ${game.state.petSlotCount} / 上限 5`,
    buff.attack || buff.health
      ? `商店宠物永久加成 +${buff.attack}/+${buff.health}`
      : ""
  ]
    .filter(Boolean)
    .join(" · ");

  renderRewards();
}

function renderEmptyShopCard(label) {
  const card = el("div", "shop-card empty");
  card.append(el("span", "", label));
  return card;
}

function renderPetOffer(offer) {
  const card = el("article", "shop-card");
  const header = el("div", "shop-card-header");
  const title = el("div");
  title.append(el("h4", "", offer.nameZh));
  title.append(el("span", "pet-name-en", offer.name));
  header.append(title, el("span", "price", `${offer.cost} 金`));
  card.append(header);

  const meta = el("div", "pet-meta");
  meta.append(el("span", "pill", `${offer.tier} 阶`));
  if (offer.frozen) meta.append(el("span", "pill", "已冻结"));
  card.append(meta);

  const statLine = el("div", "stat-line");
  statLine.append(
    el("strong", "attack", String(offer.attack)),
    el("span", "", "攻击"),
    el("strong", "health", String(offer.health)),
    el("span", "", "生命")
  );
  card.append(statLine);
  card.append(el("p", "ability", offer.ability));

  const actions = el("div", "card-actions");
  const cannotFit =
    game.state.teamSize >= game.state.maxTeamSize &&
    offer.duplicateUids.length === 0;
  actions.append(
    button(
      offer.duplicateUids.length ? `购买并合并` : "购买",
      "mini-button",
      () => buyPetOffer(offer),
      {
        disabled:
          game.state.phase === "gameOver" ||
          game.state.gold < offer.cost ||
          cannotFit
      }
    ),
    button(
      offer.frozen ? "解冻" : "冻结",
      "mini-button",
      () =>
        performAction(
          { type: "freeze", kind: "pet", slot: offer.slot },
          offer.frozen ? "已解冻宠物。" : "已冻结宠物。"
        )
    )
  );
  card.append(actions);
  return card;
}

function buyPetOffer(offer) {
  if (offer.duplicateUids.length > 1) {
    pendingPurchase = {
      slot: offer.slot,
      duplicates: offer.duplicateUids
    };
    selectedUid = null;
    pendingMergeSource = null;
    renderTeam();
    showNotice("有多只同名宠物，请点击要合并到的队伍宠物。");
    return;
  }
  performAction(
    {
      type: "buyPet",
      slot: offer.slot,
      ...(offer.duplicateUids.length === 1
        ? { targetUid: offer.duplicateUids[0] }
        : {})
    },
    offer.duplicateUids.length ? "宠物已购买并合并。" : "宠物已购买。"
  );
}

function renderFoodOffer(offer) {
  const card = el("article", "shop-card food");
  const header = el("div", "shop-card-header");
  const title = el("div");
  title.append(el("h4", "", offer.nameZh));
  title.append(el("span", "pet-name-en", offer.name));
  header.append(title, el("span", "price", `${offer.cost} 金`));
  card.append(header);
  const meta = el("div", "pet-meta");
  if (offer.tier !== null) meta.append(el("span", "pill", `${offer.tier} 阶`));
  if (offer.generated) meta.append(el("span", "pill", "生成食物"));
  if (offer.frozen) meta.append(el("span", "pill", "已冻结"));
  meta.append(
    el(
      "span",
      "pill",
      offer.targetMode === "single"
        ? "单体目标"
        : offer.targetMode === "random"
          ? "随机目标"
          : "无需目标"
    )
  );
  card.append(meta);
  card.append(el("p", "ability", offer.text));

  const actions = el("div", "card-actions");
  actions.append(
    button(
      offer.targetMode === "single" ? "喂给已选宠物" : "购买并使用",
      "mini-button",
      () => buyFoodOffer(offer),
      {
        disabled:
          game.state.phase === "gameOver" ||
          game.state.gold < offer.cost ||
          game.state.teamSize === 0
      }
    ),
    button(
      offer.frozen ? "解冻" : "冻结",
      "mini-button",
      () =>
        performAction(
          { type: "freeze", kind: "food", slot: offer.slot },
          offer.frozen ? "已解冻食物。" : "已冻结食物。"
        )
    )
  );
  card.append(actions);
  return card;
}

function buyFoodOffer(offer) {
  if (offer.targetMode === "single" && !selectedUid) {
    showNotice("请先点击队伍中的一个宠物，再购买该食物。", "error");
    return;
  }
  performAction(
    {
      type: "buyFood",
      slot: offer.slot,
      ...(offer.targetMode === "single" ? { targetUid: selectedUid } : {})
    },
    `${offer.nameZh} 已使用。`
  );
}

function renderRewards() {
  refs.rewardShop.replaceChildren();
  refs.rewardSection.classList.toggle("hidden", game.state.rewards.length === 0);
  for (const group of game.state.rewards) {
    const wrapper = el("div", "reward-group");
    const pair = el("div", "reward-pair");
    for (const offer of group.offers) {
      const card = el("article", "shop-card");
      const header = el("div", "shop-card-header");
      const title = el("div");
      title.append(el("h4", "", offer.nameZh));
      title.append(el("span", "pet-name-en", offer.name));
      header.append(title, el("span", "price", `${offer.cost} 金`));
      card.append(header);
      const meta = el("div", "pet-meta");
      meta.append(el("span", "pill", `${offer.tier} 阶`));
      card.append(meta);
      const statLine = el("div", "stat-line");
      statLine.append(
        el("strong", "attack", String(offer.attack)),
        el("span", "", "攻击"),
        el("strong", "health", String(offer.health)),
        el("span", "", "生命")
      );
      card.append(statLine);
      card.append(el("p", "ability", offer.ability));
      const actions = el("div", "card-actions");
      const cannotFit =
        game.state.teamSize >= game.state.maxTeamSize &&
        offer.duplicateUids.length === 0;
      actions.append(
        button("选择奖励", "mini-button", () => buyReward(offer), {
          disabled:
            game.state.phase === "gameOver" ||
            game.state.gold < offer.cost ||
            cannotFit
        })
      );
      card.append(actions);
      pair.append(card);
    }
    wrapper.append(pair);
    refs.rewardShop.append(wrapper);
  }
}

function buyReward(offer) {
  if (offer.duplicateUids.length > 1) {
    pendingPurchase = {
      rewardIndex: offer.rewardIndex,
      duplicates: offer.duplicateUids
    };
    selectedUid = null;
    renderTeam();
    showNotice("有多只同名宠物，请点击要合并到的队伍宠物。");
    return;
  }
  performAction(
    {
      type: "buyPet",
      rewardIndex: offer.rewardIndex,
      ...(offer.duplicateUids.length === 1
        ? { targetUid: offer.duplicateUids[0] }
        : {})
    },
    "升级奖励已选择。"
  );
}

function renderLog() {
  refs.recentLog.replaceChildren();
  const lines = game.state.recentLog.slice(-30);
  for (const line of lines) refs.recentLog.append(el("li", "", line));
  if (lines.length === 0) refs.recentLog.append(el("li", "muted", "暂无日志"));
}

function openPlainBattleLog(lines) {
  clearTimeout(battleTimer);
  battlePlayback = null;
  refs.playerBattleTeam.replaceChildren();
  refs.enemyBattleTeam.replaceChildren();
  refs.battleResult.className = "battle-result";
  refs.battleResult.textContent = "暂无结构化战斗回放";
  refs.battleTitle.textContent = "战斗报告";
  refs.battleLog.replaceChildren();
  const items = lines.length
    ? lines
    : game?.state.recentLog.filter((line) => line.includes("战斗")) ?? [];
  for (const line of items) refs.battleLog.append(el("li", "", line));
  if (items.length === 0) {
    refs.battleLog.append(el("li", "muted", "暂无战斗记录"));
  }
  if (!refs.battleDialog.open) refs.battleDialog.showModal();
}

function outcomeLabel(outcome) {
  return outcome === "win" ? "胜利" : outcome === "loss" ? "失败" : "平局";
}

function createBattlePetCard(pet, side) {
  const card = el("article", "battle-pet");
  card.dataset.uid = pet.uid;
  card.dataset.nameZh = pet.nameZh;
  const title = el("h4", "", pet.nameZh);
  const english = el("span", "battle-pet-en", pet.name);
  const meta = el(
    "span",
    "battle-pet-en",
    `${pet.tier} 阶 · Lv.${pet.level}`
  );
  const stats = el("div", "battle-pet-stats");
  const attack = el("span", "attack", String(pet.attack));
  const health = el("span", "health", String(pet.health));
  stats.append(attack, el("span", "", "/"), health);
  const ability = el("div", "battle-pet-ability", pet.ability || "无技能");
  ability.title = pet.ability || "无技能";
  const perks = el(
    "div",
    "battle-perks",
    pet.perks?.length ? pet.perks.join(" · ") : ""
  );
  card.append(title, english, meta, stats, ability, perks);
  card.dataset.side = side;
  battleCards.set(pet.uid, card);
  battleStats.set(pet.uid, {
    attack: pet.attack,
    health: pet.health,
    alive: true
  });
  return card;
}

function fillBattleTeam(container, team, side) {
  container.replaceChildren();
  team.forEach((pet) => container.append(createBattlePetCard(pet, side)));
  for (let index = team.length; index < 5; index++) {
    container.append(el("div", "battle-pet empty", "空"));
  }
}

function resetBattleTheater(replay) {
  clearTimeout(battleTimer);
  attackVisualToken++;
  battleCards.clear();
  battleStats.clear();
  refs.battleResult.className = "battle-result";
  refs.battleResult.textContent =
    game?.state.phase === "gameOver"
      ? `第 ${replay.turn} 回合 · 本局最终战斗`
      : `第 ${replay.turn} 回合 · 准备战斗`;
  refs.battleTitle.textContent =
    game?.state.phase === "gameOver"
      ? `第 ${replay.turn} 回合 · 最终战斗`
      : `第 ${replay.turn} 回合战斗回放`;
  fillBattleTeam(refs.enemyBattleTeam, replay.enemyTeam, "enemy");
  fillBattleTeam(refs.playerBattleTeam, replay.playerTeam, "player");
  refs.attackEffect.textContent = "";
  refs.battleLog.replaceChildren();
  refs.battleFeed.textContent = "战斗开始：观察双方出手顺序与目标。";
  refs.battleProgress.max = Math.max(1, replay.events.length);
  refs.battleProgress.value = 0;
  refs.battleStep.textContent = `0 / ${replay.events.length}`;
  refs.battlePlay.textContent = "暂停";
  refs.battlePlay.disabled = replay.events.length === 0;
  refs.battleLine.classList.remove("active");
  refs.battleLine.removeAttribute("x1");
  refs.battleLine.removeAttribute("y1");
  refs.battleLine.removeAttribute("x2");
  refs.battleLine.removeAttribute("y2");
}

function clearAttackVisuals() {
  refs.battleLine.classList.remove("active");
  refs.battleDialog.querySelectorAll(".battle-pet.attacking, .battle-pet.targeted")
    .forEach((card) => card.classList.remove("attacking", "targeted"));
  refs.battleDialog.querySelector(".battle-arena")?.classList.remove("striking");
}

function updateBattleCard(uid) {
  const values = battleStats.get(uid);
  const card = battleCards.get(uid);
  if (!values || !card) return;
  card.querySelector(".attack").textContent = String(values.attack);
  card.querySelector(".health").textContent = String(Math.max(0, values.health));
}

function floatDamage(uid, amount) {
  const card = battleCards.get(uid);
  if (!card) return;
  const floating = el("span", "damage-float", `-${amount}`);
  card.append(floating);
  setTimeout(() => floating.remove(), 650);
}

function flashClass(uid, className, duration = 260) {
  const card = battleCards.get(uid);
  if (!card) return;
  card.classList.add(className);
  setTimeout(() => card.classList.remove(className), duration);
}

function drawAttackArrow(actorUid, targetUid) {
  const actor = battleCards.get(actorUid);
  const target = battleCards.get(targetUid);
  const arena = refs.battleDialog.querySelector(".battle-arena");
  if (!actor || !target || !arena) return;
  clearAttackVisuals();
  const token = ++attackVisualToken;
  const arenaRect = arena.getBoundingClientRect();
  const actorRect = actor.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const startX = actorRect.left - arenaRect.left + actorRect.width / 2;
  const startY = actorRect.top - arenaRect.top + actorRect.height / 2;
  const endX = targetRect.left - arenaRect.left + targetRect.width / 2;
  const endY = targetRect.top - arenaRect.top + targetRect.height / 2;
  refs.battleLines.setAttribute(
    "viewBox",
    `0 0 ${Math.max(1, arenaRect.width)} ${Math.max(1, arenaRect.height)}`
  );
  refs.battleLine.setAttribute("x1", String(startX));
  refs.battleLine.setAttribute("y1", String(startY));
  refs.battleLine.setAttribute("x2", String(endX));
  refs.battleLine.setAttribute("y2", String(endY));
  refs.battleLine.classList.remove("active");
  void refs.battleLine.getBoundingClientRect();
  refs.battleLine.classList.add("active");
  arena.classList.add("striking");
  actor.classList.add("attacking");
  target.classList.add("targeted");
  setTimeout(() => {
    if (token !== attackVisualToken) return;
    refs.battleLine.classList.remove("active");
    arena.classList.remove("striking");
    actor.classList.remove("attacking");
    target.classList.remove("targeted");
  }, 1150);
}

function formatBattleUnit(unit) {
  const perks = unit.perks?.length ? ` [${unit.perks.join(",")}]` : "";
  return `${unit.position}.${unit.nameZh} L${unit.level} ${unit.attack}/${unit.health}${perks}`;
}

function formatBattleState(state) {
  if (!state?.units?.length) return "旧回放没有逐事件状态快照";
  const units = [...state.units].sort(
    (a, b) => a.position - b.position
  );
  const player = units
    .filter((unit) => unit.side === "player" && unit.status === "active")
    .map(formatBattleUnit);
  const enemy = units
    .filter((unit) => unit.side === "enemy" && unit.status === "active")
    .map(formatBattleUnit);
  const fainted = units
    .filter((unit) => unit.status === "fainted")
    .map((unit) => `${unit.side === "player" ? "我方" : "敌方"} ${unit.nameZh}`);
  const swallowed = units
    .filter((unit) => unit.status === "swallowed")
    .map((unit) => `${unit.nameZh} 被吞`);
  return [
    `你：${player.join("；") || "无"}`,
    `敌：${enemy.join("；") || "无"}`,
    fainted.length ? `倒下：${fainted.join("、")}` : "",
    swallowed.length ? `吞下：${swallowed.join("、")}` : ""
  ]
    .filter(Boolean)
    .join(" ｜ ");
}

function appendBattleFeed(message, state) {
  const item = el("div", "", message);
  refs.battleFeed.append(item);
  while (refs.battleFeed.children.length > 3) {
    refs.battleFeed.firstElementChild.remove();
  }
  const logItem = el("li");
  logItem.append(el("div", "", message));
  logItem.append(el("div", "log-state", formatBattleState(state)));
  refs.battleLog.append(logItem);
  refs.battleLog.scrollTop = refs.battleLog.scrollHeight;
}

function applyBattleEvent(event) {
  if (event.type === "attack" && event.actorUid) {
    const targetUid = event.targetUids[0];
    const actorCard = battleCards.get(event.actorUid);
    const targetCard = battleCards.get(targetUid);
    if (targetUid) {
      drawAttackArrow(event.actorUid, targetUid);
    } else {
      clearAttackVisuals();
      flashClass(event.actorUid, "attacking", 300);
    }
    refs.attackEffect.textContent =
      `${actorCard?.dataset.nameZh ?? "宠物"} → ${targetCard?.dataset.nameZh ?? "目标"} · ${event.values?.attack ?? ""} 伤害`;
    refs.attackEffect.classList.remove("striking");
    void refs.attackEffect.offsetWidth;
    refs.attackEffect.classList.add("striking");
  }

  if (event.type === "damage") {
    const targetUid = event.targetUids[0];
    const damage = Number(event.values?.damage ?? 0);
    const health = Number(event.values?.health ?? 0);
    const sourceCard = event.actorUid
      ? battleCards.get(event.actorUid)
      : null;
    const targetCard = battleCards.get(targetUid);
    if (event.actorUid && targetUid) {
      drawAttackArrow(event.actorUid, targetUid);
      refs.attackEffect.textContent =
        `${sourceCard?.dataset.nameZh ?? "效果"} → ${targetCard?.dataset.nameZh ?? "目标"} · ${damage} 伤害`;
    }
    const stats = battleStats.get(targetUid);
    if (stats) {
      stats.health = health;
      updateBattleCard(targetUid);
    }
    flashClass(targetUid, "hit", 250);
    floatDamage(targetUid, damage);
  }

  if (event.type === "buff") {
    const targetUid = event.targetUids[0];
    const stats = battleStats.get(targetUid);
    if (stats) {
      stats.attack += Number(event.values?.attack ?? 0);
      stats.health += Number(event.values?.health ?? 0);
      updateBattleCard(targetUid);
    }
    flashClass(targetUid, "buffed", 380);
  }

  if (event.type === "faint") {
    const uid = event.actorUid;
    const stats = battleStats.get(uid);
    const card = battleCards.get(uid);
    if (stats) {
      stats.health = 0;
      stats.alive = false;
      updateBattleCard(uid);
    }
    if (card) card.classList.add("fainted");
  }

  if (event.type === "summon" && event.summoned) {
    const side =
      event.side ?? (event.summoned.uid.startsWith("enemy:") ? "enemy" : "player");
    const container =
      side === "enemy" ? refs.enemyBattleTeam : refs.playerBattleTeam;
    const empty = container.querySelector(".battle-pet.empty");
    const card = createBattlePetCard(event.summoned, side);
    card.classList.add("summoned");
    if (empty) empty.replaceWith(card);
    else container.append(card);
  }

  if (event.type === "battleEnd") {
    const outcome =
      battlePlayback?.replay.outcome ??
      game?.state.lastBattleOutcome ??
      "draw";
    refs.battleResult.className = `battle-result ${outcome}`;
    const survivors =
      event.values?.playerSurvivors !== undefined
        ? ` · 你方存活 ${event.values.playerSurvivors}，对手存活 ${event.values.enemySurvivors}`
        : "";
    refs.battleResult.textContent =
      `${outcomeLabel(outcome)}${survivors}`;
    refs.battlePlay.textContent = "已结束";
    refs.battlePlay.disabled = true;
    if (game?.state.phase === "gameOver") {
      refs.battleResult.textContent += " · 本局结束";
      scheduleGameOver(1300);
    }
  }

  if (event.type !== "attack") {
    refs.attackEffect.textContent =
      event.type === "faint" ? "倒下" : event.type === "summon" ? "召唤" : "";
  }
  appendBattleFeed(event.message, event.state);
}

function scheduleNextBattleEvent(delay) {
  clearTimeout(battleTimer);
  if (!battlePlayback || battlePlayback.paused) return;
  if (battlePlayback.index >= battlePlayback.replay.events.length) return;
  battleTimer = setTimeout(() => {
    if (!battlePlayback || battlePlayback.paused) return;
    const event = battlePlayback.replay.events[battlePlayback.index];
    applyBattleEvent(event);
    battlePlayback.index++;
    refs.battleProgress.value = battlePlayback.index;
    refs.battleStep.textContent =
      `${battlePlayback.index} / ${battlePlayback.replay.events.length}`;
    scheduleNextBattleEvent(battlePlayback.speed);
  }, delay);
}

function openBattleTheater(replay, autoplay = true) {
  if (!replay) {
    openPlainBattleLog(lastBattleLog);
    return;
  }
  if (refs.battleDialog.open) refs.battleDialog.close();
  resetBattleTheater(replay);
  battlePlayback = {
    replay,
    index: 0,
    paused: !autoplay,
    speed: Number(refs.battleSpeed.value)
  };
  refs.battlePlay.textContent = autoplay ? "暂停" : "播放";
  refs.battleDialog.showModal();
  if (autoplay) scheduleNextBattleEvent(380);
}

refs.rollButton.addEventListener("click", async () => {
  const data = await performAction({ type: "roll" }, "商店已刷新，消耗 1 金。");
  if (data) selectedUid = null;
});

async function endTurnFromUi() {
  const data = await performAction({ type: "end" }, "回合已结算。");
  if (data) {
    lastBattleLog = data.addedLog ?? [];
    openBattleTheater(data.view.state.lastBattleReplay);
  }
}

refs.endTurn.addEventListener("click", endTurnFromUi);
refs.endTurnTop.addEventListener("click", endTurnFromUi);

refs.newRunButton.addEventListener("click", () => {
  if (refs.gameOverDialog.open) refs.gameOverDialog.close();
  refs.seedInput.value = "";
  refs.newRunDialog.showModal();
  refs.seedInput.focus();
});

refs.confirmNewRun.addEventListener("click", async () => {
  const seed = refs.seedInput.value.trim();
  refs.newRunDialog.close();
  setBusy(true);
  try {
    const data = await api("/api/new", {
      method: "POST",
      body: JSON.stringify(seed ? { seed } : {})
    });
    game = data.view;
    selectedUid = null;
    pendingPurchase = null;
    pendingMergeSource = null;
    lastBattleLog = [];
    gameOverTimer = null;
    refs.runStatePill.classList.add("hidden");
    if (refs.gameOverDialog.open) refs.gameOverDialog.close();
    render();
    showNotice("新对局已开始。", "ok");
  } catch (error) {
    showNotice(error instanceof Error ? error.message : String(error), "error");
  } finally {
    setBusy(false);
  }
});

refs.showBattle.addEventListener("click", () => {
  openBattleTheater(game?.state.lastBattleReplay, false);
});
refs.closeBattle.addEventListener("click", () => {
  clearTimeout(battleTimer);
  refs.battleDialog.close();
  if (game?.state.phase === "gameOver") scheduleGameOver(250);
});
refs.battlePlay.addEventListener("click", () => {
  if (!battlePlayback) return;
  battlePlayback.paused = !battlePlayback.paused;
  refs.battlePlay.textContent = battlePlayback.paused ? "继续" : "暂停";
  if (!battlePlayback.paused) scheduleNextBattleEvent(120);
});
refs.battleReplay.addEventListener("click", () => {
  if (game?.state.lastBattleReplay) openBattleTheater(game.state.lastBattleReplay);
});
refs.battleSpeed.addEventListener("change", () => {
  if (battlePlayback) battlePlayback.speed = Number(refs.battleSpeed.value);
});
refs.gameOverReview.addEventListener("click", () => {
  refs.gameOverDialog.close();
  openBattleTheater(game?.state.lastBattleReplay, false);
});
refs.gameOverNew.addEventListener("click", () => {
  refs.gameOverDialog.close();
  refs.seedInput.value = "";
  refs.newRunDialog.showModal();
  refs.seedInput.focus();
});
refs.gameOverDismiss.addEventListener("click", () => {
  refs.gameOverDialog.close();
});

loadGame();
