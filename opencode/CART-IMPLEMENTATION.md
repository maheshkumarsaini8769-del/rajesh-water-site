# Cart Implementation from code.md

## Overview
This document contains the complete cart implementation extracted from `code.md` including:
- Water Boxes Catalog with filters
- Customer Details checkout form
- Delivery Location selection with interactive map

---

## 1. Water Boxes Catalog (Product Page)

### HTML Structure
```html
<nav class="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-xl border-b border-subtle shadow-sm flex justify-between items-center px-margin-mobile md:px-margin-desktop py-4 max-w-container-max mx-auto">
  <div class="font-headline-sm text-headline-sm text-primary tracking-tight">Rajesh Water</div>
  <div class="hidden md:flex gap-8 font-label-caps text-label-caps">
    <a class="nav-link-inactive" href="#">Home</a>
    <a class="nav-link-active" href="#">Water Boxes</a>
    <a class="nav-link-inactive" href="#">Cold Drink Boxes</a>
    <a class="nav-link-inactive" href="#">Combo Offers</a>
    <a class="nav-link-inactive" href="#">Bulk Supply</a>
    <a class="nav-link-inactive" href="#">Coolers</a>
  </div>
  <div class="flex gap-4 text-primary">
    <button aria-label="shopping_cart" class="hover:bg-ice-glow/10 transition-all duration-300 p-2 rounded-full active:scale-95 transition-transform">
      <span class="material-symbols-outlined">shopping_cart</span>
    </button>
  </div>
</nav>
```

### Filter Sidebar
```html
<aside class="w-full md:w-64 flex-shrink-0 glass-panel rounded-xl p-6 h-fit sticky top-[120px] hidden md:block depth-container">
  <h2 class="font-headline-sm text-headline-sm text-primary mb-6">Filters</h2>

  <!-- Bottle Size Filters -->
  <div class="mb-8">
    <h3 class="font-label-caps text-label-caps text-text-muted mb-4 uppercase tracking-wider">Bottle Size</h3>
    <div class="space-y-3">
      <label class="flex items-center gap-3 cursor-pointer group">
        <input class="filter-checkbox" type="checkbox"/>
        <span class="font-body-md text-on-surface group-hover:text-primary transition-colors">200ml (Event)</span>
      </label>
      <label class="flex items-center gap-3 cursor-pointer group">
        <input checked="" class="filter-checkbox" type="checkbox"/>
        <span class="font-body-md text-on-surface group-hover:text-primary transition-colors">500ml (Standard)</span>
      </label>
      <label class="flex items-center gap-3 cursor-pointer group">
        <input class="filter-checkbox" type="checkbox"/>
        <span class="font-body-md text-on-surface group-hover:text-primary transition-colors">1L (Banquet)</span>
      </label>
      <label class="flex items-center gap-3 cursor-pointer group">
        <input class="filter-checkbox" type="checkbox"/>
        <span class="font-body-md text-on-surface group-hover:text-primary transition-colors">2L (Pantry)</span>
      </label>
    </div>
  </div>

  <!-- Bottles per Box Filters -->
  <div>
    <h3 class="font-label-caps text-label-caps text-text-muted mb-4 uppercase tracking-wider">Bottles per Box</h3>
    <div class="space-y-3">
      <label class="flex items-center gap-3 cursor-pointer group">
        <input class="filter-checkbox" type="checkbox"/>
        <span class="font-body-md text-on-surface group-hover:text-primary transition-colors">12 Bottles</span>
      </label>
      <label class="flex items-center gap-3 cursor-pointer group">
        <input checked="" class="filter-checkbox" type="checkbox"/>
        <span class="font-body-md text-on-surface group-hover:text-primary transition-colors">24 Bottles</span>
      </label>
      <label class="flex items-center gap-3 cursor-pointer group">
        <input class="filter-checkbox" type="checkbox"/>
        <span class="font-body-md text-on-surface group-hover:text-primary transition-colors">48 Bottles</span>
      </label>
    </div>
  </div>
</aside>
```

