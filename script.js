let CONFIG = null;

/** ===========================
 *  Google Sheets Logger (Apps Script)
 *  =========================== */
const LOGGER_URL = "https://script.google.com/macros/s/AKfycbye8iOYeb_OpNcZDXbbnViMcvArDl1kEr74MfZXarflSf2U4bcR6ltNYmq1zhl-vJphaw/exec"; // ex: https://script.google.com/macros/s/XXXX/exec
const LOGGER_ENABLED = true;

function logToSheet(eventName, data = {}) {
  if (!LOGGER_ENABLED) return;
  if (!LOGGER_URL || LOGGER_URL.includes("COLLE_ICI")) return;

  const payload = {
    eventName,
    ts: Date.now(),
    ...data,
  };

  // Fire-and-forget : on n'attend pas la réponse
  fetch(LOGGER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true, // utile quand on quitte la page (ex: redirection)
  }).catch(() => {});
}

// ===== User code & time helpers =====
function getUserCode() {
  return localStorage.getItem("userCode") || "";
}

function getUserPrefix() {
  return getUserCode().slice(0, 4).toUpperCase();
}

function getStartTime() {
  const t = Number(localStorage.getItem("startTime"));
  return Number.isFinite(t) && t > 0 ? t : null;
}

function getLastSuccessTime() {
  const t = Number(localStorage.getItem("lastSuccessTime"));
  return Number.isFinite(t) && t > 0 ? t : null;
}

function setLastSuccessTime(t) {
  localStorage.setItem("lastSuccessTime", String(t));
}

// Temps total depuis le début (en secondes)
function secondsSinceStart() {
  const start = getStartTime();
  if (!start) return null;
  return Math.floor((Date.now() - start) / 1000);
}

// Temps depuis la dernière bonne réponse (en secondes)
// On initialise lastSuccessTime = startTime au début du jeu
function secondsSinceLastSuccess() {
  const last = getLastSuccessTime();
  if (!last) return null;
  return Math.floor((Date.now() - last) / 1000);
}

// ===== UX helpers =====
function revealMessage(el) {
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
}

// ===== Modal helpers =====
function openModal({ title = "Bravo !", text = "", button = "Continuer", onContinue }) {
  const modal = document.getElementById("modal");
  const titleEl = document.getElementById("modalTitle");
  const textEl = document.getElementById("modalText");
  const btn = document.getElementById("modalBtn");
  const backdrop = document.getElementById("modalBackdrop");

  if (!modal || !btn) return;

  titleEl.textContent = title;
  textEl.textContent = text;
  btn.textContent = button;

  const close = () => {
    modal.classList.remove("modal--open");
    modal.setAttribute("aria-hidden", "true");
    btn.onclick = null;
    if (typeof onContinue === "function") onContinue();
  };

  btn.onclick = close;
  if (backdrop) backdrop.onclick = close;

  modal.classList.add("modal--open");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  const modal = document.getElementById("modal");
  if (!modal) return;
  modal.classList.remove("modal--open");
  modal.setAttribute("aria-hidden", "true");
}

// ===== Analytics (Umami + fallback) =====
function track(eventName, data = {}) {
  // 1) Logger Google Sheet (mêmes données que Umami)
  logToSheet(eventName, data);

  try {
    // API fréquente : umami.track(...)
    if (window.umami && typeof window.umami.track === "function") {
      window.umami.track(eventName, data);
      return;
    }
    // Variante : umami est une fonction
    if (typeof window.umami === "function") {
      window.umami(eventName, data);
      return;
    }
    // Umami bloqué / pas chargé
    console.log("[track]", eventName, data);
  } catch (e) {
    console.warn("[track][error]", eventName, data, e);
  }
}

// Petit helper : données communes
function baseTrackData(extra = {}) {
  const userCode = getUserCode();
  const prefix = getUserPrefix();
  const tStart = secondsSinceStart();
  return {
    userCode,
    prefix,
    secondsSinceStart: tStart,
    ...extra,
  };
}

