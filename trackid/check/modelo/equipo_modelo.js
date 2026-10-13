const conexion = require('../database/conexion.js')

async function listaEquipos(usuarioId) {
    const [rows] = await conexion.query(
        `
        SELECT
            id,
            usuario_id AS usuarioId,
            nombre_equipo AS nombreEquipo,
            serial_equipo AS serialEquipo,
            adicional_equipo AS adicionalEquipo,
            DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s') AS createdAt
        FROM equipos
        WHERE usuario_id = ?
        ORDER BY created_at DESC, id DESC
        `,
        [usuarioId]
    )

    return Array.isArray(rows) ? rows : []
}

async function crearEquipo({ usuarioId, nombreEquipo, serialEquipo, adicionalEquipo }) {
    const [result] = await conexion.query(
        `
        INSERT INTO equipos (usuario_id, nombre_equipo, serial_equipo, adicional_equipo)
        VALUES (?, ?, ?, ?)
        `,
        [usuarioId, nombreEquipo, serialEquipo, adicionalEquipo || null]
    )

    return result?.insertId || null
}

async function eliminarEquipo(equipoId) {
    const [result] = await conexion.query(
        `
        DELETE FROM equipos
        WHERE id = ?
        LIMIT 1
        `,
        [equipoId]
    )

    return Number(result?.affectedRows || 0) > 0
}

module.exports = {
    listaEquipos,
    crearEquipo,
    eliminarEquipo
}
