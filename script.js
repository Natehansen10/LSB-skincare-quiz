// =====================
// QUIZ LOGIC + SHEETS
// =====================
const quizEl = document.getElementById('quiz');
const progressEl = document.getElementById('progress-bar');
const modal = document.getElementById('notify-modal');

const WEBHOOK_TOKEN = "LSB_SUPER_SECRET_2025"; // must match Apps Script

// ---------------------
// Branching data (with sensitivity overlay via Q3)
// ---------------------
const quizData = {
  // Q1 — Oil return time
  q1: {
    question: "How long after cleansing in the morning do you begin to feel oily?",
    options: [
      { text: "Never / After 12+ hours", next: "q2a" },   // dryness path
      { text: "6–9 hours after", next: "q2b" },           // oil distribution path
      { text: "Immediately to 5 hours after", next: "q2b" },
    ],
  },

  // Q2a — Dryness frequency (if Q1 = Never/12+)
  q2a: {
    question: "How often does your skin feel tight, dry, or flaky?",
    options: [
      { text: "Often", next: "q3-dry" },                  // provisional Dry
      { text: "Sometimes", next: "q3-combo" },            // provisional Combo
      { text: "Never", next: "q3-combo" },                // collapse “normal/balanced” into Combination
    ],
  },

  // Q2b — Oil distribution (if Q1 = fast or 6–9h)
  q2b: {
    question: "Where does your skin feel oily?",
    options: [
      { text: "All over", next: "q3-oily" },              // provisional Oily
      { text: "Only some oily areas", next: "q3-combo" }, // provisional Combo
    ],
  },

  // Q3 (Sensitivity) — three variants that point to different result buckets
  "q3-oily": {
    question: "Does your skin turn red, flushed, or itch after using some products?",
    options: [
      { text: "Yes / Yes, often", next: "result-oily-sensitive" },
      { text: "Sometimes", next: "result-oily-mild" },
      { text: "Never / Rarely", next: "result-oily" },
    ],
  },
  "q3-combo": {
    question: "Does your skin turn red, flushed, or itch after using some products?",
    options: [
      { text: "Yes / Yes, often", next: "result-combo-sensitive" },
      { text: "Sometimes", next: "result-combo-mild" },
      { text: "Never / Rarely", next: "result-combo" },
    ],
  },
  "q3-dry": {
    question: "Does your skin turn red, flushed, or itch after using some products?",
    options: [
      { text: "Yes / Yes, often", next: "result-dry-sensitive" },
      { text: "Sometimes", next: "result-dry-mild" },
      { text: "Never / Rarely", next: "result-dry" },
    ],
  },
};

// ---------------------
// Results (LSB-forward; tweak products anytime)
// ---------------------
const results = {
  // OILY
  "result-oily": {
    label: "Oily Skin",
    recommendation: ["Ultra Gentle Cleanser", "Mandelic Serum 5%", "Hydrabalance Gel", "Daily SPF 30 Lotion"],
  },
  "result-oily-mild": {
    label: "Oily & Mildly Sensitive",
    recommendation: ["Ultra Gentle Cleanser", "Hydrabalance Gel", "Mandelic Serum 5% (3–4x/week)", "Daily SPF 30 Lotion"],
  },
  "result-oily-sensitive": {
    label: "Oily & Sensitive",
    recommendation: ["Ultra Gentle Cleanser", "Hydrabalance Gel", "Cran-Peptide Cream", "Daily SPF 30 Lotion"],
  },

  // COMBINATION
  "result-combo": {
    label: "Combination Skin",
    recommendation: ["Ultra Gentle Cleanser", "Mandelic Serum 5%", "Hydrabalance Gel", "Cran-Peptide Cream"],
  },
  "result-combo-mild": {
    label: "Combination & Mildly Sensitive",
    recommendation: ["Ultra Gentle Cleanser", "Hydrabalance Gel", "Mandelic Serum 5% (2–3x/week)", "Daily SPF 30 Lotion"],
  },
  "result-combo-sensitive": {
    label: "Combination & Sensitive",
    recommendation: ["Ultra Gentle Cleanser", "Hydrabalance Gel", "Cran-Peptide Cream", "Daily SPF 30 Lotion"],
  },

  // DRY
  "result-dry": {
    label: "Dry Skin",
    recommendation: ["Ultra Gentle Cleanser", "Moisture Balance Toner", "Hydrabalance Gel", "Cran-Peptide Cream", "Daily SPF 30 Lotion"],
  },
  "result-dry-mild": {
    label: "Dry & Mildly Sensitive",
    recommendation: ["Ultra Gentle Cleanser", "Hydrabalance Gel", "Cran-Peptide Cream", "Daily SPF 30 Lotion"],
  },
  "result-dry-sensitive": {
    label: "Dry & Sensitive",
    recommendation: ["Ultra Gentle Cleanser", "Hydrabalance Gel", "Cran-Peptide Cream", "Daily SPF 30 Lotion"],
  },
};