// ===== Navigation =====
function showScreen(screenId) {
  const screens = document.querySelectorAll(".screen");
  let found = false;

  screens.forEach((screen) => {
    const isTarget = screen.id === screenId;

    // 1) classe (optionnel, mais pratique)
    screen.classList.toggle("screen--active", isTarget);

    // 2) hidden (béton : garantit un seul écran visible)
    if (isTarget) {
      screen.removeAttribute("hidden");
      found = true;
    } else {
      screen.setAttribute("hidden", "");
    }
  });

  if (!found) console.warn(`Écran introuvable : ${screenId}`);

  track("screen_view", baseTrackData({ screen: screenId }));
}

// Splash : on passe au code dès que c'est prêt
function hideSplash() {
  const splash = document.getElementById("screen-splash");
  if (splash) splash.setAttribute("hidden", "");
  showScreen("screen-code");
}

// ===== Config =====
async function loadConfig() {
  const res = await fetch("./config.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Impossible de charger config.json");
  return res.json();
}

// ===== Texts from JSON =====
function applyTexts() {
  const t = CONFIG?.texts || {};

  // Écran code
  const tCodeTitle = document.getElementById("tCodeTitle");
  if (tCodeTitle && t.codeTitle) tCodeTitle.textContent = t.codeTitle;

  const tCodeSubtitle = document.getElementById("tCodeSubtitle");
  if (tCodeSubtitle && t.codeSubtitle) tCodeSubtitle.textContent = t.codeSubtitle;

  // Instructions
  const tInstructionsTitle = document.getElementById("tInstructionsTitle");
  if (tInstructionsTitle && t.instructionsTitle) tInstructionsTitle.textContent = t.instructionsTitle;

  // Score
  const tScoreTitle = document.getElementById("tScoreTitle");
  if (tScoreTitle && t.scoreTitle) tScoreTitle.textContent = t.scoreTitle;

  const tScoreTimeLabel = document.getElementById("tScoreTimeLabel");
  if (tScoreTimeLabel && t.scoreTimeLabel) tScoreTimeLabel.textContent = t.scoreTimeLabel;

  const tScoreErrorsLabel = document.getElementById("tScoreErrorsLabel");
  if (tScoreErrorsLabel && t.scoreErrorsLabel) tScoreErrorsLabel.textContent = t.scoreErrorsLabel;

  const tScoreHintsLabel = document.getElementById("tScoreHintsLabel");
  if (tScoreHintsLabel && t.scoreHintsLabel) tScoreHintsLabel.textContent = t.scoreHintsLabel;
}

// ===== Score / pre & post score =====
function showScore() {
  const startTime = Number(localStorage.getItem("startTime"));
  const totalErrors = Number(localStorage.getItem("totalErrors") || "0");
  const totalHints = Number(localStorage.getItem("totalHints") || "0");

  const scoreTime = document.getElementById("scoreTime");
  if (scoreTime) {
    if (!startTime) {
      scoreTime.textContent = "—";
    } else {
      const durationMs = Date.now() - startTime;
      const seconds = Math.floor(durationMs / 1000);
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      scoreTime.textContent = `${minutes} min ${remainingSeconds} s`;
    }
  }

  const scoreErrors = document.getElementById("scoreErrors");
  if (scoreErrors) scoreErrors.textContent = String(totalErrors);

  const scoreHints = document.getElementById("scoreHints");
  if (scoreHints) scoreHints.textContent = String(totalHints);

  const totalSeconds = startTime ? Math.floor((Date.now() - startTime) / 1000) : null;

  track(
    "game_completed",
    baseTrackData({
      totalSeconds,
      errors: totalErrors,
      hints: totalHints,
    })
  );
}

