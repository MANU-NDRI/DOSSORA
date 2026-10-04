/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bordeaux: { DEFAULT: '#7A1F3D', dark: '#5C1730', light: '#9A3A58', 50: '#F6E9ED' },
        ivory: { DEFAULT: '#F8F3EA', dark: '#EFE7D8' },
        gold: { DEFAULT: '#C9A45C', dark: '#9C7A34', light: '#E3CC9A' },
        ink: '#2B1B21',
      },
      fontFamily: {
        sans: ['Montserrat', 'Poppins', 'system-ui', 'sans-serif'],
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
      },
      boxShadow: { soft: '0 8px 30px -12px rgba(122,31,61,.25)' },
      // Design system des animations (miroir de src/lib/motion.ts) : FAST 150 · NORMAL 250 · SLOW 400 ms
      transitionDuration: { fast: '150ms', normal: '250ms', slow: '400ms' },
      transitionTimingFunction: { dossora: 'cubic-bezier(0.22, 0.61, 0.36, 1)' },
      keyframes: {
        rise: { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'none' } },
        fade: { from: { opacity: '0' }, to: { opacity: '1' } },
        'page-in': { from: { opacity: '0', transform: 'translateY(8px) scale(0.995)' }, to: { opacity: '1', transform: 'none' } },
        shimmer: { to: { transform: 'translateX(100%)' } },
        glow: { '0%': { opacity: '0', transform: 'scale(0.7)' }, '50%': { opacity: '0.55' }, '100%': { opacity: '0.18', transform: 'scale(1.15)' } },
        bump: { '0%,100%': { transform: 'scale(1)' }, '35%': { transform: 'scale(1.22) rotate(-6deg)' }, '65%': { transform: 'scale(0.94)' } },
        pop: { '0%': { transform: 'scale(0.6)' }, '60%': { transform: 'scale(1.25)' }, '100%': { transform: 'scale(1)' } },
        ring: { from: { opacity: '0', transform: 'scale(0.6)' }, to: { opacity: '1', transform: 'none' } },
        draw: { to: { strokeDashoffset: '0' } },
        particle: { '0%': { opacity: '1', transform: 'translate(0,0) scale(1)' }, '100%': { opacity: '0', transform: 'translate(var(--tx), var(--ty)) scale(0.3)' } },
      },
      animation: {
        rise: 'rise 350ms cubic-bezier(0.22,0.61,0.36,1) both',
        fade: 'fade 300ms ease-out both',
        'page-in': 'page-in 280ms cubic-bezier(0.22,0.61,0.36,1) both',
        shimmer: 'shimmer 1.6s ease-in-out infinite',
        glow: 'glow 1.4s ease-out both',
        bump: 'bump 450ms cubic-bezier(0.22,0.61,0.36,1)',
        pop: 'pop 320ms cubic-bezier(0.22,0.61,0.36,1)',
        ring: 'ring 400ms cubic-bezier(0.22,0.61,0.36,1) both',
        draw: 'draw 450ms 250ms ease-out forwards',
        particle: 'particle 600ms ease-out forwards',
      },
    },
  },
  plugins: [],
};
