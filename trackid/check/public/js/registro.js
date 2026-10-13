// =========================================================
// FRONTEND: Registro (crear/verificar usuario y asociar equipo)
// =========================================================
// Flujo principal:
// 1) El usuario llena el formulario y se envía a `/api/usuarios` (crea/actualiza + garantiza ingreso).
// 2) Con el documento "activo", se puede abrir un modal para registrar equipos (`/api/equipos`).
// 3) Se muestra feedback al usuario en un elemento de mensajes.

// ===== 1) Referencias del DOM (formulario principal) =====
const form = document.getElementById("userForm"); // Formulario de usuario
const mensaje = document.getElementById("msg"); // Contenedor de mensajes/estado
const inputScannerRegistro = document.getElementById("scannerRegistroInput");
const btnCerrarSesion = document.getElementById("btnLogout"); // Botón para salir
const btnIngreso = document.getElementById("btnOpenEquipo"); // Botón para abrir modal de equipo
const btnIngresoPersonal = document.getElementById("btn-ingresar")
const btnIngresoRapido = document.getElementById("btn-ingresar-rapido")
const horaIngresoActual = document.getElementById("horaIngreso"); // Campo editable de fecha/hora de ingreso
const fotoInput = document.getElementById("fotoInput"); // Input para cargar o tomar foto
const fotoPreview = document.getElementById("fotoPreview"); // Vista previa de la foto
const fotoPlaceholder = document.getElementById("fotoPlaceholder"); // Texto cuando no hay foto
const btnTomarFoto = document.getElementById("btnTomarFoto"); // Boton que abre la camara
const btnCapturarFoto = document.getElementById("btnCapturarFoto"); // Boton para guardar imagen desde video
const btnCancelarCamara = document.getElementById("btnCancelarCamara"); // Boton para cerrar la camara
const cameraPanel = document.getElementById("cameraPanel"); // Contenedor del video de camara
const cameraVideo = document.getElementById("cameraVideo"); // Video en vivo de camara
const fotoCanvas = document.getElementById("fotoCanvas"); // Canvas usado para capturar la imagen de la camara
const selectRol = document.getElementById("rol");
const campoAreaVisitante = document.getElementById("campoAreaVisitante");
const inputAreaVisita = document.getElementById("areaVisita");
const inputCorreo = document.getElementById("correo");


// ===== 2) Referencias del DOM (modal de equipos) =====
const modalEquipo = document.getElementById("equipoModal"); // Contenedor del modal
const modalOverlay = document.getElementById("modalBg"); // Fondo oscuro (overlay)
const btnCerrarModal = document.getElementById("btnCloseModal"); // Botón "X" cerrar
const btnCancelarModal = document.getElementById("btnCancelModal"); // Botón cancelar
const equipoForm = document.getElementById("equipoForm"); // Form del equipo dentro del modal
const cantidadEquiposInput = document.getElementById("cantidadEquipos");
const equiposDinamicosContainer = document.getElementById("equiposDinamicosContainer");

// ===== 3) Estado local =====
// Guarda el documento ya verificado/guardado para asociar equipos sin reconsultar.
let documentoActivo = "";
let cameraStream = null;
let registrandoUsuario = false;
let fotoArchivoSeleccionado = null;
let fotoPreviewUrl = "";
// Snapshot del usuario consultado previamente (para detectar cambios antes de enviar).
let usuarioConsultado = null;

// ===== 4) Helper UI: mostrar mensajes =====
function mostrarMensaje(texto, tipo) {
    mensaje.textContent = texto; // Texto visible para el usuario
    mensaje.className = `message ${tipo}`; // Clase CSS para estilos (ok/error/wait)
}

// ===== 4.1) Helper: hora actual en formato HH:mm =====
function horaLocalAhora() {
    const ahora = new Date(); // Fecha/hora del navegador del vigilante
    return ahora.toTimeString().slice(0, 5); // Formato requerido por <input type="time">
}

