const formPerfil = document.getElementById('form-perfil');
const mensajePerfil = document.getElementById('mensaje-perfil');
const btnGuardar = document.getElementById('btn-guardar-perfil');
const btnCerrarSesion = document.getElementById('cerrar-sesion');
const fotoInput = document.getElementById('fotoInput');
const fotoPreview = document.getElementById('fotoPreview');
const fotoPlaceholder = document.getElementById('fotoPlaceholder');
const btnTomarFoto = document.getElementById('btnTomarFoto');
const btnCapturarFoto = document.getElementById('btnCapturarFoto');
const btnCancelarCamara = document.getElementById('btnCancelarCamara');
const cameraPanel = document.getElementById('cameraPanel');
const cameraVideo = document.getElementById('cameraVideo');
const fotoCanvas = document.getElementById('fotoCanvas');

let cameraStream = null;
let guardandoPerfil = false;
let fotoArchivoSeleccionado = null;
let fotoPreviewUrl = '';

function mostrarMensaje(texto, tipo = 'wait') {
    if (!mensajePerfil) return;
    mensajePerfil.textContent = texto;
    mensajePerfil.className = `message ${tipo}`;
}

function esNombrePersonaValido(value) {
    return /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*$/.test(String(value || '').trim());
}

function mostrarFoto(src) {
    if (!fotoPreview || !fotoPlaceholder) return;

    fotoPreview.src = src || '';
    fotoPreview.hidden = !src;
    fotoPlaceholder.hidden = Boolean(src);
}

function mostrarArchivoFoto(file) {
    fotoArchivoSeleccionado = file || null;

    if (fotoPreviewUrl) {
        URL.revokeObjectURL(fotoPreviewUrl);
        fotoPreviewUrl = '';
    }

    if (!file) {
        mostrarFoto('');
        return;
    }

    fotoPreviewUrl = URL.createObjectURL(file);
    mostrarFoto(fotoPreviewUrl);
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

function limpiarFormulario() {
    if (!formPerfil) return;

    formPerfil.reset();
    mostrarArchivoFoto(null);
    cerrarCamara();
}

async function abrirCamara() {
    if (!cameraPanel || !cameraVideo || !navigator.mediaDevices?.getUserMedia) {
        mostrarMensaje('Este navegador no permite abrir la camara.', 'error');
        return;
    }

    try {
        cerrarCamara();
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } },
            audio: false
        });
        cameraVideo.srcObject = cameraStream;
        cameraPanel.hidden = false;
        mostrarMensaje('Camara lista para capturar.', 'wait');
    } catch (error) {
        mostrarMensaje('No se pudo acceder a la camara. Revisa los permisos.', 'error');
    }
}

function capturarFotoDesdeCamara() {
    if (!cameraVideo || !fotoCanvas || !cameraStream) {
        mostrarMensaje('Abre la camara antes de capturar.', 'error');
        return;
    }

    const width = cameraVideo.videoWidth;
    const height = cameraVideo.videoHeight;

    if (!width || !height) {
        mostrarMensaje('Espera un momento mientras carga la camara.', 'error');
        return;
    }

    fotoCanvas.width = width;
    fotoCanvas.height = height;

    const context = fotoCanvas.getContext('2d');
    context.drawImage(cameraVideo, 0, 0, width, height);
    fotoCanvas.toBlob((blob) => {
        if (!blob) {
            mostrarMensaje('No se pudo capturar la foto.', 'error');
            return;
        }

        const nombre = document.getElementById('nombre')?.value?.trim() || 'foto';
        const nombreLimpio = nombre.replace(/[^a-zA-Z0-9]/g, '_');
        const file = new File([blob], `${nombreLimpio}.jpg`, { type: 'image/jpeg' });
        mostrarArchivoFoto(file);
        cerrarCamara();
        mostrarMensaje('Foto capturada correctamente.', 'ok');
    }, 'image/jpeg', 0.9);
}

async function apiFetch(path, options) {
    const respuesta = await fetch(path, options);
    const resultado = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok || resultado?.ok === false) {
        throw new Error(resultado?.message || 'Error de servidor.');
    }

    return resultado;
}

function leerPayloadPerfil() {
    const datos = new FormData(formPerfil);

    return {
        nombre: String(datos.get('nombre') || '').trim(),
        rol: String(datos.get('rol') || '').trim().toLowerCase(),
        contrasena: String(datos.get('contrasena') || '').trim()
    };
}

function validarPerfil(payload) {
    if (!payload.nombre || !payload.rol || !payload.contrasena) {
        return 'Completa todos los campos obligatorios.';
    }

    if (!esNombrePersonaValido(payload.nombre)) {
        return 'El nombre solo debe contener letras y espacios.';
    }

    if (!['administrador', 'vigilante'].includes(payload.rol)) {
        return 'Selecciona un rol valido.';
    }

    if (payload.contrasena.length < 6) {
        return 'La contrasena debe tener al menos 6 caracteres.';
    }

    return '';
}

async function crearPerfil(event) {
    event.preventDefault();

    if (guardandoPerfil || !formPerfil) return;
    

    const payload = leerPayloadPerfil();
    const errorValidacion = validarPerfil(payload);

    if (errorValidacion) {
        mostrarMensaje(errorValidacion, 'error');
        return;
    }

    guardandoPerfil = true;
    if (btnGuardar) {
        btnGuardar.disabled = true;
        btnGuardar.textContent = 'Creando...';
    }

    try {
        mostrarMensaje('Creando perfil...', 'wait');

        const formData = new FormData();
        Object.entries(payload).forEach(([key, value]) => {
            formData.append(key, value);
        });

        if (fotoArchivoSeleccionado) {
            formData.append('foto', fotoArchivoSeleccionado);
        }

        await apiFetch('/api/perfiles', {
            method: 'POST',
            body: formData
        });

        limpiarFormulario();
        mostrarMensaje('Perfil creado correctamente.', 'ok');
    } catch (error) {
        mostrarMensaje(error?.message || 'No se pudo crear el perfil.', 'error');
    } finally {
        guardandoPerfil = false;
        if (btnGuardar) {
            btnGuardar.disabled = false;
            btnGuardar.textContent = 'Crear perfil';
        }
    }
}

if (formPerfil) {
    formPerfil.addEventListener('submit', crearPerfil);
    formPerfil.addEventListener('reset', () => {
        setTimeout(() => {
            mostrarMensaje('', 'wait');
            mostrarArchivoFoto(null);
            cerrarCamara();
        }, 0);
    });
}

if (fotoInput) {
    fotoInput.addEventListener('change', () => {
        const file = fotoInput.files?.[0];

        if (!file) {
            mostrarArchivoFoto(null);
            return;
        }

        if (!file.type.startsWith('image/')) {
            mostrarMensaje('Selecciona un archivo de imagen valido.', 'error');
            fotoInput.value = '';
            mostrarArchivoFoto(null);
            return;
        }

        mostrarArchivoFoto(file);
    });
}

if (btnTomarFoto) {
    btnTomarFoto.addEventListener('click', abrirCamara);
}

if (btnCapturarFoto) {
    btnCapturarFoto.addEventListener('click', capturarFotoDesdeCamara);
}

if (btnCancelarCamara) {
    btnCancelarCamara.addEventListener('click', cerrarCamara);
}

if (btnCerrarSesion) {
    btnCerrarSesion.addEventListener('click', () => {
        const confirmar = window.confirm('Estas seguro de cerrar sesion?');
        if (confirmar) {
            window.location.href = '/logout';
        }
    });
}
