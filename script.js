// =====================
// QUIZ LOGIC + SHEETS
// =====================
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
  "result-dry":    { label: "Dry Skin",        recommendation: ["HydraBalance Gel", "Cran-Peptide Cream"] },
  "result-oily":   { label: "Oily Skin",       recommendation: ["Ultra Gentle Cleanser", "Mandelic Serum 8%"] },
  "result-combo":  { label: "Combination Skin",recommendation: ["Green Tea Cleanser", "HydraBalance Gel"] },
  "result-balanced":{label: "Balanced Skin",   recommendation: ["Daily SPF", "Enzyme Mask"] },
  "result-normal": { label: "Normal Skin",     recommendation: ["Antioxidant Peptide Serum", "Glycolic Serum 5%"] },
};

let userAnswers = [];

function updateProgress(stepKey){
  // naive progress: ~10% -> ~55% -> 100%
  if (!progressEl) return;
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
    b.type = 'button';
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

function linkify(rec) {
  const url = `https://www.lydsskinbar.com/s/shop?search=${encodeURIComponent(rec)}`;
  return `<li><a href="${url}" target="_blank" rel="noopener">${rec}</a></li>`;
}

function showResult(resultKey){
  updateProgress('result');
  const result = results[resultKey];
  const recList = result.recommendation.map(linkify).join('');

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

    <form id="followup-form" autocomplete="on" novalidate>
      <label for="name">Name</label>
      <input id="name" name="name" type="text" placeholder="Your name" required />

      <label for="email">Email</label>
      <input id="email" name="email" type="email" placeholder="you@example.com" required inputmode="email" />

      <label for="phone">Phone (optional)</label>
      <input id="phone" name="phone" type="tel" placeholder="555-555-5555" inputmode="tel" />

      <div style="display:flex; gap:.75rem; flex-wrap:wrap; margin-top:.5rem;">
        <button id="submit-btn" type="submit" class="btn btn-primary">Get Custom Routine</button>
      </div>
    </form>
    <p id="confirmation" style="display:none; color: green; margin-top:.75rem;">Thank you! We'll be in touch soon.</p>
  `;

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
      answers: userAnswers,
      result: result.label,
      name, email, phone
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
      document.getElementById('confirmation').style.display = 'block';
      if (modal) {
        modal.classList.add('show');
        setTimeout(() => modal.classList.remove('show'), 1500);
      }
      setTimeout(() => {
        window.location.href = 'https://www.lydsskinbar.com/s/stories';
      }, 1800);

    } catch (err) {
      console.error('Sheets error', err);
      alert("Sorry, we couldn’t submit right now. Please try again in a moment.");
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
}

// INIT
renderQuestion('q1');
