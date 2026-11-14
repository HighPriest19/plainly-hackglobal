const SAMPLES = {
  bill: [
    "METRO WATER & POWER - STATEMENT #88412",
    "Billing Period: Oct 1 - Oct 31",
    "Total Amount Due: $84.60",
    "Auto-Pay Scheduled: November 24",
    "Notice: A seasonal tier adjustment of $4.20 is included for usage above 400 kWh.",
    "Questions? Call 1-800-555-0192 or sign in at metrowaterpower.org.",
  ].join("\n"),
  scam: [
    "USPS-ALERT: Your parcel is held at our depot due to an incomplete street address.",
    "Failure to confirm within 12 hours will return your item and incur a $14.95 storage fee.",
    "Verify delivery immediately at: http://usps-parcel-track-99.vip/pay",
  ].join("\n"),
  notice: [
    "FINAL NOTICE BEFORE COLLECTIONS - ACCOUNT #C-4092",
    "Balance Remaining: $312.00 (Out-of-network lab balance)",
    "Pursuant to Section 4B of your provider agreement, remit payment within 10 business days",
    "or request an itemized EOB review by calling the billing office at 1-888-555-0144.",
  ].join("\n"),
};

const state = {
  language: "English",
  bcp47: "en-US",
  text: "",
  imageBase64: "",
  mimeType: "",
  imagePreviewUrl: "",
  lastResult: null,
  speaking: false,
  utterance: null,
  dictating: false,
  recognition: null,
  shareBlob: null,
};

const els = {
  newDocBtn: document.getElementById("newDocBtn"),
  inputSection: document.getElementById("inputSection"),
  uploadZone: document.getElementById("uploadZone"),
  photoInput: document.getElementById("photoInput"),
  cameraInput: document.getElementById("cameraInput"),
  pickPhotoBtn: document.getElementById("pickPhotoBtn"),
  snapPhotoBtn: document.getElementById("snapPhotoBtn"),
  uploadEmpty: document.getElementById("uploadEmpty"),
  uploadPreview: document.getElementById("uploadPreview"),
  previewImg: document.getElementById("previewImg"),
  previewName: document.getElementById("previewName"),
  removePhotoBtn: document.getElementById("removePhotoBtn"),
  textInput: document.getElementById("textInput"),
  dictateBtn: document.getElementById("dictateBtn"),
  dictateLabel: document.getElementById("dictateLabel"),
  dictateStatus: document.getElementById("dictateStatus"),
  langButtons: document.getElementById("langButtons"),
  otherLang: document.getElementById("otherLang"),
  countrySelect: document.getElementById("countrySelect"),
  analyzeBtn: document.getElementById("analyzeBtn"),
  errorBanner: document.getElementById("errorBanner"),
  loadingSection: document.getElementById("loadingSection"),
  resultsSection: document.getElementById("resultsSection"),
  sourceKindLabel: document.getElementById("sourceKindLabel"),
  sourcePhotoWrap: document.getElementById("sourcePhotoWrap"),
  photoSweepStage: document.getElementById("photoSweepStage"),
  sourcePhotoImg: document.getElementById("sourcePhotoImg"),
  sourceTextWrap: document.getElementById("sourceTextWrap"),
  highlightedText: document.getElementById("highlightedText"),
  flaggedExtracts: document.getElementById("flaggedExtracts"),
  extractList: document.getElementById("extractList"),
  plainCard: document.getElementById("plainCard"),
  docTypeLabel: document.getElementById("docTypeLabel"),
  whatItWantsHeading: document.getElementById("whatItWantsHeading"),
  verdictStamp: document.getElementById("verdictStamp"),
  speakBtn: document.getElementById("speakBtn"),
  speakIconPlay: document.getElementById("speakIconPlay"),
  speakIconStop: document.getElementById("speakIconStop"),
  speakBtnText: document.getElementById("speakBtnText"),
  speechStatus: document.getElementById("speechStatus"),
  amountVal: document.getElementById("amountVal"),
  deadlineVal: document.getElementById("deadlineVal"),
  plainExplanationText: document.getElementById("plainExplanationText"),
  redFlagsList: document.getElementById("redFlagsList"),
  noFlagsNote: document.getElementById("noFlagsNote"),
  nextStepsList: document.getElementById("nextStepsList"),
  thumbUpBtn: document.getElementById("thumbUpBtn"),
  thumbDownBtn: document.getElementById("thumbDownBtn"),
  feedbackStatus: document.getElementById("feedbackStatus"),
  shareAlertBtn: document.getElementById("shareAlertBtn"),
  startOverBtn: document.getElementById("startOverBtn"),
  impactLetters: document.getElementById("impactLetters"),
  impactScams: document.getElementById("impactScams"),
  impactCountries: document.getElementById("impactCountries"),
  shareModal: document.getElementById("shareModal"),
  shareCardPreview: document.getElementById("shareCardPreview"),
  downloadCardLink: document.getElementById("downloadCardLink"),
  nativeShareBtn: document.getElementById("nativeShareBtn"),
  closeModalBtn: document.getElementById("closeModalBtn"),
};

