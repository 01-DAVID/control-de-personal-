const scannerRegistroInput = document.getElementById("scannerRegistroInput");
const scannerRegistroForm = document.getElementById("userForm");
const scannerRegistroMensaje = document.getElementById("msg");

let scannerRegistroTimer = null;

function scannerRegistroMostrarMensaje(texto, tipo = "") {
    if (!scannerRegistroMensaje) return;
    scannerRegistroMensaje.textContent = texto;
    scannerRegistroMensaje.className = `message ${tipo}`.trim();
}

function scannerRegistroSetDocumentoActivo(numeroDocumento = "") {
    if (scannerRegistroForm) {
        scannerRegistroForm.dataset.documentoActivo = numeroDocumento || "";
        scannerRegistroForm.dataset.origenConsulta = numeroDocumento ? "scanner" : "";
    }

    if (typeof documentoActivo !== "undefined") {
        documentoActivo = numeroDocumento || "";
    }
}

function scannerRegistroMostrarFoto(fotoRuta) {
    const fotoPreview = document.getElementById("fotoPreview");
    const fotoPlaceholder = document.getElementById("fotoPlaceholder");

    if (typeof window.mostrarFotoRegistro === "function") {
        window.mostrarFotoRegistro(fotoRuta);
        return;
    }

    if (!fotoPreview || !fotoPlaceholder) return;

    fotoPreview.src = fotoRuta || "";
    fotoPreview.hidden = !fotoRuta;
    fotoPlaceholder.hidden = Boolean(fotoRuta);
}

function scannerRegistroPintarUsuario(usuario) {
    if (!usuario) return;

    // Normalizar tipo de documento
    let tipoDocNormalizado = String(usuario.tipoDocumento || "").trim().toUpperCase().replace(/\./g, "");
    if (tipoDocNormalizado === "CC") tipoDocNormalizado = "C.C.";
    else if (tipoDocNormalizado === "TI") tipoDocNormalizado = "T.I.";
    else if (tipoDocNormalizado === "CE") tipoDocNormalizado = "C.E.";
    else if (tipoDocNormalizado === "PTO" || tipoDocNormalizado === "PASAPORTE") tipoDocNormalizado = "P.T.O.";
    else tipoDocNormalizado = usuario.tipoDocumento || "";

    const rolNormalizado = String(usuario.rol || "").trim().toLowerCase();

    document.getElementById("nombre").value = usuario.nombre || "";
    document.getElementById("tipoDocumento").value = tipoDocNormalizado;
    document.getElementById("numeroDocumento").value = usuario.numeroDocumento || "";
    document.getElementById("correo").value = usuario.correo || "";
    document.getElementById("telefono").value = usuario.telefono || "";
    document.getElementById("rol").value = rolNormalizado;

    const areaVisita = document.getElementById("areaVisita");
    if (areaVisita) areaVisita.value = usuario.areaVisita || "";

    if (typeof actualizarCampoAreaVisitante === "function") {
        actualizarCampoAreaVisitante();
    }

    scannerRegistroMostrarFoto(usuario.fotoRuta || "");

    const horaIngreso = document.getElementById("horaIngreso");
    if (horaIngreso) {
        const ingresoAt = usuario.movimiento?.ingresoAt || "";
        horaIngreso.textContent = ingresoAt ? ingresoAt.slice(11, 19) : new Date().toLocaleTimeString("es-CO", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    }

    scannerRegistroSetDocumentoActivo(usuario.numeroDocumento || "");

    // Guarda una copia de los datos consultados para detectar cambios al registrar.
    if (typeof window.guardarSnapshotConsulta === "function") {
        window.guardarSnapshotConsulta(usuario);
    }
}

async function scannerRegistroApiFetch(path) {
    const res = await fetch(path);
    const data = await res.json().catch(() => ({}));

    if (!res.ok || data?.ok === false) {
        throw new Error(data?.message || "No se pudo consultar el usuario escaneado.");
    }

    return data;
}

async function consultarDesdeScannerRegistro() {
    const valor = String(scannerRegistroInput?.value || "").trim();
    if (!valor) return;

    if (valor.length < 3) {
        scannerRegistroMostrarMensaje("El escaneo debe tener minimo 3 caracteres.", "error");
        return;
    }

    scannerRegistroMostrarMensaje("Consultando usuario desde escaner...", "wait");
    scannerRegistroInput.readOnly = true;

    try {
        const data = await scannerRegistroApiFetch(`/api/scanner-registro/buscar?valor=${encodeURIComponent(valor)}`);
        scannerRegistroPintarUsuario(data.usuario);
        scannerRegistroMostrarMensaje("Usuario encontrado desde escaner.", "ok");
        scannerRegistroInput.readOnly = false;
    } catch (error) {
        scannerRegistroInput.readOnly = false;
        scannerRegistroSetDocumentoActivo("");
        if (typeof window.guardarSnapshotConsulta === "function") {
            window.guardarSnapshotConsulta(null);
        }
        scannerRegistroMostrarMensaje(error?.message || "Error al consultar el usuario escaneado.", "error");
    }
}

if (scannerRegistroInput) {
    scannerRegistroInput.addEventListener("input", () => {
        clearTimeout(scannerRegistroTimer);
        scannerRegistroTimer = setTimeout(consultarDesdeScannerRegistro, 250);
    });

    scannerRegistroInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        clearTimeout(scannerRegistroTimer);
        consultarDesdeScannerRegistro();
    });
}
