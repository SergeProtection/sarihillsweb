document.getElementById("year").textContent = new Date().getFullYear();

const siteHeader = document.getElementById("site-header");

function updateHeader() {
  siteHeader.classList.toggle("is-top", window.scrollY < 40);
}

updateHeader();
window.addEventListener("scroll", updateHeader, { passive: true });

const navToggle = document.getElementById("nav-toggle");
const navLinks = document.getElementById("nav-links");

function closeNav() {
  navLinks.classList.remove("open");
  navToggle.setAttribute("aria-expanded", "false");
}

navToggle.addEventListener("click", () => {
  const isOpen = navLinks.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
});

navLinks.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", closeNav);
});

document.addEventListener("click", (e) => {
  if (!navLinks.classList.contains("open")) return;
  if (!navLinks.contains(e.target) && !navToggle.contains(e.target)) closeNav();
});

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

// Gallery backdrop collage. Purely decorative and kept last so a failure here cannot affect
// anything above. Tall photos get tall tiles and wide photos get wide tiles; the number of
// columns and rows is chosen so whole tiles fit the panel exactly (nothing cut off at the edges).
const gallerySection = document.getElementById("gallery");

if (gallerySection && "ResizeObserver" in window) {
  const portraits = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"];
  const landscapes = ["l1", "l2", "l3", "l4", "l5", "l6", "l7"];
  const pattern = ["P", "L", "P", "L", "L"];
  const collage = document.createElement("div");
  const collageGrid = document.createElement("div");
  let collageKey = "";

  collage.className = "collage";
  collage.setAttribute("aria-hidden", "true");
  collageGrid.className = "collage-grid";
  collage.appendChild(collageGrid);
  gallerySection.insertBefore(collage, gallerySection.firstChild);

  function buildCollage() {
    const width = gallerySection.clientWidth;
    const height = gallerySection.clientHeight;
    const margin = 18;
    const gap = width <= 700 ? 12 : 16;
    const target = width <= 700 ? 150 : width <= 1100 ? 250 : 330;
    const cols = Math.max(2, Math.round((width - 2 * margin + gap) / (target + gap)));
    const tileWidth = (width - 2 * margin - (cols - 1) * gap) / cols;
    const rowHeight = tileWidth / 1.4;
    const rows = Math.max(2, Math.round((height - 2 * margin + gap) / (rowHeight + gap)));
    const key = cols + "x" + rows;

    if (key === collageKey) return;
    collageKey = key;
    collageGrid.textContent = "";
    collageGrid.style.setProperty("--cols", cols);
    collageGrid.style.setProperty("--rows", rows);

    // 1) Lay out the tiles column by column: tall photos take 2 rows, wide photos 1.
    const slots = [];

    for (let col = 0; col < cols; col++) {
      let row = 1;
      let step = 0;

      while (row <= rows) {
        const tall = pattern[(step + col * 2) % pattern.length] === "P" && rows - row >= 1;

        slots.push({ col, row, tall });
        row += tall ? 2 : 1;
        step++;
      }
    }

    // 2) Give each slot the matching photo that is farthest from every copy already placed,
    //    so the same photo is never near itself (unused photos count as infinitely far).
    slots.sort((a, b) => a.row - b.row || a.col - b.col);
    const placed = {};
    const uses = {};

    slots.forEach((slot) => {
      const x = slot.col * (tileWidth + gap);
      const y = (slot.row - 1 + (slot.tall ? 1 : 0.5)) * (rowHeight + gap);
      const pool = slot.tall ? portraits : landscapes;
      let best = pool[0];
      let bestDistance = -1;

      pool.forEach((name) => {
        const distance = (placed[name] || []).reduce((nearest, spot) => Math.min(nearest, Math.hypot(spot.x - x, spot.y - y)), Infinity);
        const better = distance > bestDistance || (distance === bestDistance && (uses[name] || 0) < (uses[best] || 0));

        if (better) {
          best = name;
          bestDistance = distance;
        }
      });

      (placed[best] = placed[best] || []).push({ x, y });
      uses[best] = (uses[best] || 0) + 1;
      slot.name = best;
    });

    // 3) Build the tiles.
    slots.forEach((slot) => {
      const tile = document.createElement("div");
      const img = document.createElement("img");

      tile.className = "collage-tile";
      tile.style.gridColumn = String(slot.col + 1);
      tile.style.gridRow = slot.row + " / span " + (slot.tall ? 2 : 1);
      img.src = "images/collage-tiles/" + slot.name + ".jpg";
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      tile.appendChild(img);
      collageGrid.appendChild(tile);
    });
  }

  new ResizeObserver(buildCollage).observe(gallerySection);
}
