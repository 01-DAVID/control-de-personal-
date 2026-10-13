// =========================================================
// FRONTEND: Index / Login (mostrar errores)
// =========================================================
// Este script lee el parámetro `?error=` en la URL y lo muestra en pantalla.
// Luego limpia el parámetro de la URL para que no quede "pegado" al recargar.

// ===== IIFE: evita variables globales =====
(() => {
    // 1) Buscar el elemento donde se mostrará el error.
    const errorEl = document.getElementById('loginError')
    if (!errorEl) return // Si no existe en la vista, no hay nada que hacer.

    // 2) Parsear querystring actual.
    const params = new URLSearchParams(window.location.search)

    // 3) Leer el valor del parámetro `error` (si existe).
    const error = params.get('error')
    if (!error) return // Si no hay error, no se muestra nada.

    // 4) Pintar el mensaje en el DOM.
    errorEl.textContent = error
    errorEl.hidden = false

    // 5) Eliminar `error` de la URL sin recargar la página.
    params.delete('error')
    const qs = params.toString()

    // Construir URL "limpia": conserva path, otros parámetros y hash.
    const cleanUrl = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash
    window.history.replaceState({}, document.title, cleanUrl)
})()