// ===== 4.2) Helper: mostrar foto en el recuadro =====
function mostrarFoto(src) {
    if (!fotoPreview || !fotoPlaceholder) return;

    fotoPreview.src = src || ""; // Coloca la imagen en pantalla si existe
    fotoPreview.hidden = !src; // Oculta el img cuando no hay foto
    fotoPlaceholder.hidden = Boolean(src); // Muestra "Sin foto" si no hay imagen
}

function actualizarCampoAreaVisitante() {
    const esVisitante = String(selectRol?.value || "") === "visitante";

    if (campoAreaVisitante) campoAreaVisitante.hidden = !esVisitante;
    if (inputAreaVisita) {
        inputAreaVisita.required = esVisitante;
        if (!esVisitante) inputAreaVisita.value = "";
    }
}

function esNombrePersonaValido(value) {
    return /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*$/.test(String(value || "").trim());
}

function esCorreoValido(value) {
    return /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/.test(String(value || "").trim());
}

if (inputCorreo) {
    inputCorreo.addEventListener("input", () => {
        inputCorreo.value = inputCorreo.value.replace(/[^\x21-\x7E]/g, "");
    });
}

function mostrarArchivoFoto(file) {
    fotoArchivoSeleccionado = file || null;

    if (fotoPreviewUrl) {
        URL.revokeObjectURL(fotoPreviewUrl);
        fotoPreviewUrl = "";
    }

    if (!file) {
        mostrarFoto("");
        return;
    }

    fotoPreviewUrl = URL.createObjectURL(file);
    mostrarFoto(fotoPreviewUrl);
}

// ===== 4.4) Helpers: camara del navegador =====
async function abrirCamara() {
    if (!cameraPanel || !cameraVideo || !navigator.mediaDevices?.getUserMedia) {
        mostrarMensaje("Este navegador no permite abrir la camara.", "error");
        return;
    }

    try {
        cerrarCamara();
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
            audio: false,
        });
        cameraVideo.srcObject = cameraStream;
        cameraPanel.hidden = false;
        mostrarMensaje("Camara lista para capturar.", "wait");
    } catch (error) {
        mostrarMensaje("No se pudo acceder a la camara. Revisa los permisos.", "error");
    }
}

function cerrarCamara() {
    if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
        cameraStream = null;
    }

    if (cameraVideo) {
        cameraVideo.srcObject = null;
    }

    if (cameraPanel) {
        cameraPanel.hidden = true;
    }
}

function capturarFotoDesdeCamara() {
    if (!cameraVideo || !fotoCanvas || !cameraStream) {
        mostrarMensaje("Abre la camara antes de capturar.", "error");
        return;
    }

    const width = cameraVideo.videoWidth;
    const height = cameraVideo.videoHeight;

    if (!width || !height) {
        mostrarMensaje("Espera un momento mientras carga la camara.", "error");
        return;
    }

    fotoCanvas.width = width;
    fotoCanvas.height = height;
    const context = fotoCanvas.getContext("2d");
    context.translate(width, 0);
    context.scale(-1, 1);
    context.drawImage(cameraVideo, 0, 0, width, height);
    fotoCanvas.toBlob((blob) => {
        if (!blob) {
            mostrarMensaje("No se pudo capturar la foto.", "error");
            return;
        }

        const documento = document.getElementById("numeroDocumento")?.value?.trim() || "foto";
        const file = new File([blob], `${documento}.jpg`, { type: "image/jpeg" });
        mostrarArchivoFoto(file);
        cerrarCamara();
        mostrarMensaje("Foto capturada correctamente.", "ok");
    }, "image/jpeg", 0.9);
}

window.mostrarFotoRegistro = function mostrarFotoRegistro(rutaFoto = "") {
    fotoArchivoSeleccionado = null;
    if (fotoPreviewUrl) {
        URL.revokeObjectURL(fotoPreviewUrl);
        fotoPreviewUrl = "";
    }
    mostrarFoto(rutaFoto);
};

function formatDateTime(value) {
    if (!value) return ""; // Si no hay valor, retorna vacío

    const date = new Date(value); // Convierte string/fecha a Date

    if (Number.isNaN(date.getTime())) return ""; // Si no es parseable, retorna vacío

    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
}

