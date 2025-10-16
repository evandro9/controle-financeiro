// Passo a passo inicial da Dashboard (primeira tela pós-login)
// Alvos:
//  - [data-tour="header-theme-toggle"]: botão de alternar tema
//  - [data-tour="header-user"]: área do usuário (avatar/nome/menu)
//  - [data-tour="sidebar-menu"]: barra lateral (aberta) com itens [DESKTOP]
//  - [data-tour="sidebar-toggle-mobile"] (fallback: [data-tour="sidebar-toggle"], aria-label) [MOBILE]
 
export function getDashboardSteps() {
  const isDesktop =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(min-width: 1024px)').matches; // >= lg

  const step4 = isDesktop
    ? {
        // DESKTOP: mira a sidebar aberta (e abre se estiver fechada)
        target: '[data-tour="sidebar-menu"]',
        title: 'Menu das telas',
        content:
          'Use a barra lateral para navegar entre as áreas do sistema. Aqui você acessa Balanço, Lançamentos, Investimentos e mais.',
        placement: 'right',
        meta: {
          onEnter: () => {
            try {
              const aside = document.querySelector('[data-tour="sidebar-menu"]');
              const isOpen = aside && aside.getAttribute('data-open') === 'true';
              if (!isOpen) {
                const toggle = document.querySelector('[data-tour="sidebar-toggle"]');
                if (toggle) toggle.click();
              }
            } catch {}
          },
        },
      }
    : {
        // MOBILE: mira SOMENTE o botão do AppShell que abre a sidebar (sem fallback)
        target: '[data-tour="sidebar-toggle-mobile"]',
        title: 'Menu das telas',
        content:
          'Toque aqui para abrir o menu lateral e escolher as telas. Você pode fechar quando quiser pelo mesmo botão.',
        // Como esse botão fica no topo/esquerda, "bottom" evita o tooltip sair da tela
        placement: 'bottom',
      };

  return [
    {
      target: 'body',
      placement: 'center',
      title: 'Bem-vindo!',
      content:
        'Antes de começar, um tour rapidinho para te situar. Você pode pular quando quiser.',
      disableBeacon: true,
    },
    {
      target: '[data-tour="header-theme-toggle"]',
      title: 'Tema claro/escuro',
      content:
        'Aqui você alterna entre modo claro e escuro de acordo com a sua preferência.',
    },
    {
      target: '[data-tour="header-user"]',
      title: 'Menu do Usuário & Configurações',
      content:
        'Clique no seu avatar para abrir o menu. Em “Configurações”, você pode personalizar o sistema do seu jeito. '
        + 'Se preferir, pode usar as configurações padrão e personalizar depois.',
      placement: 'left',
    },
    step4,
  ];
}

// Compatibilidade: se seu Dashboard importa uma constante, exportamos já resolvido.
// (Se você já usa getDashboardSteps() manualmente, pode ignorar esta linha.)
export const dashboardSteps = getDashboardSteps();

// 🔸 Aviso único (MOBILE): em vez do passo a passo completo
export function getDashboardMobileNoticeSteps() {
  return [
    {
      target: 'body',
      placement: 'center',
      title: 'Melhor no computador',
      content:
        'Você está acessando esta tela pela primeira vez pelo celular. Recomendamos abrir no computador para ver um passo a passo detalhado de como tudo funciona.',
      disableBeacon: true,
    },
  ];
}