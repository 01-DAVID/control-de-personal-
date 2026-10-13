// =========================================================
// FRONTEND: Salida (consultar usuario, observacion y salida)
// =========================================================

const salidaForm = document.getElementById("salidaForm");
const codigoCarnet = document.getElementById("codigoCarnet");
const scanid = document.getElementById("scanid");
const btnProcesar = document.getElementById("btnProcesar");
const btnSalida = document.getElementById("btnSalida");
const btnLimpiar = document.getElementById("btnLimpiar");
const observacionTextarea = document.getElementById("observacion");
const btnAdjuntarObservacion = document.getElementById("observacion-submit");

const estadoScan = document.getElementById("estadoScan");
const horaActual = document.getElementById("horaActual");
const btnCerrarSesion = document.getElementById("btnCerrarSesion");
const mensaje = document.getElementById("mensaje");

const inputNombre = document.getElementById("nombre");
const inputTipoDocumento = document.getElementById("tipoDocumento");
const inputNumeroDocumento = document.getElementById("numeroDocumento");
const inputCorreo = document.getElementById("correo");
const inputTelefono = document.getElementById("telefono");
const inputRol = document.getElementById("rol");
const inputAreaVisitaSalida = document.getElementById("areaVisitaSalida");
const fotoUsuario = document.getElementById("fotoUsuario");

const inputHoraIngreso = document.getElementById("horaIngreso");
const inputHoraSalida = document.getElementById("horaSalida");
const inputDuracion = document.getElementById("duracion");
const inputEstadoMovimiento = document.getElementById("estadoMovimiento");
const equiposBody = document.getElementById("equiposBody");

let currentNumeroDocumento = "";
let currentActiveMovementId = null;

function mostrarMensaje(texto, tipo = "") {
    if (!mensaje) return;
    mensaje.textContent = texto;
    mensaje.className = `message ${tipo}`.trim();
}

function setEstadoScan(texto, clase) {
    if (!estadoScan) return;
    estadoScan.textContent = texto;
    estadoScan.className = `pill ${clase}`;
}

function setAccionesHabilitadas(habilitado) {
    if (observacionTextarea) observacionTextarea.disabled = !habilitado;
    if (btnAdjuntarObservacion) btnAdjuntarObservacion.disabled = !habilitado;
    if (btnSalida) btnSalida.disabled = !habilitado;
}

function setDatosMovimientoActual(numeroDocumento = "", movimientoId = "") {
    if (!salidaForm) return;
    salidaForm.dataset.numeroDocumento = numeroDocumento || "";
    salidaForm.dataset.activeMovementId = movimientoId ? String(movimientoId) : "";
}

function setOrigenConsulta(origen = "") {
    if (!salidaForm) return;
    salidaForm.dataset.origenConsulta = origen;
}

function formatDateTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleString("es-CO", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatDurationMs(ms) {
    if (!Number.isFinite(ms) || ms < 0) return "";
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [
        String(hours).padStart(2, "0"),
        String(minutes).padStart(2, "0"),
        String(seconds).padStart(2, "0"),
    ].join(":");
}

function limpiarPantalla() {
    currentNumeroDocumento = "";
    currentActiveMovementId = null;
    setDatosMovimientoActual("", "");
    setOrigenConsulta("");

    inputNombre.value = "";
    inputTipoDocumento.value = "";
    inputNumeroDocumento.value = "";
    inputCorreo.value = "";
    inputTelefono.value = "";
    inputRol.value = "";
    if (inputAreaVisitaSalida) inputAreaVisitaSalida.value = "";

    inputHoraIngreso.value = "";
    inputHoraSalida.value = "";
    inputDuracion.value = "";
    inputEstadoMovimiento.value = "";

    if (observacionTextarea) observacionTextarea.value = "";
    setAccionesHabilitadas(false);

    if (fotoUsuario) {
        fotoUsuario.innerHTML = "<span>Foto</span>";
        fotoUsuario.style.backgroundImage = "";
    }

    renderEquipos([]);
    mostrarMensaje("", "");
    setEstadoScan("Esperando consulta", "pill-wait");
}

function pintarFoto(fotoRuta) {
    if (!fotoUsuario) return;

    if (!fotoRuta) {
        fotoUsuario.innerHTML = "<span>Foto</span>";
        fotoUsuario.style.backgroundImage = "";
        return;
    }

    fotoUsuario.innerHTML = "";
    fotoUsuario.style.backgroundImage = `url("${fotoRuta}")`;
    fotoUsuario.style.backgroundSize = "cover";
    fotoUsuario.style.backgroundPosition = "center";
}

function renderEquipos(equipos) {
    if (!equiposBody) return;
    equiposBody.innerHTML = "";

    if (!Array.isArray(equipos) || equipos.length === 0) {
        equiposBody.innerHTML = '<tr class="table-empty"><td colspan="4">Sin equipos registrados.</td></tr>';
        return;
    }

    for (const equipo of equipos) {
        const row = document.createElement("tr");

        const tdEquipo = document.createElement("td");
        tdEquipo.textContent = String(equipo?.nombreEquipo || "");

        const tdSerial = document.createElement("td");
        tdSerial.textContent = String(equipo?.serialEquipo || "");

        const tdAdicional = document.createElement("td");
        tdAdicional.textContent = equipo?.adicionalEquipo ? String(equipo.adicionalEquipo) : "";

        const tdAcciones = document.createElement("td");
        const btnRegistrarEquipo = document.createElement("button");
        btnRegistrarEquipo.type = "button";
        btnRegistrarEquipo.textContent = "Registrar salida";
        btnRegistrarEquipo.className = "btn-equipo-salida";
        btnRegistrarEquipo.dataset.equipoId = String(equipo?.id || "");
        tdAcciones.appendChild(btnRegistrarEquipo);

        row.append(tdEquipo, tdSerial, tdAdicional, tdAcciones);
        equiposBody.appendChild(row);
    }
}

async function apiFetch(path, options = {}) {
    const res = await fetch(path, options);
    const data = await res.json().catch(() => ({}));

    if (!res.ok || data?.ok === false) {
        throw new Error(data?.message || "Error de servidor.");
    }

    return data;
}

function pintarUsuario(data) {
    const usuario = data.usuario || {};
    const movimiento = data.movimiento || usuario.movimiento || null;
    const equipos = Array.isArray(data.equipos) ? data.equipos : [];

    currentNumeroDocumento = usuario.numeroDocumento || "";
    currentActiveMovementId = movimiento && !movimiento.salidaAt ? movimiento.id : null;
    setDatosMovimientoActual(currentNumeroDocumento, currentActiveMovementId);
    setOrigenConsulta("manual");

    inputNombre.value = usuario.nombre || "";
    inputTipoDocumento.value = usuario.tipoDocumento || "";
    inputNumeroDocumento.value = usuario.numeroDocumento || "";
    inputCorreo.value = usuario.correo || "";
    inputTelefono.value = usuario.telefono || "";
    inputRol.value = usuario.rol || "";
    if (inputAreaVisitaSalida) {
        inputAreaVisitaSalida.value = usuario.areaVisita || "";
    }
    pintarFoto(usuario.fotoRuta);

    inputHoraIngreso.value = formatDateTime(movimiento?.ingresoAt);
    inputHoraSalida.value = formatDateTime(movimiento?.salidaAt);
    inputEstadoMovimiento.value = movimiento?.estado || "";

    const ingreso = movimiento?.ingresoAt ? new Date(movimiento.ingresoAt) : null;
    const salida = movimiento?.salidaAt ? new Date(movimiento.salidaAt) : null;
    inputDuracion.value = ingreso && salida ? formatDurationMs(salida.getTime() - ingreso.getTime()) : "";

    if (observacionTextarea) observacionTextarea.value = movimiento?.observacionSalida || "";
    setAccionesHabilitadas(Boolean(currentActiveMovementId));
    renderEquipos(equipos);

    if (!movimiento) {
        setEstadoScan("Sin movimientos", "pill-muted");
        mostrarMensaje("Usuario consultado. No tiene movimientos registrados.", "ok");
    } else if (currentActiveMovementId) {
        setEstadoScan("Usuario en sede", "pill-ok");
        mostrarMensaje("Usuario consultado. Puedes adjuntar observacion o registrar salida.", "ok");
    } else {
        setEstadoScan("Usuario fuera de sede", "pill-muted");
        mostrarMensaje("Usuario consultado. No tiene un ingreso abierto.", "ok");
    }
}

async function consultarUsuario(valorConsulta = null) {
    const esEvento = valorConsulta && typeof valorConsulta === "object" && "type" in valorConsulta;
    const valor = String(esEvento ? codigoCarnet?.value || "" : valorConsulta || codigoCarnet?.value || "").trim();

    if (valor.length < 3) {
        mostrarMensaje("Ingresa minimo 3 caracteres del nombre o documento.", "error");
        setEstadoScan("Consulta invalida", "pill-error");
        return;
    }

    limpiarPantalla();
    setEstadoScan("Consultando...", "pill-muted");
    mostrarMensaje("Consultando usuario...", "wait");

    try {
        const data = await apiFetch(`/api/usuarios/buscar?valor=${encodeURIComponent(valor)}`);
        pintarUsuario(data);
    } catch (error) {
        mostrarMensaje(error?.message || "No se pudo consultar el usuario.", "error");
        setEstadoScan("Error", "pill-error");
    }
}

async function adjuntarObservacion() {
    const movementId = salidaForm?.dataset.activeMovementId || currentActiveMovementId || null;
    if (!movementId) {
        mostrarMensaje("Primero consulta un usuario con ingreso abierto.", "error");
        return;
    }

    const observacionSalida = String(observacionTextarea?.value || "").trim();
    mostrarMensaje("Guardando observacion...", "wait");
    if (btnAdjuntarObservacion) btnAdjuntarObservacion.disabled = true;

    try {
        const data = await apiFetch(`/api/movimientos/${movementId}/observacion`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ observacionSalida }),
        });
        if (observacionTextarea) observacionTextarea.value = data.movimiento?.observacionSalida || "";
        mostrarMensaje("Observacion adjuntada correctamente.", "ok");
    } catch (error) {
        mostrarMensaje(error?.message || "No se pudo adjuntar la observacion.", "error");
    } finally {
        if (btnAdjuntarObservacion) btnAdjuntarObservacion.disabled = false;
    }
}

