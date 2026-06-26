document.addEventListener('DOMContentLoaded', function() {
  initAgeGate();
  initCartDrawer();
  initStickyHeader();
  initQtySelectors();
  initAjaxAddToCart();
  initScrollAnimations();
  initCardInteractions();
  initVaporDrift();
  initVariantSwatches();
});

/* ==========================================
   1. Age Gate Verification
   ========================================== */
function initAgeGate() {
  const ageGate = document.getElementById('age-gate-overlay');
  if (!ageGate) return;

  const isVerified = localStorage.getItem('age_verified') === 'true';

  if (isVerified) {
    ageGate.style.display = 'none';
    document.documentElement.removeAttribute('data-drawer-open');
  } else {
    ageGate.style.display = 'flex';
    document.documentElement.setAttribute('data-drawer-open', 'true');
  }

  const enterBtn = document.getElementById('age-gate-enter');
  const leaveBtn = document.getElementById('age-gate-leave');
  const actionContainer = document.getElementById('age-gate-actions');
  const deniedContainer = document.getElementById('age-gate-denied');

  if (enterBtn) {
    enterBtn.addEventListener('click', function(e) {
      e.preventDefault();
      localStorage.setItem('age_verified', 'true');
      ageGate.style.opacity = '0';
      ageGate.style.transition = 'opacity 0.5s ease-out';
      document.documentElement.removeAttribute('data-drawer-open');
      setTimeout(() => {
        ageGate.style.display = 'none';
      }, 500);
    });
  }

  if (leaveBtn) {
    leaveBtn.addEventListener('click', function(e) {
      e.preventDefault();
      if (actionContainer && deniedContainer) {
        actionContainer.style.display = 'none';
        deniedContainer.style.display = 'block';
        deniedContainer.style.animation = 'fadeIn 0.5s ease-out';
      }
    });
  }
}

/* ==========================================
   2. Cart Drawer Navigation
   ========================================== */
function initCartDrawer() {
  const drawer = document.getElementById('cart-drawer');
  const overlays = document.querySelectorAll('.cart-drawer-trigger');
  const closeBtn = document.getElementById('cart-drawer-close');
  const backdrop = document.getElementById('cart-drawer-backdrop');

  if (!drawer) return;

  function openDrawer() {
    drawer.setAttribute('aria-hidden', 'false');
    document.documentElement.setAttribute('data-drawer-open', 'true');
    fetchCartDrawerHTML();
  }

  function closeDrawer() {
    drawer.setAttribute('aria-hidden', 'true');
    document.documentElement.removeAttribute('data-drawer-open');
  }

  overlays.forEach(trigger => {
    trigger.addEventListener('click', function(e) {
      e.preventDefault();
      openDrawer();
    });
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', function(e) {
      e.preventDefault();
      closeDrawer();
    });
  }

  if (backdrop) {
    backdrop.addEventListener('click', function(e) {
      e.preventDefault();
      closeDrawer();
    });
  }

  // Bind close on ESC key
  window.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && drawer.getAttribute('aria-hidden') === 'false') {
      closeDrawer();
    }
  });
}

// Fetch dynamic cart drawer sections using Shopify Section Rendering API
function fetchCartDrawerHTML() {
  const container = document.getElementById('cart-drawer-items-container');
  if (!container) return;

  container.innerHTML = '<div class="drawer-loading">Updating Cart...</div>';

  fetch('/cart?sections=cart-drawer-items')
    .then(response => response.json())
    .then(data => {
      const html = data['cart-drawer-items'];
      if (html) {
        container.innerHTML = html;
        updateCartCountBubbles();
        initQtySelectorsInDrawer();
      }
    })
    .catch(err => {
      console.error('Error fetching cart drawer content:', err);
      container.innerHTML = '<div class="drawer-error">Unable to load cart. Please try again.</div>';
    });
}

