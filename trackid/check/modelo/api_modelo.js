// =========================================================
// MODELO: Fachada (API de modelos)
// =========================================================
// Este archivo re-exporta ("agrega") funciones de varios modelos en un solo objeto.
// Sirve para importar todo desde un único punto cuando se necesite.

module.exports = {
    // Exporta utilidades de BD (ej: `bdCheck`).
    ...require('./db_modelo.js'),

    // Exporta funciones relacionadas con usuarios.
    ...require('./usuario_modelo.js'),

    // Exporta funciones relacionadas con equipos.
    ...require('./equipo_modelo.js'),

    // Exporta funciones relacionadas con movimientos (ingreso/salida).
    ...require('./movimiento_modelo.js'),
}
