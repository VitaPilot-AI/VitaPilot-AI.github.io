// VitaPilot AI — small interactions, kept deliberately light.

const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Hero: highlight what we read in the brief, one facet at a time, then reveal matches.
const marks = document.querySelectorAll(".brief .hl");
const deck = document.getElementById("deck");
const status = document.getElementById("briefStatus");
const cards = deck ? Array.from(deck.querySelectorAll(".match-card")) : [];

cards.forEach((card, i) => (card.dataset.pos = i));

if (prefersReduced) {
  marks.forEach((m) => m.classList.add("on"));
  if (status) status.textContent = "3 matches";
} else {
  deck && deck.classList.add("hidden");
  marks.forEach((m, i) => setTimeout(() => m.classList.add("on"), 500 + i * 450));
  setTimeout(() => {
    deck && deck.classList.remove("hidden");
    if (status) status.textContent = "3 matches";
  }, 500 + marks.length * 450 + 200);
}

// "Next match" sends the top card to the back of the deck.
const passBtn = document.getElementById("passBtn");
let busy = false;
if (passBtn) {
  passBtn.addEventListener("click", () => {
    if (busy || !cards.length) return;
    const top = cards.find((c) => c.dataset.pos === "0");
    const advance = () => {
      cards.forEach((c) => (c.dataset.pos = (Number(c.dataset.pos) + cards.length - 1) % cards.length));
      top.classList.remove("leaving");
      busy = false;
    };
    busy = true;
    if (prefersReduced) return advance();
    top.classList.add("leaving");
    setTimeout(advance, 420);
  });
}

// Scroll-reveal for section blocks.
const revealTargets = document.querySelectorAll(
  ".section-head, .facet, .step, .split-copy, .chain, .contact-inner"
);

if (prefersReduced || !("IntersectionObserver" in window)) {
  revealTargets.forEach((el) => el.classList.add("in"));
} else {
  revealTargets.forEach((el, i) => {
    el.classList.add("reveal");
    el.style.transitionDelay = `${Math.min(i % 5, 4) * 60}ms`;
  });
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
  );
  revealTargets.forEach((el) => io.observe(el));
}
