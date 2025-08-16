/* ------------------------------
   QUIZ STATE
------------------------------ */
let currentStep = "start";
let userAnswers = [];
let provisionalType = null;
let hasAcne = false;
let hasScars = false;

/* ------------------------------
   DOM
------------------------------ */
const quizEl = document.getElementById("quiz");
const progressBar = document.getElementById("progress-bar");
const modal = document.getElementById("notify-modal");

/* ------------------------------
   UTIL
------------------------------ */
function slugify(str) {
  return str.toLowerCase().replace(/\s+/g, "_").replace(/[^\w_]+/g, "");
}

function withUTM(url, { campaign, content }) {
  const u = new URL(url);
  u.searchParams.set("utm_source", "lsb_quiz");
  u.searchParams.set("utm_medium", "quiz");
  if (campaign) u.searchParams.set("utm_campaign", campaign);
  if (content) u.searchParams.set("utm_content", content);
  return u.toString();
}

/* ------------------------------
   QUIZ QUESTIONS
------------------------------ */
const quizSteps = {
  start: {
    question: "What’s your primary skin concern?",
    answers: [
      { text: "Oily / Shine", next: "oily" },
      { text: "Dry / Flaky", next: "dry" },
      { text: "Normal / Balanced", next: "normal" },
      { text: "Acne / Breakouts", next: "acne" }
    ]
  },
  oily: {
    question: "Do you also experience frequent breakouts?",
    answers: [
      { text: "Yes", next: "oily_acne" },
      { text: "No", next: "oily_final" }
    ]
  },
  oily_acne: {
    question: "Do you have acne scarring?",
    answers: [
      { text: "Yes", next: "result-oily_acne_scar" },
      { text: "No", next: "result-oily_acne" }
    ]
  },
  oily_final: {
    question: "Do you have acne scarring?",
    answers: [
      { text: "Yes", next: "result-oily_scar" },
      { text: "No", next: "result-oily" }
    ]
  },
  dry: {
    question: "Do you also get breakouts?",
    answers: [
      { text: "Yes", next: "dry_acne" },
      { text: "No", next: "dry_final" }
    ]
  },
  dry_acne: {
    question: "Do you have acne scarring?",
    answers: [
      { text: "Yes", next: "result-dry_acne_scar" },
      { text: "No", next: "result-dry_acne" }
    ]
  },
  dry_final: {
    question: "Do you have acne scarring?",
    answers: [
      { text: "Yes", next: "result-dry_scar" },
      { text: "No", next: "result-dry" }
    ]
  },
  normal: {
    question: "Do you have acne scarring?",
    answers: [
      { text: "Yes", next: "result-normal_scar" },
      { text: "No", next: "result-normal" }
    ]
  },
  acne: {
    question: "Is your skin usually more oily or dry?",
    answers: [
      { text: "Oily", next: "acne_oily" },
      { text: "Dry", next: "acne_dry" },
      { text: "Neither / Balanced", next: "acne_final" }
    ]
  },
  acne_oily: {
    question: "Do you have acne scarring?",
    answers: [
      { text: "Yes", next: "result-oily_acne_scar" },
      { text: "No", next: "result-oily_acne" }
    ]
  },
  acne_dry: {
    question: "Do you have acne scarring?",
    answers: [
      { text: "Yes", next: "result-dry_acne_scar" },
      { text: "No", next: "result-dry_acne" }
    ]
  },
  acne_final: {
    question: "Do you have acne scarring?",
    answers: [
      { text: "Yes", next: "result-acne_scar" },
      { text: "No", next: "result-acne" }
    ]
  }
};

