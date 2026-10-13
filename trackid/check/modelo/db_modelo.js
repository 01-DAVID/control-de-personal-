// =========================================================
// MODELO: Utilidades de Base de Datos
// =========================================================
// Este módulo agrupa funciones pequeñas relacionadas con la BD
// (por ejemplo, un "health check" para validar conexión).

// ===== Importación de conexión/pool =====
const conexion = require('../database/conexion.js') // Cliente/pool de MySQL (o similar)

// ===== Health check de BD =====
// Verifica conectividad con la base de datos ejecutando una consulta mínima.
async function bdCheck() {
    await conexion.query('SELECT 1') // Si esto falla, la conexión o permisos están mal
}

// ===== Exportación pública =====
module.exports = {
    bdCheck,
}
