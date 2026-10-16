document.documentElement.classList.add("is-ready");

let smoothScroll = null;

if (window.Lenis) {
  smoothScroll = new window.Lenis({
    duration: 1.1,
    easing: (time) => Math.min(1, 1.001 - Math.pow(2, -10 * time)),
    orientation: "vertical",
    gestureOrientation: "vertical",
    smoothWheel: true,
    syncTouch: true,
    touchMultiplier: 1.2,
    infinite: false
  });

  const lenisFrame = (time) => {
    smoothScroll.raf(time);
    requestAnimationFrame(lenisFrame);
  };
  requestAnimationFrame(lenisFrame);
}

const hero = document.querySelector(".hero");
const revealTargets = hero ? [...hero.querySelectorAll(".hero__title")] : [];

if (hero && revealTargets.length) {
  const scrollTargets = revealTargets.map((target) => {
    const clone = target.cloneNode(true);
    clone.removeAttribute("id");
    clone.setAttribute("aria-hidden", "true");
    clone.classList.add("hero__reveal-scroll");
    if (target.classList.contains("hero__title")) clone.classList.add("hero__title--scroll");
    (target.closest("h1") || target).after(clone);
    return clone;
  });

  const masks = revealTargets.map(() => document.createElement("canvas"));
  const contexts = masks.map((mask) => mask.getContext("2d"));
  const targetCursor = { x: 0, y: 0 };
  const cursor = { x: 0, y: 0 };
  let frameId = 0;
  let hovering = false;
  let scrollProgress = 0;
  let scrollLocked = false;
  let scrollUnlockTimer = 0;
  let scrollReadyAt = 0;
  let lastTouchY = null;
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const resizeMasks = () => revealTargets.forEach((target, index) => {
    const bounds = target.getBoundingClientRect();
    masks[index].width = Math.ceil(bounds.width);
    masks[index].height = Math.ceil(bounds.height);
  });

  const setMask = (target, mask) => {
    const image = `url("${mask.toDataURL("image/png")}")`;
    target.style.webkitMaskImage = image;
    target.style.maskImage = image;
    target.style.webkitMaskSize = "100% 100%";
    target.style.maskSize = "100% 100%";
  };

  const clearReveal = () => {
    hovering = false;
    cancelAnimationFrame(frameId);
    frameId = 0;
    revealTargets.forEach((target, index) => {
      contexts[index].clearRect(0, 0, masks[index].width, masks[index].height);
      setMask(target, masks[index]);
    });
  };

  const drawReveal = () => revealTargets.forEach((target, index) => {
    const bounds = target.getBoundingClientRect();
    const x = cursor.x - bounds.left;
    const y = cursor.y - bounds.top;
    const radius = Math.max(190, Math.min(260, bounds.width * 0.25));
    const context = contexts[index];
    const mask = masks[index];
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
    gradient.addColorStop(0.4, "rgba(255, 255, 255, 1)");
    gradient.addColorStop(0.6, "rgba(255, 255, 255, 0.75)");
    gradient.addColorStop(0.75, "rgba(255, 255, 255, 0.4)");
    gradient.addColorStop(0.88, "rgba(255, 255, 255, 0.12)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    context.clearRect(0, 0, mask.width, mask.height);
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
    setMask(target, mask);
  });

  const animate = () => {
    if (!hovering) return;
    const easing = reducedMotion ? 1 : 0.18;
    cursor.x += (targetCursor.x - cursor.x) * easing;
    cursor.y += (targetCursor.y - cursor.y) * easing;
    drawReveal();
    frameId = Math.hypot(targetCursor.x - cursor.x, targetCursor.y - cursor.y) > 0.5 ? requestAnimationFrame(animate) : 0;
  };

  const updatePointer = (event) => {
    if (scrollProgress > 0 || !finePointer || event.pointerType !== "mouse") return;
    targetCursor.x = event.clientX;
    targetCursor.y = event.clientY;
    if (!hovering) { cursor.x = targetCursor.x; cursor.y = targetCursor.y; hovering = true; }
    if (!frameId) frameId = requestAnimationFrame(animate);
  };

  const setScrollReveal = (visible) => {
    const nextProgress = visible ? 1 : 0;
    if (nextProgress === scrollProgress) return;
    if (visible) clearReveal();
    scrollProgress = nextProgress;
    scrollTargets.forEach((target) => { target.style.opacity = String(scrollProgress); });
  };

  const keepScrollLocked = () => {
    clearTimeout(scrollUnlockTimer);
    const remaining = Math.max(160, scrollReadyAt - performance.now());
    scrollUnlockTimer = window.setTimeout(() => {
      scrollLocked = false;
      if (smoothScroll) smoothScroll.start();
    }, remaining);
  };

  const revealBeforeScroll = () => {
    if (smoothScroll) {
      smoothScroll.stop();
      smoothScroll.scrollTo(0, { immediate: true, force: true });
    }
    setScrollReveal(true);
    scrollLocked = true;
    scrollReadyAt = performance.now() + 720;
    keepScrollLocked();
  };

  const hideAtTop = () => {
    if (smoothScroll) {
      smoothScroll.stop();
      smoothScroll.scrollTo(0, { immediate: true, force: true });
    }
    setScrollReveal(false);
    scrollLocked = true;
    scrollReadyAt = performance.now() + 720;
    keepScrollLocked();
  };

  resizeMasks();
  clearReveal();
  hero.addEventListener("pointerenter", updatePointer);
  hero.addEventListener("pointermove", updatePointer, { passive: true });
  hero.addEventListener("pointerleave", clearReveal);
  window.addEventListener("wheel", (event) => {
    const atTop = window.scrollY <= 2;
    if (scrollLocked) {
      event.preventDefault();
      keepScrollLocked();
      return;
    }
    if (atTop && event.deltaY > 0 && scrollProgress < 1) {
      event.preventDefault();
      revealBeforeScroll();
    } else if (atTop && event.deltaY < 0 && scrollProgress > 0) {
      event.preventDefault();
      hideAtTop();
    }
  }, { passive: false, capture: true });
  window.addEventListener("touchstart", (event) => { lastTouchY = event.touches[0]?.clientY ?? null; }, { passive: true });
  window.addEventListener("touchmove", (event) => {
    const currentY = event.touches[0]?.clientY;
    if (lastTouchY === null || currentY === undefined) return;
    const delta = lastTouchY - currentY;
    const atTop = window.scrollY <= 2;
    if (scrollLocked) {
      event.preventDefault();
      keepScrollLocked();
    } else if (atTop && delta > 0 && scrollProgress < 1) {
      event.preventDefault();
      revealBeforeScroll();
    } else if (atTop && delta < 0 && scrollProgress > 0) {
      event.preventDefault();
      hideAtTop();
    }
    lastTouchY = currentY;
  }, { passive: false, capture: true });
  window.addEventListener("touchend", () => { lastTouchY = null; }, { passive: true });
  window.addEventListener("keydown", (event) => {
    const atTop = window.scrollY <= 2;
    if (scrollLocked) {
      if (["ArrowDown", "PageDown", " ", "ArrowUp", "PageUp"].includes(event.key)) event.preventDefault();
      return;
    }
    if (atTop && ["ArrowDown", "PageDown", " "].includes(event.key) && scrollProgress < 1) {
      event.preventDefault();
      revealBeforeScroll();
    } else if (atTop && ["ArrowUp", "PageUp"].includes(event.key) && scrollProgress > 0) {
      event.preventDefault();
      hideAtTop();
    }
  });
  window.addEventListener("resize", () => { resizeMasks(); if (!hovering) clearReveal(); }, { passive: true });
  window.addEventListener("pagehide", () => cancelAnimationFrame(frameId));
}

const practiceCards = [...document.querySelectorAll(".practice-card")];

if (practiceCards.length) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let cardsFrame = 0;

  const updateCards = () => {
    cardsFrame = 0;
    const viewportHeight = window.innerHeight;
    const isMobile = window.innerWidth <= 767;
    const targetTop = isMobile ? 60 : window.innerWidth <= 991 ? 80 : 100;
    const maxRotate = isMobile ? 55 : 80;
    const maxTranslate = isMobile ? 35 : 60;
    const maxScale = isMobile ? .05 : .08;

    practiceCards.forEach((card) => {
      const surface = card.querySelector(".practice-card__surface");
      if (!surface) return;

      if (reducedMotion) {
        surface.style.transform = "none";
        surface.style.opacity = "1";
        return;
      }

      const rect = card.getBoundingClientRect();
      const raw = Math.max(0, Math.min(1, (viewportHeight - rect.top) / (viewportHeight - targetTop)));
      const eased = 1 - Math.pow(1 - raw, 2.5);
      const rotate = (1 - eased) * maxRotate;
      const translate = (1 - eased) * maxTranslate;
      const scale = 1 + (1 - eased) * maxScale;
      surface.style.transform = raw >= 1
        ? "translate3d(0, 0, 0) rotateX(0deg) scale(1)"
        : `translate3d(0, ${translate}px, 0) rotateX(${rotate}deg) scale(${scale})`;
      surface.style.opacity = String(.4 + eased * .6);
    });
  };

  const scheduleCards = () => {
    if (!cardsFrame) cardsFrame = requestAnimationFrame(updateCards);
  };

  scheduleCards();
  if (smoothScroll) smoothScroll.on("scroll", scheduleCards);
  else window.addEventListener("scroll", scheduleCards, { passive: true });
  window.addEventListener("resize", scheduleCards, { passive: true });
  window.addEventListener("load", scheduleCards, { once: true });
}

