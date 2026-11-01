(function () {
  "use strict";
  const dialog = document.getElementById("acceso-dialog");
  const message = document.getElementById("acceso-mensaje");
  const googleButton = document.getElementById("google-acceso");
  let config = null;
  let usuario = null;
  let googlePromise = null;
  let returnFocus = null;
  let rendering = false;

  const errores = {
    AUTH_NOT_CONFIGURED:
      "El acceso con Google está pendiente de activación. Puedes seguir como visitante.",
    EXPIRED_CHALLENGE:
      "El acceso caducó. Cierra y vuelve a abrir esta ventana para intentarlo otra vez.",
    INVALID_ORIGIN:
      "Esta dirección todavía no está habilitada para el acceso con Google.",
    INVALID_ACCOUNT:
      "Google no devolvió una cuenta con correo verificado. Prueba otra cuenta.",
    GOOGLE_UNAVAILABLE:
      "No pudimos contactar con Google. Inténtalo de nuevo en unos minutos.",
    EXPIRED_TOKEN: "La autorización caducó. Vuelve a iniciar sesión.",
  };

  async function api(path, options = {}) {
    const response = await fetch(path, {
      credentials: "same-origin",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
      ...options,
    });
    const tipo = response.headers.get("content-type") || "";
    if (!tipo.includes("application/json"))
      throw new Error("AUTH_NOT_CONFIGURED");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "AUTH_UNAVAILABLE");
    return data;
  }

  function anunciar(user) {
    usuario = user;
    const name = document.getElementById("perfil-nombre");
    const badge = document.getElementById("perfil-estado");
    const detail = document.getElementById("perfil-descripcion");
    name.textContent = user ? user.nombre : "Visitante Allsumaq";
    badge.textContent = user
      ? "Cuenta de Google conectada"
      : "Explorando como visitante";
    detail.textContent = user
      ? user.email
      : "Inicia sesión con Google o sigue explorando sin una cuenta.";
    document.getElementById("abrir-acceso").hidden = Boolean(user);
    document.getElementById("cerrar-sesion").hidden = !user;
    const initials = document.getElementById("perfil-iniciales");
    initials.hidden = !user;
    initials.textContent = user
      ? user.nombre
          .split(/\s+/)
          .slice(0, 2)
          .map((part) => part[0])
          .join("")
          .toUpperCase()
      : "";
    document.getElementById("perfil-avatar-icono").hidden = Boolean(user);
    document.dispatchEvent(
      new CustomEvent("allsumaq:sesion", { detail: { user } }),
    );
  }

  function cargarGoogle() {
    if (window.google?.accounts?.id) return Promise.resolve();
    if (googlePromise) return googlePromise;
    googlePromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client?hl=es";
      script.async = true;
      const timer = setTimeout(() => {
        script.remove();
        googlePromise = null;
        reject(new Error("GOOGLE_UNAVAILABLE"));
      }, 15000);
      script.onload = () => {
        clearTimeout(timer);
        resolve();
      };
      script.onerror = () => {
        clearTimeout(timer);
        googlePromise = null;
        reject(new Error("GOOGLE_UNAVAILABLE"));
      };
      document.head.appendChild(script);
    });
    return googlePromise;
  }

  async function recibirCredencial(result) {
    if (!result.credential) return;
    message.textContent = "Verificando tu cuenta con Google…";
    googleButton.inert = true;
    try {
      const data = await api("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: result.credential }),
      });
      anunciar(data.user);
      cerrar();
    } catch (error) {
      message.textContent =
        errores[error.message] ||
        "No se pudo completar el acceso. Cierra y vuelve a intentarlo.";
    } finally {
      googleButton.inert = false;
    }
  }

  async function prepararAcceso() {
    if (rendering) return;
    rendering = true;
    googleButton.replaceChildren();
    message.textContent = "Preparando el acceso con Google…";
    try {
      if (location.protocol === "file:") throw new Error("AUTH_NOT_CONFIGURED");
      config = await api("/api/auth/config");
      if (!config.configured) throw new Error("AUTH_NOT_CONFIGURED");
      const [challenge] = await Promise.all([
        api("/api/auth/challenge", { method: "POST" }),
        cargarGoogle(),
      ]);
      window.google.accounts.id.initialize({
        client_id: config.googleClientId,
        nonce: challenge.nonce,
        callback: recibirCredencial,
        ux_mode: "popup",
        auto_select: false,
      });
      window.google.accounts.id.renderButton(googleButton, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "pill",
        locale: "es",
        width: Math.min(360, Math.max(200, googleButton.clientWidth)),
      });
      message.textContent =
        "Elige tu cuenta en la ventana de Google para continuar.";
    } catch (error) {
      message.textContent =
        errores[error.message] ||
        "El acceso no está disponible en este momento. Puedes continuar como visitante.";
    } finally {
      rendering = false;
    }
  }

  function cerrar() {
    dialog.close();
    document.body.classList.remove("auth-open");
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  }

  document.getElementById("abrir-acceso").addEventListener("click", () => {
    returnFocus = document.activeElement;
    dialog.showModal();
    document.body.classList.add("auth-open");
    prepararAcceso();
  });
  document
    .querySelectorAll("[data-cerrar-acceso]")
    .forEach((button) => button.addEventListener("click", cerrar));
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    cerrar();
  });
  document
    .getElementById("cerrar-sesion")
    .addEventListener("click", async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        await api("/api/auth/logout", { method: "POST" });
        window.google?.accounts?.id?.disableAutoSelect();
        anunciar(null);
      } catch (_) {
        document.getElementById("sesion-estado").textContent =
          "No se pudo cerrar la sesión. Revisa tu conexión e inténtalo otra vez.";
      } finally {
        button.disabled = false;
      }
    });

  async function iniciar() {
    if (location.protocol === "file:") {
      anunciar(null);
      return;
    }
    try {
      const data = await api("/api/auth/session");
      anunciar(data.authenticated ? data.user : null);
    } catch (_) {
      anunciar(null);
    }
  }

  window.AllsumaqSesion = {
    actualizar: iniciar,
    get usuario() {
      return usuario;
    },
  };
  iniciar();
})();