const ANON_ID_KEY = "plainly_anon_id";
const COUNTED_COUNTRIES_KEY = "plainly_counted_countries";

function getAnonId() {
  try {
    let existing = window.localStorage.getItem(ANON_ID_KEY);
    if (existing) return existing;

    const generated =
      window.crypto && typeof window.crypto.randomUUID === "function"
        ? window.crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(ANON_ID_KEY, generated);
    return generated;
  } catch {
    return "";
  }
}

function getCountedCountries() {
  try {
    const raw = window.localStorage.getItem(COUNTED_COUNTRIES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function hasCountedCountry(country) {
  if (!country) return true;
  return getCountedCountries().includes(country);
}

function markCountryCounted(country) {
  if (!country) return;
  try {
    const list = getCountedCountries();
    if (!list.includes(country)) {
      list.push(country);
      window.localStorage.setItem(COUNTED_COUNTRIES_KEY, JSON.stringify(list));
    }
  } catch {
    // Ignore storage quota or private mode failures.
  }
}

function resetFeedbackUi() {
  els.thumbUpBtn.disabled = false;
  els.thumbDownBtn.disabled = false;
  els.thumbUpBtn.classList.remove("selected");
  els.thumbDownBtn.classList.remove("selected");
  els.thumbUpBtn.setAttribute("aria-pressed", "false");
  els.thumbDownBtn.setAttribute("aria-pressed", "false");
  els.feedbackStatus.textContent = "";
  els.feedbackStatus.classList.add("hidden");
}

async function submitFeedback(helpful) {
  els.thumbUpBtn.disabled = true;
  els.thumbDownBtn.disabled = true;

  const chosenBtn = helpful ? els.thumbUpBtn : els.thumbDownBtn;
  chosenBtn.classList.add("selected");
  chosenBtn.setAttribute("aria-pressed", "true");

  els.feedbackStatus.textContent = "Thanks for the feedback.";
  els.feedbackStatus.classList.remove("hidden");

  try {
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        helpful,
        anonId: getAnonId(),
      }),
    });
  } catch {
    // Keep confirmation visible even if network drops briefly.
  }
}

function showError(message) {
  els.errorBanner.textContent = message;
  els.errorBanner.classList.remove("hidden");
}

function clearError() {
  els.errorBanner.textContent = "";
  els.errorBanner.classList.add("hidden");
}

function stopSpeech() {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  state.speaking = false;
  state.utterance = null;
  els.speakBtn.classList.remove("playing");
  els.speakIconPlay.classList.remove("hidden");
  els.speakIconStop.classList.add("hidden");
  els.speakBtnText.textContent = "Read aloud";
  els.speechStatus.textContent = "Tap to hear this summary";
}

function setDictationUi(listening, statusMessage) {
  state.dictating = listening;
  els.dictateBtn.classList.toggle("listening", listening);
  els.dictateBtn.setAttribute("aria-pressed", String(listening));
  els.dictateLabel.textContent = listening ? "Stop" : "Dictate";

  if (statusMessage) {
    els.dictateStatus.textContent = statusMessage;
    els.dictateStatus.classList.remove("hidden");
  } else {
    els.dictateStatus.textContent = "";
    els.dictateStatus.classList.add("hidden");
  }
}

function stopDictation() {
  if (state.recognition && state.dictating) {
    try {
      state.recognition.stop();
    } catch {
      // Ignore if recognition already stopped.
    }
  }
  setDictationUi(false, "");
}

