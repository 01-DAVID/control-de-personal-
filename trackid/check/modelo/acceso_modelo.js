// =========================================================
// MODELO: Accesos
// =========================================================
// Responsabilidad:
// - Consultar accesos por código.
// - Crear registros de acceso para login del sistema.

const conexion = require('../database/conexion.js')

async function consultarAccesoPorCodigo(codigo) {
    const [rows] = await conexion.query(
        `
        SELECT id, codigo, password_hash AS passwordHash, rol, activo
        FROM accesos
        WHERE codigo = ?
        LIMIT 1
        `,
        [String(codigo || '').trim()]
    )

    return rows?.[0] || null
}

async function crearAcceso({ codigo, passwordHash, rol, fotoRuta }) {
    const [result] = await conexion.query(
        `
        INSERT INTO accesos (codigo, password_hash, rol, activo, foto_ruta)
        VALUES (?, ?, ?, 1, ?)
        `,
        [String(codigo || '').trim(), passwordHash, String(rol || '').trim(), fotoRuta || null]
    )

    return {
        id: result.insertId,
        codigo: String(codigo || '').trim(),
        rol: String(rol || '').trim(),
        activo: 1,
        fotoRuta: fotoRuta || null
    }
}

async function consultarAccesoPorId(id) {
    const [rows] = await conexion.query(
        `
        SELECT id, codigo, rol, activo, foto_ruta AS fotoRuta
        FROM accesos
        WHERE id = ?
        LIMIT 1
        `,
        [id]
    )

    return rows?.[0] || null
}

module.exports = {
    consultarAccesoPorCodigo,
    consultarAccesoPorId,
    crearAcceso
}
