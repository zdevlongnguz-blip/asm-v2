<template>
  <div class="site-frame">
    <header class="site-header">
      <RouterLink class="brand" to="/" aria-label="Lữ hành, trang điểm đến">
        <span class="brand-mark" aria-hidden="true"><i class="bi bi-compass-fill" /></span>
        <span class="brand-copy">
          <strong>Lữ hành</strong>
          <small>Những miền đáng nhớ</small>
        </span>
      </RouterLink>

      <nav class="site-nav" aria-label="Điều hướng chính">
        <RouterLink to="/" class="nav-link">Điểm đến</RouterLink>
        <RouterLink to="/assistant" class="nav-link assistant-link">
          <i class="bi bi-stars" aria-hidden="true" />
          Trợ lý du lịch
        </RouterLink>
      </nav>
    </header>

    <RouterView />
  </div>
</template>

<style>
:root {
  color-scheme: light;
  --color-canvas: #fdf9f4;
  --color-surface: #ffffff;
  --color-ink: #1c1c19;
  --color-muted: #646b65;
  --color-primary: #012d1d;
  --color-primary-soft: #1b4332;
  --color-secondary: #97472e;
  --color-border: #dedbd3;
  --font-display: 'Newsreader', Georgia, serif;
  --font-body: 'Plus Jakarta Sans', sans-serif;
  color: var(--color-ink);
  background: var(--color-canvas);
  font-family: var(--font-body);
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  min-width: 320px;
  min-height: 100vh;
  margin: 0;
  background: var(--color-canvas);
  color: var(--color-ink);
  font-family: var(--font-body);
}

button,
input,
textarea,
select {
  font: inherit;
}

.site-header {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  min-height: 76px;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 12px max(24px, calc((100vw - 1280px) / 2));
  border-bottom: 1px solid var(--color-border);
  background: rgba(253, 249, 244, 0.96);
  backdrop-filter: blur(12px);
  box-shadow: 0 5px 18px rgba(1, 45, 29, 0.04);
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 11px;
  color: var(--color-primary);
  text-decoration: none;
}

.brand-mark {
  display: grid;
  width: 38px;
  aspect-ratio: 1;
  place-items: center;
  border-radius: 50%;
  background: var(--color-primary);
  color: #fff;
  font-size: 17px;
}

.brand-copy {
  display: grid;
  gap: 1px;
}

.brand-copy strong {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 500;
  line-height: 1;
}

.brand-copy small {
  color: var(--color-muted);
  font-size: 10px;
}

.site-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}

.site-nav .nav-link {
  display: inline-flex;
  min-height: 42px;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  border-radius: 4px;
  color: var(--color-muted);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  transition: background-color 160ms ease, color 160ms ease;
}

.site-nav .nav-link:hover,
.site-nav .nav-link.router-link-active {
  background: #e8eee9;
  color: var(--color-primary);
}

.site-nav .assistant-link {
  border: 1px solid #c4d0c7;
}

@media (max-width: 520px) {
  .site-header {
    min-height: 68px;
    gap: 8px;
    padding: 10px 14px;
  }

  .brand-copy small {
    display: none;
  }

  .site-nav {
    gap: 2px;
  }

  .site-nav .nav-link {
    min-height: 40px;
    gap: 6px;
    padding: 8px;
    font-size: 11px;
  }
}
</style>
