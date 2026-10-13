const btnCerrarSesion = document.getElementById("cerrar-sesion");
const nombreUsuario = document.querySelector(".nombre");
const fotoUsuario = document.querySelector(".foto-usuario");

async function cargarUsuarioActual() {
    try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();

        if (!data.ok || !data.usuario) return;

        const { nombre, fotoRuta } = data.usuario;

        if (nombreUsuario) {
            nombreUsuario.textContent = nombre;
        }

        if (fotoUsuario && fotoRuta) {
            fotoUsuario.src = fotoRuta;
            fotoUsuario.alt = `Foto de ${nombre}`;
        }
    } catch (error) {
        console.error("Error al cargar datos del usuario:", error);
    }
}

if (btnCerrarSesion) {
    btnCerrarSesion.addEventListener("click", () => {
        const confirmar = window.confirm("¿Estás seguro de cerrar sesión?");
        if (confirmar) window.location.href = "/logout";
    });
}

document.addEventListener("DOMContentLoaded", cargarUsuarioActual);