function showPreScore() {
  const data = CONFIG?.preScorePage;
  if (!data) return;

  const titleEl = document.getElementById("preScoreTitle");
  const textEl = document.getElementById("preScoreText");
  const btn = document.getElementById("btnPreScore");

  if (titleEl) {
    if (data.title) {
      titleEl.textContent = data.title;
      titleEl.style.display = "block";
    } else {
      titleEl.style.display = "none";
    }
  }

  if (textEl) textEl.textContent = data.text || "";
  if (btn) btn.textContent = data.button || "Voir le score";

  if (btn) {
    btn.onclick = () => {
      showScreen("screen-score");
      showScore();
    };
  }
}

function showPostScore() {
  const data = CONFIG?.postScorePage;
  if (!data) return;

  const titleEl = document.getElementById("postScoreTitle");
  const textEl = document.getElementById("postScoreText");
  const btn = document.getElementById("btnPostScore");

  if (titleEl) {
    if (data.title) {
      titleEl.textContent = data.title;
      titleEl.style.display = "block";
    } else {
      titleEl.style.display = "none";
    }
  }

  if (textEl) textEl.textContent = data.text || "";
  if (btn) btn.textContent = data.button || "Terminer";

  if (btn) {
    btn.onclick = () => {
      const url = data.redirectUrl;
      if (!url) return;

      // 1) On track le clic (Umami + Google Sheet)
      track(
        "outbound_click",
        baseTrackData({
          target: "post_score_redirect",
          url,
        })
      );

      // 2) Puis on redirige (petit délai pour laisser partir la requête)
      setTimeout(() => {
        window.location.href = url;
      }, 250);
    };
  }
}

// ===== Riddles Enigmes =====
function initRiddle1() {
  const r1 = (CONFIG?.riddles || []).find((r) => r.id === 1);
  if (!r1) return;

  document.getElementById("r1Title").textContent = r1.title || "Énigme 1";
  document.getElementById("r1Question").textContent = r1.question || "";

  const select = document.getElementById("r1Select");
  select.querySelectorAll("option:not(:first-child)").forEach((o) => o.remove());

  (r1.options || []).forEach((opt) => {
    const o = document.createElement("option");
    o.value = opt;
    o.textContent = opt;
    select.appendChild(o);
  });

  const msg = document.getElementById("r1Message");
  const btnContinue = document.getElementById("btnR1Continue");
  if (btnContinue) btnContinue.style.display = "none";
  if (msg) msg.textContent = "";

  document.getElementById("btnR1Validate").onclick = () => {
    const answer = select.value;

    if (!answer) {
      msg.textContent = "Choisissez une option.";
      revealMessage(msg);
      return;
    }

    if (answer !== r1.correct) {
      const current = Number(localStorage.getItem("totalErrors") || "0");
      localStorage.setItem("totalErrors", String(current + 1));
      msg.textContent = r1.errorText || "Incorrect.";
      revealMessage(msg);

      track("riddle_error", baseTrackData({ riddleId: 1 }));
      return;
    }

    // timing
    const now = Date.now();
    const delta = secondsSinceLastSuccess(); // start -> r1
    track(
      "riddle_success",
      baseTrackData({
        riddleId: 1,
        secondsSinceLastSuccess: delta,
      })
    );
    setLastSuccessTime(now);

    msg.textContent = "";
    if (btnContinue) btnContinue.style.display = "none";

    openModal({
      title: r1.successTitle || CONFIG?.texts?.modalSuccessTitle || "Bravo !",
      text: r1.successText || "",
      button: r1.successButton || CONFIG?.texts?.modalSuccessButton || "Continuer",
      onContinue: () => showScreen("screen-riddle2"),
    });
  };
}

