const scannerSalidaInput = document.getElementById("scanid");
const scannerSalidaForm = document.getElementById("salidaForm");
const scannerEstadoScan = document.getElementById("estadoScan");
const scannerMensaje = document.getElementById("mensaje");
const scannerInputNombre = document.getElementById("nombre");
const scannerInputTipoDocumento = document.getElementById("tipoDocumento");
const scannerInputNumeroDocumento = document.getElementById("numeroDocumento");
const scannerInputCorreo = document.getElementById("correo");
const scannerInputTelefono = document.getElementById("telefono");
const scannerInputRol = document.getElementById("rol");
const scannerInputAreaVisitaSalida = document.getElementById("areaVisitaSalida");
const scannerFotoUsuario = document.getElementById("fotoUsuario");
const scannerInputHoraIngreso = document.getElementById("horaIngreso");
const scannerInputHoraSalida = document.getElementById("horaSalida");
const scannerInputDuracion = document.getElementById("duracion");
const scannerInputEstadoMovimiento = document.getElementById("estadoMovimiento");
const scannerEquiposBody = document.getElementById("equiposBody");
const scannerObservacionTextarea = document.getElementById("observacion");
const scannerBtnAdjuntarObservacion = document.getElementById("observacion-submit");
const scannerBtnSalida = document.getElementById("btnSalida");

let scannerSalidaTimer = null;

function scannerMostrarMensaje(texto, tipo = "") {
    if (!scannerMensaje) return;
    scannerMensaje.textContent = texto;
    scannerMensaje.className = `message ${tipo}`.trim();
}

function scannerSetEstadoScan(texto, clase) {
    if (!scannerEstadoScan) return;
    scannerEstadoScan.textContent = texto;
    scannerEstadoScan.className = `pill ${clase}`;
}

function scannerSetAccionesHabilitadas(habilitado) {
    if (scannerObservacionTextarea) scannerObservacionTextarea.disabled = !habilitado;
    if (scannerBtnAdjuntarObservacion) scannerBtnAdjuntarObservacion.disabled = !habilitado;
    if (scannerBtnSalida) scannerBtnSalida.disabled = !habilitado;
}

function scannerSetDatosMovimiento(numeroDocumento = "", movimientoId = "") {
    if (!scannerSalidaForm) return;
    scannerSalidaForm.dataset.numeroDocumento = numeroDocumento || "";
    scannerSalidaForm.dataset.activeMovementId = movimientoId ? String(movimientoId) : "";
}

function scannerSetOrigenConsulta(origen = "scanner") {
    if (!scannerSalidaForm) return;
    scannerSalidaForm.dataset.origenConsulta = origen;
}