let userAnswers = [];
let currentStep = 'q1';

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
  // Support absolute and relative URLs
  const url = baseUrl.startsWith("http")
    ? new URL(baseUrl)
    : new URL(baseUrl, window.location.origin);

  url.searchParams.set("utm_source", source);
  url.searchParams.set("utm_medium", medium);
  if (campaign) url.searchParams.set("utm_campaign", campaign);
  if (content)  url.searchParams.set("utm_content", content);
  return url.toString();
}

// Map product names (base) -> image paths
const productImages = {
  "Ultra Gentle Cleanser": "images/Ultra-Gentle-Cleanser-16oz.png",
  "Hydrabalance Gel": "images/Hydra Balance Gel.png",
  "Cran-Peptide Cream": "images/Cran-Peptide-Cream-1.png",
  "Daily SPF 30 Lotion": "images/Daily_SPF30_Plus.png",
  "Mandelic Serum 5%": "images/Mandelic Serum 5%.png"
};

// Normalize recommendation labels to base product keys
function baseProductName(label){
  // Remove anything in parentheses and trim
  return label.split(" (")[0].trim();
}

// Build the image gallery HTML for the given recommendations
function productGalleryHTML(recommendations, campaignSlug){
  const items = recommendations.map((rec) => {
    const base = baseProductName(rec);
    const imgPath = productImages[base];
    if (!imgPath) return ""; // skip if we don't have an image mapping

    // Link to shop with UTMs (content set to product slug)
    const shopLink = withUTM(
      `https://www.lydsskinbar.com/s/shop?search=${encodeURIComponent(base)}`,
      { campaign: campaignSlug, content: slugify(base) }
    );

    return `
      <div class="product-item" style="text-align:center; max-width:120px;">
        <a href="${shopLink}" target="_blank" rel="noopener" style="text-decoration:none;">
          <img src="${imgPath}" alt="${base}" style="width:100px; height:auto; border-radius:6px; border:1px solid #eee; background:#fff; padding:5px; display:block; margin:0 auto 6px;" />
          <span style="display:block; font-size:.9rem; line-height:1.1;">${base}</span>
        </a>
      </div>
    `;
  }).join("");

  if (!items.trim()) return "";

  // Container row
  return `
    <div class="product-recommendations"
         style="display:flex; flex-wrap:wrap; justify-content:center; gap:20px; margin-top:16px;">
      ${items}
    </div>
  `;
}

// Update linkify to accept campaign + content and append UTMs (for the text list)
function linkify(rec, campaignSlug){
  const base = baseProductName(rec);
  const url = withUTM(`https://www.lydsskinbar.com/s/shop?search=${encodeURIComponent(base)}`, {
    campaign: campaignSlug,
    content: slugify(base)
  });
  return `<li><a href="${url}" target="_blank" rel="noopener">${base}</a></li>`;
}

// ---------------------
// Helpers
// ---------------------
function updateProgress(stepKey){
  // q1 ~ 15%, q2 ~ 55%, q3 ~ 85%, result ~ 100%
  let pct = 15;
  if (stepKey.startsWith('q2')) pct = 55;
  else if (stepKey.startsWith('q3')) pct = 85;
  else if (stepKey.startsWith('result')) pct = 100;
  if (progressEl) progressEl.style.width = pct + '%';
}

// Recompute the step by replaying answers (used for Back)
function stepFromAnswers(answers){
  if (!answers || answers.length === 0) return 'q1';
  let step = 'q1';
  for (const ans of answers) {
    const node = quizData[step];
    if (!node) return 'q1';
    const chosen = node.options.find(o => o.text === ans.answer);
    if (!chosen) return 'q1';
    step = chosen.next;
    if (step.startsWith('result')) return step;
  }
  return step;
}

function restartQuiz(){
  userAnswers = [];
  currentStep = 'q1';
  renderQuestion('q1');
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
      const next = opt.next;
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
  const campaignSlug = slugify(resultKey.replace(/^result-/, "")); // e.g., "oily_sensitive"

  // Build recommendation list with UTMs (text list)
  const recList = result.recommendation.map(rec => linkify(rec, campaignSlug)).join('');
  // Build image gallery row for these recs
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
    <ul>${recList}</ul>

    ${gallery}

    <!-- Added more space above buttons + removed underline on the two CTAs -->
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

  // Fire a lightweight event for analytics (optional)
  try {
    window.dispatchEvent(new CustomEvent("lsbQuizComplete", {
      detail: { result_key: resultKey, utm_campaign: campaignSlug, answers: userAnswers.slice() }
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

    // Include result + campaign in payload for segmentation
    const payload = {
      answers: userAnswers,
      result: result.label,
      result_key: resultKey,
      utm_campaign: campaignSlug,
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
        userAnswers = [];
        renderQuestion('q1');
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
