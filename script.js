// =====================
// QUIZ LOGIC + SHEETS
// =====================
const quizEl = document.getElementById('quiz');
const progressEl = document.getElementById('progress-bar');
const modal = document.getElementById('notify-modal');

const WEBHOOK_TOKEN = "LSB_SUPER_SECRET_2025"; // must match Apps Script

// ---------------------
// State (for dynamic mapping to 7 outcomes)
// ---------------------
let userAnswers = [];
let currentStep = 'q1';
let provisionalType = null; // 'dry' | 'oily' | 'normal'
let hasAcne = false;
let hasScars = false;

// ---------------------
// Branching data (7-outcome flow)
// ---------------------
const quizData = {
  // Q1 — Oil return time (entry)
  q1: {
    question: "How long after cleansing in the morning do you begin to feel oily?",
    options: [
      { text: "Never / After 12+ hours", next: "q2a" }, // dryness path
      { text: "6–9 hours after", next: "q2b" },         // oil distribution path
      { text: "Immediately to 5 hours after", next: "q2b" },
    ],
  },

  // Q2a — Dryness frequency (if Q1 = Never/12+)
  q2a: {
    question: "How often does your skin feel tight, dry, or flaky?",
    options: [
      { text: "Often", next: "q3", setProvisional: "dry" },              // Provisional Dry → go acne Q
      { text: "Sometimes", next: "q3", setProvisional: "normal" },       // Provisional Normal
      { text: "Never", next: "q3", setProvisional: "normal" },           // Collapses “balanced” into Normal
    ],
  },

  // Q2b — Oil distribution (if Q1 = fast or 6–9h)
  q2b: {
    question: "Where does your skin feel oily?",
    options: [
      { text: "All over", next: "q3", setProvisional: "oily" },          // Provisional Oily
      { text: "Only some oily areas", next: "q3", setProvisional: "normal" }, // Provisional Normal
    ],
  },

  // Q3 — Breakout frequency (replaces sensitivity overlay)
  q3: {
    question: "How often do you notice new breakouts?",
    options: [
      { text: "Never", next: "compute-no-acne-result", setAcne: false },
      { text: "Monthly", next: "q4", setAcne: true },
      { text: "Weekly", next: "q4", setAcne: true },
      { text: "Daily", next: "q4", setAcne: true },
    ],
  },

  // Q4 — Acne scarring (only if acne path)
  q4: {
    question: "Do you have acne scarring?",
    options: [
      { text: "Yes", next: "q5", setScars: true }, // still ask Q5 for profiling, then finalize
      { text: "No", next: "q5", setScars: false },
    ],
  },

  // Q5 — Large pores/blackheads (profiling only, non-deciding)
  q5: {
    question: "Do you have large pores/blackheads?",
    options: [
      { text: "Yes", next: "compute-acne-mapping" },  // finalize after capturing answer
      { text: "No", next: "compute-acne-mapping" },
    ],
  },
};

// ---------------------
// Results (7 fixed outcomes)
// ---------------------
const results = {
  "result-oily": {
    label: "Oily Skin",
    recommendation: ["Ultra Gentle Cleanser", "Mandelic Serum 8%", "Hydrabalance Gel", "Moisture Balance Toner"],
  },
  "result-dry": {
    label: "Dry Skin",
    recommendation: ["Ultra Gentle Cleanser", "Cell Balm", "Cran-Peptide Cream", "Hydrabalance Gel"],
  },
  "result-normal": {
    label: "Normal Skin",
    recommendation: ["Ultra Gentle Cleanser", "Mandelic Serum 8%", "Cran-Peptide Cream", "Daily SPF-30"],
  },
  "result-acne-prone": {
    label: "Acne-Prone Skin",
    recommendation: ["Ultra Gentle Cleanser", "Mandelic Serum 8%", "Cran-Peptide Cream", "Acne Med 5%"],
  },
  "result-post-acne-scars": {
    label: "Post-Acne Scars",
    recommendation: ["Ultra Gentle Cleanser", "Mandelic Serum 8%", "Glow-Tone Serum", "Daily SPF-30"],
  },
  "result-dry-acne": {
    label: "Dry with Acne-Prone",
    recommendation: ["Ultra Gentle Cleanser", "Mandelic Serum 5%", "Cran-Peptide Cream", "Daily SPF-30"],
  },
  "result-oily-acne": {
    label: "Oily with Acne-Prone",
    recommendation: ["Ultra Gentle Cleanser", "Mandelic Serum 11%", "Hydrabalance Gel", "Acne Med 5%"],
  },
};

