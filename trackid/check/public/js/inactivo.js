// =========================================================
// FRONTEND: Salida de personal activo desde panel admin
// =========================================================

const formFiltros = document.getElementById("form-filtros-inactivo");
const mensaje = document.getElementById("mensaje-inactivo");
const cuerpoTabla = document.getElementById("cuerpo-tabla-inactivo");
const btnCerrarSesion = document.getElementById("cerrar-sesion");

const detalleNombre = document.getElementById("detalle-nombre");
const detalleDocumento = document.getElementById("detalle-documento");
const detalleRol = document.getElementById("detalle-rol");
const detalleIngreso = document.getElementById("detalle-ingreso");
const cuerpoEquipos = document.getElementById("cuerpo-tabla-equipos");
const observacionSalida = document.getElementById("observacion-salida");
const btnAdjuntarObservacion = document.getElementById("btn-adjuntar-observacion");
const btnDarSalida = document.getElementById("btn-dar-salida");

let usuarioSeleccionado = null;
let observacionAdjuntada = "";

function mostrarMensaje(texto, tipo) {
    if (!mensaje) return;
    mensaje.textContent = texto || "";
    mensaje.className = `message ${tipo || ""}`;
}

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

async function apiFetch(path, options) {
    const res = await fetch(path, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
        throw new Error(data?.message || "Error de servidor.");
    }
    return data;
}

function resetDetalle() {
    usuarioSeleccionado = null;
    observacionAdjuntada = "";

    if (detalleNombre) detalleNombre.value = "";
    if (detalleDocumento) detalleDocumento.value = "";
    if (detalleRol) detalleRol.value = "";
    if (detalleIngreso) detalleIngreso.value = "";
    if (observacionSalida) observacionSalida.value = "";
    if (btnAdjuntarObservacion) btnAdjuntarObservacion.disabled = true;
    if (btnDarSalida) btnDarSalida.disabled = true;

    if (cuerpoEquipos) {
        cuerpoEquipos.innerHTML = `<tr><td colspan="4">Selecciona un usuario activo.</td></tr>`;
    }
}