function scannerFormatDateTime(value) {
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

function scannerFormatDurationMs(ms) {
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

function scannerPintarFoto(fotoRuta) {
    if (!scannerFotoUsuario) return;

    if (!fotoRuta) {
        scannerFotoUsuario.innerHTML = "<span>Foto</span>";
        scannerFotoUsuario.style.backgroundImage = "";
        return;
    }

    scannerFotoUsuario.innerHTML = "";
    scannerFotoUsuario.style.backgroundImage = `url("${fotoRuta}")`;
    scannerFotoUsuario.style.backgroundSize = "cover";
    scannerFotoUsuario.style.backgroundPosition = "center";
}

function scannerRenderEquipos(equipos) {
    if (!scannerEquiposBody) return;
    scannerEquiposBody.innerHTML = "";

    if (!Array.isArray(equipos) || equipos.length === 0) {
        scannerEquiposBody.innerHTML = '<tr class="table-empty"><td colspan="4">Sin equipos registrados.</td></tr>';
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
        scannerEquiposBody.appendChild(row);
    }
}

async function scannerApiFetch(path, options = {}) {
    const res = await fetch(path, options);
    const data = await res.json().catch(() => ({}));

    if (!res.ok || data?.ok === false) {
        throw new Error(data?.message || "Error de servidor.");
    }

    return data;
}

function scannerPintarUsuario(data) {
    const usuario = data.usuario || {};
    const movimiento = data.movimiento || usuario.movimiento || null;
    const equipos = Array.isArray(data.equipos) ? data.equipos : [];
    const numeroDocumento = usuario.numeroDocumento || "";
    const movimientoActivoId = movimiento && !movimiento.salidaAt ? movimiento.id : null;

    scannerSetDatosMovimiento(numeroDocumento, movimientoActivoId);
    scannerSetOrigenConsulta("scanner");

    scannerInputNombre.value = usuario.nombre || "";
    scannerInputTipoDocumento.value = usuario.tipoDocumento || "";
    scannerInputNumeroDocumento.value = numeroDocumento;
    scannerInputCorreo.value = usuario.correo || "";
    scannerInputTelefono.value = usuario.telefono || "";
    scannerInputRol.value = usuario.rol || "";
    if (scannerInputAreaVisitaSalida) scannerInputAreaVisitaSalida.value = usuario.areaVisita || "";
    scannerPintarFoto(usuario.fotoRuta);

    scannerInputHoraIngreso.value = scannerFormatDateTime(movimiento?.ingresoAt);
    scannerInputHoraSalida.value = scannerFormatDateTime(movimiento?.salidaAt);
    scannerInputEstadoMovimiento.value = movimiento?.estado || "";

    const ingreso = movimiento?.ingresoAt ? new Date(movimiento.ingresoAt) : null;
    const salida = movimiento?.salidaAt ? new Date(movimiento.salidaAt) : null;
    scannerInputDuracion.value = ingreso && salida ? scannerFormatDurationMs(salida.getTime() - ingreso.getTime()) : "";

    if (scannerObservacionTextarea) scannerObservacionTextarea.value = movimiento?.observacionSalida || "";
    scannerSetAccionesHabilitadas(Boolean(movimientoActivoId));
    scannerRenderEquipos(equipos);

    if (!movimiento) {
        scannerSetEstadoScan("Sin movimientos", "pill-muted");
        scannerMostrarMensaje("Usuario consultado. No tiene movimientos registrados.", "ok");
    } else if (movimientoActivoId) {
        scannerSetEstadoScan("Usuario en sede", "pill-ok");
        scannerMostrarMensaje("Usuario consultado desde escaner. Puedes adjuntar observacion o registrar salida.", "ok");
    } else {
        scannerSetEstadoScan("Usuario fuera de sede", "pill-muted");
        scannerMostrarMensaje("Usuario consultado. No tiene un ingreso abierto.", "ok");
    }
}

async function consultarDesdeScanner() {
    const valor = String(scannerSalidaInput?.value || "").trim();
    if (!valor) return;

    if (valor.length < 3) {
        scannerMostrarMensaje("El escaneo debe tener minimo 3 caracteres.", "error");
        scannerSetEstadoScan("Consulta invalida", "pill-error");
        return;
    }

    scannerSetEstadoScan("Consultando...", "pill-muted");
    scannerMostrarMensaje("Consultando usuario desde escaner...", "wait");
    scannerSalidaInput.readOnly = true;

    try {
        const data = await scannerApiFetch(`/api/scanner-salida/buscar?valor=${encodeURIComponent(valor)}`);
        scannerPintarUsuario(data);
        scannerSalidaInput.readOnly = false;
    } catch (error) {
        scannerSalidaInput.readOnly = false;
        scannerSetDatosMovimiento("", "");
        scannerSetAccionesHabilitadas(false);
        scannerMostrarMensaje(error?.message || "No se pudo consultar el usuario escaneado.", "error");
        scannerSetEstadoScan("Error", "pill-error");
    }
}

if (scannerSalidaInput) {
    scannerSalidaInput.addEventListener("input", () => {
        clearTimeout(scannerSalidaTimer);
        scannerSalidaTimer = setTimeout(consultarDesdeScanner, 250);
    });

    scannerSalidaInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        clearTimeout(scannerSalidaTimer);
        consultarDesdeScanner();
    });
}

window.refrescarConsultaScannerSalida = async function refrescarConsultaScannerSalida(valor) {
    if (scannerSalidaInput) scannerSalidaInput.value = String(valor || "");
    await consultarDesdeScanner();
};
