const formFiltrosIngresos = document.getElementById("form-filtros-ingresos");
const cuerpoTablaIngresos = document.getElementById("cuerpo-tabla-ingresos");
const mensajeIngresos = document.getElementById("mensaje-ingresos");
const btnCerrarSesionReporte = document.getElementById("cerrar-sesion");
const btnReporteExcel = document.getElementById("btn-reporte-excel");
const totalIngresos = document.getElementById("total-ingresos");
const totalEnSede = document.getElementById("total-en-sede");
const totalSalidas = document.getElementById("total-salidas");
const avanceConsulta = document.getElementById("avance-consulta");
const barraAvance = document.getElementById("barra-avance");

function setMensaje(texto, tipo = "") {
    if (!mensajeIngresos) return;
    mensajeIngresos.textContent = texto || "";
    mensajeIngresos.className = `mensaje ${tipo}`;
}

function setAvance(valor) {
    const porcentaje = Math.max(0, Math.min(100, Number(valor) || 0));
    if (avanceConsulta) avanceConsulta.textContent = `${porcentaje}%`;
    if (barraAvance) barraAvance.style.width = `${porcentaje}%`;
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

function etiquetaEstado(estado) {
    if (estado === "en_sede") return "En sede";
    if (estado === "salio") return "Salio";
    return estado || "";
}

function construirQuery() {
    const data = formFiltrosIngresos ? new FormData(formFiltrosIngresos) : new FormData();
    const params = new URLSearchParams();

    for (const [key, value] of data.entries()) {
        const texto = String(value || "").trim();
        if (texto) params.set(key, texto);
    }

    return params;
}

async function apiFetch(path) {
    const res = await fetch(path);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
        throw new Error(data?.message || "Error de servidor.");
    }
    return data;
}

function pintarResumen(resumen) {
    const total = Number(resumen?.total || 0);
    const enSede = Number(resumen?.enSede || 0);
    const salidas = Number(resumen?.salidas || 0);
    const avance = total > 0 ? Math.round((salidas / total) * 100) : 0;

    if (totalIngresos) totalIngresos.textContent = total;
    if (totalEnSede) totalEnSede.textContent = enSede;
    if (totalSalidas) totalSalidas.textContent = salidas;
    setAvance(avance);
}

function pintarTabla(ingresos) {
    if (!cuerpoTablaIngresos) return;
    cuerpoTablaIngresos.innerHTML = "";

    if (!Array.isArray(ingresos) || ingresos.length === 0) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td colspan="8">No se encontraron ingresos con esos filtros.</td>`;
        cuerpoTablaIngresos.appendChild(tr);
        return;
    }

    for (const ingreso of ingresos) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${ingreso?.nombre ?? ""}</td>
            <td>${ingreso?.numeroDocumento ?? ""}</td>
            <td>${ingreso?.rol ?? ""}</td>
            <td>${formatDateTime(ingreso?.ingresoAt)}</td>
            <td>${formatDateTime(ingreso?.salidaAt)}</td>
            <td><span class="estado ${ingreso?.estado === "en_sede" ? "activo" : "cerrado"}">${etiquetaEstado(ingreso?.estado)}</span></td>
            <td>${ingreso?.areaVisita ?? ""}</td>
            <td>${ingreso?.observacionSalida ?? ""}</td>
        `;
        cuerpoTablaIngresos.appendChild(tr);
    }
}

async function cargarIngresos() {
    const params = construirQuery();
    const query = params.toString();

    setMensaje("Consultando ingresos...", "wait");
    setAvance(35);

    try {
        const data = await apiFetch(query ? `/api/ingresos?${query}` : "/api/ingresos");
        pintarResumen(data.resumen);
        pintarTabla(data.ingresos);
        setMensaje(`Consulta lista: ${data.resumen?.total || 0} movimientos encontrados.`, "ok");
    } catch (error) {
        pintarResumen({ total: 0, enSede: 0, salidas: 0 });
        pintarTabla([]);
        setMensaje(error?.message || "No se pudo consultar el reporte.", "error");
    }
}

if (formFiltrosIngresos) {
    formFiltrosIngresos.addEventListener("submit", (event) => {
        event.preventDefault();
        cargarIngresos();
    });

    formFiltrosIngresos.addEventListener("reset", () => {
        setTimeout(() => cargarIngresos(), 0);
    });
}

if (btnReporteExcel) {
    btnReporteExcel.addEventListener("click", () => {
        const query = construirQuery().toString();
        window.location.href = query ? `/api/ingresos/reporte-excel?${query}` : "/api/ingresos/reporte-excel";
    });
}

if (btnCerrarSesionReporte) {
    btnCerrarSesionReporte.addEventListener("click", () => {
        const confirmar = window.confirm("Estas seguro de cerrar sesion?");
        if (confirmar) window.location.href = "/logout";
    });
}

cargarIngresos();