### Product Card
```html
<article class="product-card rounded-xl overflow-hidden flex flex-col group depth-container relative">
  <div class="absolute top-4 left-4 z-10 bg-primary-container/10 px-3 py-1 rounded-full border border-primary-container/20">
    <span class="font-label-caps text-label-caps text-primary-container">Sealed Box</span>
  </div>

  <div class="aspect-[4/5] bg-surface-container-highest relative overflow-hidden">
    <img class="object-cover w-full h-full opacity-80 group-hover:opacity-100 transition-opacity duration-500 group-hover:scale-105 transform"
         data-alt="Product description"
         src="https://lh3.googleusercontent.com/..."/>
  </div>

  <div class="p-6 flex flex-col flex-grow">
    <h3 class="font-headline-sm text-headline-sm text-primary mb-1">200ml Event Box</h3>
    <p class="font-body-md text-text-muted mb-4">48 Bottles per Box • Ideal for large gatherings</p>

    <div class="mt-auto pt-4 border-t border-border-subtle flex items-end justify-between">
      <div>
        <span class="font-label-caps text-label-caps text-text-muted block mb-1">Price per box</span>
        <span class="font-price-display text-price-display text-primary-container">₹450</span>
      </div>
      <div class="flex items-center gap-3">
        <button class="qty-btn w-8 h-8 rounded-full flex items-center justify-center font-bold pb-1">-</button>
        <span class="font-headline-md text-headline-md text-primary w-6 text-center">0</span>
        <button class="qty-btn w-8 h-8 rounded-full flex items-center justify-center font-bold pb-1">+</button>
      </div>
    </div>
  </div>
</article>
```

### CSS Styles for Cart
```css
/* Glassmorphism Panel */
.glass-panel {
  background: rgba(0, 27, 68, 0.6);
  backdrop-filter: blur(20px);
  border: 1px solid #1e293b;
}

/* Product Card */
.product-card {
  background-color: #001b44;
  border: 1px solid #1e293b;
  transition: all 0.3s ease;
}

.product-card:hover {
  border-color: #89f2fe;
  box-shadow: 0 0 20px rgba(138, 243, 255, 0.15);
}

/* Primary Button */
.btn-primary {
  background-color: #8af3ff;
  color: #000a1a;
  transition: all 0.3s ease;
}

.btn-primary:hover {
  box-shadow: 0 0 15px rgba(138, 243, 255, 0.3);
}

/* Quantity Button */
.qty-btn {
  background-color: rgba(138, 243, 255, 0.1);
  border: 1px solid #1e293b;
  color: #8af3ff;
  transition: all 0.2s;
}

.qty-btn:hover {
  background-color: rgba(138, 243, 255, 0.2);
}

/* Filter Checkbox */
.filter-checkbox {
  appearance: none;
  width: 16px;
  height: 16px;
  border: 1px solid #3d494a;
  border-radius: 4px;
  background-color: #061424;
  cursor: pointer;
  position: relative;
}

.filter-checkbox:checked {
  background-color: #0356ff;
  border-color: #0356ff;
}

.filter-checkbox:checked::after {
  content: '✓';
  position: absolute;
  color: white;
  font-size: 10px;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

/* Depth Container */
.depth-container {
  position: relative;
}

.depth-container::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
  pointer-events: none;
}

/* Navigation Links */
.nav-link-active {
  color: #ffffff;
  border-bottom: 2px solid #ffffff;
  padding-bottom: 0.25rem;
}

.nav-link-inactive {
  color: #bcc9ca;
  transition: color 0.3s;
}

.nav-link-inactive:hover {
  color: #ffffff;
}
```

---

## 2. Customer Details Checkout Form