function updateCartCountBubbles() {
  fetch('/cart.js')
    .then(response => response.json())
    .then(cart => {
      const counts = document.querySelectorAll('.cart-count-bubble');
      counts.forEach(el => {
        el.textContent = cart.item_count;
        if (cart.item_count > 0) {
          el.style.display = 'flex';
        } else {
          el.style.display = 'none';
        }
      });
    });
}

/* ==========================================
   3. Sticky Header
   ========================================== */
function initStickyHeader() {
  const header = document.querySelector('.site-header-wrapper');
  if (!header) return;

  window.addEventListener('scroll', function() {
    if (window.scrollY > 20) {
      header.classList.add('header--scrolled');
    } else {
      header.classList.remove('header--scrolled');
    }
  }, { passive: true });
}

/* ==========================================
   4. Quantity Selectors
   ========================================== */
function initQtySelectors() {
  document.body.addEventListener('click', function(e) {
    const trigger = e.target;
    if (trigger.classList.contains('qty-btn')) {
      const input = trigger.parentElement.querySelector('input.qty-input');
      if (!input) return;
      
      const val = parseInt(input.value) || 1;
      if (trigger.classList.contains('qty-plus')) {
        input.value = val + 1;
      } else if (trigger.classList.contains('qty-minus') && val > 1) {
        input.value = val - 1;
      }
      
      // Dispatch change event to trigger form calculation if needed
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
}

function initQtySelectorsInDrawer() {
  const container = document.getElementById('cart-drawer-items-container');
  if (!container) return;

  const qtyInputs = container.querySelectorAll('.drawer-qty-input');
  qtyInputs.forEach(input => {
    input.addEventListener('change', function() {
      const line = this.getAttribute('data-line');
      const qty = this.value;
      
      updateCartLineQty(line, qty);
    });
  });

  const removeBtns = container.querySelectorAll('.drawer-item-remove');
  removeBtns.forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      const line = this.getAttribute('data-line');
      updateCartLineQty(line, 0);
    });
  });
}

function updateCartLineQty(line, qty) {
  const container = document.getElementById('cart-drawer-items-container');
  if (container) {
    container.innerHTML = '<div class="drawer-loading">Updating Cart...</div>';
  }

  fetch('/cart/change.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ line: parseInt(line), quantity: parseInt(qty) })
  })
    .then(response => response.json())
    .then(cart => {
      fetchCartDrawerHTML();
    })
    .catch(err => {
      console.error('Error changing cart quantity:', err);
      fetchCartDrawerHTML();
    });
}

/* ==========================================
   5. AJAX Add To Cart (High Trust, smooth UX)
   ========================================== */
function initAjaxAddToCart() {
  document.body.addEventListener('submit', function(e) {
    const form = e.target;
    // Intercept standard product form submits to provide smooth drawer experience
    if (form.getAttribute('action') === '/cart/add' || form.action.includes('/cart/add')) {
      e.preventDefault();
      
      const submitBtn = form.querySelector('[type="submit"]');
      const originalText = submitBtn ? submitBtn.value || submitBtn.textContent : '';
      
      if (submitBtn) {
        if (submitBtn.nodeName === 'INPUT') {
          submitBtn.value = 'Adding...';
        } else {
          submitBtn.textContent = 'Adding...';
        }
        submitBtn.disabled = true;
      }

      const formData = new FormData(form);

      fetch('/cart/add.js', {
        method: 'POST',
        body: formData
      })
        .then(response => response.json())
        .then(item => {
          if (submitBtn) {
            if (submitBtn.nodeName === 'INPUT') {
              submitBtn.value = 'Added!';
            } else {
              submitBtn.textContent = 'Added!';
            }
            setTimeout(() => {
              if (submitBtn.nodeName === 'INPUT') {
                submitBtn.value = originalText;
              } else {
                submitBtn.textContent = originalText;
              }
              submitBtn.disabled = false;
            }, 1000);
          }
          
          // Open the cart drawer
          const drawer = document.getElementById('cart-drawer');
          if (drawer) {
            drawer.setAttribute('aria-hidden', 'false');
            document.documentElement.setAttribute('data-drawer-open', 'true');
            fetchCartDrawerHTML();
          }
        })
        .catch(err => {
          console.error('Error adding product to cart:', err);
          if (submitBtn) {
            if (submitBtn.nodeName === 'INPUT') {
              submitBtn.value = originalText;
            } else {
              submitBtn.textContent = originalText;
            }
            submitBtn.disabled = false;
          }
          // Fallback to traditional form submission if Ajax fails
          form.submit();
        });
    }
  });
}

