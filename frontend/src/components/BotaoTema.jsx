import React, { useContext } from 'react';
import { Sun, Moon } from 'lucide-react';
import { ThemeContext } from '../context/ThemeContext';

function BotaoTema({ size = 18 }) {
  const { darkMode, setDarkMode } = useContext(ThemeContext);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation(); // impede que clique afete o menu do usuário
        setDarkMode(!darkMode);
      }}
      className="inline-flex h-10 w-10 items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-darkBorder transition"
    >
      {darkMode ? <Sun size={size} /> : <Moon size={size} />}
    </button>
  );
}

export default BotaoTema;