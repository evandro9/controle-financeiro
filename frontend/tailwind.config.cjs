module.exports = {
  darkMode: 'class', // importante para alternar pelo ThemeContext
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        darkBg: '#0d1117', // Base estilo GitHub/TradingView
        darkCard: '#161b22',
        darkBorder: '#30363d',
        darkText: '#c9d1d9',
        darkMuted: '#8b949e',
      }
    },
  },
  plugins: [],
}