// ===== 8) Formatear duración (ms -> HH:MM:SS) =====
function formatDurationMs(ms) {
    if (!Number.isFinite(ms) || ms < 0) return ""; // Validación básica
    const totalSeconds = Math.floor(ms / 1000); // Milisegundos a segundos
    const hours = Math.floor(totalSeconds / 3600); // Horas
    const minutes = Math.floor((totalSeconds % 3600) / 60); // Minutos
    const seconds = totalSeconds % 60; // Segundos restantes
    const hh = String(hours).padStart(2, "0"); // 2 dígitos
    const mm = String(minutes).padStart(2, "0"); // 2 dígitos
    const ss = String(seconds).padStart(2, "0"); // 2 dígitos
    return `${hh}:${mm}:${ss}`; // Retorna como texto
}

/**
 * =========================================================================
 * TITULO: GENERADOR DINÁMICO DE FORMULARIO DE EQUIPOS
 * =========================================================================
 * Esta función detecta el número ingresado por el usuario en el modal.
 * 1. Limpia cualquier campo de equipo generado previamente.
 * 2. Ejecuta un ciclo basado en la cantidad deseada.
 * 3. Inserta dinámicamente bloques de HTML con inputs para Nombre, Serial 
 *    y Objetos Adicionales, asignándoles clases para su posterior lectura.
 */
function generarCamposEquipos() {
    if (!equiposDinamicosContainer || !cantidadEquiposInput) return;
    
    const cantidad = parseInt(cantidadEquiposInput.value) || 1;
    equiposDinamicosContainer.innerHTML = ""; // Limpiar anteriores

    for (let i = 1; i <= cantidad; i++) {
        const group = document.createElement("div");
        group.className = "equipo-entry-group";
        group.innerHTML = `
            <h3>Equipo N.${i}</h3>
            <div class="field">
                <label>Nombre del equipo</label>
                <input type="text" class="input-nombre-equipo" placeholder="Ej: Portatil Lenovo" required>
            </div>
            <div class="field">
                <label>Serial</label>
                <input type="text" class="input-serial-equipo" placeholder="Serial / placa" required>
            </div>
            <div class="field">
                <label>Objeto Adicional (opcional)</label>
                <input type="text" class="input-adicional-equipo" placeholder="Cargador, mouse...">
            </div>
            <hr>
        `;
        equiposDinamicosContainer.appendChild(group);
    }
}


// Coloca la hora actual al abrir la pantalla.
function horaingreso (){
    if (!horaIngresoActual) return;
    const actualizarhora = () => {
        horaIngresoActual.textContent = new Date().toLocaleTimeString("es-CO", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        }); 
    };

    actualizarhora();
    setInterval(actualizarhora, 1000);
}

horaingreso()


// Cuando el usuario toma/carga una foto se guarda como archivo para enviarla al backend.
if (fotoInput) {
    fotoInput.addEventListener("change", () => {
        const file = fotoInput.files?.[0];
        if (!file) {
            mostrarArchivoFoto(null);
            return;
        }

        if (!file.type.startsWith("image/")) {
            mostrarMensaje("Selecciona un archivo de imagen valido.", "error");
            fotoInput.value = "";
            mostrarArchivoFoto(null);
            return;
        }

        mostrarArchivoFoto(file);
    });
}

if (btnTomarFoto) {
    btnTomarFoto.addEventListener("click", abrirCamara);
}

if (btnCapturarFoto) {
    btnCapturarFoto.addEventListener("click", capturarFotoDesdeCamara);
}

if (btnCancelarCamara) {
    btnCancelarCamara.addEventListener("click", cerrarCamara);
}

if (selectRol) {
    selectRol.addEventListener("change", actualizarCampoAreaVisitante);
    actualizarCampoAreaVisitante();
}

