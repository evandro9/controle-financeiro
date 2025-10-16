import { useContext } from "react";
import { Sun, Moon, UserCircle2, ChevronDown } from "lucide-react";
// ajuste o caminho conforme o seu projeto
import { ThemeContext } from "../context/ThemeContext";

export default function PageHeader({
  userName,                 // ex.: "Evandro dos Santos" (opcional)
  accountLabel = "Conta Pessoal",
  onSair,                   // se já usa, mantém
}) {
  const { darkMode, setDarkMode } = useContext(ThemeContext);

  return (
    <div
      className={[
        "w-full h-14",                         // mesma altura da topbar
        "flex items-center justify-end gap-2", // tudo alinhado à direita
        "px-2 select-none",
        // ZERA margens/paddings verticais de QUALQUER filho
        "[&>*]:my-0 [&>*]:py-0 [&_*]:leading-none",
      ].join(" ")}
    >
      {/* Toggle de tema — alvo tocável 40x40 */}
      <button
        type="button"
        onClick={() => setDarkMode(!darkMode)}
        aria-label={darkMode ? "Ativar tema claro" : "Ativar tema escuro"}
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border hover:bg-accent/20 transition"
      >
        {darkMode ? <Sun className="size-5" /> : <Moon className="size-5" />}
      </button>

      {/* Saudação + conta (compactos, sem empurrar nada pra baixo) */}
      <div className="hidden xs:flex items-center gap-2">
        <span className="text-sm sm:text-base font-medium">
          {userName ? `Olá, ${userName}` : "Olá"}
        </span>
        <span className="px-2 py-1 text-[11px] sm:text-xs rounded-md bg-muted/60 text-foreground/80">
          {accountLabel}
        </span>
      </div>

      {/* Avatar e seta — mesmos 40px de altura */}
      <button
        type="button"
        className="inline-flex h-10 w-10 items-center justify-center rounded-full"
        aria-label="Abrir menu do usuário"
      >
        <UserCircle2 className="size-6 text-emerald-400" />
      </button>
      <ChevronDown className="size-4 opacity-70" />
    </div>
  );
}
