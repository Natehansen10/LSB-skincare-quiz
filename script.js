// Google Sheets Web App URL
const SHEETS_WEBHOOK = "https://script.google.com/macros/s/AKfycbx99ra8wZyF-LNEeXiBOxjyP3ilmFuHiBhQUcWsNL1ueFLfs2Lkrd6feIuXo09Fmco1lQ/exec";

const quizEl = document.getElementById('quiz');
const progressEl = document.getElementById('progress-bar');
const modal = document.getElementById('notify-modal');

// Branching data
const quizData = {
  q1: {
    question: "How long after cleansing in the morning do you begin to feel oily?",
    options: [
      { text: "Never / After 12+ hours", next: "q2a" },
      { text: "6–9 hours after", next: "q2b" },
      { text: "Immediately to 5 hours after", next: "q2b" },
    ],
  },
  q2a: {
    question: "How often does your skin feel tight, dry, or flaky?",
    options: [
      { text: "Yes, often", next: "result-dry" },
      { text: "Sometimes", next: "result-normal" },
      { text: "Never", next: "result-balanced" },
    ],
  },
  q2b: {
    question: "Where does your skin feel oily?",
    options: [
      { text: "All over", next: "result-oily" },
      { text: "Only some oily areas", next: "result-combo" },
    ],
  },
};

const results = {
  "result-dry": { label: "Dry Skin", recommendation: ["HydraBalance Gel", "Cran-Peptide Cream"] },
  "result-oily": { label: "Oily Skin", recommendation: ["Ultra Gentle Cleanser", "Mandelic Serum 8%"] },
  "result-combo": { label: "Combination Skin", recommendation: ["Green Tea Cleanser", "HydraBalance Gel"] },
  "result-balanced": { label: "Balanced Skin", recommendation: ["Daily SPF", "Enzyme Mask"] },
  "result-normal": { label: "Normal Skin", recommendation: ["Antioxidant Peptide Serum", "Glycolic Serum 5%"] },
};

let userAnswers = [];

function updateProgress(stepKey){
  const pct = stepKey.startsWith('q1') ? 10 : (stepKey.startsWith('q2') ? 55 : 100);
  progressEl.style.width = pct + '%';
}

function renderQuestion(stepKey){
  updateProgress(stepKey);
  const data = quizData[stepKey];
  quizEl.innerHTML = `
    <h2 class="question">${data.question}</h2>
    <div class="options" id="options"></div>
  `;
  const optionsEl = document.getElementById('options');
  data.options.forEach(opt => {
    const b = document.createElement('button');
    b.className = 'option-btn';
    b.textContent = opt.text;
    b.addEventListener('click', () => {
      userAnswers.push({ question: data.question, answer: opt.text });
      if (opt.next.startsWith('result')) {
        showResult(opt.next);
      } else {
        renderQuestion(opt.next);
      }
    });
    optionsEl.appendChild(b);
  });
}

function showResult(resultKey){
  updateProgress('result');
  const result = results[resultKey];
  const recList = result.recommendation.map(r => `<li>${r}</li>`).join('');

  quizEl.innerHTML = `
    <h2 class="question">Your Skin Type: ${result.label}</h2>
    <p>We recommend starting here:</p>
    <ul>${recList}</ul>

    <div class="links-row" style="margin:.5rem 0 1.25rem">
      <a class="btn btn-outline" href="https://www.lydsskinbar.com/s/shop" target="_blank" rel="noopener">Shop LSB Products</a>
    </div>

    <hr style="border:none; border-top:1px solid #eee; margin: 1rem 0 1.25rem;" />

    <h3 style="margin:.25rem 0 .5rem;">Want a custom routine from our estheticians?</h3>
    <p style="margin-top:0">Share your info and we’ll reach out.</p>

    <form id="followup-form">
      <label for="name">Name</label>
      <input id="name" type="text" placeholder="Your name" required />

      <label for="email">Email</label>
      <input id="email" type="email" placeholder="you@example.com" required />

      <label for="phone">Phone (optional)</label>
      <input id="phone" type="tel" placeholder="555-555-5555" />

      <div style="display:flex; gap:.75rem; flex-wrap:wrap; margin-top:.5rem;">
        <button type="submit" class="btn btn-primary">Get Custom Routine</button>
      </div>
    </form>
  `;

  const form = document.getElementById('followup-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();

    try {
      await fetch(SHEETS_WEBHOOK, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          answers: userAnswers,
          result: result.label,
          name, email, phone
        })
      });
    } catch (err) {
      console.error('Sheets error', err);
    }

    // show modal then redirect to stories
    modal.style.display = 'flex';
    setTimeout(() => {
      window.location.href = 'https://www.lydsskinbar.com/s/stories';
    }, 2000);
  });
}

// INIT
renderQuestion('q1');