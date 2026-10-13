// =========================================================
// MODELO: Movimientos (Ingreso / Salida)
// =========================================================
// Un "movimiento" representa el estado de un usuario en la sede:
// - `ingreso_at`: fecha/hora de ingreso.
// - `salida_at`: fecha/hora de salida (null si está activo).
// - `estado`: texto de estado (ej: en_sede / salio).

// ===== Conexión a BD =====
const conexion = require('../database/conexion.js') // Pool/cliente para ejecutar queries

// ===== Consulta: movimiento activo =====
// Obtiene el movimiento abierto (sin salida) de un usuario, si existe.
async function movimientoActivo(usuarioId) {
    const [rows] = await conexion.query(
        `
        SELECT
            id,
            DATE_FORMAT(ingreso_at, '%Y-%m-%dT%H:%i:%s') AS ingresoAt,
            DATE_FORMAT(salida_at, '%Y-%m-%dT%H:%i:%s') AS salidaAt,
            estado,
            observacion_salida AS observacionSalida
        FROM movimientos
        WHERE usuario_id = ? AND salida_at IS NULL
        ORDER BY ingreso_at DESC
        LIMIT 1
        `,
        [usuarioId] // Placeholder 
    )
    return rows?.[0] || null // Un solo movimiento o null
}

// ===== Consulta: último movimiento (histórico) =====
// Obtiene el último movimiento registrado de un usuario.
async function ultimoMovimiento(usuarioId) {
    const [rows] = await conexion.query(
        `
        SELECT
            id,
            DATE_FORMAT(ingreso_at, '%Y-%m-%dT%H:%i:%s') AS ingresoAt,
            DATE_FORMAT(salida_at, '%Y-%m-%dT%H:%i:%s') AS salidaAt,
            estado,
            observacion_salida AS observacionSalida
        FROM movimientos
        WHERE usuario_id = ?
        ORDER BY ingreso_at DESC
        LIMIT 1
        `,
        [usuarioId] // Placeholder `?`
    )
    return rows?.[0] || null // Un solo movimiento o null
}

// ===== Comando: garantizar ingreso abierto =====
// Garantiza que el usuario tenga un movimiento de ingreso abierto y lo devuelve.
async function garantizarMovimiento(usuarioId, ingresoAt) {
    const connection = await conexion.getConnection()
    const lockName = `movimiento_usuario_${usuarioId}`

    try {
        const [[lockResult]] = await connection.query('SELECT GET_LOCK(?, 5) AS locked', [lockName])
        if (Number(lockResult?.locked || 0) !== 1) {
            throw new Error('No se pudo bloquear el movimiento del usuario.')
        }

        await connection.beginTransaction()

        const [abiertos] = await connection.query(
            `
            SELECT
                id,
                DATE_FORMAT(ingreso_at, '%Y-%m-%dT%H:%i:%s') AS ingresoAt,
                DATE_FORMAT(salida_at, '%Y-%m-%dT%H:%i:%s') AS salidaAt,
                estado,
                observacion_salida AS observacionSalida
            FROM movimientos
            WHERE usuario_id = ? AND salida_at IS NULL
            ORDER BY ingreso_at DESC
            LIMIT 1
            FOR UPDATE
            `,
            [usuarioId]
        )

        if (abiertos?.[0]) {
            await connection.commit()
            return abiertos[0]
        }

        await connection.query(
            `
            INSERT INTO movimientos (usuario_id, ingreso_at, estado)
            VALUES (?, ?, 'en_sede')
            `,
            [usuarioId, ingresoAt]
        )

        const [rows] = await connection.query(
            `
            SELECT
                id,
                DATE_FORMAT(ingreso_at, '%Y-%m-%dT%H:%i:%s') AS ingresoAt,
                DATE_FORMAT(salida_at, '%Y-%m-%dT%H:%i:%s') AS salidaAt,
                estado,
                observacion_salida AS observacionSalida
            FROM movimientos
            WHERE usuario_id = ? AND salida_at IS NULL
            ORDER BY ingreso_at DESC
            LIMIT 1
            `,
            [usuarioId]
        )

        await connection.commit()
        return rows?.[0] || null
    } catch (error) {
        try {
            await connection.rollback()
        } catch (_rollbackError) {}
        throw error
    } finally {
        try {
            await connection.query('SELECT RELEASE_LOCK(?)', [lockName])
        } catch (_releaseError) {}
        connection.release()
    }
}

// ===== Comando: cerrar movimiento =====
// Cierra un movimiento (marca salida) y devuelve el registro actualizado. 
async function cerrarMovimiento(movimientoId, observacionSalida = null) {
    // 1) Actualiza el registro: coloca salida y cambia estado.
    const [result] = await conexion.query(
        `
        UPDATE movimientos
        SET
            salida_at = NOW(),
            estado = 'salio',
            observacion_salida = COALESCE(?, observacion_salida)
        WHERE id = ?
          AND salida_at IS NULL
        `,
        [observacionSalida, movimientoId] // Movimiento a cerrar
    )

    if (!Number(result?.affectedRows || 0)) return null

    // 2) Re-consulta el movimiento para retornar el estado final al controlador.
    const [rows] = await conexion.query(
        `
        SELECT
            id,
            DATE_FORMAT(ingreso_at, '%Y-%m-%dT%H:%i:%s') AS ingresoAt,
            DATE_FORMAT(salida_at, '%Y-%m-%dT%H:%i:%s') AS salidaAt,
            estado,
            observacion_salida AS observacionSalida
        FROM movimientos
        WHERE id = ?
        LIMIT 1
        `,
        [movimientoId] // Placeholder `?`
    )

    return rows?.[0] || null // Un solo movimiento o null
}

