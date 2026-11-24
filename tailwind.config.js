/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  corePlugins: { preflight: false },
  content: ["./frontend/pages/**/*.html", "./frontend/js/**/*.js"],
  theme: {
    extend: {
      colors: {
        "surface-container-low": "#F8FAFC", "outline": "#64748B", "secondary-fixed": "#E0E7FF",
        "surface-dim": "#F1F5F9", "error-container": "#FFE4E6", "surface": "#FFFFFF",
        "on-tertiary-container": "#1E3A8A", "inverse-primary": "#38BDF8", "secondary": "#475569",
        "on-surface-variant": "#334155", "surface-container-high": "#E2E8F0",
        "surface-container-lowest": "#FFFFFF", "on-secondary": "#FFFFFF", "outline-variant": "#CBD5E1",
        "primary-container": "#0284C7", "surface-secondary": "#F0F9FF",
        "ice-glow": "rgba(2, 132, 199, 0.10)", "secondary-container": "#4F46E5",
        "on-background": "#0B192C", "secondary-fixed-dim": "#64748B", "border-subtle": "#E2E8F0",
        "surface-variant": "#F1F5F9", "on-tertiary": "#FFFFFF", "on-surface": "#0B192C",
        "primary-fixed": "#0284C7", "on-error": "#FFFFFF", "tertiary": "#0B192C",
        "surface-primary": "#FFFFFF", "text-primary": "#0B192C",
        "on-secondary-container": "#FFFFFF", "on-secondary-fixed-variant": "#1E40AF",
        "inverse-on-surface": "#F8FAFC", "on-error-container": "#9F1239", "on-primary-fixed": "#FFFFFF",
        "primary-fixed-dim": "#0369A1", "background": "#FFFFFF", "on-primary-fixed-variant": "#0369A1",
        "surface-container-highest": "#E2E8F0", "on-tertiary-fixed": "#0F172A",
        "inverse-surface": "#0F172A", "on-primary-container": "#FFFFFF",
        "tertiary-container": "#E0F2FE", "tertiary-fixed": "#E0F2FE", "error": "#E11D48",
        "on-secondary-fixed": "#0F172A", "surface-tint": "#0284C7", "tertiary-fixed-dim": "#BAE6FD",
        "on-tertiary-fixed-variant": "#1E3A8A", "on-primary": "#FFFFFF",
        "surface-bright": "#FFFFFF", "text-muted": "#475569", "primary": "#0B192C",
        "surface-container": "#F8FAFC"
      },
      borderRadius: { DEFAULT: "0.25rem", lg: "0.5rem", xl: "0.75rem", full: "9999px" },
      spacing: {
        "margin-desktop": "80px", "margin-mobile": "20px", "gutter": "32px",
        "stack-lg": "120px", "stack-sm": "32px", "container-max": "1440px", "stack-md": "64px"
      },
      fontFamily: {
        "headline-sm": ["Space Grotesk"], "headline-md": ["Space Grotesk"],
        "headline-lg": ["Space Grotesk"], "label-caps": ["Space Grotesk"],
        "price-display": ["Space Grotesk"], "body-md": ["Inter"], "body-lg": ["Inter"]
      },
      fontSize: {
        "headline-sm": ["24px", { lineHeight: "1.4", fontWeight: "600" }],
        "headline-md": ["32px", { lineHeight: "1.3", fontWeight: "600" }],
        "headline-lg": ["48px", { lineHeight: "1.2", fontWeight: "700" }],
        "display-hero": ["72px", { lineHeight: "1.1", letterSpacing: "-0.04em", fontWeight: "700" }],
        "display-hero-mobile": ["40px", { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "700" }],
        "label-caps": ["14px", { lineHeight: "1.0", letterSpacing: "0.1em", fontWeight: "700" }],
        "price-display": ["28px", { lineHeight: "1.0", fontWeight: "700" }],
        "body-md": ["16px", { lineHeight: "1.6", fontWeight: "400" }],
        "body-lg": ["18px", { lineHeight: "1.6", fontWeight: "400" }]
      }
    }
  },
  plugins: [require("@tailwindcss/forms"), require("@tailwindcss/container-queries")]
};