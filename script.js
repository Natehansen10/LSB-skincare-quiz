<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>LSB Skincare Quiz</title>
  <link rel="stylesheet" href="https://use.typekit.net/uby7sdn.css">
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <header class="hero" role="banner">
    <div class="hero__inner">
      <span class="badge">LSB • Your skin, our obsession</span>
      <h1>Find Your Skin Type. Get Your Custom Routine.</h1>
      <p>Take our quick, dynamic quiz to identify your skin type and get product recommendations curated by Lyds Skin Bar in Provo, Utah.</p>
    </div>
  </header>
  <section class="section" aria-label="Skincare quiz">
    <div class="quiz-wrap" id="quiz-card">
      <div class="progress" aria-hidden="true"><span id="progress-bar"></span></div>
      <div id="quiz"></div>
    </div>
  </section>
  <div class="parallax-strip" aria-hidden="true"></div>
  <div class="modal" id="notify-modal" role="dialog" aria-modal="true" aria-labelledby="notify-title">
    <div class="modal__card">
      <h3 id="notify-title">Your estheticians are reviewing your responses</h3>
      <p>We’ll deliver your custom routine as soon as possible.</p>
    </div>
  </div>
  <script>
    const SHEETS_WEBHOOK = "https://script.google.com/macros/s/AKfycbx99ra8wZyF-LNEeXiBOxjyP3ilmFuHiBhQUcWsNL1ueFLfs2Lkrd6feIuXo09Fmco1lQ/exec";
    const quizEl = document.getElementById('quiz');
    const progressEl = document.getElementById('progress-bar');
    const modal = document.getElementById('notify-modal');
    const quizData = {
      q1: { question: "How long after cleansing in the morning do you begin to feel oily?", options: [ { text: "Never / After 12+ hours", next: "q2a" }, { text: "6–9 hours after", next: "q2b" }, { text: "Immediately to 5 hours after", next: "q2b" } ] },
      q2a: { question: "How often does your skin feel tight, dry, or flaky?", options: [ { text: "Yes, often", next: "result-dry" }, { text: "Sometimes", next: "result-normal" }, { text: "Never", next: "result-balanced" } ] },
      q2b: { question: "Where does your skin feel oily?", options: [ { text: "All over", next: "result-oily" }, { text: "Only some oily areas", next: "result-combo" } ] }
    };
    const results = {
      "result-dry": { label: "Dry Skin", recommendation: ["HydraBalance Gel", "Cran-Peptide Cream"] },
      "result-oily": { label: "Oily Skin", recommendation: ["Ultra Gentle Cleanser", "Mandelic Serum 8%"] },
      "result-combo": { label: "Combination Skin", recommendation: ["Green Tea Cleanser", "HydraBalance Gel"] },
      "result-balanced": { label: "Balanced Skin", recommendation: ["Daily SPF", "Enzyme Mask"] },
      "result-normal": { label: "Normal Skin", recommendation: ["Antioxidant Peptide Serum", "Glycolic Serum 5%"] }
    };
    let userAnswers = [];
    function updateProgress(stepKey){ const pct = stepKey.startsWith('q1') ? 10 : (stepKey.startsWith('q2') ? 55 : 100); progressEl.style.width = pct + '%'; }
    function renderQuestion(stepKey){
      updateProgress(stepKey);
      const data = quizData[stepKey];
      quizEl.innerHTML = `<h2 class="question">${data.question}</h2><div class="options" id="options"></div>`;
      const optionsEl = document.getElementById('options');
      data.options.forEach(opt => {
        const b = document.createElement('button');
        b.className = 'option-btn';
        b.textContent = opt.text;
        b.addEventListener('click', () => {
          userAnswers.push({ question: data.question, answer: opt.text });
          if (opt.next.startsWith('result')) { showResult(opt.next); } else { renderQuestion(opt.next); }
        });
        optionsEl.appendChild(b);
      });
    }
    function showResult(resultKey){
      updateProgress('result');
      const result = results[resultKey];
      const recList = result.recommendation.map(r => `<li>${r}</li>`).join('');
      quizEl.innerHTML = `<h2 class="question">Your Skin Type: ${result.label}</h2><p>We recommend starting here:</p><ul>${recList}</ul><div class="links-row" style="margin:.5rem 0 1.25rem"><a class="btn btn-outline" href="https://www.lydsskinbar.com/s/shop" target="_blank" rel="noopener">Shop LSB Products</a></div><hr style='border:none; border-top:1px solid #eee; margin: 1rem 0 1.25rem;' /><h3 style="margin:.25rem 0 .5rem;">Want a custom routine from our estheticians?</h3><p style="margin-top:0">Share your info and we’ll reach out.</p><form id="followup-form"><label for="name">Name</label><input id="name" type="text" placeholder="Your name" required /><label for="email">Email</label><input id="email" type="email" placeholder="you@example.com" required /><label for="phone">Phone (optional)</label><input id="phone" type="tel" placeholder="555-555-5555" /><div style="display:flex; gap:.75rem; flex-wrap:wrap; margin-top:.5rem;"><button type="submit" class="btn btn-primary">Get Custom Routine</button></div></form>`;
      document.getElementById('followup-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('email').value.trim();
        const phone = document.getElementById('phone').value.trim();
        try {
          await fetch(SHEETS_WEBHOOK, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ answers: userAnswers, result: result.label, name, email, phone })
          });
        } catch (err) { console.error('Sheets error', err); }
        modal.style.display = 'flex';
        setTimeout(() => { window.location.href = 'https://www.lydsskinbar.com/s/stories'; }, 2000);
      });
    }
    renderQuestion('q1');
  </script>
</body>
</html>
