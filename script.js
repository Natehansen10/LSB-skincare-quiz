const quiz = document.getElementById('quiz');
const nextBtn = document.getElementById('next-btn');

// Define quiz steps
const quizData = {
  q1: {
    question: "How long after cleansing in the morning do you begin to feel oily?",
    options: [
      { text: "Never/After 12+ hours", next: "q2a" },
      { text: "6–9 Hours After", next: "q2b" },
      { text: "Immediately to 5 hours after", next: "q2b" },
    ],
  },
  q2a: {
    question: "How often does your skin feel tight, dry, or flaky?",
    options: [
      { text: "Yes, Often", next: "result-dry" },
      { text: "Sometimes", next: "result-normal" },
      { text: "Never", next: "result-balanced" },
    ],
  },
  q2b: {
    question: "Where does your skin feel oily?",
    options: [
      { text: "All Over", next: "result-oily" },
      { text: "Only some oily areas", next: "result-combo" },
    ],
  },
};

const results = {
  "result-dry": {
    label: "Dry Skin",
    recommendation: [
      "HydraBalance Gel",
      "Cran-Peptide Cream"
    ],
  },
  "result-oily": {
    label: "Oily Skin",
    recommendation: [
      "Ultra Gentle Cleanser",
      "Mandelic Serum 8%"
    ],
  },
  "result-combo": {
    label: "Combination Skin",
    recommendation: [
      "Green Tea Cleanser",
      "HydraBalance Gel"
    ],
  },
  "result-balanced": {
    label: "Balanced Skin",
    recommendation: [
      "Daily SPF",
      "Enzyme Mask"
    ],
  },
  "result-normal": {
    label: "Normal Skin",
    recommendation: [
      "Antioxidant Peptide Serum",
      "Glycolic Serum 5%"
    ],
  },
};

let currentStep = 'q1';
let userAnswers = [];

function renderQuestion(step) {
  const data = quizData[step];
  quiz.innerHTML = `<h2>${data.question}</h2>`;
  data.options.forEach(opt => {
    const btn = document.createElement('button');
    btn.innerText = opt.text;
    btn.onclick = () => {
      userAnswers.push({ question: data.question, answer: opt.text });
      if (opt.next.startsWith('result')) {
        showResult(opt.next);
      } else {
        renderQuestion(opt.next);
      }
    };
    quiz.appendChild(btn);
  });
}

function showResult(resultKey) {
  const result = results[resultKey];
  quiz.innerHTML = `
    <h2>Your Skin Type: ${result.label}</h2>
    <p>We recommend:</p>
    <ul>
      ${result.recommendation.map(r => `<li><a href="https://lydsskinbar.com/search?q=${encodeURIComponent(r)}" target="_blank">${r}</a></li>`).join("")}
    </ul>
    <p>Thanks for taking the LSB Skin Quiz!</p>
  `;

  // OPTIONAL: Send to Google Sheets
  sendToSheets(result.label);
}

function sendToSheets(skinType) {
  fetch('https://script.google.com/macros/s/AKfycbxgtBppBvXYm-GpGl0L7FLny51-Xbzg9dXrauoXR-_N/exec', {
    method: 'POST',
    body: JSON.stringify({
      answers: userAnswers,
      result: skinType,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

renderQuestion(currentStep);