/* ==========================================
   6. Intersection Observer Scroll Reveal
   ========================================== */
function initScrollAnimations() {
  const elements = document.querySelectorAll('.reveal-on-scroll');
  if (elements.length === 0) return;

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        obs.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.05,
    rootMargin: '0px 0px -40px 0px'
  });

  elements.forEach(el => observer.observe(el));
}

/* ==========================================
   7. Card Spotlight & 3D Tilt Integration
   ========================================== */
function initCardInteractions() {
  const supportsHover = window.matchMedia('(hover: hover)').matches;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  const cardSelector = '.product-card, .category-card, .bargain-card';

  document.body.addEventListener('mousemove', function(e) {
    const card = e.target.closest(cardSelector);
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Set cursor spotlights
    card.style.setProperty('--mouse-x', `${x}px`);
    card.style.setProperty('--mouse-y', `${y}px`);

    // 3D Parallax Tilt (disabled on touch & reduced motion)
    if (supportsHover && !prefersReducedMotion && !isTouch) {
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const rotateX = ((y - centerY) / centerY) * -8;
      const rotateY = ((x - centerX) / centerX) * 8;

      card.style.transform = `perspective(1000px) translateY(-5px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
      
      const img = card.querySelector('.product-card-img, .category-card-img, .bargain-card-img');
      if (img) {
        const moveX = ((x - centerX) / centerX) * -5;
        const moveY = ((y - centerY) / centerY) * -5;
        img.style.transform = `translate3d(${moveX}px, ${moveY}px, 0) scale(1.06)`;
      }
    }
  });

  document.body.addEventListener('mouseout', function(e) {
    const card = e.target.closest(cardSelector);
    if (!card) return;

    const related = e.relatedTarget;
    if (related && card.contains(related)) return;

    // Reset styles
    card.style.transform = '';
    card.style.removeProperty('--mouse-x');
    card.style.removeProperty('--mouse-y');

    const img = card.querySelector('.product-card-img, .category-card-img, .bargain-card-img');
    if (img) {
      img.style.transform = '';
    }
  });
}

/* ==========================================
   8. Ambient Vapor Drift Canvas Engine
   ========================================== */
function initVaporDrift() {
  const canvas = document.getElementById('hero-vapor-canvas');
  if (!canvas) return;

  const wrapper = canvas.parentElement;
  const ctx = canvas.getContext('2d');
  
  let animationFrameId;
  let particles = [];
  let width, height;
  let isVisible = false;
  
  let mouse = { x: -1000, y: -1000, active: false };
  
  function resize() {
    const rect = wrapper.getBoundingClientRect();
    width = canvas.width = Math.floor(rect.width / 4); // low resolution optimization
    height = canvas.height = Math.floor(rect.height / 4);
  }
  
  window.addEventListener('resize', resize);
  resize();

  const heroWrapper = wrapper.closest('.hero-section-wrapper');
  if (heroWrapper) {
    heroWrapper.addEventListener('mousemove', (e) => {
      const rect = wrapper.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * width;
      mouse.y = ((e.clientY - rect.top) / rect.height) * height;
      mouse.active = true;
    });

    heroWrapper.addEventListener('mouseleave', () => {
      mouse.x = -1000;
      mouse.y = -1000;
      mouse.active = false;
    });
  }

  class Particle {
    constructor() {
      this.reset(true);
    }

    reset(initial = false) {
      this.x = Math.random() * width;
      this.y = initial ? Math.random() * height : height + Math.random() * 20;
      this.radius = Math.random() * 25 + 15;
      this.vx = Math.random() * 0.4 - 0.2;
      this.vy = -Math.random() * 0.3 - 0.15;
      this.alpha = 0;
      this.maxAlpha = Math.random() * 0.3 + 0.1;
      this.fadeInSpeed = 0.005 + Math.random() * 0.005;
      this.decay = 0.001 + Math.random() * 0.002;
      
      if (Math.random() < 0.15) {
        this.color = { r: 255, g: 107, b: 74 }; // brand coral tint
      } else {
        this.color = { r: 220, g: 220, b: 230 }; // smoke grey
      }
    }

    update() {
      if (mouse.active) {
        const dx = this.x - mouse.x;
        const dy = this.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 60) {
          const force = (60 - dist) / 1200;
          this.vx += (dx / dist) * force;
          this.vy += (dy / dist) * force;
        }
      }

      this.x += this.vx;
      this.y += this.vy;
      
      if (this.alpha < this.maxAlpha && this.vy < 0) {
        this.alpha += this.fadeInSpeed;
      }
      
      this.alpha -= this.decay;
      
      if (this.alpha <= 0 || this.y < -this.radius || this.x < -this.radius || this.x > width + this.radius) {
        this.reset(false);
      }
    }

    draw() {
      ctx.beginPath();
      const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
      grad.addColorStop(0, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.alpha})`);
      grad.addColorStop(1, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, 0)`);
      ctx.fillStyle = grad;
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const particleCount = 20;
  for (let i = 0; i < particleCount; i++) {
    particles.push(new Particle());
  }

  function loop() {
    if (!isVisible) return;
    
    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < particles.length; i++) {
      particles[i].update();
      particles[i].draw();
    }

    animationFrameId = requestAnimationFrame(loop);
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      isVisible = entry.isIntersecting;
      if (isVisible) {
        loop();
      } else {
        cancelAnimationFrame(animationFrameId);
      }
    });
  }, { threshold: 0 });

  observer.observe(wrapper);
}

/* ==========================================
   9. Hover Variant Swatches
   ========================================== */
function initVariantSwatches() {
  document.body.addEventListener('mouseover', function(e) {
    const swatch = e.target.closest('.swatch-color');
    if (!swatch) return;

    const card = swatch.closest('.product-card');
    if (!card) return;

    card.querySelectorAll('.swatch-color').forEach(s => s.classList.remove('active'));
    swatch.classList.add('active');

    const imgEl = card.querySelector('.product-card-img');
    const placeholderEl = card.querySelector('.product-card-placeholder-img');
    
    const newImgSrc = swatch.getAttribute('data-image');
    const newEmoji = swatch.getAttribute('data-emoji');
    const newBg = swatch.getAttribute('data-bg');

    if (imgEl && newImgSrc) {
      imgEl.src = newImgSrc;
    } else if (placeholderEl) {
      if (newEmoji) {
        const emojiSpan = placeholderEl.querySelector('span');
        if (emojiSpan) emojiSpan.textContent = newEmoji;
      }
      if (newBg) {
        placeholderEl.style.backgroundImage = newBg;
      }
    }

    const priceEl = card.querySelector('.product-price');
    const comparePriceEl = card.querySelector('.product-compare-price');
    const newPrice = swatch.getAttribute('data-price');
    const newComparePrice = swatch.getAttribute('data-compare-price');

    if (priceEl && newPrice) {
      priceEl.textContent = newPrice;
    }
    
    if (comparePriceEl) {
      if (newComparePrice) {
        comparePriceEl.textContent = newComparePrice;
        comparePriceEl.style.display = '';
        if (priceEl) priceEl.classList.add('price-sale');
      } else {
        comparePriceEl.style.display = 'none';
        if (priceEl) priceEl.classList.remove('price-sale');
      }
    }

    const variantInput = card.querySelector('input[name="id"]');
    const newVariantId = swatch.getAttribute('data-variant-id');
    if (variantInput && newVariantId) {
      variantInput.value = newVariantId;
    }
  });
}
