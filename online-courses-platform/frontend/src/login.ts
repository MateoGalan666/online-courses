export {};

const TOKEN_KEY = 'academy_token';
const USER_KEY = 'academy_user';

interface User {
  id: number;
  nombre: string;
  email: string;
  rol: 'estudiante' | 'profesor' | 'admin';
}

document.addEventListener('DOMContentLoaded', () => {
  // Si ya hay sesión iniciada, redirigir
  verificarSesionActiva();

  // Elementos de Pestañas
  const tabLogin = document.getElementById('tabLogin');
  const tabRegister = document.getElementById('tabRegister');
  const formLoginContainer = document.getElementById('formLoginContainer');
  const formRegisterContainer = document.getElementById('formRegisterContainer');

  // Cambiar a Iniciar Sesión
  tabLogin?.addEventListener('click', () => {
    tabLogin.classList.add('login-tab--active');
    tabRegister?.classList.remove('login-tab--active');
    formLoginContainer?.classList.add('login-form--active');
    formRegisterContainer?.classList.remove('login-form--active');
  });

  // Cambiar a Registrarse
  tabRegister?.addEventListener('click', () => {
    tabRegister.classList.add('login-tab--active');
    tabLogin?.classList.remove('login-tab--active');
    formRegisterContainer?.classList.add('login-form--active');
    formLoginContainer?.classList.remove('login-form--active');
  });

  // Formulario Login
  const loginForm = document.getElementById('loginForm') as HTMLFormElement;
  const loginError = document.getElementById('loginError');

  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (loginError) loginError.style.display = 'none';

    const email = (document.getElementById('loginEmail') as HTMLInputElement).value;
    const password = (document.getElementById('loginPassword') as HTMLInputElement).value;

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ocurrió un error al iniciar sesión.');
      }

      // Guardar token y datos del usuario
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));

      // Redirigir según el rol
      redirigirPorRol(data.user.rol);

    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      if (loginError) {
        loginError.textContent = (error as Error).message;
        loginError.style.display = 'block';
      }
    }
  });

  // Formulario Registro
  const registerForm = document.getElementById('registerForm') as HTMLFormElement;
  const registerError = document.getElementById('registerError');

  registerForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (registerError) registerError.style.display = 'none';

    const nombre = (document.getElementById('registerName') as HTMLInputElement).value;
    const email = (document.getElementById('registerEmail') as HTMLInputElement).value;
    const password = (document.getElementById('registerPassword') as HTMLInputElement).value;

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ocurrió un error al registrarse.');
      }

      // Guardar sesión del estudiante registrado
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));

      // Como los registrados son siempre estudiantes, ir al aula
      window.location.href = '/estudiante';

    } catch (error) {
      console.error('Error en registro:', error);
      if (registerError) {
        registerError.textContent = (error as Error).message;
        registerError.style.display = 'block';
      }
    }
  });
});

/**
 * Verifica si el usuario ya tiene sesión iniciada y lo redirige al panel correspondiente.
 */
function verificarSesionActiva() {
  const userJson = localStorage.getItem(USER_KEY);
  if (userJson) {
    try {
      const user: User = JSON.parse(userJson);
      redirigirPorRol(user.rol);
    } catch (e) {
      localStorage.clear();
    }
  }
}

/**
 * Redirige al panel correspondiente dependiendo de si es profesor o estudiante.
 */
function redirigirPorRol(rol: 'profesor' | 'estudiante' | 'admin') {
  // Si había una redirección guardada del checkout, ir allí
  const checkoutRedirect = sessionStorage.getItem('redirect_to_checkout');
  if (checkoutRedirect && rol === 'estudiante') {
    sessionStorage.removeItem('redirect_to_checkout');
    window.location.href = checkoutRedirect;
    return;
  }

  if (rol === 'profesor' || rol === 'admin') {
    window.location.href = '/admin';
  } else {
    window.location.href = '/estudiante';
  }
}