/* ------------------------------
   RESULTS
------------------------------ */
const results = {
  "result-oily": {
    label: "Oily Skin",
    recommendation: ["Ultra Gentle Cleanser","Mandelic Serum 8%","HydraBalance Gel","Moisture Balance Toner"],
    treatment: "Chemical Peel",
    product_url: "https://www.lydsskinbar.com/s/shop",
    service_url: "https://www.lydsskinbar.com/s/appointments"
  },
  "result-oily_scar": {
    label: "Oily Skin with Scarring",
    recommendation: ["Ultra Gentle Cleanser","Mandelic Serum 8%","HydraBalance Gel","Glow-Tone Serum"],
    treatment: "Microneedling",
    product_url: "https://www.lydsskinbar.com/s/shop",
    service_url: "https://www.lydsskinbar.com/s/appointments"
  },
  "result-dry": {
    label: "Dry Skin",
    recommendation: ["Ultra Gentle Cleanser","Cell Balm","Cran-Peptide Cream","HydraBalance Gel"],
    treatment: "Hydrating Glow Facial",
    product_url: "https://www.lydsskinbar.com/s/shop",
    service_url: "https://www.lydsskinbar.com/s/appointments"
  },
  "result-dry_scar": {
    label: "Dry Skin with Scarring",
    recommendation: ["Ultra Gentle Cleanser","Cell Balm","Cran-Peptide Cream","Glow-Tone Serum"],
    treatment: "Microneedling",
    product_url: "https://www.lydsskinbar.com/s/shop",
    service_url: "https://www.lydsskinbar.com/s/appointments"
  },
  "result-normal": {
    label: "Normal Skin",
    recommendation: ["Ultra Gentle Cleanser","Mandelic Serum 8%","Cran-Peptide Cream","Daily SPF-30"],
    treatment: "Hydrating Glow Facial",
    product_url: "https://www.lydsskinbar.com/s/shop",
    service_url: "https://www.lydsskinbar.com/s/appointments"
  },
  "result-normal_scar": {
    label: "Normal Skin with Scarring",
    recommendation: ["Ultra Gentle Cleanser","Mandelic Serum 8%","Glow-Tone Serum","Daily SPF-30"],
    treatment: "Microneedling",
    product_url: "https://www.lydsskinbar.com/s/shop",
    service_url: "https://www.lydsskinbar.com/s/appointments"
  },
  "result-acne": {
    label: "Acne Prone Skin",
    recommendation: ["Ultra Gentle Cleanser","Mandelic Serum 8%","Cran-Peptide Cream","Acne Med 5%"],
    treatment: "Acne Bootcamp or Acne Facial",
    product_url: "https://www.lydsskinbar.com/s/shop",
    service_url: "https://www.lydsskinbar.com/s/appointments"
  },
  "result-acne_scar": {
    label: "Acne Prone Skin with Scarring",
    recommendation: ["Ultra Gentle Cleanser","Mandelic Serum 8%","Cran-Peptide Cream","Glow-Tone Serum"],
    treatment: "Microneedling with Chemical Peel",
    product_url: "https://www.lydsskinbar.com/s/shop",
    service_url: "https://www.lydsskinbar.com/s/appointments"
  },
  "result-dry_acne": {
    label: "Dry, Acne Prone Skin",
    recommendation: ["Ultra Gentle Cleanser","Mandelic Serum 5%","Cran-Peptide Cream","Daily SPF-30"],
    treatment: "Chemical Peel",
    product_url: "https://www.lydsskinbar.com/s/shop",
    service_url: "https://www.lydsskinbar.com/s/appointments"
  },
  "result-dry_acne_scar": {
    label: "Dry, Acne Prone Skin with Scarring",
    recommendation: ["Ultra Gentle Cleanser","Mandelic Serum 8%","Cran-Peptide Cream","Daily SPF-30"],
    treatment: "Microneedling with Chemical Peel",
    product_url: "https://www.lydsskinbar.com/s/shop",
    service_url: "https://www.lydsskinbar.com/s/appointments"
  },
  "result-oily_acne": {
    label: "Oily, Acne Prone Skin",
    recommendation: ["Ultra Gentle Cleanser","Mandelic Serum 11%","HydraBalance Gel","Acne Med 5%"],
    treatment: "Chemical Peel",
    product_url: "https://www.lydsskinbar.com/s/shop",
    service_url: "https://www.lydsskinbar.com/s/appointments"
  },
  "result-oily_acne_scar": {
    label: "Oily, Acne Prone Skin with Scarring",
    recommendation: ["Ultra Gentle Cleanser","Mandelic Serum 11%","HydraBalance Gel","Glow-Tone Serum"],
    treatment: "Microneedling with Chemical Peel",
    product_url: "https://www.lydsskinbar.com/s/shop",
    service_url: "https://www.lydsskinbar.com/s/appointments"
  }
};

/* ------------------------------
   RENDER
------------------------------ */
function updateProgress(step) {
  const totalSteps = 6;
  let progress = 0;
  if (step === "result") progress = 100;
  else progress = (userAnswers.length / totalSteps) * 100;
  progressBar.style.width = progress + "%";
}

function renderStep(stepKey) {
  const step = quizSteps[stepKey];
  quizEl.innerHTML = `
    <h2 class="question">${step.question}</h2>
    <div class="answers">
      ${step.answers.map(
        (a, i) => `
        <button class="answer-btn" data-next="${a.next}">${a.text}</button>
      `
      ).join("")}
    </div>
  `;

  document.querySelectorAll(".answer-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      userAnswers.push(btn.textContent);
      if (btn.dataset.next.startsWith("result-")) {
        showResult(btn.dataset.next);
      } else {
        currentStep = btn.dataset.next;
        updateProgress(currentStep);
        renderStep(currentStep);
      }
    });
  });
}

/* ------------------------------
   SHOW RESULT (UPDATED)
------------------------------ */
function showResult(resultKey) {
  currentStep = resultKey;
  updateProgress("result");

  const result = results[resultKey];
  const campaignSlug = slugify(resultKey.replace(/^result-/, ""));

  const shopURL = withUTM(result.product_url, {
    campaign: campaignSlug,
    content: "shop_button"
  });
  const bookURL = withUTM(result.service_url, {
    campaign: campaignSlug,
    content: "book_button"
  });

  quizEl.innerHTML = `
    <h2 class="question">Your Skin Type: ${result.label}</h2>
    <p>We recommend starting here:</p>

    <ul class="recommend-list">
      ${result.recommendation.map(item => `<li>${item}</li>`).join("")}
    </ul>
    <p><strong>Treatment:</strong> ${result.treatment}</p>

    <div class="result-links" style="margin:1.5rem 0;">
      <p><strong>Products:</strong> 
        <a href="${result.product_url}" target="_blank" rel="noopener">Browse recommended products</a>
      </p>
      <p><strong>Treatments:</strong> 
        <a href="${result.service_url}" target="_blank" rel="noopener">Explore treatment options</a>
      </p>
    </div>

    <div class="links-row" style="display:flex; gap:1rem; justify-content:center; margin:2rem 0 1.25rem;">
      <a class="btn btn-outline" style="text-decoration:none;" href="${shopURL}" target="_blank" rel="noopener">Shop LSB Products</a>
      <a class="btn btn-outline" style="text-decoration:none;" href="${bookURL}" target="_blank" rel="noopener">Visit LSB</a>
      <button id="restart-btn-result" type="button" class="btn btn-outline">Retake Quiz</button>
    </div>
  `;

  document.getElementById("restart-btn-result").addEventListener("click", restartQuiz);
}

/* ------------------------------
   RESET
------------------------------ */
function restartQuiz() {
  currentStep = "start";
  userAnswers = [];
  updateProgress(currentStep);
  renderStep("start");
}

/* ------------------------------
   INIT
------------------------------ */
renderStep("start");