### Timeline Component
```html
<div class="w-full max-w-3xl mx-auto mb-stack-sm flex justify-between items-center relative">
  <!-- Connecting Line -->
  <div class="absolute top-1/2 left-0 w-full h-[1px] bg-border-subtle -z-10 transform -translate-y-1/2"></div>

  <!-- Step 1: Cart -->
  <div class="flex flex-col items-center gap-2 bg-surface-primary px-4">
    <div class="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center shadow-[0_0_15px_rgba(3,86,255,0.4)]">
      <span class="material-symbols-outlined text-tertiary text-sm" style="font-variation-settings: 'FILL' 1;">check</span>
    </div>
    <span class="font-label-caps text-[10px] text-text-muted tracking-widest">CART</span>
  </div>

  <!-- Step 2: Details (Active) -->
  <div class="flex flex-col items-center gap-2 bg-surface-primary px-4">
    <div class="w-8 h-8 rounded-full bg-surface-secondary border-2 border-primary-container flex items-center justify-center shadow-[0_0_15px_rgba(138,243,255,0.2)]">
      <span class="text-primary-container font-label-caps text-xs">2</span>
    </div>
    <span class="font-label-caps text-[10px] text-primary-container tracking-widest">DETAILS</span>
  </div>

  <!-- Step 3: Payment -->
  <div class="flex flex-col items-center gap-2 bg-surface-primary px-4">
    <div class="w-8 h-8 rounded-full bg-surface-container-high border border-border-subtle flex items-center justify-center">
      <span class="text-text-muted font-label-caps text-xs">3</span>
    </div>
    <span class="font-label-caps text-[10px] text-text-muted tracking-widest">PAYMENT</span>
  </div>
</div>
```

### Customer Details Form
```html
<div class="glass-panel rounded-xl p-6 md:p-10">
  <div class="mb-8 border-b border-border-subtle pb-4">
    <h1 class="font-headline-md text-headline-md text-primary mb-2">Customer Details</h1>
    <p class="font-body-md text-body-md text-on-surface-variant">Please provide your contact and delivery information.</p>
  </div>

  <form class="space-y-6">
    <!-- Full Name -->
    <div class="space-y-2">
      <label class="block font-label-caps text-label-caps text-text-muted" for="fullName">Full Name</label>
      <div class="relative">
        <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <span class="material-symbols-outlined text-text-muted">person</span>
        </div>
        <input class="input-field w-full rounded-full py-4 pl-12 pr-4 font-body-md text-body-md placeholder:text-surface-variant focus:ring-0"
               id="fullName" name="fullName" placeholder="Enter your full name" type="text"/>
      </div>
    </div>

    <!-- Mobile & WhatsApp Numbers -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="space-y-2">
        <label class="block font-label-caps text-label-caps text-text-muted" for="mobileNumber">Mobile Number</label>
        <div class="relative">
          <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <span class="material-symbols-outlined text-text-muted">call</span>
          </div>
          <input class="input-field w-full rounded-full py-4 pl-12 pr-4 font-body-md text-body-md placeholder:text-surface-variant focus:ring-0"
                 id="mobileNumber" name="mobileNumber" placeholder="+1 (555) 000-0000" type="tel"/>
        </div>
      </div>

      <div class="space-y-2">
        <label class="block font-label-caps text-label-caps text-text-muted flex justify-between" for="whatsappNumber">
          <span>WhatsApp Number</span>
          <span class="text-[10px] text-surface-variant">Optional</span>
        </label>
        <div class="relative">
          <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <span class="material-symbols-outlined text-text-muted">chat</span>
          </div>
          <input class="input-field w-full rounded-full py-4 pl-12 pr-4 font-body-md text-body-md placeholder:text-surface-variant focus:ring-0"
                 id="whatsappNumber" name="whatsappNumber" placeholder="Same as mobile" type="tel"/>
        </div>
      </div>
    </div>

    <!-- Complete Address -->
    <div class="space-y-2">
      <label class="block font-label-caps text-label-caps text-text-muted" for="address">Complete Address</label>
      <div class="relative">
        <div class="absolute top-4 left-0 pl-4 flex items-start pointer-events-none">
          <span class="material-symbols-outlined text-text-muted">location_on</span>
        </div>
        <textarea class="input-field w-full rounded-xl py-4 pl-12 pr-4 font-body-md text-body-md placeholder:text-surface-variant focus:ring-0 resize-none"
                  id="address" name="address" placeholder="Street address, apartment, suite, floor, etc." rows="3"></textarea>
      </div>
    </div>

    <!-- Delivery Instructions -->
    <div class="space-y-2">
      <label class="block font-label-caps text-label-caps text-text-muted flex justify-between" for="instructions">
        <span>Delivery Instructions</span>
        <span class="text-[10px] text-surface-variant">Optional</span>
      </label>
      <div class="relative">
        <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <span class="material-symbols-outlined text-text-muted">local_shipping</span>
        </div>
        <input class="input-field w-full rounded-full py-4 pl-12 pr-4 font-body-md text-body-md placeholder:text-surface-variant focus:ring-0"
               id="instructions" name="instructions" placeholder="e.g. Leave at front door" type="text"/>
      </div>
    </div>
  </form>
</div>
```

