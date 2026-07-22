// VitaPilot AI — small interactions, kept deliberately light.

// Current year in footer.
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Scroll-reveal for section blocks (respects reduced motion).
const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const revealTargets = document.querySelectorAll(
  ".section-head, .card, .step, .readout-item, .audience li, .mission-quote, .contact-inner"
);

if (prefersReduced || !("IntersectionObserver" in window)) {
  revealTargets.forEach((el) => el.classList.add("in"));
} else {
  revealTargets.forEach((el, i) => {
    el.classList.add("reveal");
    el.style.transitionDelay = `${Math.min(i % 4, 3) * 70}ms`;
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
