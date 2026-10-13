// =========================================================
// FRONTEND: Reporte Excel de adminPersonal
// =========================================================
// Lee los filtros actuales y solicita al backend el Excel detallado.

const btnGenerarInforme = document.getElementById("generar-informe");
const formReportePersonal = document.getElementById("form-filtros-personal");

function construirQueryReportePersonal() {
    const data = formReportePersonal ? new FormData(formReportePersonal) : new FormData();
    const params = new URLSearchParams();

    for (const [key, value] of data.entries()) {
        const texto = String(value || "").trim();
        if (texto) params.set(key, texto);
    }

    return params.toString();
}

if (btnGenerarInforme) {
    btnGenerarInforme.addEventListener("click", () => {
        const query = construirQueryReportePersonal();
        const url = query ? `/api/personal/reporte-excel?${query}` : "/api/personal/reporte-excel";
        window.location.href = url;
    });
}