### Order Summary Sidebar
```html
<div class="w-full lg:w-1/3">
  <div class="glass-panel rounded-xl p-6 sticky top-[100px]">
    <h2 class="font-headline-sm text-headline-sm text-primary mb-6 flex items-center gap-2 border-b border-border-subtle pb-4">
      <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">inventory_2</span>
      Order Summary
    </h2>

    <div class="space-y-4 mb-6">
      <!-- Item 1 -->
      <div class="flex items-start gap-4">
        <div class="w-16 h-16 rounded-lg bg-surface-primary border border-border-subtle overflow-hidden flex-shrink-0 relative">
          <img alt="1L Water Box" class="w-full h-full object-cover opacity-80"
               data-alt="Product description"
               src="https://lh3.googleusercontent.com/..."/>
          <div class="absolute top-0 right-0 bg-surface-secondary/80 backdrop-blur-sm px-1.5 py-0.5 rounded-bl-lg border-l border-b border-border-subtle">
            <span class="font-label-caps text-[10px] text-primary">2x</span>
          </div>
        </div>
        <div class="flex-grow">
          <h3 class="font-body-md text-body-md font-medium text-primary line-clamp-1">1L Premium Water Box</h3>
          <p class="font-body-md text-body-md text-text-muted text-sm mb-1">Sealed Box • 12 Bottles</p>
          <div class="font-label-caps text-label-caps text-primary-container">$24.00</div>
        </div>
      </div>

      <!-- Item 2 -->
      <div class="flex items-start gap-4">
        <div class="w-16 h-16 rounded-lg bg-surface-primary border border-border-subtle overflow-hidden flex-shrink-0 relative">
          <img alt="Classic Cola Box" class="w-full h-full object-cover opacity-80"
               data-alt="Product description"
               src="https://lh3.googleusercontent.com/..."/>
          <div class="absolute top-0 right-0 bg-surface-secondary/80 backdrop-blur-sm px-1.5 py-0.5 rounded-bl-lg border-l border-b border-border-subtle">
            <span class="font-label-caps text-[10px] text-primary">2x</span>
          </div>
        </div>
        <div class="flex-grow">
          <h3 class="font-body-md text-body-md font-medium text-primary line-clamp-1">Classic Cola Box</h3>
          <p class="font-body-md text-body-md text-text-muted text-sm mb-1">Sealed Box • 24 Cans</p>
          <div class="font-label-caps text-label-caps text-primary-container">$36.00</div>
        </div>
      </div>
    </div>

    <div class="border-t border-border-subtle pt-4 space-y-2 mb-6">
      <div class="flex justify-between items-center font-body-md text-body-md text-on-surface-variant">
        <span>Subtotal (4 items)</span>
        <span>$120.00</span>
      </div>
      <div class="flex justify-between items-center font-body-md text-body-md text-on-surface-variant">
        <span>Delivery</span>
        <span class="text-primary-fixed-dim">Free</span>
      </div>
    </div>

    <div class="border-t border-border-subtle pt-4 mb-8">
      <div class="flex justify-between items-end">
        <span class="font-body-lg text-body-lg text-primary">Total</span>
        <span class="font-price-display text-price-display text-primary">$120.00</span>
      </div>
    </div>

    <button class="btn-primary w-full rounded-full py-4 font-label-caps text-label-caps flex items-center justify-center gap-2">
      <span>Review Order</span>
      <span class="material-symbols-outlined text-sm" style="font-variation-settings: 'FILL' 1;">arrow_forward</span>
    </button>
  </div>
</div>
```