async function registrarSalidaUsuario() {
    const numeroDocumentoActual = salidaForm?.dataset.numeroDocumento || currentNumeroDocumento || "";
    const movementId = salidaForm?.dataset.activeMovementId || currentActiveMovementId || null;

    if (!numeroDocumentoActual || !movementId) {
        mostrarMensaje("Primero consulta un usuario con ingreso abierto.", "error");
        return;
    }

    const numeroDocumentoSalida = numeroDocumentoActual;
    const observacionSalida = String(observacionTextarea?.value || "").trim();
    mostrarMensaje("Registrando salida...", "wait");
    if (btnSalida) btnSalida.disabled = true;

    try {
        await apiFetch("/api/salida", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ numeroDocumento: numeroDocumentoSalida, observacionSalida }),
        });

        mostrarMensaje("Salida registrada correctamente.", "ok");
        setEstadoScan("Salida registrada", "pill-ok");
        if (
            salidaForm?.dataset.origenConsulta === "scanner" &&
            typeof window.refrescarConsultaScannerSalida === "function"
        ) {
            await window.refrescarConsultaScannerSalida(numeroDocumentoSalida);
            return;
        }

        if (codigoCarnet) codigoCarnet.value = numeroDocumentoSalida;
        await consultarUsuario(numeroDocumentoSalida);
    } catch (error) {
        mostrarMensaje(error?.message || "No se pudo registrar la salida.", "error");
        setEstadoScan("Error", "pill-error");
        if (btnSalida) btnSalida.disabled = false;
    }
}

async function registrarSalidaEquipo(equipoId) {
    if (!equipoId) return;
    const numeroDocumentoConsulta = salidaForm?.dataset.numeroDocumento || currentNumeroDocumento || "";

    const confirmar = window.confirm("Estas seguro de registrar la salida de este equipo u objeto?");
    if (!confirmar) return;

    mostrarMensaje("Registrando salida del equipo...", "wait");

    try {
        await apiFetch(`/api/equipos/${encodeURIComponent(equipoId)}/salida`, {
            method: "DELETE",
        });
        mostrarMensaje("Salida del equipo registrada.", "ok");
        if (numeroDocumentoConsulta) {
            if (codigoCarnet) codigoCarnet.value = numeroDocumentoConsulta;
            await consultarUsuario(numeroDocumentoConsulta);
        }
    } catch (error) {
        mostrarMensaje(error?.message || "No se pudo registrar la salida del equipo.", "error");
    }
}

function iniciarReloj() {
    if (!horaActual) return;

    const actualizar = () => {
        horaActual.textContent = new Date().toLocaleTimeString("es-CO", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    };

    actualizar();
    setInterval(actualizar, 1000);
}

if (btnCerrarSesion) {
    btnCerrarSesion.addEventListener("click", () => {
        if (window.confirm("Estas seguro de cerrar sesion?")) {
            window.location.href = "/logout";
        }
    });
}

if (btnLimpiar) {
    btnLimpiar.addEventListener("click", () => {
        if (codigoCarnet) codigoCarnet.value = "";
        if (scanid) {
            scanid.value = "";
            scanid.readOnly = false;
        }
        limpiarPantalla();
        codigoCarnet?.focus?.();
    });
}

btnProcesar?.addEventListener("click", () => consultarUsuario());
btnSalida?.addEventListener("click", registrarSalidaUsuario);
btnAdjuntarObservacion?.addEventListener("click", adjuntarObservacion);

salidaForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    consultarUsuario();
});

equiposBody?.addEventListener("click", (event) => {
    const btn = event.target?.closest?.(".btn-equipo-salida");
    if (!btn) return;
    registrarSalidaEquipo(btn.dataset.equipoId);
});

iniciarReloj();
limpiarPantalla();
codigoCarnet?.focus?.();
