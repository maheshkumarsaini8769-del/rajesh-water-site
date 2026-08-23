/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  corePlugins: { preflight: false },
  content: ["./frontend/pages/**/*.html", "./frontend/js/**/*.js"],
  theme: {
    extend: {
      colors: {
        "surface-container-low": "#0A101B", "outline": "#879394", "secondary-fixed": "#dce1ff",
        "surface-dim": "#080D16", "error-container": "#93000a", "surface": "#080D16",
        "on-tertiary-container": "#4f6490", "inverse-primary": "#006971", "secondary": "#A9B8CF",
        "on-surface-variant": "#bcc9ca", "surface-container-high": "#1e2b3c",
        "surface-container-lowest": "#020f1f", "on-secondary": "#002780", "outline-variant": "#3d494a",
        "primary-container": "#7CEBFF", "surface-secondary": "#001b44",
        "ice-glow": "rgba(124, 235, 255, 0.12)", "secondary-container": "#8B7CFF",
        "on-background": "#F4F8FC", "secondary-fixed-dim": "#A9B8CF", "border-subtle": "#17212E",
        "surface-variant": "#111A29", "on-tertiary": "#192f59", "on-surface": "#F4F8FC",
        "primary-fixed": "#7CEBFF", "on-error": "#690005", "tertiary": "#ffffff",
        "surface-primary": "#05070D", "text-primary": "#F4F8FC",
        "on-secondary-container": "#e4e7ff", "on-secondary-fixed-variant": "#0039b3",
        "inverse-on-surface": "#243143", "on-error-container": "#ffdad6", "on-primary-fixed": "#041018",
        "primary-fixed-dim": "#4BC9EF", "background": "#05070D", "on-primary-fixed-variant": "#0B5C7C",
        "surface-container-highest": "#151F31", "on-tertiary-fixed": "#001a42",
        "inverse-surface": "#F4F8FC", "on-primary-container": "#041018",
        "tertiary-container": "#d8e2ff", "tertiary-fixed": "#d8e2ff", "error": "#ffb4ab",
        "on-secondary-fixed": "#001551", "surface-tint": "#38D9FF", "tertiary-fixed-dim": "#b1c6f9",
        "on-tertiary-fixed-variant": "#314671", "on-primary": "#00363b",
        "surface-bright": "#151F31", "text-muted": "#7E8CA0", "primary": "#ffffff",
        "surface-container": "#0D1421"
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