// =====================
// QUIZ LOGIC + SHEETS (CLEANED) + INTRO + EMAIL GATE
// =====================
const quizEl = document.getElementById('quiz');
const progressEl = document.getElementById('progress-bar');
const modal = document.getElementById('notify-modal');

const WEBHOOK_TOKEN = "LSB_SUPER_SECRET_2025"; // must match Apps Script

// ---------------------
// State
// ---------------------
let userAnswers = [];
let currentStep = 'q1';
let provisionalType = null; // 'dry' | 'oily' | 'normal'
let hasAcne = false;        // user reports breakouts at Monthly/Weekly/Daily
let hasScars = false;       // last question, applies as a modifier

// ---------------------
// Branching data (scarring asked LAST for every path)
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
      { text: "Often", next: "q3", setProvisional: "dry" },         // Provisional Dry
      { text: "Sometimes", next: "q3", setProvisional: "normal" },  // Provisional Normal
      { text: "Never", next: "q3", setProvisional: "normal" },
    ],
  },

  // Q2b — Oil distribution (if Q1 = fast or 6–9h)
  q2b: {
    question: "Where does your skin feel oily?",
    options: [
      { text: "All over", next: "q3", setProvisional: "oily" },     // Provisional Oily
      { text: "Only some oily areas", next: "q3", setProvisional: "normal" }, // Provisional Normal
    ],
  },

  // Q3 — Breakout frequency (sets acne yes/no; we will ALWAYS ask scarring next)
  q3: {
    question: "How often do you notice new breakouts?",
    options: [
      { text: "Never",   next: "q4", setAcne: false },
      { text: "Monthly", next: "q4", setAcne: true  },
      { text: "Weekly",  next: "q4", setAcne: true  },
      { text: "Daily",   next: "q4", setAcne: true  },
    ],
  },

  // Q4 — Scarring (ALWAYS LAST; acts as a modifier)
  q4: {
    question: "Do you have acne scarring?",
    options: [
      { text: "Yes", next: "compute-final", setScars: true  },
      { text: "No",  next: "compute-final", setScars: false },
    ],
  },
};