document.querySelectorAll("[data-modal]").forEach((trigger) => {
  const modal = document.getElementById(trigger.dataset.modal);
  if (!modal || typeof modal.showModal !== "function") return;
  trigger.addEventListener("click", () => {
    modal.showModal();
    if (smoothScroll) smoothScroll.stop();
  });
});

document.querySelectorAll(".service-modal").forEach((modal) => {
  modal.addEventListener("close", () => { if (smoothScroll) smoothScroll.start(); });
  modal.addEventListener("click", (event) => { if (event.target === modal) modal.close(); });
  modal.querySelector("[data-close-modal]")?.addEventListener("click", () => modal.close());
});

const faqItems = [...document.querySelectorAll(".faq__item")];

if (faqItems.length) {
  faqItems.forEach((item) => {
    item.addEventListener("toggle", () => {
      if (!item.open) return;
      faqItems.forEach((other) => {
        if (other !== item) other.open = false;
      });
    });
  });
}

const aboutSection = document.querySelector(".about");

if (aboutSection) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let aboutRevealed = false;

  const revealAbout = () => {
    if (aboutRevealed) return;
    aboutRevealed = true;
    aboutSection.classList.add("is-visible");
  };

  const aboutInView = () => {
    const rect = aboutSection.getBoundingClientRect();
    return rect.top < window.innerHeight * 0.88 && rect.bottom > window.innerHeight * 0.08;
  };

  if (reducedMotion || !("IntersectionObserver" in window)) {
    revealAbout();
  } else {
    const aboutObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        revealAbout();
        aboutObserver.unobserve(aboutSection);
      });
    }, { threshold: window.innerWidth <= 700 ? .05 : .12 });

    aboutObserver.observe(aboutSection);

    const syncAboutReveal = () => {
      if (!aboutInView()) return;
      revealAbout();
      aboutObserver.unobserve(aboutSection);
      if (smoothScroll) smoothScroll.off("scroll", syncAboutReveal);
      window.removeEventListener("scroll", syncAboutReveal);
    };

    if (smoothScroll) smoothScroll.on("scroll", syncAboutReveal);
    window.addEventListener("scroll", syncAboutReveal, { passive: true });
    requestAnimationFrame(syncAboutReveal);
  }
}

const contactSection = document.querySelector(".contact");

if (contactSection) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reducedMotion || !("IntersectionObserver" in window)) {
    contactSection.classList.add("is-visible");
  } else {
    const contactObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        contactSection.classList.toggle("is-visible", entry.isIntersecting);
      });
    }, { threshold: .2 });

    contactObserver.observe(contactSection);
  }
}