function renderEquipos(equipos) {
    if (!cuerpoEquipos) return;
    cuerpoEquipos.innerHTML = "";

    if (!Array.isArray(equipos) || equipos.length === 0) {
        cuerpoEquipos.innerHTML = `<tr><td colspan="4">Sin equipos u objetos registrados.</td></tr>`;
        return;
    }

    for (const equipo of equipos) {

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${equipo?.nombreEquipo ?? ""}</td>
            <td>${equipo?.serialEquipo ?? ""}</td>
            <td>${equipo?.adicionalEquipo ?? ""}</td>
        `;

        const tdAcciones = document.createElement("td");
        const btnRegistrarEquipo = document.createElement("button");

        btnRegistrarEquipo.type = "button";
        btnRegistrarEquipo.textContent = "Registrar salida";
        btnRegistrarEquipo.className = "btn-equipo-salida";
        btnRegistrarEquipo.dataset.equipoId = String(equipo?.id || "");
        tdAcciones.appendChild(btnRegistrarEquipo);
        
        tr.appendChild(tdAcciones);

        cuerpoEquipos.appendChild(tr,);
    }
}

function pintarFilas(personal) {
    if (!cuerpoTabla) return;
    cuerpoTabla.innerHTML = "";

    if (!Array.isArray(personal) || personal.length === 0) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td colspan="7">No se encontraron usuarios activos.</td>`;
        cuerpoTabla.appendChild(tr);
        return;
    }

    for (const persona of personal) {
        const numeroDocumento = persona?.numeroDocumento ?? "";
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${persona?.nombre ?? ""}</td>
            <td>${persona?.tipoDocumento ?? ""}</td>
            <td>${numeroDocumento}</td>
            <td>${persona?.rol ?? ""}</td>
            <td>${formatDateTime(persona?.ingresoAt)}</td>
            <td>${persona?.estado ?? ""}</td>
            <td class="celda-acciones">
                <button type="button" class="btn-secondary" data-consultar="${numeroDocumento}">Consultar</button>
            </td>
        `;
        cuerpoTabla.appendChild(tr);
    }
}

async function cargarPersonalActivo() {
    const data = formFiltros ? new FormData(formFiltros) : new FormData();
    const nombre = String(data.get("nombre") || "").trim();
    const cedula = String(data.get("cedula") || "").trim();

    const params = new URLSearchParams();
    if (nombre) params.set("nombre", nombre);
    if (cedula) params.set("cedula", cedula);

    resetDetalle();
    mostrarMensaje("Cargando usuarios activos...", "wait");

    try {
        const res = await apiFetch(`/api/personal/activos?${params.toString()}`);
        pintarFilas(res.personal);
        mostrarMensaje(`Activos encontrados: ${Array.isArray(res.personal) ? res.personal.length : 0}`, "ok");
    } catch (error) {
        mostrarMensaje(error?.message || "No se pudo cargar el personal activo.", "error");
    }
}

async function consultarDetalle(numeroDocumento) {
    if (!numeroDocumento) return;

    resetDetalle();
    mostrarMensaje("Consultando datos, movimiento y equipos...", "wait");

    try {
        const res = await apiFetch(`/api/usuarios/${encodeURIComponent(numeroDocumento)}`);
        const usuario = res.usuario;
        const movimiento = res.movimiento;

        if (!movimiento || movimiento.salidaAt || movimiento.estado !== "en_sede") {
            mostrarMensaje("Este usuario no tiene un ingreso activo.", "error");
            return;
        }

        usuarioSeleccionado = usuario;
        if (detalleNombre) detalleNombre.value = usuario?.nombre || "";
        if (detalleDocumento) detalleDocumento.value = usuario?.numeroDocumento || "";
        if (detalleRol) detalleRol.value = usuario?.rol || "";
        if (detalleIngreso) detalleIngreso.value = formatDateTime(movimiento?.ingresoAt);

        renderEquipos(Array.isArray(res.equipos) ? res.equipos : []);
        if (btnAdjuntarObservacion) btnAdjuntarObservacion.disabled = false;
        mostrarMensaje("Usuario activo consultado. Adjunta la observacion para habilitar la salida.", "ok");
    } catch (error) {
        mostrarMensaje(error?.message || "No se pudo consultar el usuario.", "error");
    }
}

async function registrarSalidaEquipo(equipoId) {
    if (!equipoId) return;

    const numeroDocumento = usuarioSeleccionado?.numeroDocumento;
    if (!numeroDocumento) {
        mostrarMensaje("Primero consulta un usuario activo.", "error");
        return;
    }

    const confirmar = window.confirm("Estas seguro de registrar la salida de este equipo u objeto?");
    if (!confirmar) return;

    mostrarMensaje("Registrando salida del equipo...", "wait");

    try {
        await apiFetch(`/api/equipos/${encodeURIComponent(equipoId)}/salida`, {
            method: "DELETE",
        });

        mostrarMensaje("Salida del equipo registrada. El usuario sigue activo hasta que le des salida.", "ok");
        await consultarDetalle(numeroDocumento);
    } catch (error) {
        mostrarMensaje(error?.message || "No se pudo registrar la salida del equipo.", "error");
    }
}

function adjuntarObservacion() {
    if (!usuarioSeleccionado) {
        mostrarMensaje("Primero consulta un usuario activo.", "error");
        return;
    }

    const texto = String(observacionSalida?.value || "").trim();
    if (!texto) {
        mostrarMensaje("Escribe la observacion de salida.", "error");
        return;
    }

    observacionAdjuntada = texto;
    if (btnDarSalida) btnDarSalida.disabled = false;
    mostrarMensaje("Observacion adjuntada. Ya puedes dar salida.", "ok");
}

async function darSalida() {
    const numeroDocumento = usuarioSeleccionado?.numeroDocumento;
    if (!numeroDocumento) {
        mostrarMensaje("Primero consulta un usuario activo.", "error");
        return;
    }

    if (!observacionAdjuntada) {
        mostrarMensaje("Adjunta la observacion antes de dar salida.", "error");
        return;
    }

    const confirmar = window.confirm(`Dar salida al usuario con documento ${numeroDocumento}?`);
    if (!confirmar) return;

    mostrarMensaje("Registrando salida...", "wait");

    try {
        await apiFetch("/api/salida", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                numeroDocumento,
                observacionSalida: observacionAdjuntada,
            }),
        });

        mostrarMensaje("Salida registrada correctamente.", "ok");
        await cargarPersonalActivo();
    } catch (error) {
        mostrarMensaje(error?.message || "No se pudo registrar la salida.", "error");
    }
}

if (cuerpoTabla) {
    cuerpoTabla.addEventListener("click", (event) => {
        const btn = event.target?.closest?.("button[data-consultar]");
        if (!btn) return;
        consultarDetalle(String(btn.getAttribute("data-consultar") || "").trim());
    });
}

if (cuerpoEquipos) {
    cuerpoEquipos.addEventListener("click", (event) => {
        const btn = event.target?.closest?.(".btn-equipo-salida");
        if (!btn) return;
        registrarSalidaEquipo(btn.dataset.equipoId);
    });
}

if (formFiltros) {
    formFiltros.addEventListener("submit", (event) => {
        event.preventDefault();
        cargarPersonalActivo();
    });

    formFiltros.addEventListener("reset", () => {
        setTimeout(() => cargarPersonalActivo(), 0);
    });
}

if (observacionSalida) {
    observacionSalida.addEventListener("input", () => {
        observacionAdjuntada = "";
        if (btnDarSalida) btnDarSalida.disabled = true;
    });
}

if (btnAdjuntarObservacion) {
    btnAdjuntarObservacion.addEventListener("click", adjuntarObservacion);
}

if (btnDarSalida) {
    btnDarSalida.addEventListener("click", darSalida);
}

if (btnCerrarSesion) {
    btnCerrarSesion.addEventListener("click", () => {
        const confirmar = window.confirm("Estas seguro de cerrar sesion?");
        if (confirmar) window.location.href = "/logout";
    });
}

cargarPersonalActivo();