// ---------------------
// Results — 12 outcomes (base ± scarring)
// ---------------------
const results = {
  // Oily
  "result-oily": {
    label: "Oily skin",
    recommendation: ["Ultra Gentle Cleanser", "Mandelic Serum 8%", "Hydrabalance Gel", "Moisture Balance Toner"],
    treatment: "Chemical Peel",
    product_url: "https://www.lydsskinbar.com/s/shop",
    service_url: "https://www.lydsskinbar.com/s/appointments",
  },
  "result-oily-scar": {
    label: "Oily skin with scarring",
    recommendation: ["Ultra Gentle Cleanser", "Mandelic Serum 8%", "Hydrabalance Gel", "Glow-Tone Serum"],
    treatment: "Microneedling",
    product_url: "https://www.lydsskinbar.com/s/shop",
    service_url: "https://www.lydsskinbar.com/s/appointments",
  },

  // Dry
  "result-dry": {
    label: "Dry skin",
    recommendation: ["Ultra Gentle Cleanser", "Cell Balm", "Cran-Peptide Cream", "Hydrabalance Gel"],
    treatment: "Hydrating Glow Facial",
    product_url: "https://www.lydsskinbar.com/s/shop",
    service_url: "https://www.lydsskinbar.com/s/appointments",
  },
  "result-dry-scar": {
    label: "Dry skin with scarring",
    recommendation: ["Ultra Gentle Cleanser", "Cell Balm", "Cran-Peptide Cream", "Glow-Tone Serum"],
    treatment: "Microneedling",
    product_url: "https://www.lydsskinbar.com/s/shop",
    service_url: "https://www.lydsskinbar.com/s/appointments",
  },

  // Normal
  "result-normal": {
    label: "Normal skin",
    recommendation: ["Ultra Gentle Cleanser", "Mandelic Serum 8%", "Cran-Peptide Cream", "Daily SPF-30"],
    treatment: "Hydrating Glow Facial",
    product_url: "https://www.lydsskinbar.com/s/shop",
    service_url: "https://www.lydsskinbar.com/s/appointments",
  },
  "result-normal-scar": {
    label: "Normal skin with scarring",
    recommendation: ["Ultra Gentle Cleanser", "Mandelic Serum 8%", "Glow-Tone Serum", "Daily SPF-30"],
    treatment: "Microneedling",
    product_url: "https://www.lydsskinbar.com/s/shop",
    service_url: "https://www.lydsskinbar.com/s/appointments",
  },

  // Acne-prone (normal base)
  "result-acne-prone": {
    label: "Acne prone skin",
    recommendation: ["Ultra Gentle Cleanser", "Mandelic Serum 8%", "Cran-Peptide Cream", "Acne Med 5%"],
    treatment: "Acne Bootcamp or Acne Facial",
    product_url: "https://www.lydsskinbar.com/s/shop",
    service_url: "https://www.lydsskinbar.com/s/appointments",
  },
  "result-acne-prone-scar": {
    label: "Acne prone skin with scarring",
    recommendation: ["Ultra Gentle Cleanser", "Mandelic Serum 8%", "Cran-Peptide Cream", "Glow-Tone Serum"],
    treatment: "Microneedling with Chemical Peel",
    product_url: "https://www.lydsskinbar.com/s/shop",
    service_url: "https://www.lydsskinbar.com/s/appointments",
  },

  // Dry + Acne-prone
  "result-dry-acne": {
    label: "Dry, acne prone skin",
    recommendation: ["Ultra Gentle Cleanser", "Mandelic Serum 5%", "Cran-Peptide Cream", "Daily SPF-30"],
    treatment: "Chemical Peel",
    product_url: "https://www.lydsskinbar.com/s/shop",
    service_url: "https://www.lydsskinbar.com/s/appointments",
  },
  "result-dry-acne-scar": {
    label: "Dry, acne prone skin with scarring",
    recommendation: ["Ultra Gentle Cleanser", "Mandelic Serum 8%", "Cran-Peptide Cream", "Daily SPF-30"],
    treatment: "Microneedling with Chemical Peel",
    product_url: "https://www.lydsskinbar.com/s/shop",
    service_url: "https://www.lydsskinbar.com/s/appointments",
  },

  // Oily + Acne-prone
  "result-oily-acne": {
    label: "Oily, acne prone skin",
    recommendation: ["Ultra Gentle Cleanser", "Mandelic Serum 11%", "Hydrabalance Gel", "Acne Med 5%"],
    treatment: "Chemical Peel",
    product_url: "https://www.lydsskinbar.com/s/shop",
    service_url: "https://www.lydsskinbar.com/s/appointments",
  },
  "result-oily-acne-scar": {
    label: "Oily, acne prone skin with scarring",
    recommendation: ["Ultra Gentle Cleanser", "Mandelic Serum 11%", "Hydrabalance Gel", "Glow-Tone Serum"],
    treatment: "Microneedling with Chemical Peel",
    product_url: "https://www.lydsskinbar.com/s/shop",
    service_url: "https://www.lydsskinbar.com/s/appointments",
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
// Product image map
// ---------------------
const productImages = {
  "Ultra Gentle Cleanser": "images/Ultra-Gentle-Cleanser-16oz.png",
  "Hydrabalance Gel": "images/Hydra-Balance-Gel.png",
  "Cran-Peptide Cream": "images/Cran-Peptide-Cream-1.png",
  "Moisture Balance Toner": "images/Moisture-Balance-Toner.png",
  "Daily SPF 30 Lotion": "images/Daily-SPF30-Plus.png",
  "Daily SPF-30": "images/Daily-SPF30-Plus.png",
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
    const imgHTML = imgPath
      ? `<img src="${imgPath}" alt="${base}" style="width:100px; height:auto; border-radius:6px; border:1px solid #eee; background:#fff; padding:5px; display:block; margin:0 auto 6px;" />`
      : `<div style="width:100px;height:100px;border:1px dashed #ccc;border-radius:6px;display:flex;align-items:center;justify-content:center;margin:0 auto 6px;font-size:.75rem;background:#fafafa;">${base}</div>`;

    const shopLink = withUTM(
      `${resultsBaseShopURL()}?search=${encodeURIComponent(base)}`,
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
  return `<div class="product-recommendations" style="margin-top:16px;">${items}</div>`;
}

function resultsBaseShopURL(){
  return "https://www.lydsskinbar.com/s/shop";
}

// ---------------------
// Helpers
// ---------------------
function updateProgress(stepKey){
  // q1 ~15%, q2 ~45%, q3 ~70%, q4 ~95%, result ~100%
  let pct = 15;
  if (stepKey === 'intro') pct = 0;
  else if (stepKey.startsWith('q2')) pct = 45;
  else if (stepKey === 'q3') pct = 70;
  else if (stepKey === 'q4') pct = 95;
  else if (stepKey === 'gate') pct = 98;
  else if (stepKey.startsWith('result')) pct = 100;
  if (progressEl) progressEl.style.width = pct + '%';
}

function restartQuiz(){
  userAnswers = [];
  currentStep = 'intro';
  provisionalType = null;
  hasAcne = false;
  hasScars = false;
  renderIntro();
}

// Build final result key from state
function computeFinalKey(){
  // Choose base
  let baseKey;
  if (hasAcne) {
    if (provisionalType === 'dry')      baseKey = 'result-dry-acne';
    else if (provisionalType === 'oily') baseKey = 'result-oily-acne';
    else                                 baseKey = 'result-acne-prone'; // normal + acne
  } else {
    if (provisionalType === 'dry')      baseKey = 'result-dry';
    else if (provisionalType === 'oily') baseKey = 'result-oily';
    else                                 baseKey = 'result-normal';
  }

  // Apply scarring modifier
  if (hasScars) return `${baseKey}-scar`;
  return baseKey;
}

// Transition helper (applies state changes and returns next)
function getNextFrom(stepKey, answerText){
  const node = quizData[stepKey];
  if (!node) return 'q1';
  const opt = node.options.find(o => o.text === answerText);
  if (!opt) return 'q1';

  if (typeof opt.setProvisional !== 'undefined') provisionalType = opt.setProvisional;
  if (typeof opt.setAcne !== 'undefined')        hasAcne = !!opt.setAcne;
  if (typeof opt.setScars !== 'undefined')       hasScars = !!opt.setScars;

  if (opt.next === 'compute-final') {
    return computeFinalKey();
  }
  return opt.next;
}

// Recompute the step by replaying answers (used for Back)
function stepFromAnswers(answers){
  provisionalType = null;
  hasAcne = false;
  hasScars = false;

  if (!answers || answers.length === 0) return 'q1';
  let step = 'q1';

  for (const ans of answers) {
    const next = getNextFrom(step, ans.answer);
    step = next || 'q1';
    if (step.startsWith('result')) return step;
  }
  return step;
}

// ---------------------
// UI
// ---------------------
function renderIntro(){
  currentStep = 'intro';
  updateProgress('intro');

  if (!quizEl) {
    console.error('Missing #quiz element');
    return;
  }
  quizEl.innerHTML = `
    <div class="intro" style="text-align:center; padding:2rem 1rem;">
      <h2 style="margin:0 0 .5rem; font-size:clamp(1.6rem, 4vw, 2.2rem); line-height:1.2; color:#F44831; white-space:nowrap;">Clear Skin Starts Here</h2>
      <p style="margin:.25rem 0 1.25rem; font-size:1rem; color:#555;">A few quick questions to personalize your routine.</p>
      <button id="begin-quiz-btn" type="button" class="btn btn-primary">Begin Quiz</button>
    </div>
  `;

  const begin = document.getElementById('begin-quiz-btn');
  if (begin) begin.addEventListener('click', () => renderQuestion('q1'));
}

// EMAIL GATE shown after Q4, before results
function renderEmailGate(resultKey){
  currentStep = 'gate';
  updateProgress('gate');

  if (!quizEl) return;
  quizEl.innerHTML = `
    <div class="gate" style="max-width:520px; margin:0 auto;">
      <h2 class="question" style="margin:0 0 .5rem; color:#F44831; ">Almost There — Get Your Results</h2>
      <p style="margin:.25rem 0 1rem; color:#555;">Enter your info to see your personalized skin type and routine.</p>

      <form id="gate-form" autocomplete="on" novalidate>
        <label for="gate-name">Name</label>
        <input id="gate-name" name="name" type="text" placeholder="Your name" required />

        <label for="gate-email">Email</label>
        <input id="gate-email" name="email" type="email" placeholder="clearskin@lsb.com" required inputmode="email" />

        <div style="display:flex; gap:.75rem; flex-wrap:wrap; margin-top:.75rem;">
          <button id="gate-submit" type="submit" class="btn btn-primary">See My Results</button>
          <button id="gate-retake" type="button" class="btn btn-outline">Retake Quiz</button>
        </div>
        <small style="display:block; margin-top:.5rem; color:#777;">We’ll send helpful tips and updates. You can unsubscribe anytime.</small>
      </form>
    </div>
  `;

  // FIXED: Retake button should restart the quiz (go to intro)
  const retakeBtn = document.getElementById('gate-retake');
  if (retakeBtn) retakeBtn.addEventListener('click', restartQuiz);

  const form = document.getElementById('gate-form');
  const submitBtn = document.getElementById('gate-submit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name  = document.getElementById('gate-name').value.trim();
    const email = document.getElementById('gate-email').value.trim();

    if (!name || !email) {
      alert('Please enter your name and a valid email.');
      return;
    }

    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Submitting…';

    // Send minimal lead record for everyone who takes quiz (Sheet: Responses)
    const payload = {
      stage: 'gate',                // <-- use this in Apps Script to route to "Responses"
      answers: userAnswers,         // optional but useful
      result_key: resultKey,        // computed key before reveal
      provisionalType,
      hasAcne,
      hasScars,
      name,
      email,
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

      // Proceed to show results
      showResult(resultKey);

    } catch (err) {
      console.error('Sheets error (gate)', err);
      alert('Sorry, we couldn’t submit right now. Please try again in a moment.');
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
}

function renderQuestion(stepKey){
  currentStep = stepKey;
  updateProgress(stepKey);

  const data = quizData[stepKey];
  if (!quizEl) {
    console.error('Missing #quiz element');
    return;
  }
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
        // SHOW EMAIL GATE BEFORE REVEALING RESULTS
        renderEmailGate(next);
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
      if (prev.startsWith('result')) renderEmailGate(prev); else renderQuestion(prev);
    }
  });

  const restartBtn = document.getElementById('restart-btn');
  if (restartBtn) restartBtn.addEventListener('click', restartQuiz);
}

function showResult(resultKey){
  currentStep = resultKey;
  updateProgress('result');

  const result = results[resultKey];
  const campaignSlug = slugify(resultKey.replace(/^result-/, "")); // e.g., "oily_acne_scar"

  const gallery = productGalleryHTML(result.recommendation, campaignSlug);

  // UTM-tagged CTAs (use the specific URLs in each result)
  const shopURL = withUTM(result.product_url, {
    campaign: campaignSlug,
    content: "shop_button"
  });
  const bookURL = withUTM(result.service_url, {
    campaign: campaignSlug,
    content: "book_button"
  });

  const highlightedLabel = `<span class="result-highlight">${result.label}</span>`;

  if (!quizEl) return;
  quizEl.innerHTML = `
    <h2 class="question">Your Skin Type: ${highlightedLabel}</h2>
    <p>We recommend starting here:</p>

    ${gallery}

<div class="links-row results-actions" style="margin:1rem 0 .5rem;">
  <a class="btn btn-outline" href="${shopURL}" target="_blank" rel="noopener">Shop LSB Products</a>
  <a class="btn btn-outline" href="${bookURL}" target="_blank" rel="noopener">Recommended Services: ${result.treatment}</a>
</div>


    <hr style="border:none; border-top:1px solid #eee; margin: 1rem 0 1.25rem;" />

    <h3 style="margin:.25rem 0 .5rem;">Want a Custom Routine?</h3>
    <p style="margin-top:0">Share your info and our team will reach out to you.</p>

    <form id="followup-form" autocomplete="on" novalidate>
      <label for="name">Name</label>
      <input id="name" name="name" type="text" placeholder="LSB" required />

      <label for="email">Email</label>
      <input id="email" name="email" type="email" placeholder="Lydsskinbar@gmail.com" required inputmode="email" />

      <label for="phone">Phone (optional)</label>
      <input id="phone" name="phone" type="tel" placeholder="(801) 717-9313" inputmode="tel" />

      <div style="display:flex; gap:.75rem; flex-wrap:wrap; margin-top:.5rem;">
        <button id="submit-btn" type="submit" class="btn btn-primary">Get Custom Routine</button>
        <button id="restart-btn-result" type="button" class="btn btn-outline">Retake Quiz</button>
      </div>
    </form>
    <p id="confirmation" style="display:none; color: green; margin-top:.75rem;">Thank you! Check you email for next steps.</p>
  `;

  document.getElementById('restart-btn-result').addEventListener('click', restartQuiz);

  // Analytics hook
  try {
    window.dispatchEvent(new CustomEvent("lsbQuizComplete", {
      detail: { result_key: resultKey, utm_campaign: campaignSlug, answers: userAnswers.slice(), provisionalType, hasAcne, hasScars }
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

    const payload = {
      stage: 'custom',            // <-- use this to route to Sheet1 (custom requests)
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
      c.innerHTML = `Thank you! Check your email for next steps. <br><br>
        <button id="retake" class="btn btn-outline">Retake Quiz</button>`;
      c.style.display = 'block';

      document.getElementById('retake').addEventListener('click', restartQuiz);

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
if (quizEl) {
  renderIntro();
} else {
  console.error('Missing #quiz element — ensure this script runs after the HTML.');
}