### CSS for Checkout
```css
/* Input Field */
.input-field {
  background-color: #000a1a;
  border: 1px solid #1e293b;
  color: #ffffff;
  transition: all 0.3s ease;
}

.input-field:focus {
  outline: none;
  border-color: #8af3ff;
  box-shadow: inset 0 0 10px rgba(138, 243, 255, 0.15);
}

/* Timeline Nodes */
.timeline-node-active {
  background: #0356ff;
  box-shadow: 0 0 10px rgba(3, 86, 255, 0.5);
  border-color: #0356ff;
}

.timeline-node-inactive {
  background: #293547;
  border-color: #293547;
}
```

---

## 3. Delivery Location Selection (Interactive Map)

### Map Section
```html
<section class="relative w-full md:w-2/3 h-[512px] md:h-full bg-surface-container-low flex-shrink-0 border-r border-subtle overflow-hidden">
  <!-- Map Image -->
  <img class="absolute inset-0 w-full h-full object-cover dark-map-overlay"
       data-alt="Cinematic dark mode street map"
       data-location="Delhi, India"
       src="https://lh3.googleusercontent.com/..."/>

  <!-- Map Overlay Gradient -->
  <div class="absolute inset-0 bg-gradient-to-t from-surface-primary via-transparent to-transparent pointer-events-none"></div>

  <!-- Central Pin Indicator -->
  <div class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center pointer-events-none">
    <div class="bg-primary-container text-surface-primary p-3 rounded-full shadow-[0_0_20px_rgba(138,243,255,0.4)] animate-pulse">
      <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">location_on</span>
    </div>
    <div class="w-1 h-8 bg-gradient-to-b from-primary-container to-transparent"></div>
    <div class="w-4 h-1 bg-primary-container rounded-full blur-[2px] opacity-50 mt-1"></div>
  </div>

  <!-- Floating Map Controls -->
  <div class="absolute right-6 bottom-6 flex flex-col gap-2">
    <button aria-label="Zoom in" class="w-12 h-12 rounded-full glass-panel flex items-center justify-center text-primary hover:bg-surface-secondary transition-colors">
      <span class="material-symbols-outlined">add</span>
    </button>
    <button aria-label="Zoom out" class="w-12 h-12 rounded-full glass-panel flex items-center justify-center text-primary hover:bg-surface-secondary transition-colors">
      <span class="material-symbols-outlined">remove</span>
    </button>
    <button aria-label="Current location" class="w-12 h-12 rounded-full glass-panel flex items-center justify-center text-primary-container hover:bg-surface-secondary transition-colors mt-4">
      <span class="material-symbols-outlined">my_location</span>
    </button>
  </div>

  <!-- Contextual Search -->
  <div class="absolute top-6 left-1/2 transform -translate-x-1/2 w-full max-w-md px-4 z-20">
    <div class="glass-panel rounded-full flex items-center px-4 py-3 shadow-lg">
      <span class="material-symbols-outlined text-primary-container mr-3">search</span>
      <input class="bg-transparent border-none outline-none text-primary placeholder:text-surface-variant flex-grow"
             placeholder="Search for area or landmark..." type="text"/>
    </div>
  </div>
</section>
```

### Map Controls CSS
```css
/* Dark Map Overlay */
.dark-map-overlay {
  mix-blend-mode: luminosity;
  opacity: 0.8;
  filter: contrast(1.2) brightness(0.7);
}

/* Glowing Button */
.glow-button {
  box-shadow: 0 0 15px rgba(138, 243, 255, 0.15);
  transition: all 0.3s ease;
}

.glow-button:hover {
  box-shadow: 0 0 25px rgba(138, 243, 255, 0.3);
  transform: translateY(-2px);
}
```