function initRiddle2() {
  const r2 = (CONFIG?.riddles || []).find((r) => r.id === 2);
  if (!r2) return;

  document.getElementById("r2Title").textContent = r2.title || "Énigme 2";
  const container = document.getElementById("r2Container");
  const msg = document.getElementById("r2Message");
  const btnContinue = document.getElementById("btnR2Continue");

  container.innerHTML = "";
  msg.textContent = "";
  if (btnContinue) btnContinue.style.display = "none";

  const usedHints = new Set();

  (r2.questions || []).forEach((q, i) => {
    const block = document.createElement("div");
    block.style.marginTop = "14px";
    block.style.paddingTop = "10px";
    block.style.borderTop = "1px solid var(--border)";

    const label = document.createElement("p");
    label.style.margin = "0 0 8px";
    label.textContent = q.label || `Question ${i + 1}`;
    block.appendChild(label);

    const select = document.createElement("select");
    select.className = "input";
    select.id = `r2Select${i}`;

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "— Choisir —";
    select.appendChild(placeholder);

    (q.options || []).forEach((opt) => {
      const o = document.createElement("option");
      o.value = opt;
      o.textContent = opt;
      select.appendChild(o);
    });

    block.appendChild(select);

    const hintBtn = document.createElement("button");
    hintBtn.className = "btn";
    hintBtn.type = "button";
    hintBtn.textContent = "Indice";

    const hintText = document.createElement("p");
    hintText.className = "muted";
    hintText.style.display = "none";
    hintText.style.margin = "8px 0 0";
    hintText.textContent = q.hint || "";

    hintBtn.onclick = () => {
      hintText.style.display = hintText.style.display === "none" ? "block" : "none";
      if (!usedHints.has(i)) {
        usedHints.add(i);
        const current = Number(localStorage.getItem("totalHints") || "0");
        localStorage.setItem("totalHints", String(current + 1));

        track("hint_used", baseTrackData({ riddleId: 2, questionIndex: i }));
      }
    };

    block.appendChild(hintBtn);
    block.appendChild(hintText);

    container.appendChild(block);
  });

  document.getElementById("btnR2Validate").onclick = () => {
    const questions = r2.questions || [];
    let correctCount = 0;

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const select = document.getElementById(`r2Select${i}`);
      const answer = select ? select.value : "";
      if (answer && answer === q.correct) correctCount += 1;
    }

    if (correctCount !== questions.length) {
      const current = Number(localStorage.getItem("totalErrors") || "0");
      localStorage.setItem("totalErrors", String(current + 1));
      msg.textContent = `${r2.errorText || "Pas tout bon."} (${correctCount}/${questions.length})`;
      revealMessage(msg);

      track(
        "riddle_error",
        baseTrackData({
          riddleId: 2,
          correct: correctCount,
          total: questions.length,
        })
      );
      return;
    }

    const now = Date.now();
    const delta = secondsSinceLastSuccess(); // r1 -> r2
    track(
      "riddle_success",
      baseTrackData({
        riddleId: 2,
        secondsSinceLastSuccess: delta,
      })
    );
    setLastSuccessTime(now);

    msg.textContent = "";

    openModal({
      title: r2.successTitle || CONFIG?.texts?.modalSuccessTitle || "Bravo !",
      text: r2.successText || "",
      button: r2.successButton || CONFIG?.texts?.modalSuccessButton || "Continuer",
      onContinue: () => showScreen("screen-riddle3"),
    });
  };
}