function initDictation() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) {
    els.dictateBtn.classList.add("hidden");
    return;
  }

  els.dictateBtn.classList.remove("hidden");

  const recognition = new SpeechRec();
  recognition.continuous = true;
  recognition.interimResults = false;
  state.recognition = recognition;

  recognition.onresult = (event) => {
    let spoken = "";
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      if (event.results[i].isFinal) {
        spoken += event.results[i][0].transcript + " ";
      }
    }
    const clean = spoken.trim();
    if (!clean) return;
    const existing = els.textInput.value.trim();
    els.textInput.value = existing ? `${existing} ${clean}` : clean;
  };

  recognition.onerror = (event) => {
    const msg =
      event.error === "not-allowed"
        ? "Microphone access was blocked in your browser."
        : "Could not hear voice input. Try typing or pasting instead.";
    setDictationUi(false, msg);
  };

  recognition.onend = () => {
    if (state.dictating) {
      setDictationUi(false, "");
    }
  };

  els.dictateBtn.addEventListener("click", () => {
    if (state.dictating) {
      stopDictation();
      return;
    }
    clearError();
    recognition.lang = state.bcp47 || "en-US";
    try {
      setDictationUi(true, `Listening in ${state.language}... tap Stop when done.`);
      recognition.start();
    } catch {
      setDictationUi(false, "Could not start microphone right now.");
    }
  });
}

async function refreshImpactStats() {
  try {
    const res = await fetch("/api/impact");
    if (!res.ok) return;
    const stats = await res.json();
    els.impactLetters.textContent = Number(stats.lettersExplained || 0).toLocaleString();
    els.impactScams.textContent = Number(stats.scamsFlagged || 0).toLocaleString();
    els.impactCountries.textContent = Number(stats.countriesReached || 0).toLocaleString();
  } catch {
    // Keep existing numbers if network request fails.
  }
}