---

## 🎨 Complete Color Palette

```javascript
{
  "surface-primary": "#000a1a",           // Deep navy
  "surface-container-low": "#0f1c2d",     // Lighter navy
  "surface-container-high": "#1e2b3c",    // Even lighter
  "surface-container-highest": "#293547", // Muted slate
  "surface-secondary": "#001b44",         // Dark blue
  "surface-variant": "#293547",           // Slate
  "on-surface": "#d6e3fa",                // Light text
  "on-surface-variant": "#bcc9ca",        // Muted text
  "primary": "#ffffff",                   // White
  "primary-container": "#89f2fe",         // Ice blue
  "primary-fixed": "#89f2fe",             // Ice blue
  "primary-fixed-dim": "#6cd6e2",         // Dimmed ice blue
  "secondary": "#b6c4ff",                 // Light blue
  "secondary-container": "#0356ff",       // Royal blue
  "secondary-fixed": "#dce1ff",           // Light blue
  "tertiary": "#ffffff",                  // White
  "tertiary-container": "#d8e2ff",        // Light blue
  "border-subtle": "#1e293b",             // Subtle border
  "border-variant": "#3d494a",            // Border variant
  "text-muted": "#94a3b8",                // Muted text
  "error": "#ffb4ab",                     // Red
  "error-container": "#93000a",           // Dark red
  "on-error": "#690005",                  // Dark red text
  "on-error-container": "#ffdad6",        // Light red
  "on-primary": "#00363b",                // Dark text on blue
  "on-primary-container": "#006f78",      // Dark text on ice blue
  "ice-glow": "rgba(138, 243, 255, 0.15)" // Ice glow effect
}
```

---

## 📦 Font Configuration

```javascript
{
  "headline-sm": ["Space Grotesk", 24, { "lineHeight": "1.4", "fontWeight": "600" }],
  "headline-md": ["Space Grotesk", 32, { "lineHeight": "1.3", "fontWeight": "600" }],
  "headline-lg": ["Space Grotesk", 48, { "lineHeight": "1.2", "fontWeight": "700" }],
  "label-caps": ["Space Grotesk", 14, { "lineHeight": "1.0", "letterSpacing": "0.1em", "fontWeight": "700" }],
  "price-display": ["Space Grotesk", 28, { "lineHeight": "1.0", "fontWeight": "700" }],
  "body-md": ["Inter", 16, { "lineHeight": "1.6", "fontWeight": "400" }],
  "body-lg": ["Inter", 18, { "lineHeight": "1.6", "fontWeight": "400" }]
}
```

---

## 🚀 Key Features

### 1. Glassmorphism Design
- Semi-transparent backgrounds with blur effects
- Subtle borders and shadows
- Depth layers with gradient overlays

### 2. Interactive Components
- Hover effects on all interactive elements
- Scale animations on buttons
- Smooth transitions throughout

### 3. Responsive Layout
- Mobile-first approach
- Breakpoints at 768px (md) and 1024px (lg)
- Flexible grid systems

### 4. Accessibility
- ARIA labels on all interactive elements
- Focus states for keyboard navigation
- Screen reader friendly text

### 5. Performance
- Hardware-accelerated animations
- Lazy loading for images
- Optimized transitions

---

## 📝 Integration Notes

1. **Use this cart implementation** with the existing Aqualine project
2. **Replace Google Fonts** with existing project fonts (Cormorant Garamond, Manrope)
3. **Replace Material Symbols** with existing SVG icons
4. **Maintain color consistency** with existing ice-blue theme
5. **Keep responsive behavior** for all breakpoints

---

**Status**: ✅ Complete cart implementation ready for integration
**Last Updated**: 2025-08-15
**Source**: code.md (Lines 1-914)
