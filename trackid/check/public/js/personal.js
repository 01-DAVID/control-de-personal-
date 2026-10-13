// =========================================================
// FRONTEND: Personal (listado general)
// =========================================================
// Esta vista lista todo el personal registrado en la tabla `usuarios`.
// Permite filtrar usando querystring al endpoint `/api/personal`.

// ===== 1) Referencias del DOM =====
const formFiltros = document.getElementById("form-filtros-personal"); // Formulario de filtros
const mensaje = document.getElementById("mensaje-personal"); // Contenedor de mensajes
const cuerpoTabla = document.getElementById("cuerpo-tabla-personal"); // <tbody> de la tabla
const btnCerrarSesion = document.getElementById("cerrar-sesion"); // Botón de logout



//===============================================



// =========================================================
// HELPERS
// =========================================================

// ===== 2) Mostrar mensajes en pantalla =====
function mostrarMensaje(texto, tipo) {
    if (!mensaje) return;
    mensaje.textContent = texto || "";
    mensaje.className = `message ${tipo || ""}`;
}

// ===== 3) Wrapper fetch con manejo estándar de errores =====
async function apiFetch(path, options) {
    const res = await fetch(path, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
        throw new Error(data?.message || "Error de servidor.");
    }
    return data;
}

// ===== 4.1) Formatear fecha y hora para mostrar en tabla =====
function formatDateTimeForTable(value) {
    if (!value) return ""; // Si no hay valor, retorna vacío

    const date = new Date(value); // Convierte string/fecha a Date

    if (Number.isNaN(date.getTime())) return String(value); // Si no es parseable, retorna el valor original o vacío

    return date.toLocaleString("es-CO", {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit",
    });
}

// ===== 4) Pintar filas de la tabla =====
function pintarFilas(personal) {
    if (!cuerpoTabla) return;
    cuerpoTabla.innerHTML = "";

    // Caso sin resultados
    if (!Array.isArray(personal) || personal.length === 0) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td colspan="9">No se encontraron resultados.</td>`;
        cuerpoTabla.appendChild(tr);
        return;
    }

    // Render de una fila por persona
    for (const persona of personal) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${persona?.nombre ?? ""}</td>
            <td>${persona?.tipoDocumento ?? ""}</td> 
            <td>${persona?.numeroDocumento ?? ""}</td>
            <td>${persona?.correo ?? ""}</td>
            <td>${persona?.telefono ?? ""}</td>
            <td>${persona?.rol ?? ""}</td>
            <td>${formatDateTimeForTable(persona?.createdAt)}</td>
            <td>${formatDateTimeForTable(persona?.ingresoAt)}</td>
            <td>${formatDateTimeForTable(persona?.salidaAt)}</td>
        `;
        cuerpoTabla.appendChild(tr);
    }
}

// =========================================================
// CARGA DE DATOS
// =========================================================

// ===== 5) Cargar personal con filtros =====
async function cargarPersonal() {
    // Leer filtros del formulario
    const data = formFiltros ? new FormData(formFiltros) : new FormData();
    const nombre = String(data.get("nombre") || "").trim();
    const cedula = String(data.get("cedula") || "").trim();
    const rol = String(data.get("rol") || "").trim();
    const dia = String(data.get("dia") || "").trim();
    const mes = String(data.get("mes") || "").trim();
    const quincena = String(data.get("quincena") || "").trim();
    const hora = String(data.get("hora") || "").trim();

    // Construir querystring
    const params = new URLSearchParams();
    if (nombre) params.set("nombre", nombre);
    if (cedula) params.set("cedula", cedula);
    if (rol) params.set("rol", rol);
    if (dia) params.set("dia", dia);
    if (mes) params.set("mes", mes);
    if (quincena) params.set("quincena", quincena);
    if (hora) params.set("hora", hora);

    mostrarMensaje("Cargando...", "wait");
    try {
        const res = await apiFetch(`/api/personal?${params.toString()}`);
        pintarFilas(res.personal);
        mostrarMensaje(`Resultados: ${Array.isArray(res.personal) ? res.personal.length : 0}`, "ok");
    } catch (e) {
        mostrarMensaje(e?.message || "No se pudo cargar el personal.", "error");
    }
}

// =========================================================
// EVENTOS
// =========================================================

// ===== 6) Submit/reset del formulario de filtros =====
if (formFiltros) {
    formFiltros.addEventListener("submit", (e) => {
        e.preventDefault();
        cargarPersonal();
    });
    formFiltros.addEventListener("reset", () => {
        setTimeout(() => cargarPersonal(), 0);
    });
}

// ===== 7) Cerrar sesión =====
if (btnCerrarSesion) {
    btnCerrarSesion.addEventListener("click", () => {
        const confirmar = window.confirm("Estas seguro de cerrar sesion?");
        if (confirmar) window.location.href = "/logout";
    });
}

// ===== 8) Carga inicial =====
cargarPersonal();
