/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./contexts/**/*.{js,ts,jsx,tsx}",
        "./hooks/**/*.{js,ts,jsx,tsx}",
        "./services/**/*.{js,ts,jsx,tsx}",
        "./App.tsx",
        "./index.tsx",
        "./types.ts"
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
            colors: {
                // Semantic Color Mapping
                primary: {
                    DEFAULT: '#0f172a', // Slate 900
                    foreground: '#ffffff',
                },
                secondary: {
                    DEFAULT: '#10b981', // Emerald 500
                    foreground: '#ffffff',
                },
                destructive: {
                    DEFAULT: '#f43f5e', // Rose 500
                    foreground: '#ffffff',
                },
                surface: {
                    DEFAULT: '#f8fafc', // Slate 50 (App Background)
                    card: '#ffffff',    // White (Card Background)
                },
                text: {
                    DEFAULT: '#475569', // Slate 600
                    muted: '#94a3b8',   // Slate 400
                    title: '#0f172a',   // Slate 900
                }
            },
            borderRadius: {
                '3xl': '1.5rem', // 24px (Card)
                '2xl': '1rem',   // 16px (Button)
                'xl': '0.75rem', // 12px (Input)
            },
            boxShadow: {
                'card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)', // shadow-sm equivalent
                'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)', // shadow-md
            }
        },
    },
    plugins: [],
}
