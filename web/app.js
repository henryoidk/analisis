document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const password = document.getElementById('password');
  const toggle = document.getElementById('toggle');

  if (toggle && password) {
    toggle.addEventListener('click', () => {
      const isPass = password.getAttribute('type') === 'password';
      password.setAttribute('type', isPass ? 'text' : 'password');
      toggle.setAttribute('aria-pressed', String(isPass));
      toggle.title = isPass ? 'Ocultar' : 'Mostrar';
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('username').value.trim();
      const pwd = password.value;

      try {
        const resp = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password: pwd })
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) {
          const msg = (data && (data.error || data.message)) || `Error ${resp.status}`;
          alert(`Error: ${msg}`);
          return;
        }
        const { user } = data;
        const role = (user.role || '').toLowerCase();
        if (role.includes('admin')) {
          window.location.href = 'admin.html';
        } else {
          window.location.href = 'vendor.html';
        }
      } catch (err) {
        alert('No se pudo conectar con el servidor');
      }
    });
  }
});