function initRiddle3() {
  const r3 = (CONFIG?.riddles || []).find((r) => r.id === 3);
  if (!r3) return;

  document.getElementById("r3Title").textContent = r3.title || "Énigme 3";
  const container = document.getElementById("r3Container");
  const msg = document.getElementById("r3Message");
  const btnContinue = document.getElementById("btnR3Continue");

  container.innerHTML = "";
  msg.textContent = "";
  if (btnContinue) btnContinue.style.display = "none";

  (r3.questions || []).forEach((q, i) => {
    const block = document.createElement("div");
    block.style.marginTop = "14px";

    const label = document.createElement("p");
    label.style.margin = "0 0 8px";
    label.textContent = q.label || `Item ${i + 1}`;
    block.appendChild(label);

    const select = document.createElement("select");
    select.className = "input";
    select.id = `r3Select${i}`;

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "— Choisir —";
    select.appendChild(placeholder);

    (q.options || []).forEach((opt) => {
      const o = document.createElement("option");
      o.value = opt;
      o.textContent = opt;
      select.appendChild(o);
    });

    block.appendChild(select);
    container.appendChild(block);
  });

  document.getElementById("btnR3Validate").onclick = () => {
    const questions = r3.questions || [];
    let correctCount = 0;

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const select = document.getElementById(`r3Select${i}`);
      const answer = select ? select.value : "";
      if (answer && answer === q.correct) correctCount += 1;
    }

    if (correctCount !== questions.length) {
      const current = Number(localStorage.getItem("totalErrors") || "0");
      localStorage.setItem("totalErrors", String(current + 1));
      msg.textContent = `${r3.errorText || "Pas tout bon."} (${correctCount}/${questions.length})`;
      revealMessage(msg);

      track(
        "riddle_error",
        baseTrackData({
          riddleId: 3,
          correct: correctCount,
          total: questions.length,
        })
      );
      return;
    }

    const now = Date.now();
    const delta = secondsSinceLastSuccess(); // r2 -> r3
    track(
      "riddle_success",
      baseTrackData({
        riddleId: 3,
        secondsSinceLastSuccess: delta,
      })
    );
    setLastSuccessTime(now);

    msg.textContent = "";

    openModal({
      title: r3.successTitle || CONFIG?.texts?.modalSuccessTitle || "Bravo !",
      text: r3.successText || "",
      button: r3.successButton || CONFIG?.texts?.modalSuccessButton || "Continuer",
      onContinue: () => showScreen("screen-riddle4"),
    });
  };
}

function initRiddle4() {
  const r4 = (CONFIG?.riddles || []).find((r) => r.id === 4);
  if (!r4) return;

  document.getElementById("r4Title").textContent = r4.title || "Énigme 4";
  document.getElementById("r4Question").textContent = r4.question || "";

  const select = document.getElementById("r4Select");
  select.querySelectorAll("option:not(:first-child)").forEach((o) => o.remove());

  (r4.options || []).forEach((opt) => {
    const o = document.createElement("option");
    o.value = opt;
    o.textContent = opt;
    select.appendChild(o);
  });

  const msg = document.getElementById("r4Message");
  const btnContinue = document.getElementById("btnR4Continue");
  if (btnContinue) btnContinue.style.display = "none";
  msg.textContent = "";

  document.getElementById("btnR4Validate").onclick = () => {
    const answer = select.value;

    if (!answer) {
      msg.textContent = "Choisissez une option.";
      revealMessage(msg);
      return;
    }

    if (answer !== r4.correct) {
      const current = Number(localStorage.getItem("totalErrors") || "0");
      localStorage.setItem("totalErrors", String(current + 1));
      msg.textContent = r4.errorText || "Incorrect.";
      revealMessage(msg);

      track("riddle_error", baseTrackData({ riddleId: 4 }));
      return;
    }

    const now = Date.now();
    const delta = secondsSinceLastSuccess(); // r3 -> r4
    track(
      "riddle_success",
      baseTrackData({
        riddleId: 4,
        secondsSinceLastSuccess: delta,
      })
    );
    setLastSuccessTime(now);

    msg.textContent = "";

    openModal({
      title: r4.successTitle || CONFIG?.texts?.modalSuccessTitle || "Bravo !",
      text: r4.successText || "",
      button: r4.successButton || CONFIG?.texts?.modalSuccessButton || "Continuer",
      onContinue: () => showScreen("screen-riddle5"),
    });
  };
}