function resetWorkspace() {
  stopSpeech();
  stopDictation();
  clearError();
  resetFeedbackUi();
  state.lastResult = null;
  els.loadingSection.classList.add("hidden");
  els.resultsSection.classList.add("hidden");
  els.inputSection.classList.remove("hidden");
  els.plainCard.classList.remove("slide-in");
  els.verdictStamp.classList.remove("thud");
  els.photoSweepStage.classList.remove("animate");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function clearPhoto() {
  state.imageBase64 = "";
  state.mimeType = "";
  state.imagePreviewUrl = "";
  els.photoInput.value = "";
  els.cameraInput.value = "";
  els.previewImg.removeAttribute("src");
  els.uploadPreview.classList.add("hidden");
  els.uploadEmpty.classList.remove("hidden");
}

function isImageFile(file) {
  if (!file) return false;
  if (file.type && file.type.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(file.name || "");
}

function isTextFile(file) {
  if (!file) return false;
  if (file.type === "text/plain") return true;
  return /\.txt$/i.test(file.name || "");
}

// Shrink large camera photos on a canvas so uploads stay fast on slow connections.
function compressImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that image file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That file format could not be previewed. Please use JPG, PNG, or WebP."));
      img.onload = () => {
        const maxSide = 1400;
        let width = img.width;
        let height = img.height;

        if (width > maxSide || height > maxSide) {
          const ratio = Math.min(maxSide / width, maxSide / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        // Fill white before drawing so transparent PNG screenshots do not turn black.
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        const base64 = dataUrl.split(",")[1];
        resolve({ base64, mimeType: "image/jpeg", dataUrl });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function handleFileSelected(file) {
  if (!file) return;

  if (isTextFile(file)) {
    clearError();
    clearPhoto();
    const content = await file.text();
    els.textInput.value = content.slice(0, 15000);
    els.textInput.focus();
    return;
  }

  if (!isImageFile(file)) {
    showError("Please pick a JPG, PNG, WebP photo, or a .txt file.");
    return;
  }

  clearError();
  try {
    const compressed = await compressImageFile(file);
    state.imageBase64 = compressed.base64;
    state.mimeType = compressed.mimeType;
    state.imagePreviewUrl = compressed.dataUrl;

    els.previewImg.src = compressed.dataUrl;
    els.previewName.textContent = file.name || "document.jpg";
    els.uploadEmpty.classList.add("hidden");
    els.uploadPreview.classList.remove("hidden");
  } catch (err) {
    showError(err.message || "Could not load that image.");
  }
}

function selectLanguageButton(lang, bcp47, isPreset) {
  state.language = lang;
  state.bcp47 = bcp47;

  const buttons = els.langButtons.querySelectorAll(".seg-btn");
  buttons.forEach((btn) => {
    btn.classList.toggle("active", isPreset && btn.dataset.lang === lang);
  });

  if (isPreset) {
    els.otherLang.value = "";
  }
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Safely wrap matching confusing phrases in <mark class="hl-sweep"> without using innerHTML.
function renderHighlightedText(container, fullText, phrases) {
  container.textContent = "";
  const cleanPhrases = (phrases || [])
    .map((p) => p.trim())
    .filter((p) => p.length >= 3);

  if (cleanPhrases.length === 0) {
    container.textContent = fullText;
    return [];
  }

  const matches = [];
  const matchedPhrases = new Set();

  for (const phrase of cleanPhrases) {
    const pattern = phrase.split(/\s+/).map(escapeRegExp).join("\\s+");
    const regex = new RegExp(pattern, "i");
    const found = regex.exec(fullText);
    if (found) {
      matches.push({ start: found.index, end: found.index + found[0].length, phrase });
    }
  }

  matches.sort((a, b) => a.start - b.start);

  // Merge or drop overlapping ranges so every character renders once.
  const nonOverlapping = [];
  let cursor = 0;
  for (const m of matches) {
    if (m.start >= cursor) {
      nonOverlapping.push(m);
      matchedPhrases.add(m.phrase);
      cursor = m.end;
    }
  }

  let pos = 0;
  nonOverlapping.forEach((m, index) => {
    if (m.start > pos) {
      container.appendChild(document.createTextNode(fullText.slice(pos, m.start)));
    }
    const mark = document.createElement("mark");
    mark.className = "hl-sweep";
    mark.style.animationDelay = `${index * 140}ms`;
    mark.textContent = fullText.slice(m.start, m.end);
    container.appendChild(mark);
    pos = m.end;
  });

  if (pos < fullText.length) {
    container.appendChild(document.createTextNode(fullText.slice(pos)));
  }

  return cleanPhrases.filter((p) => !matchedPhrases.has(p));
}

function getStampLabel(risk) {
  if (risk === "safe") return "SAFE";
  if (risk === "likely_scam") return "LIKELY SCAM";
  return "SUSPICIOUS";
}

function renderResults(result, originalText) {
  state.lastResult = result;

  // Populate left-hand source paper card.
  if (state.imagePreviewUrl) {
    els.sourcePhotoImg.src = state.imagePreviewUrl;
    els.sourcePhotoWrap.classList.remove("hidden");
    els.sourceKindLabel.textContent = originalText ? "PHOTO + TEXT" : "PHOTO";
    els.photoSweepStage.classList.remove("animate");
    void els.photoSweepStage.offsetWidth;
    els.photoSweepStage.classList.add("animate");
  } else {
    els.sourcePhotoWrap.classList.add("hidden");
    els.sourceKindLabel.textContent = "TEXT";
  }

  let unhighlightedPhrases = result.confusingPhrases || [];
  if (originalText) {
    unhighlightedPhrases = renderHighlightedText(
      els.highlightedText,
      originalText,
      result.confusingPhrases
    );
    els.sourceTextWrap.classList.remove("hidden");
  } else {
    els.sourceTextWrap.classList.add("hidden");
  }

  els.extractList.textContent = "";
  if (unhighlightedPhrases.length > 0) {
    unhighlightedPhrases.forEach((phrase, index) => {
      const li = document.createElement("li");
      const mark = document.createElement("mark");
      mark.className = "hl-sweep";
      mark.style.animationDelay = `${index * 160}ms`;
      mark.textContent = `"${phrase}"`;
      li.appendChild(mark);
      els.extractList.appendChild(li);
    });
    els.flaggedExtracts.classList.remove("hidden");
  } else {
    els.flaggedExtracts.classList.add("hidden");
  }

  // Populate right-hand plain explanation card.
  els.docTypeLabel.textContent = (result.documentType || "DOCUMENT").toUpperCase();
  els.whatItWantsHeading.textContent = result.whatItWants;
  els.amountVal.textContent = result.amount || "None stated";
  els.deadlineVal.textContent = result.deadline || "None stated";
  els.plainExplanationText.textContent = result.plainExplanation;

  const stamp = els.verdictStamp;
  stamp.textContent = getStampLabel(result.scamRisk);
  stamp.className = `rubber-stamp ${result.scamRisk}`;

  els.redFlagsList.textContent = "";
  if (result.redFlags && result.redFlags.length > 0) {
    result.redFlags.forEach((flag) => {
      const li = document.createElement("li");
      li.textContent = flag;
      els.redFlagsList.appendChild(li);
    });
    els.redFlagsList.classList.remove("hidden");
    els.noFlagsNote.classList.add("hidden");
  } else {
    els.redFlagsList.classList.add("hidden");
    els.noFlagsNote.classList.remove("hidden");
  }

  els.nextStepsList.textContent = "";
  (result.nextSteps || []).forEach((step) => {
    const li = document.createElement("li");
    li.textContent = step;
    els.nextStepsList.appendChild(li);
  });

  resetFeedbackUi();

  // Trigger slide-in and stamp thud animations cleanly.
  els.loadingSection.classList.add("hidden");
  els.resultsSection.classList.remove("hidden");
  els.plainCard.classList.remove("slide-in");
  void els.plainCard.offsetWidth;
  els.plainCard.classList.add("slide-in");
  stamp.classList.add("thud");

  // Scroll once after layout updates so the reader starts at the top of the result, below the sticky header.
  requestAnimationFrame(() => {
    const headerOffset = 74;
    const top = Math.max(0, els.resultsSection.getBoundingClientRect().top + window.scrollY - headerOffset);
    window.scrollTo({ top, behavior: "smooth" });
  });
}

async function analyzeDocument() {
  stopSpeech();
  stopDictation();
  clearError();

  const text = els.textInput.value.trim();
  if (!text && !state.imageBase64) {
    showError("Upload a photo or paste some text first.");
    return;
  }

  els.inputSection.classList.add("hidden");
  els.resultsSection.classList.add("hidden");
  els.loadingSection.classList.remove("hidden");

  const selectedCountry = els.countrySelect.value;
  const anonId = getAnonId();
  const countCountryUser = selectedCountry ? !hasCountedCountry(selectedCountry) : false;

  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        imageBase64: state.imageBase64,
        mimeType: state.mimeType,
        language: state.language,
        country: selectedCountry,
        anonId,
        countCountryUser,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Could not read this document.");
    }

    if (selectedCountry) {
      markCountryCounted(selectedCountry);
    }

    renderResults(data, text);
    refreshImpactStats();
  } catch (err) {
    els.loadingSection.classList.add("hidden");
    els.inputSection.classList.remove("hidden");
    showError(err.message || "Something went wrong. Please try again.");
  }
}

function toggleSpeech() {
  if (!state.lastResult) return;

  if (!("speechSynthesis" in window)) {
    els.speechStatus.textContent = "Audio playback is not supported in this browser.";
    return;
  }

  if (state.speaking) {
    stopSpeech();
    return;
  }

  window.speechSynthesis.cancel();

  const parts = [
    state.lastResult.whatItWants,
    state.lastResult.plainExplanation,
    ...(state.lastResult.nextSteps || []),
  ].filter(Boolean);

  const utterance = new SpeechSynthesisUtterance(parts.join(". "));
  utterance.lang = state.bcp47;
  utterance.rate = 0.96;

  // Match a browser voice for the selected language when available.
  const voices = window.speechSynthesis.getVoices();
  const langPrefix = state.bcp47.split("-")[0].toLowerCase();
  const matchingVoice = voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix));
  if (matchingVoice) {
    utterance.voice = matchingVoice;
  }

  utterance.onend = () => stopSpeech();
  utterance.onerror = () => stopSpeech();

  state.speaking = true;
  state.utterance = utterance;
  els.speakBtn.classList.add("playing");
  els.speakIconPlay.classList.add("hidden");
  els.speakIconStop.classList.remove("hidden");
  els.speakBtnText.textContent = "Stop reading";
  els.speechStatus.textContent = `Reading in ${state.language}...`;

  window.speechSynthesis.speak(utterance);
}

function wrapCanvasText(ctx, text, maxWidth) {
  const words = String(text || "").split(/\s+/);
  const lines = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function getRiskColor(risk) {
  if (risk === "safe") return "#15803d";
  if (risk === "likely_scam") return "#b91c1c";
  return "#b45309";
}

// Draw a self-contained alert card image on canvas so users can save or forward it.
async function buildShareCardBlob(result) {
  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Fallback fonts still draw cleanly if font loading fails.
    }
  }

  return new Promise((resolve) => {
    const width = 1080;
    const height = 1080;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    // Warm paper background and double ink border
    ctx.fillStyle = "#faf6ee";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#fffdf8";
    ctx.fillRect(44, 44, width - 88, height - 88);
    ctx.strokeStyle = "#181615";
    ctx.lineWidth = 3;
    ctx.strokeRect(44, 44, width - 88, height - 88);

    // Header
    ctx.fillStyle = "#181615";
    ctx.font = '700 46px "Fraunces", Georgia, serif';
    ctx.fillText("Plainly", 92, 118);

    ctx.fillStyle = "#5b554c";
    ctx.font = '600 20px "IBM Plex Mono", monospace';
    ctx.fillText((result.documentType || "DOCUMENT").toUpperCase().slice(0, 38), 92, 160);

    // Rubber stamp
    const stampColor = getRiskColor(result.scamRisk);
    const stampText = getStampLabel(result.scamRisk);
    ctx.save();
    ctx.translate(820, 136);
    ctx.rotate(-0.07);
    ctx.strokeStyle = stampColor;
    ctx.lineWidth = 5;
    ctx.strokeRect(-145, -40, 290, 80);
    ctx.lineWidth = 2;
    ctx.strokeRect(-137, -32, 274, 64);
    ctx.fillStyle = stampColor;
    ctx.font = '700 30px "IBM Plex Mono", monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(stampText, 0, 2);
    ctx.restore();

    // Divider
    ctx.strokeStyle = "#ddd4c3";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(92, 198);
    ctx.lineTo(width - 92, 198);
    ctx.stroke();

    // Summary headline (max 3 lines so lower sections always have room)
    ctx.fillStyle = "#181615";
    ctx.font = '700 38px "Fraunces", Georgia, serif';
    const summaryLines = wrapCanvasText(ctx, result.whatItWants, width - 184).slice(0, 3);
    let y = 264;
    for (const line of summaryLines) {
      ctx.fillText(line, 92, y);
      y += 48;
    }

    // Highlighted amount + deadline box
    y += 14;
    ctx.fillStyle = "rgba(253, 224, 71, 0.5)";
    ctx.fillRect(92, y, width - 184, 92);
    ctx.fillStyle = "#5b554c";
    ctx.font = '600 19px "IBM Plex Mono", monospace';
    ctx.fillText("AMOUNT", 120, y + 32);
    ctx.fillText("DEADLINE", 540, y + 32);
    ctx.fillStyle = "#181615";
    ctx.font = "700 26px sans-serif";
    ctx.fillText(String(result.amount || "None stated").slice(0, 22), 120, y + 70);
    ctx.fillText(String(result.deadline || "None stated").slice(0, 22), 540, y + 70);

    // Warning signs or takeaway
    y += 138;
    ctx.fillStyle = "#5b554c";
    ctx.font = '600 20px "IBM Plex Mono", monospace';
    const flags = result.redFlags || [];
    ctx.fillText(flags.length > 0 ? "WARNING SIGNS" : "PLAIN SUMMARY", 92, y);
    y += 40;

    ctx.fillStyle = flags.length > 0 ? "#b91c1c" : "#181615";
    ctx.font = "500 25px sans-serif";
    const details =
      flags.length > 0
        ? flags.slice(0, 3).map((f) => `• ${f}`)
        : wrapCanvasText(ctx, result.plainExplanation, width - 184).slice(0, 4);

    const maxContentBottom = height - 154;
    for (const item of details) {
      const wrapped = wrapCanvasText(ctx, item, width - 184).slice(0, 2);
      for (const line of wrapped) {
        if (y > maxContentBottom) break;
        ctx.fillText(line, 92, y);
        y += 36;
      }
      y += 8;
      if (y > maxContentBottom) break;
    }

    // Footer link back to the app
    ctx.strokeStyle = "#ddd4c3";
    ctx.beginPath();
    ctx.moveTo(92, height - 134);
    ctx.lineTo(width - 92, height - 134);
    ctx.stroke();

    ctx.fillStyle = "#181615";
    ctx.font = '600 20px "IBM Plex Mono", monospace';
    ctx.fillText(`Check your own letters at ${window.location.origin}`, 92, height - 88);

    canvas.toBlob((blob) => resolve({ blob, dataUrl: canvas.toDataURL("image/png") }), "image/png");
  });
}

async function openShareModal() {
  if (!state.lastResult) return;

  const { blob, dataUrl } = await buildShareCardBlob(state.lastResult);
  state.shareBlob = blob;
  els.shareCardPreview.src = dataUrl;
  els.downloadCardLink.href = dataUrl;
  els.shareModal.classList.remove("hidden");
}

function closeShareModal() {
  els.shareModal.classList.add("hidden");
}

async function shareCardNative() {
  if (!state.shareBlob) return;
  const file = new File([state.shareBlob], "plainly-alert.png", { type: "image/png" });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: "Plainly Alert",
        text: `Checked a letter on Plainly (${window.location.origin})`,
        files: [file],
      });
      return;
    } catch {
      // Fall through to link copy if user cancels or share fails.
    }
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(window.location.origin);
    els.nativeShareBtn.textContent = "Link copied";
    setTimeout(() => {
      els.nativeShareBtn.textContent = "Share";
    }, 1800);
  }
}