// ===== 5) Helpers UI: abrir/cerrar modal =====
function abrirModalEquipo() {
    modalEquipo.hidden = false; // Muestra el modal quitando el "hidden"
    cantidadEquiposInput.value = 1; // Reset a 1
    generarCamposEquipos(); // Genera el primer bloque por defecto
}

function cerrarModalEquipo() {
    modalEquipo.hidden = true; // Oculta el modal aplicando "hidden"
}

// ===== 6) Helper de red: fetch con manejo estándar de errores =====
async function apiFetch(path, options) {
    const res = await fetch(path, options); // Llama al backend
    const data = await res.json().catch(() => ({})); // Intenta parsear JSON; si falla, usa objeto vacío

    // Si el backend responde no-OK o marca ok=false, se lanza error para capturar arriba.
    if (!res.ok || data?.ok === false) {
        const msg = data?.message || "Error de servidor.";
        const error = new Error(msg);
        error.status = res.status;
        error.data = data;
        throw error;
    }

    return data; // Estructura típica: { ok: true, ... }
}

async function confirmarActualizacionUsuario(usuarioExistente, numeroDocumento) {
    const nombreExistente = usuarioExistente?.nombre ? `Nombre registrado: ${usuarioExistente.nombre}` : "";
    const texto = `Ya existe un usuario con el numero de documento ${numeroDocumento}, pero los datos no coinciden. ${nombreExistente}`;

    if (window.Swal?.fire) {
        const resultado = await Swal.fire({
            title: "Datos diferentes",
            text: texto,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Actualizar",
            cancelButtonText: "Cancelar",
            reverseButtons: true,
        });

        return resultado.isConfirmed;
    }

    return window.confirm(`${texto}\n\n¿Deseas actualizarlo y continuar con el registro?`);
}

// ===== 6.1) Alerta obligatoria al cambiar el documento sin cambiar el nombre =====
// El usuario puede cerrar la alerta, pero el registro queda bloqueado hasta
// que tambien modifique el nombre.
async function mostrarAlertaCambioDocumento() {
    const titulo = "Cambio de documento detectado";
    const texto = "Has modificado el numero de documento. Para evitar registros duplicados o informacion incorrecta, tambien debes modificar el nombre del usuario antes de continuar.";

    if (window.Swal?.fire) {
        await Swal.fire({
            title: titulo,
            text: texto,
            icon: "warning",
            confirmButtonText: "Entendido",
        });
        return;
    }

    window.alert(`${titulo}\n\n${texto}`);
}

