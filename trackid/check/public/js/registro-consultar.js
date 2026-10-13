// const btnConsultar = document.getElementById("consultar-btn");
// const inputDocumentoConsulta = document.getElementById("documento");
// const enterInput = document.getElementById("documento");
// const mensajeConsulta = document.getElementById("msg");

// enterInput.addEventListener("keydown" , (event) => {
//     if (event.key === "Enter") {
//         ;
//     }
// })

// if (btnConsultar) {
//     btnConsultar.addEventListener("click", (e) => {
//         e.preventDefault();

//         const consulta = String(inputDocumentoConsulta?.value || "").trim();

//         if (!consulta || consulta.length < 3) {
//             mostrarMensajeConsulta("Ingresa minimo 3 caracteres del nombre o documento.", "error");
//             return;
//         }


//         consultarDatos(consulta);
//     });
// }


const btnConsultar = document.getElementById("consultar-btn");
const inputDocumentoConsulta = document.getElementById("documento");
const mensajeConsulta = document.getElementById("msg");

// FUNCIÓN PRINCIPAL
function ejecutarConsulta(event) {

    if (event) {
        event.preventDefault();
    }

    const consulta = String(inputDocumentoConsulta?.value || "").trim();

    if (!consulta || consulta.length < 3) {

        mostrarMensajeConsulta(
            "Ingresa minimo 3 caracteres del nombre o documento.",
            "error"
        );

        return;
    }

    consultarDatos(consulta);
}


// CLICK DEL BOTÓN
if (btnConsultar) {
    btnConsultar.addEventListener("click", ejecutarConsulta);
}


// ENTER EN EL INPUT
if (inputDocumentoConsulta) {

    inputDocumentoConsulta.addEventListener("keydown", (event) => {

        if (event.key === "Enter") {

            ejecutarConsulta(event);

        }

    });

}

function mostrarMensajeConsulta(texto, tipo) {
    if (!mensajeConsulta) return;

    mensajeConsulta.textContent = texto;
    mensajeConsulta.className = `message ${tipo}`;
}

async function consultarDatos(consulta) {
    try {
        // Primero se muestra un mensaje visual para que el usuario sepa que la consulta empezo.
        mostrarMensajeConsulta("Consultando usuario...", "wait");

        // fetch hace una peticion HTTP al backend.
        // En este caso consulta la ruta /api/usuarios/buscar?valor=...
        // encodeURIComponent convierte el texto a un formato seguro para ponerlo en la URL.
        // Ejemplo: si el valor tuviera espacios o caracteres especiales, los codifica para evitar errores.
        // await pausa esta funcion hasta que el servidor responda.
        const respuesta = await fetch(`/api/usuarios/buscar?valor=${encodeURIComponent(consulta)}`);

        // La respuesta del servidor viene como texto en formato JSON.
        // respuesta.json() intenta convertir ese JSON a un objeto de JavaScript.
        // Ejemplo esperado: { ok: true, usuario: { nombre: "...", ... } }
        // Si el servidor no devuelve un JSON valido, el catch evita que el programa se rompa
        // y en su lugar deja datos como un objeto vacio: {}.
        const datos = await respuesta.json().catch(() => ({}));

        // respuesta.ok pertenece a fetch y es true cuando el codigo HTTP fue exitoso.
        // Por ejemplo: 200 o 201 dan true; 400, 404 o 500 dan false.
        // datos?.ok === false revisa si el backend respondio con ok: false dentro del JSON.
        // El ?. evita errores si datos no existe o viene vacio.
        // Si ocurre cualquiera de esos dos casos, se lanza un error para pasar directo al catch.
        if (!respuesta.ok || datos?.ok === false) {
            // Si el backend mando un mensaje de error, se usa ese mensaje.
            // Si no mando mensaje, se usa uno generico.
            throw new Error(datos?.message || "No se pudo consultar el usuario.");
        }

        // Si no hubo errores, se llenan los campos del formulario con los datos del usuario.
        mostrarDatos(datos.usuario);
        // Guarda una copia de los datos consultados para detectar cambios al registrar.
        if (typeof window.guardarSnapshotConsulta === "function") {
            window.guardarSnapshotConsulta(datos.usuario);
        }
        // Finalmente se avisa al usuario que la consulta fue exitosa.
        mostrarMensajeConsulta("Usuario encontrado.", "ok");
    } catch (error) {
        // Cualquier error de la consulta llega aqui:
        // errores de red, respuestas no exitosas o JSON invalido sin datos utiles.
        // Si la consulta fallo, no hay un usuario consultado de referencia.
        if (typeof window.guardarSnapshotConsulta === "function") {
            window.guardarSnapshotConsulta(null);
        }
        mostrarMensajeConsulta(error?.message || "Error al consultar el usuario.", "error");
    }
}

function mostrarDatos(usuario) {
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

    // Si el usuario tiene foto guardada, se muestra desde su ruta publica.
    const fotoPreview = document.getElementById("fotoPreview");
    const fotoPlaceholder = document.getElementById("fotoPlaceholder");
    const fotoRuta = usuario.fotoRuta || "";

    if (typeof window.mostrarFotoRegistro === "function") {
        window.mostrarFotoRegistro(fotoRuta);
    } else if (fotoPreview && fotoPlaceholder) {
        fotoPreview.src = fotoRuta;
        fotoPreview.hidden = !fotoRuta;
        fotoPlaceholder.hidden = Boolean(fotoRuta);
    }

    // Si hay movimiento abierto se muestra solo su hora; la fecha siempre sera la actual al registrar.
    const horaIngreso = document.getElementById("horaIngreso");
    if (horaIngreso) {
        const ingresoAt = usuario.movimiento?.ingresoAt || "";
        horaIngreso.value = ingresoAt ? ingresoAt.slice(11, 16) : horaLocalAhora();
    }

    if (typeof documentoActivo !== "undefined") {
        documentoActivo = usuario.numeroDocumento || "";
    }
}
