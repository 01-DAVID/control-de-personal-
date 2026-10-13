// =========================================================
// FRONTEND: Personal registrado (consultar + actualizar)
// =========================================================
// Esta vista muestra personas activas e inactivas y permite actualizar
// sus datos personales sin registrar salida ni cambiar movimientos.

// ===== 1) Referencias del DOM =====
const formFiltros = document.getElementById("form-filtros-activo"); // Formulario de filtros
const formActualizar = document.getElementById("form-actualizar-activo");
const mensaje = document.getElementById("mensaje-activo"); // Contenedor de mensajes
const cuerpoTabla = document.getElementById("cuerpo-tabla-activo"); // <tbody> donde se pintan filas
const btnCerrarSesion = document.getElementById("cerrar-sesion"); // Botón de logout
const estadoSeleccion = document.getElementById("estado-seleccion");
const btnCancelarEdicion = document.getElementById("btn-cancelar-edicion-activo");
const btnGuardar = document.getElementById("btn-guardar-activo");

let personalListado = [];
let documentoSeleccionado = "";

// =========================================================
// HELPERS
// =========================================================

// ===== 2) Mostrar mensajes en pantalla =====
function mostrarMensaje(texto, tipo) {
    if (!mensaje) return; // Evita errores si el elemento no existe
    mensaje.textContent = texto || ""; // Texto a mostrar
    mensaje.className = `message ${tipo || ""}`; // Clase CSS (ok/error/wait)
}

// ===== 3) Wrapper fetch con manejo estándar de errores =====
async function apiFetch(path, options) {
    const res = await fetch(path, options); // Realiza petición al backend
    const data = await res.json().catch(() => ({})); // Intenta leer JSON
    if (!res.ok || data?.ok === false) {
        throw new Error(data?.message || "Error de servidor."); // Convierte el error en excepción para `catch`
    }
    return data; // Respuesta parseada
}