function initRiddle5() {
  const r5 = (CONFIG?.riddles || []).find((r) => r.id === 5);
  if (!r5) return;

  document.getElementById("r5Title").textContent = r5.title || "Énigme 5";
  document.getElementById("r5Question").textContent = r5.question || "";

  const select = document.getElementById("r5Select");
  select.querySelectorAll("option:not(:first-child)").forEach((o) => o.remove());

  (r5.options || []).forEach((opt) => {
    const o = document.createElement("option");
    o.value = opt;
    o.textContent = opt;
    select.appendChild(o);
  });

  const msg = document.getElementById("r5Message");
  const btnContinue = document.getElementById("btnR5Continue");
  if (btnContinue) btnContinue.style.display = "none";
  msg.textContent = "";

  document.getElementById("btnR5Validate").onclick = () => {
    const answer = select.value;

    if (!answer) {
      msg.textContent = "Choisissez une option.";
      revealMessage(msg);
      return;
    }

    if (answer !== r5.correct) {
      const current = Number(localStorage.getItem("totalErrors") || "0");
      localStorage.setItem("totalErrors", String(current + 1));
      msg.textContent = r5.errorText || "Incorrect.";
      revealMessage(msg);

      track("riddle_error", baseTrackData({ riddleId: 5 }));
      return;
    }

    const now = Date.now();
    const delta = secondsSinceLastSuccess(); // r4 -> r5
    track(
      "riddle_success",
      baseTrackData({
        riddleId: 5,
        secondsSinceLastSuccess: delta,
      })
    );
    setLastSuccessTime(now);

    msg.textContent = r5.successText || "Bravo !";

    // Passage direct
    showScreen("screen-preScore");
    showPreScore();
  };
}

// ===== Init UI =====
function initUI() {
  applyTexts();

  // Splash: on attend un minimum (petit fade possible), puis on passe au code
  // (la config est déjà chargée à ce stade)
  setTimeout(hideSplash, 3500);

  const instructionsText = document.getElementById("instructionsText");
  if (instructionsText) instructionsText.textContent = CONFIG?.texts?.instructions ?? "";

  document.getElementById("btnValidateCode").addEventListener("click", () => {
    const input = document.getElementById("codeInput");
    const msg = document.getElementById("codeMessage");

    const raw = (input.value || "").trim();
    const prefix = raw.slice(0, 4).toUpperCase();

    if (!prefix || prefix.length < 4 || !CONFIG.validPrefixes.includes(prefix)) {
      msg.textContent = CONFIG?.texts?.errorInvalidCode ?? "Code invalide.";
      return;
    }

    const now = Date.now();

    localStorage.setItem("userCode", raw);
    localStorage.setItem("startTime", String(now));
    localStorage.setItem("lastSuccessTime", String(now)); // IMPORTANT : start -> énigme 1
    localStorage.setItem("totalErrors", "0");
    localStorage.setItem("totalHints", "0");

    msg.textContent = CONFIG?.texts?.successCode ?? "OK";

    track(
      "code_validated",
      baseTrackData({
        // on force le code validé tel que tapé
        userCode: raw,
        prefix,
        secondsSinceStart: 0,
      })
    );

    showScreen("screen-instructions");
  });

  document.getElementById("btnToRiddle1").addEventListener("click", () => {
    showScreen("screen-riddle1");
  });

  document.getElementById("btnScoreContinue").addEventListener("click", () => {
    showScreen("screen-postScore");
    showPostScore();
  });

  initRiddle1();
  initRiddle2();
  initRiddle3();
  initRiddle4();
  initRiddle5();
}

// ===== Main =====
(async function main() {
  try {
    // On démarre toujours sur le splash
    showScreen("screen-splash");

    CONFIG = await loadConfig();
    initUI();
  } catch (e) {
    console.error(e);
    // Si config ne charge pas, on va au code quand même
    showScreen("screen-code");
  }
})();

// Debug léger (console) : Umami chargé ?
setTimeout(() => {
  const ok =
    (window.umami && typeof window.umami.track === "function") ||
    typeof window.umami === "function";
  console.log("Umami chargé ?", ok, window.umami);
}, 1500);