// ===== Comando: guardar observacion de salida =====
// Permite adjuntar una observacion antes de cerrar el movimiento.
async function actualizarObservacionSalida(movimientoId, observacionSalida) {
    const [result] = await conexion.query(
        `
        UPDATE movimientos
        SET observacion_salida = ?
        WHERE id = ? AND salida_at IS NULL
        `,
        [observacionSalida || null, movimientoId]
    )

    if (!Number(result?.affectedRows || 0)) return null

    const [rows] = await conexion.query(
        `
        SELECT
            id,
            DATE_FORMAT(ingreso_at, '%Y-%m-%dT%H:%i:%s') AS ingresoAt,
            DATE_FORMAT(salida_at, '%Y-%m-%dT%H:%i:%s') AS salidaAt,
            estado,
            observacion_salida AS observacionSalida
        FROM movimientos
        WHERE id = ?
        LIMIT 1
        `,
        [movimientoId]
    )

    return rows?.[0] || null
}

// ===== Consulta: personal activo (en sede) =====
// Lista el personal activo (con movimiento abierto) con filtros opcionales por nombre o cédula.
async function listarPersonalActivo({ nombre, cedula }) {
    const filtros = ['m.salida_at IS NULL'] // Condición base: movimiento abierto
    const params = [] // Valores para placeholders `?`

    if (nombre) {
        filtros.push('u.nombre LIKE ?') // Filtro opcional por nombre
        params.push(`%${nombre}%`) // LIKE con comodines
    }

    if (cedula) {
        filtros.push('u.numero_documento LIKE ?') // Filtro opcional por documento
        params.push(`%${cedula}%`) // LIKE con comodines
    }

    const [rows] = await conexion.query(
        `
        SELECT
            u.id,
            u.nombre,
            u.tipo_documento AS tipoDocumento,
            u.numero_documento AS numeroDocumento,
            u.correo,
            u.telefono,
            u.rol,
            m.id AS movimientoId,
            DATE_FORMAT(m.ingreso_at, '%Y-%m-%dT%H:%i:%s') AS ingresoAt,
            DATE_FORMAT(m.salida_at, '%Y-%m-%dT%H:%i:%s') AS salidaAt,
            m.estado
        FROM movimientos m
        INNER JOIN usuarios u ON u.id = m.usuario_id
        WHERE ${filtros.join(' AND ')}
        ORDER BY m.ingreso_at DESC
        `,
        params
    )

    return Array.isArray(rows) ? rows : [] // Normaliza retorno a arreglo
}

// ===== Consulta: personal inactivo (ya salió) =====
// Lista el personal inactivo (sin movimiento abierto y con último movimiento cerrado) con filtros opcionales.
async function listarPersonalInactivo({ nombre, cedula }) {
    const filtros = ['lm.salida_at IS NOT NULL'] // Condición base: último movimiento tiene salida
    const params = [] // Valores para placeholders `?`

    if (nombre) {
        filtros.push('u.nombre LIKE ?') // Filtro opcional por nombre
        params.push(`%${nombre}%`) // LIKE con comodines
    }

    if (cedula) {
        filtros.push('u.numero_documento LIKE ?') // Filtro opcional por documento
        params.push(`%${cedula}%`) // LIKE con comodines
    }

    // Esta consulta arma una subconsulta (lm) para obtener el último movimiento por usuario,
    // y además excluye los usuarios que tengan un movimiento abierto (NOT EXISTS con salida_at IS NULL).
    const [rows] = await conexion.query(
        `
        SELECT
            u.id,
            u.nombre,
            u.tipo_documento AS tipoDocumento,
            u.numero_documento AS numeroDocumento,
            u.correo,
            u.telefono,
            u.rol,
            lm.id AS movimientoId,
            DATE_FORMAT(lm.ingreso_at, '%Y-%m-%dT%H:%i:%s') AS ingresoAt,
            DATE_FORMAT(lm.salida_at, '%Y-%m-%dT%H:%i:%s') AS salidaAt,
            lm.estado,
            lm.observacion_salida AS observacionSalida
        FROM usuarios u
        INNER JOIN (
            SELECT m1.*
            FROM movimientos m1
            INNER JOIN (
                SELECT usuario_id, MAX(ingreso_at) AS max_ingreso
                FROM movimientos
                GROUP BY usuario_id
            ) t ON t.usuario_id = m1.usuario_id AND t.max_ingreso = m1.ingreso_at
        ) lm ON lm.usuario_id = u.id
        WHERE ${filtros.join(' AND ')}
          AND NOT EXISTS (
            SELECT 1
            FROM movimientos mo
            WHERE mo.usuario_id = u.id AND mo.salida_at IS NULL
          )
        ORDER BY lm.salida_at DESC
        `,
        params
    )

    return Array.isArray(rows) ? rows : [] // Normaliza retorno a arreglo
}

// ===== Exportación pública =====
module.exports = {
    movimientoActivo,
    ultimoMovimiento,
    garantizarMovimiento,
    cerrarMovimiento,
    actualizarObservacionSalida,
    listarPersonalActivo,
    listarPersonalInactivo
}