function bindEvents() {
  els.newDocBtn.addEventListener("click", resetWorkspace);
  els.startOverBtn.addEventListener("click", resetWorkspace);

  // Reset input value on click so selecting the same file twice still fires change.
  els.photoInput.addEventListener("click", () => {
    els.photoInput.value = "";
  });
  els.cameraInput.addEventListener("click", () => {
    els.cameraInput.value = "";
  });
  els.photoInput.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelected(file);
  });
  els.cameraInput.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelected(file);
  });

  // Keyboard support for label triggers
  [els.pickPhotoBtn, els.snapPhotoBtn].forEach((labelEl) => {
    labelEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        document.getElementById(labelEl.getAttribute("for"))?.click();
      }
    });
  });

  els.removePhotoBtn.addEventListener("click", clearPhoto);

  // Drag and drop image or text file support
  els.uploadZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    els.uploadZone.classList.add("dragover");
  });
  els.uploadZone.addEventListener("dragleave", () => {
    els.uploadZone.classList.remove("dragover");
  });
  els.uploadZone.addEventListener("drop", (e) => {
    e.preventDefault();
    els.uploadZone.classList.remove("dragover");
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFileSelected(file);
  });

  // Paste screenshot from clipboard directly into the page
  window.addEventListener("paste", (e) => {
    const items = e.clipboardData?.items || [];
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) handleFileSelected(file);
        break;
      }
    }
  });

  // Sample buttons
  document.querySelectorAll("[data-sample]").forEach((btn) => {
    btn.addEventListener("click", () => {
      clearPhoto();
      clearError();
      els.textInput.value = SAMPLES[btn.dataset.sample] || "";
      els.textInput.focus();
    });
  });

  // Language switcher
  els.langButtons.addEventListener("click", (e) => {
    const btn = e.target.closest(".seg-btn");
    if (!btn) return;
    selectLanguageButton(btn.dataset.lang, btn.dataset.bcp, true);
  });

  els.otherLang.addEventListener("change", () => {
    const val = els.otherLang.value;
    if (!val) return;
    const [lang, bcp] = val.split("|");
    selectLanguageButton(lang, bcp, false);
  });

  els.analyzeBtn.addEventListener("click", analyzeDocument);
  els.speakBtn.addEventListener("click", toggleSpeech);
  els.thumbUpBtn.addEventListener("click", () => submitFeedback(true));
  els.thumbDownBtn.addEventListener("click", () => submitFeedback(false));
  els.shareAlertBtn.addEventListener("click", openShareModal);
  els.closeModalBtn.addEventListener("click", closeShareModal);
  els.nativeShareBtn.addEventListener("click", shareCardNative);

  els.shareModal.addEventListener("click", (e) => {
    if (e.target === els.shareModal) closeShareModal();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !els.shareModal.classList.contains("hidden")) {
      closeShareModal();
    }
  });
}

initDictation();
refreshImpactStats();
bindEvents();