// ---------------------
// UTM helpers
// ---------------------
function slugify(str) {
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function withUTM(baseUrl, { source="skinquiz", medium="website", campaign="", content="" } = {}) {
  const url = baseUrl.startsWith("http")
    ? new URL(baseUrl)
    : new URL(baseUrl, window.location.origin);

  url.searchParams.set("utm_source", source);
  url.searchParams.set("utm_medium", medium);
  if (campaign) url.searchParams.set("utm_campaign", campaign);
  if (content)  url.searchParams.set("utm_content", content);
  return url.toString();
}

// ---------------------
// Product image map (add a few aliases for naming differences)
// ---------------------
const productImages = {
  "Ultra Gentle Cleanser": "images/Ultra-Gentle-Cleanser-16oz.png",
  "Hydrabalance Gel": "images/Hydra-Balance-Gel.png",
  "Cran-Peptide Cream": "images/Cran-Peptide-Cream-1.png",
  "Moisture Balance Toner": "images/Moisture-Balance-Toner.png",
  "Daily SPF 30 Lotion": "images/Daily-SPF30-Plus.png",
  "Daily SPF-30": "images/Daily-SPF30-Plus.png",         // alias
  "Mandelic Serum 5%": "images/Mandelic-Serum-5.png",
  "Mandelic Serum 8%": "images/Mandelic-Serum-8.png",
  "Mandelic Serum 11%": "images/Mandelic-Serum-11.png",
  "Acne Med 5%": "images/Acne-Med-5.png",
  "Cell Balm": "images/Cell-Balm.png",
  "Glow-Tone Serum": "images/Glow-Tone-Serum.png",
};

// Normalize recommendation labels to base product keys
function baseProductName(label){
  return label.split(" (")[0].trim();
}

// Build the image gallery HTML for the given recommendations (gallery only, no text list)
function productGalleryHTML(recommendations, campaignSlug){
  const items = recommendations.map((rec) => {
    const base = baseProductName(rec);
    const imgPath = productImages[base];
    // If an image isn't mapped yet, still show a text tag (no image)
    const imgHTML = imgPath
      ? `<img src="${imgPath}" alt="${base}" style="width:100px; height:auto; border-radius:6px; border:1px solid #eee; background:#fff; padding:5px; display:block; margin:0 auto 6px;" />`
      : `<div style="width:100px;height:100px;border:1px dashed #ccc;border-radius:6px;display:flex;align-items:center;justify-content:center;margin:0 auto 6px;font-size:.75rem;background:#fafafa;">${base}</div>`;

    const shopLink = withUTM(
      `https://www.lydsskinbar.com/s/shop?search=${encodeURIComponent(base)}`,
      { campaign: campaignSlug, content: slugify(base) }
    );

    return `
      <div class="product-item" style="text-align:center; max-width:120px;">
        <a href="${shopLink}" target="_blank" rel="noopener" style="text-decoration:none;">
          ${imgHTML}
          <span style="display:block; font-size:.9rem; line-height:1.1;">${base}</span>
        </a>
      </div>
    `;
  }).join("");

  if (!items.trim()) return "";
  return `
    <div class="product-recommendations" style="margin-top:16px;">
      ${items}
    </div>
  `;
}

// ---------------------
// Helpers
// ---------------------
function updateProgress(stepKey){
  // q1 ~15%, q2 ~45%, q3 ~70%, q4 ~85%, q5 ~95%, result ~100%
  let pct = 15;
  if (stepKey.startsWith('q2')) pct = 45;
  else if (stepKey === 'q3') pct = 70;
  else if (stepKey === 'q4') pct = 85;
  else if (stepKey === 'q5') pct = 95;
  else if (stepKey.startsWith('result')) pct = 100;
  if (progressEl) progressEl.style.width = pct + '%';
}

function restartQuiz(){
  userAnswers = [];
  currentStep = 'q1';
  provisionalType = null;
  hasAcne = false;
  hasScars = false;
  renderQuestion('q1');
}

// Compute next step or final result based on state + answer
function computeNoAcneResult(){
  if (provisionalType === 'dry')  return 'result-dry';
  if (provisionalType === 'oily') return 'result-oily';
  return 'result-normal'; // default
}

function computeAcneMapping(){
  // If scars, always Post-Acne Scars regardless of base type
  if (hasScars) return 'result-post-acne-scars';

  // Else map by base type
  if (provisionalType === 'dry')  return 'result-dry-acne';
  if (provisionalType === 'oily') return 'result-oily-acne';
  return 'result-acne-prone'; // normal + acne
}

// Centralized transition logic so Back can replay deterministically
function getNextFrom(stepKey, answerText){
  const node = quizData[stepKey];
  if (!node) return 'q1';
  const opt = node.options.find(o => o.text === answerText);
  if (!opt) return 'q1';

  // Apply state mutations if present
  if (typeof opt.setProvisional !== 'undefined') {
    provisionalType = opt.setProvisional;
  }
  if (typeof opt.setAcne !== 'undefined') {
    hasAcne = !!opt.setAcne;
  }
  if (typeof opt.setScars !== 'undefined') {
    hasScars = !!opt.setScars;
  }

  // Handle compute pseudo-steps
  if (opt.next === 'compute-no-acne-result') {
    return computeNoAcneResult();
  }
  if (opt.next === 'compute-acne-mapping') {
    return computeAcneMapping();
  }

  return opt.next;
}

// Recompute the step by replaying answers (used for Back)
function stepFromAnswers(answers){
  // reset state then replay
  provisionalType = null;
  hasAcne = false;
  hasScars = false;

  if (!answers || answers.length === 0) return 'q1';
  let step = 'q1';

  for (const ans of answers) {
    const next = getNextFrom(step, ans.answer);
    if (!next) return 'q1';
    step = next;
    if (step.startsWith('result')) return step;
  }
  return step;
}

// ---------------------
// UI
// ---------------------
function renderQuestion(stepKey){
  currentStep = stepKey;
  updateProgress(stepKey);

  const data = quizData[stepKey];
  quizEl.innerHTML = `
    <h2 class="question">${data.question}</h2>
    <div class="options" id="options"></div>
    <div class="links-row" style="margin-top:1rem;">
      ${userAnswers.length > 0 ? `<button class="btn btn-outline" id="back-btn">Back</button>` : ''}
      ${userAnswers.length > 0 ? `<button class="btn btn-outline" id="restart-btn">Start Over</button>` : ''}
    </div>
  `;

  const optionsEl = document.getElementById('options');
  data.options.forEach(opt => {
    const b = document.createElement('button');
    b.className = 'option-btn';
    b.type = 'button';
    b.textContent = opt.text;
    b.addEventListener('click', () => {
      userAnswers.push({ question: data.question, answer: opt.text });
      const next = getNextFrom(stepKey, opt.text);
      if (next.startsWith('result')) {
        showResult(next);
      } else {
        renderQuestion(next);
      }
    });
    optionsEl.appendChild(b);
  });

  const backBtn = document.getElementById('back-btn');
  if (backBtn) backBtn.addEventListener('click', () => {
    if (userAnswers.length > 0) {
      userAnswers.pop();
      const prev = stepFromAnswers(userAnswers);
      if (prev.startsWith('result')) showResult(prev); else renderQuestion(prev);
    }
  });

  const restartBtn = document.getElementById('restart-btn');
  if (restartBtn) restartBtn.addEventListener('click', restartQuiz);
}

function showResult(resultKey){
  currentStep = resultKey;
  updateProgress('result');

  const result = results[resultKey];
  const campaignSlug = slugify(resultKey.replace(/^result-/, "")); // e.g., "oily_acne"

  // Build image gallery only (no text list)
  const gallery = productGalleryHTML(result.recommendation, campaignSlug);

  // UTM-tagged primary CTAs
  const shopURL = withUTM("https://www.lydsskinbar.com/s/shop", {
    campaign: campaignSlug,
    content: "shop_button"
  });
  const bookURL = withUTM("/book", {
    campaign: campaignSlug,
    content: "book_button"
  });

  quizEl.innerHTML = `
    <h2 class="question">Your Skin Type: ${result.label}</h2>
    <p>We recommend starting here:</p>

    ${gallery}

    <div class="links-row" style="margin:2rem 0 1.25rem;">
      <a class="btn btn-outline" style="text-decoration:none;" href="${shopURL}" target="_blank" rel="noopener">Shop LSB Products</a>
      <a class="btn btn-outline" style="text-decoration:none;" href="${bookURL}" target="_blank" rel="noopener">Book at Lyds Skin Bar</a>
      <button id="restart-btn-result" type="button" class="btn btn-outline">Retake Quiz</button>
    </div>

    <hr style="border:none; border-top:1px solid #eee; margin: 1rem 0 1.25rem;" />

    <h3 style="margin:.25rem 0 .5rem;">Want a custom routine from our estheticians?</h3>
    <p style="margin-top:0">Share your info and we’ll reach out.</p>

    <form id="followup-form" autocomplete="on" novalidate>
      <label for="name">Name</label>
      <input id="name" name="name" type="text" placeholder="LSB" required />

      <label for="email">Email</label>
      <input id="email" name="email" type="email" placeholder="Lydsskinbar@gmail.com" required inputmode="email" />

      <label for="phone">Phone (optional)</label>
      <input id="phone" name="phone" type="tel" placeholder="(801) 717-9313" inputmode="tel" />

      <div style="display:flex; gap:.75rem; flex-wrap:wrap; margin-top:.5rem;">
        <button id="submit-btn" type="submit" class="btn btn-primary">Get Custom Routine</button>
      </div>
    </form>
    <p id="confirmation" style="display:none; color: green; margin-top:.75rem;">Thank you! We'll be in touch soon.</p>
  `;

  document.getElementById('restart-btn-result').addEventListener('click', restartQuiz);

  // Lightweight analytics hook
  try {
    window.dispatchEvent(new CustomEvent("lsbQuizComplete", {
      detail: {
        result_key: resultKey,
        utm_campaign: campaignSlug,
        answers: userAnswers.slice(),
        provisionalType,
        hasAcne,
        hasScars
      }
    }));
  } catch (e) {}

  const form = document.getElementById('followup-form');
  const submitBtn = document.getElementById('submit-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name  = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();

    if (!name || !email) {
      alert("Please enter your name and a valid email.");
      return;
    }

    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
    submitBtn.textContent = "Submitting…";

    // Include result + campaign + state in payload for segmentation
    const payload = {
      answers: userAnswers,
      result: result.label,
      result_key: resultKey,
      utm_campaign: campaignSlug,
      provisionalType,
      hasAcne,
      hasScars,
      name, email, phone,
      token: WEBHOOK_TOKEN
    };
    const fd = new FormData();
    fd.append('payload', JSON.stringify(payload));

    try {
      const res = await fetch('https://script.google.com/macros/s/AKfycbx99ra8wZyF-LNEeXiBOxjyP3ilmFuHiBhQUcWsNL1ueFLfs2Lkrd6feIuXo09Fmco1lQ/exec', {
        method: 'POST',
        body: fd
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      form.style.display = 'none';
      const c = document.getElementById('confirmation');
      c.innerHTML = `Thank you! We'll be in touch soon. <br><br>
        <button id="retake" class="btn btn-outline">Retake Quiz</button>`;
      c.style.display = 'block';

      document.getElementById('retake').addEventListener('click', () => {
        restartQuiz();
      });

      if (modal) {
        modal.classList.add('show');
        setTimeout(() => modal.classList.remove('show'), 1500);
      }

    } catch (err) {
      console.error('Sheets error', err);
      alert("Sorry, we couldn’t submit right now. Please try again in a moment.");
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
}

// ---------------------
// INIT
// ---------------------
renderQuestion('q1');
