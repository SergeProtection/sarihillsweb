document.getElementById("year").textContent = new Date().getFullYear();

const figures = Array.from(document.querySelectorAll(".gallery-grid figure"));
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightbox-img");
let currentIndex = 0;

function openLightbox(index) {
  currentIndex = index;
  const img = figures[currentIndex].querySelector("img");
  lightboxImg.src = img.src;
  lightboxImg.alt = img.alt;
  lightbox.classList.add("open");
}

function closeLightbox() {
  lightbox.classList.remove("open");
}

function showNext(step) {
  currentIndex = (currentIndex + step + figures.length) % figures.length;
  const img = figures[currentIndex].querySelector("img");
  lightboxImg.src = img.src;
  lightboxImg.alt = img.alt;
}

figures.forEach((figure, index) => {
  figure.addEventListener("click", () => openLightbox(index));
});

document.getElementById("lightbox-close").addEventListener("click", closeLightbox);
document.getElementById("lightbox-prev").addEventListener("click", () => showNext(-1));
document.getElementById("lightbox-next").addEventListener("click", () => showNext(1));

lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) closeLightbox();
});

document.addEventListener("keydown", (e) => {
  if (!lightbox.classList.contains("open")) return;
  if (e.key === "Escape") closeLightbox();
  if (e.key === "ArrowRight") showNext(1);
  if (e.key === "ArrowLeft") showNext(-1);
});