// ===== 6.2) Snapshot del usuario consultado (para detectar cambios) =====
function normalizarComparacion(value) {
    return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizarTipoDocSnapshot(value) {
    let tipo = String(value || "").trim().toUpperCase().replace(/\./g, "");
    if (tipo === "CC") return "C.C.";
    if (tipo === "TI") return "T.I.";
    if (tipo === "CE") return "C.E.";
    if (tipo === "PTO" || tipo === "PASAPORTE") return "P.T.O.";
    return String(value || "").trim();
}

// Guarda una copia de los datos del usuario consultado (por boton o scanner).
// Recibe el objeto `usuario` tal como lo devuelve el backend.
function guardarSnapshotConsulta(usuario) {
    if (!usuario) {
        usuarioConsultado = null;
        return;
    }

    usuarioConsultado = {
        nombre: String(usuario.nombre || "").trim(),
        tipoDocumento: normalizarTipoDocSnapshot(usuario.tipoDocumento),
        numeroDocumento: String(usuario.numeroDocumento || "").trim(),
        correo: String(usuario.correo || "").trim(),
        telefono: String(usuario.telefono || "").trim(),
        rol: String(usuario.rol || "").trim().toLowerCase(),
        areaVisita: String(usuario.areaVisita || "").trim(),
    };
}

window.guardarSnapshotConsulta = guardarSnapshotConsulta;

// Compara los datos actuales del formulario contra el snapshot de la consulta.
function evaluarCambiosConsulta(datosActuales) {
    if (!usuarioConsultado) return null;

    const docActual = String(datosActuales.numeroDocumento || "").trim();
    const docCambio = docActual !== usuarioConsultado.numeroDocumento;
    const nombreCambio = normalizarComparacion(datosActuales.nombre) !== normalizarComparacion(usuarioConsultado.nombre);

    const hayOtrosCambios = (
        nombreCambio ||
        normalizarTipoDocSnapshot(datosActuales.tipoDocumento) !== usuarioConsultado.tipoDocumento ||
        normalizarComparacion(datosActuales.correo) !== normalizarComparacion(usuarioConsultado.correo) ||
        String(datosActuales.telefono || "").trim() !== usuarioConsultado.telefono ||
        normalizarComparacion(datosActuales.rol) !== usuarioConsultado.rol ||
        normalizarComparacion(datosActuales.areaVisita) !== normalizarComparacion(usuarioConsultado.areaVisita) ||
        Boolean(fotoArchivoSeleccionado)
    );

    return {
        docCambio,
        nombreCambio,
        hayOtrosCambios,
        hayCambio: docCambio || hayOtrosCambios,
    };
}

// =========================================================
// EVENTOS: Formulario de usuario
// =========================================================

// ===== 7) Envío del formulario: crea/actualiza usuario =====
// btnIngresoPersonal.addEventListener("click", (event) => {
//     event.preventDefault(); // Evita recargar la página (submit tradicional)

//     // 7.1) Leer campos del formulario
//     const data = new FormData(form);
//     const nombre = (data.get("nombre") || "").toString().trim();
//     const tipoDocumento = (data.get("tipoDocumento") || "").toString().trim();
//     const numeroDocumento = (data.get("numeroDocumento") || "").toString().trim();
//     const correo = (data.get("correo") || "").toString().trim();
//     const telefono = (data.get("telefono") || "").toString().trim();
//     const rol = (data.get("rol") || "").toString().trim();
//     const horaIngreso = formatDateTime(new Date());

//     // 7.2) Validaciones básicas antes de llamar al backend
//     if (!nombre || !tipoDocumento || !numeroDocumento || !correo || !telefono || !rol || !horaIngreso) {
//         mostrarMensaje("Completa todos los campos obligatorios.", "error");
//         return;
//     }

//     // Documento: 6 a 15 dígitos (mismo criterio usado en backend).
//     if (!/^\d{6,15}$/.test(numeroDocumento)) {
//         mostrarMensaje("El numero de documento debe contener entre 6 y 15 digitos.", "error");
//         return;
//     }

//     // Teléfono: 7 a 15 dígitos.
//     if (!/^\d{7,15}$/.test(telefono)) {
//         mostrarMensaje("El telefono debe contener entre 7 y 15 digitos.", "error");
//         return;
//     }

//     // 7.3) Construir payload(datos) para la API
//     const usuario = {
//         nombre,
//         tipoDocumento,
//         numeroDocumento,
//         correo,
//         telefono,
//         rol,
//         horaIngreso, // El backend usara esta hora para crear/actualizar el ingreso abierto
//     };

//     // 7.4) Feedback visual mientras se guarda.
//     mostrarMensaje("Guardando usuario...", "espere..");

//     // 7.5) Llamar a la API para crear/actualizar
//     apiFetch("/api/usuarios", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(usuario),
//     })
//         .then(() => {
//             // 7.6) Al guardar, se marca el documento como "activo" para asociar equipos.
//             mostrarMensaje("Usuario verificado y guardado correctamente.", "ok");
//             documentoActivo = numeroDocumento;
//         })
//         .catch((error) => {
//             // 7.7) Si falla, se muestra el mensaje de error devuelto por el backend (si existe).
//             mostrarMensaje(error?.message || "No se pudo guardar el usuario.", "error");
//         });
// });


// 7) prueba
if (btnIngresoRapido) {
    btnIngresoRapido.addEventListener("click", () => {
        if (form?.requestSubmit) {
            form.requestSubmit();
        } else {
            registrarUsuario();
        }
    });
}

form.addEventListener("submit", registrarUsuario);


async function registrarUsuario(event) {

    if (event) {
        event.preventDefault();
    }

    if (registrandoUsuario) return;
    registrandoUsuario = true;
    if (btnIngresoPersonal) btnIngresoPersonal.disabled = true;
    if (btnIngresoRapido) btnIngresoRapido.disabled = true;

    const data = new FormData(form);

    const nombre = (data.get("nombre") || "").toString().trim();
    const tipoDocumento = (data.get("tipoDocumento") || "").toString().trim();
    const numeroDocumento = (data.get("numeroDocumento") || "").toString().trim();
    const correo = (data.get("correo") || "").toString().trim();
    const telefono = (data.get("telefono") || "").toString().trim();
    const rol = (data.get("rol") || "").toString().trim();
    const areaVisita = (data.get("areaVisita") || "").toString().trim();
    const horaIngreso = formatDateTime(new Date());

    function crearPayloadUsuario(opciones = {}) {
        const { confirmarActualizacion = false, documentoOriginal = "" } = opciones || {};
        const usuario = new FormData();
        usuario.append("nombre", nombre);
        usuario.append("tipoDocumento", tipoDocumento);
        usuario.append("numeroDocumento", numeroDocumento);
        usuario.append("correo", correo);
        usuario.append("telefono", telefono);
        usuario.append("rol", rol);
        usuario.append("areaVisita", rol === "visitante" ? areaVisita : "");
        usuario.append("horaIngreso", horaIngreso);
        if (confirmarActualizacion) usuario.append("confirmarActualizacion", "true");
        if (documentoOriginal) usuario.append("documentoOriginal", documentoOriginal);

        if (fotoArchivoSeleccionado) {
            usuario.append("foto", fotoArchivoSeleccionado);
        }

        return usuario;
    }

    try {
        // Nombre, tipo de documento, numero de documento y rol son obligatorios.
        // Correo, telefono y foto son opcionales.
        if (!nombre || !tipoDocumento || !numeroDocumento || !rol || !horaIngreso) {
            mostrarMensaje("Completa los campos obligatorios (nombre, tipo y numero de documento, rol).", "error");
            return;
        }

        if (!esNombrePersonaValido(nombre)) {
            mostrarMensaje("El nombre solo debe contener letras y espacios.", "error");
            return;
        }

        if (correo && !esCorreoValido(correo)) {
            mostrarMensaje("Ingresa un correo valido sin emojis.", "error");
            return;
        }

        if (!/^\d{6,15}$/.test(numeroDocumento)) {
            mostrarMensaje("El numero de documento debe contener entre 6 y 15 digitos.", "error");
            return;
        }

        if (telefono && !/^\d{7,15}$/.test(telefono)) {
            mostrarMensaje("El telefono debe contener entre 7 y 15 digitos.", "error");
            return;
        }

        if (rol === "visitante" && !areaVisita) {
            mostrarMensaje("Indica el area a la que se dirige el visitante.", "error");
            return;
        }

        const datosActuales = {
            nombre,
            tipoDocumento,
            numeroDocumento,
            correo,
            telefono,
            rol,
            areaVisita,
        };

        const cambios = evaluarCambiosConsulta(datosActuales);
        let payloadOpciones = {};

        // REGLA: documento cambiado + nombre sin cambiar => bloquear registro.
        if (cambios?.docCambio && !cambios?.nombreCambio) {
            await mostrarAlertaCambioDocumento();
            mostrarMensaje("Para cambiar el documento tambien debes modificar el nombre del usuario.", "error");
            return;
        }

        // Documento cambiado + nombre cambiado => actualizar el mismo usuario consultado.
        if (cambios?.docCambio && cambios?.nombreCambio) {
            payloadOpciones.documentoOriginal = usuarioConsultado.numeroDocumento;
        }

        // Documento igual + otros datos modificados => preguntar si se desea actualizar.
        if (cambios && !cambios.docCambio && cambios.hayOtrosCambios) {
            const confirmado = await confirmarActualizacionUsuario(usuarioConsultado, numeroDocumento);
            if (!confirmado) {
                mostrarMensaje("Actualizacion cancelada. No se modifico el usuario existente.", "wait");
                return;
            }
            payloadOpciones.confirmarActualizacion = true;
        }

        mostrarMensaje("Guardando usuario...", "espere..");

        await apiFetch("/api/usuarios", {
            method: "POST",
            body: crearPayloadUsuario(payloadOpciones),
        });

        mostrarMensaje("Usuario verificado y guardado correctamente.", "ok");

        documentoActivo = numeroDocumento;
        usuarioConsultado = null;
        if (form) {
            form.dataset.documentoActivo = numeroDocumento;
            form.dataset.origenConsulta = "manual";
        }

    } catch (error) {
        if (error?.status === 409 && error?.data?.code === "USUARIO_EXISTE") {
            const confirmado = await confirmarActualizacionUsuario(error.data.usuario, numeroDocumento);
            if (!confirmado) {
                mostrarMensaje("Actualizacion cancelada. No se modifico el usuario existente.", "wait");
                return;
            }

            try {
                mostrarMensaje("Actualizando usuario existente...", "wait");
                await apiFetch("/api/usuarios", {
                    method: "POST",
                    body: crearPayloadUsuario({ confirmarActualizacion: true }),
                });

                mostrarMensaje("Usuario actualizado y registro continuado correctamente.", "ok");
                documentoActivo = numeroDocumento;
                usuarioConsultado = null;
                if (form) {
                    form.dataset.documentoActivo = numeroDocumento;
                    form.dataset.origenConsulta = "manual";
                }
                return;
            } catch (errorActualizar) {
                mostrarMensaje(errorActualizar?.message || "No se pudo actualizar el usuario.", "error");
                return;
            }
        }

        mostrarMensaje(error?.message || "No se pudo guardar el usuario.", "error");

    } finally {
        registrandoUsuario = false;
        if (btnIngresoPersonal) btnIngresoPersonal.disabled = false;
        if (btnIngresoRapido) btnIngresoRapido.disabled = false;
    }
}



// ===== 8) Reset del formulario: limpiar estado y mensajes =====
form.addEventListener("reset", () => {
    setTimeout(() => {
        mostrarMensaje("", ""); // Limpia mensaje
        documentoActivo = ""; // Limpia documento activo
        usuarioConsultado = null; // Limpia el snapshot de la consulta
        if (form) {
            form.dataset.documentoActivo = "";
            form.dataset.origenConsulta = "";
        }
        if (inputScannerRegistro) {
            inputScannerRegistro.value = "";
            inputScannerRegistro.readOnly = false;
        }
        fotoArchivoSeleccionado = null;
        if (fotoPreviewUrl) {
            URL.revokeObjectURL(fotoPreviewUrl);
            fotoPreviewUrl = "";
        }
        mostrarFoto(""); // Limpia foto y preview
        cerrarCamara(); // Cierra la camara si estaba abierta
        actualizarCampoAreaVisitante();
        // Reinicia solo la hora con el momento actual
    }, 0);
});

/**
 * EVENTO DE CAMBIO DE CANTIDAD:
 * Cada vez que el usuario sube o baja el número en el selector de cantidad,
 * se dispara la regeneración de los campos para que coincidan con el número.
 */
if (cantidadEquiposInput) {
    cantidadEquiposInput.addEventListener("change", generarCamposEquipos);
}

// =========================================================
// EVENTOS: Sesión y modal
// =========================================================

// ===== 9) Cerrar sesión =====
if (btnCerrarSesion) {
    btnCerrarSesion.addEventListener("click", () => {
        const confirmar = window.confirm("Estas seguro de cerrar sesion?"); // Confirmación del usuario
        if (confirmar) {
            window.location.href = "/logout"; // Backend limpia cookie y redirige
        }
    });
}



// ===== 10) Abrir modal de equipos (solo si hay documento válido) =====
if (btnIngreso) {
    btnIngreso.addEventListener("click", () => {
        const data = new FormData(form); // Lee el documento del formulario si aún no está en `documentoActivo`
        const numeroDocumento = (form?.dataset.documentoActivo || documentoActivo || data.get("numeroDocumento") || "").toString().trim();

        if (!/^\d{6,15}$/.test(numeroDocumento)) {
            mostrarMensaje("Primero verifica el usuario para asociar el equipo.", "error");
            return;
        }

        documentoActivo = numeroDocumento; // Actualiza estado local
        if (form) form.dataset.documentoActivo = numeroDocumento;
        abrirModalEquipo(); // Muestra el modal
    });
}

// ===== 11) Cerrar modal por botones/overlay/tecla ESC =====
if (btnCerrarModal) {
    btnCerrarModal.addEventListener("click", cerrarModalEquipo);
}

if (btnCancelarModal) {
    btnCancelarModal.addEventListener("click", cerrarModalEquipo);
}

if (modalOverlay) {
    modalOverlay.addEventListener("click", cerrarModalEquipo);
}

document.addEventListener("keydown", (event) => {
    // Cierra el modal si está abierto y el usuario presiona Escape.
    if (event.key === "Escape" && modalEquipo && !modalEquipo.hidden) {
        cerrarModalEquipo();
    }
});

// =========================================================
// EVENTOS: Formulario de equipo (modal)
// =========================================================

/**
 * =========================================================================
 * TITULO: PROCESAMIENTO Y ENVÍO MASIVO DE EQUIPOS
 * =========================================================================
 * Al presionar "Guardar equipo", esta función:
 * 1. Valida que exista un documento de usuario activo.
 * 2. Selecciona todos los grupos de equipos generados en el DOM.
 * 3. Utiliza un bucle 'for...of' con 'await' para enviar cada equipo de forma 
 *    individual a la API, asegurando que todos se guarden correctamente.
 */
if (equipoForm) {
    equipoForm.addEventListener("submit", async (event) => {
        event.preventDefault(); // Evita recargar la página

        // 12.1) Asegurar documento activo
        const numeroDocumento = form?.dataset.documentoActivo || documentoActivo || (new FormData(form).get("numeroDocumento") || "").toString().trim();
        if (!/^\d{6,15}$/.test(numeroDocumento)) {
            mostrarMensaje("No se encontro un usuario verificado para asociar el equipo.", "error");
            return;
        }

        // 12.2) Obtener todos los grupos de equipos generados
        const grupos = equiposDinamicosContainer.querySelectorAll(".equipo-entry-group");
        if (!grupos.length) {
            mostrarMensaje("Agrega al menos un equipo para registrar.", "error");
            return;
        }

        const equipos = [];
        for (const grupo of grupos) {
            const inputNombre = grupo.querySelector(".input-nombre-equipo");
            const inputSerial = grupo.querySelector(".input-serial-equipo");
            const inputAdicional = grupo.querySelector(".input-adicional-equipo");
            const nombreEquipo = inputNombre?.value.trim() || "";
            const serialEquipo = inputSerial?.value.trim() || "";
            const adicionalEquipo = inputAdicional?.value.trim() || "";

            if (!nombreEquipo || !serialEquipo) {
                mostrarMensaje("Completa nombre y serial de todos los equipos.", "error");
                (nombreEquipo ? inputSerial : inputNombre)?.focus();
                return;
            }

            equipos.push({ nombreEquipo, serialEquipo, adicionalEquipo });
        }

        mostrarMensaje(`Registrando ${equipos.length} equipos...`, "wait");

        try {
            // 12.3) Procesar cada equipo en un bucle
            for (const equipo of equipos) {
                await apiFetch("/api/equipos", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        numeroDocumento,
                        nombreEquipo: equipo.nombreEquipo,
                        serialEquipo: equipo.serialEquipo,
                        adicionalEquipo: equipo.adicionalEquipo,
                    }),
                });
            }

            mostrarMensaje("Todos los equipos fueron registrados correctamente.", "ok");
            equipoForm.reset();
            cerrarModalEquipo();
        } catch (error) {
            mostrarMensaje(error?.message || "Ocurrió un error al registrar los equipos.", "error");
        }
    });
}