// ===== 3.1) Formatear fecha y hora para mostrar en tabla =====
function formatDateTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleString("es-CO", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function esNombrePersonaValido(value) {
    return /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*$/.test(String(value || "").trim());
}

function setFormularioHabilitado(habilitado) {
    if (!formActualizar) return;
    const campos = formActualizar.querySelectorAll("input:not([type='hidden']), select, button");
    campos.forEach((campo) => {
        campo.disabled = !habilitado;
    });
}

function limpiarFormularioEdicion() {
    documentoSeleccionado = "";
    if (formActualizar) formActualizar.reset();
    setFormularioHabilitado(false);
    if (estadoSeleccion) {
        estadoSeleccion.textContent = "Sin seleccion";
        estadoSeleccion.className = "pill pill-muted";
    }
}

function seleccionarPersona(numeroDocumento) {
    const persona = personalListado.find((item) => String(item?.numeroDocumento || "") === String(numeroDocumento));
    if (!persona || !formActualizar) return;

    // Normalizar tipo de documento
    let tipoDocNormalizado = String(persona.tipoDocumento || "").trim().toUpperCase().replace(/\./g, "");
    if (tipoDocNormalizado === "CC") tipoDocNormalizado = "C.C.";
    else if (tipoDocNormalizado === "TI") tipoDocNormalizado = "T.I.";
    else if (tipoDocNormalizado === "CE") tipoDocNormalizado = "C.E.";
    else if (tipoDocNormalizado === "PTO" || tipoDocNormalizado === "PASAPORTE") tipoDocNormalizado = "P.T.O.";
    else tipoDocNormalizado = persona.tipoDocumento || "";

    const rolNormalizado = String(persona.rol || "").trim().toLowerCase();

    documentoSeleccionado = String(persona.numeroDocumento || "");
    formActualizar.documentoActual.value = documentoSeleccionado;
    formActualizar.nombre.value = persona.nombre || "";
    formActualizar.tipoDocumento.value = tipoDocNormalizado;
    formActualizar.numeroDocumento.value = persona.numeroDocumento || "";
    formActualizar.correo.value = persona.correo || "";
    formActualizar.telefono.value = persona.telefono || "";
    formActualizar.rol.value = rolNormalizado;

    setFormularioHabilitado(true);
    if (estadoSeleccion) {
        estadoSeleccion.textContent = `Editando ${persona.nombre || persona.numeroDocumento}`;
        estadoSeleccion.className = "pill pill-ok";
    }
    mostrarMensaje("Registro seleccionado. Puedes actualizar sus datos.", "ok");
}

// ===== 4) Pintar filas de la tabla =====
function pintarFilas(personal) {
    if (!cuerpoTabla) return; // Si no hay tbody, no se puede renderizar
    cuerpoTabla.innerHTML = ""; // Limpia filas anteriores

    // 4.1) Caso sin resultados
    if (!Array.isArray(personal) || personal.length === 0) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td colspan="9">No se encontraron resultados.</td>`;
        cuerpoTabla.appendChild(tr);
        return;
    }

    // 4.2) Crear una fila por persona
    for (const persona of personal) {
        const tr = document.createElement("tr");
        const numeroDocumento = persona?.numeroDocumento ?? ""; // Se usa también como `data-cedula`

        // Se construye el HTML de la fila con los datos recibidos del backend.
        tr.innerHTML = `
            <td>${escapeHtml(persona?.nombre)}</td>
            <td>${escapeHtml(persona?.tipoDocumento)}</td>
            <td>${escapeHtml(numeroDocumento)}</td>
            <td>${escapeHtml(persona?.correo)}</td>
            <td>${escapeHtml(persona?.telefono)}</td>
            <td>${escapeHtml(persona?.rol)}</td> 
            <td>${formatDateTime(persona?.ingresoAt)}</td>
            <td>${escapeHtml(persona?.estado)}</td>
            <td class="celda-acciones">
                <button type="button" class="btn-accion btn-editar" data-cedula="${escapeHtml(numeroDocumento)}">Editar</button>
            </td>
        `;
        cuerpoTabla.appendChild(tr); // Agrega la fila al tbody
    }
}

// =========================================================
// CARGA DE DATOS
// =========================================================

// ===== 5) Cargar personal registrado con filtros =====
async function cargarPersonal() {
    // 5.1) Leer filtros del formulario (si existe)
    const data = formFiltros ? new FormData(formFiltros) : new FormData();
    const nombre = String(data.get("nombre") || "").trim();
    const cedula = String(data.get("cedula") || "").trim();

    // 5.2) Construir querystring (?nombre=...&cedula=...)
    const params = new URLSearchParams();
    if (nombre) params.set("nombre", nombre);
    if (cedula) params.set("cedula", cedula);

    // 5.3) UI feedback
    mostrarMensaje("Cargando...", "wait");
    try {
        // 5.4) Llamar endpoint de todo el personal registrado
        const res = await apiFetch(`/api/personal?${params.toString()}`);

        // 5.5) Pintar tabla y mostrar cantidad
        personalListado = Array.isArray(res.personal) ? res.personal : [];
        pintarFilas(personalListado);
        mostrarMensaje(`Resultados: ${personalListado.length}`, "ok");
    } catch (e) {
        mostrarMensaje(e?.message || "No se pudo cargar el personal registrado.", "error");
    }
}

// ===== 6) Actualizar datos del usuario seleccionado =====
async function actualizarPersona() {
    if (!formActualizar || !documentoSeleccionado) {
        mostrarMensaje("Selecciona un registro antes de actualizar.", "error");
        return;
    }

    const data = new FormData(formActualizar);
    const payload = {
        nombre: String(data.get("nombre") || "").trim(),
        tipoDocumento: String(data.get("tipoDocumento") || "").trim(),
        numeroDocumento: String(data.get("numeroDocumento") || "").trim(),
        correo: String(data.get("correo") || "").trim(),
        telefono: String(data.get("telefono") || "").trim(),
        rol: String(data.get("rol") || "").trim(),
    };

    if (!payload.nombre || !payload.tipoDocumento || !payload.numeroDocumento || !payload.rol) {
        mostrarMensaje("Completa todos los campos obligatorios.", "error");
        return;
    }

    if (!esNombrePersonaValido(payload.nombre)) {
        mostrarMensaje("El nombre solo debe contener letras y espacios.", "error");
        return;
    }

    if (payload.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.correo)) {
        mostrarMensaje("Ingresa un correo valido sin emojis.", "error");
        return;
    }

    if (payload.telefono && !/^\d{7,15}$/.test(payload.telefono)) {
        mostrarMensaje("El telefono debe contener entre 7 y 15 digitos.", "error");
        return;
    }

    mostrarMensaje("Guardando cambios...", "wait");
    if (btnGuardar) btnGuardar.disabled = true;
    try {
        await apiFetch(`/api/usuarios/${encodeURIComponent(documentoSeleccionado)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        mostrarMensaje("Datos actualizados correctamente.", "ok");
        limpiarFormularioEdicion();
        await cargarPersonal();
    } catch (e) {
        mostrarMensaje(e?.message || "No se pudo actualizar el usuario.", "error");
        if (btnGuardar) btnGuardar.disabled = false;
    }
}

// =========================================================
// EVENTOS
// =========================================================

// ===== 7) Click en tabla (delegación) para capturar botón "Editar" =====
if (cuerpoTabla) {
    cuerpoTabla.addEventListener("click", (e) => {
        const btn = e.target?.closest?.("button[data-cedula]"); // Busca el botón de la fila
        if (!btn) return;

        const cedula = String(btn.getAttribute("data-cedula") || "").trim(); // Documento desde atributo data-*
        if (!cedula) return;

        seleccionarPersona(cedula);
    });
}

// ===== 8) Submit/reset del formulario de filtros =====
if (formFiltros) {
    formFiltros.addEventListener("submit", (e) => {
        e.preventDefault(); // Evita recarga
        limpiarFormularioEdicion();
        cargarPersonal(); // Re-carga con filtros actuales
    });
    formFiltros.addEventListener("reset", () => {
        // `reset` ocurre antes de que los inputs queden vacíos; por eso se difiere con setTimeout.
        setTimeout(() => {
            limpiarFormularioEdicion();
            cargarPersonal();
        }, 0);
    });
}

if (formActualizar) {
    formActualizar.addEventListener("submit", (e) => {
        e.preventDefault();
        actualizarPersona();
    });
}

if (btnCancelarEdicion) {
    btnCancelarEdicion.addEventListener("click", () => {
        limpiarFormularioEdicion();
        mostrarMensaje("Edicion cancelada.", "wait");
    });
}

// ===== 9) Cerrar sesión =====
if (btnCerrarSesion) {
    btnCerrarSesion.addEventListener("click", () => {
        const confirmar = window.confirm("Estas seguro de cerrar sesion?");
        if (confirmar) window.location.href = "/logout";
    });
}

// ===== 10) Carga inicial =====
limpiarFormularioEdicion();
cargarPersonal(); // Renderiza por primera vez al entrar a la vista
