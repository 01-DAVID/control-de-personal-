// =========================================================
// MODELO: Usuarios
// =========================================================
// Responsabilidad:
// - Consultar usuarios por documento.
// - Crear/actualizar (upsert) usuarios.
// - Listar personal con filtros opcionales.

// ===== Conexión a BD =====
const conexion = require('../database/conexion.js') // Pool/cliente para ejecutar queries

let columnaFotoRutaLista = false

async function asegurarColumnaFotoRuta() {
    if (columnaFotoRutaLista) return

    const [columns] = await conexion.query(
        `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'usuarios'
          AND COLUMN_NAME = 'foto_ruta'
        `
    )

    if (!columns.length) {
        await conexion.query(`
            ALTER TABLE usuarios
            ADD COLUMN foto_ruta VARCHAR(255) NULL AFTER area_visita
        `)
    }

    columnaFotoRutaLista = true
}

// ===== Consulta: usuario por documento =====
// Obtiene un usuario por número de documento.
async function consultarUsuarioDoc(numeroDocumento) {
    await asegurarColumnaFotoRuta()
    const [rows] = await conexion.query(
        `
        SELECT
            id,
            nombre,
            tipo_documento AS tipoDocumento,
            numero_documento AS numeroDocumento,
            correo,
            telefono,
            rol,
            area_visita AS areaVisita,
            foto_ruta AS fotoRuta,
            DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s') AS createdAt,
            DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:%s') AS updatedAt
        FROM usuarios
        WHERE numero_documento = ?
        LIMIT 1
        `,
        [String(numeroDocumento)] // Placeholder `?` para evitar SQL injection
    )
    return rows?.[0] || null // Retorna un solo registro o null
    console.log(rows)
}

// ===== Consulta: usuario por nombre o documento =====
// Busca primero por documento exacto; si el valor no es solo numero, busca por nombre.
async function consultarUsuarioPorValor(valor) {
    await asegurarColumnaFotoRuta()
    const texto = String(valor || '').trim()
    const esDocumento = /^\d+$/.test(texto)
    const where = esDocumento ? 'numero_documento = ?' : 'nombre LIKE ?'
    const params = esDocumento ? [texto] : [`%${texto}%`]

    const [rows] = await conexion.query(
        `
        SELECT
            id,
            nombre,
            tipo_documento AS tipoDocumento,
            numero_documento AS numeroDocumento,
            correo,
            telefono,
            rol,
            area_visita AS areaVisita,
            foto_ruta AS fotoRuta,
            DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s') AS createdAt,
            DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:%s') AS updatedAt
        FROM usuarios
        WHERE ${where}
        ORDER BY id DESC
        LIMIT ?
        `,
        [...params, esDocumento ? 1 : 2]
    )

    if (!esDocumento && rows.length > 1) {
        return {
            multipleMatches: true,
            message: 'Hay varios usuarios con ese nombre. Consulta con numero de documento.'
        }
    }

    return rows?.[0] || null
}


//consultar usuarios del registro de usuarios para traer informacion 
async function consultarUsuarioDocReg(numdoc) {
    await asegurarColumnaFotoRuta()
    const [rows] = await conexion.query(
        `
        SELECT
            id,
            nombre,
            tipo_documento AS tipoDocumento,
            numero_documento AS numeroDocumento,
            correo,
            telefono,
            rol,
            area_visita AS areaVisita,
            foto_ruta AS fotoRuta
        FROM usuarios
        WHERE numero_documento = ?
        LIMIT 1
        `,
        [String(numdoc)] // Placeholder `?` para evitar SQL injection
    )
    return rows?.[0] || null // Retorna un solo registro o null
}

// ===== Comando: crear o actualizar (upsert) =====
// Crea o actualiza un usuario (si ya existe por llave única) y devuelve el registro resultante.
async function usuarioCrearActualizar({ nombre, tipoDocumento, numeroDocumento, correo, telefono, rol, areaVisita, fotoRuta }) {
    await asegurarColumnaFotoRuta()
    await conexion.query(
        `
        INSERT INTO usuarios (nombre, tipo_documento, numero_documento, correo, telefono, rol, area_visita, foto_ruta)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            nombre = VALUES(nombre),
            tipo_documento = VALUES(tipo_documento),
            correo = VALUES(correo),
            telefono = VALUES(telefono),
            rol = VALUES(rol),
            area_visita = VALUES(area_visita),
            foto_ruta = COALESCE(NULLIF(VALUES(foto_ruta), ''), foto_ruta),
            updated_at = NOW()
        `,
        [nombre, tipoDocumento, numeroDocumento, correo, telefono, rol, areaVisita || null, fotoRuta || null] // Parámetros en el mismo orden del INSERT
    )

    return consultarUsuarioDoc(numeroDocumento) // Re-consulta para devolver el registro actualizado
}

// ===== Comando: actualizar datos de usuario =====
// Actualiza la informacion personal. Si `numeroDocumento` difiere de `documentoActual`,
// la fila original cambia su documento (no se crea una fila nueva).
// `fotoRuta` es opcional: si viene vacio/null conserva la foto existente.
async function actualizarUsuarioDatos(documentoActual, { nombre, tipoDocumento, numeroDocumento, correo, telefono, rol, areaVisita, fotoRuta }) {
    await asegurarColumnaFotoRuta()
    await conexion.query(
        `
        UPDATE usuarios
        SET
            nombre = ?,
            tipo_documento = ?,
            numero_documento = ?,
            correo = ?,
            telefono = ?,
            rol = ?,
            area_visita = ?,
            foto_ruta = COALESCE(NULLIF(?, ''), foto_ruta),
            updated_at = NOW()
        WHERE numero_documento = ?
        `,
        [nombre, tipoDocumento, numeroDocumento, correo, telefono, rol, areaVisita || null, fotoRuta || null, String(documentoActual)]
    )

    return consultarUsuarioDoc(numeroDocumento)
}

// ===== Consulta: listado de personal con filtros =====
// Lista todo el personal registrado con filtros opcionales por nombre, cédula y movimientos.
async function listarPersonal({ nombre, cedula, rol, dia, mes, quincena, hora }) {
    await asegurarColumnaFotoRuta()
    const filtros = [] // Acumula condiciones SQL (WHERE)
    const params = [] // Acumula valores para placeholders `?`

    if (nombre) {
        filtros.push('u.nombre LIKE ?') // Busca por coincidencia parcial
        params.push(`%${nombre}%`) // Envia comodines para LIKE (datos parciales % cualquier cosa menos 0) 
    }

    if (cedula) {
        filtros.push('u.numero_documento LIKE ?') // Coincidencia parcial por documento
        params.push(`%${cedula}%`) // Envia comodines para LIKE
    }

    if (rol) {
        filtros.push('u.rol = ?')
        params.push(rol)
    }

    if (dia) {
        filtros.push(`
            EXISTS (
                SELECT 1
                FROM movimientos mf
                WHERE mf.usuario_id = u.id
                  AND (
                    DATE(mf.ingreso_at) = ?
                    OR DATE(mf.salida_at) = ?
                  )
            )
        `)
        params.push(dia, dia)
    }

    if (mes) {
        filtros.push(`
            EXISTS (
                SELECT 1
                FROM movimientos mf
                WHERE mf.usuario_id = u.id
                  AND (
                    DATE_FORMAT(mf.ingreso_at, '%Y-%m') = ?
                    OR DATE_FORMAT(mf.salida_at, '%Y-%m') = ?
                  )
            )
        `)
        params.push(mes, mes)
    }

    if (quincena) {
        const desde = quincena === 'primera' ? 1 : 16
        const hasta = quincena === 'primera' ? 15 : 31

        filtros.push(`
            EXISTS (
                SELECT 1
                FROM movimientos mf
                WHERE mf.usuario_id = u.id
                  AND (
                    DAY(mf.ingreso_at) BETWEEN ? AND ?
                    OR DAY(mf.salida_at) BETWEEN ? AND ?
                  )
            )
        `)
        params.push(desde, hasta, desde, hasta)
    }

    if (hora) {
        const horaSolo = hora.slice(0, 2)
        filtros.push(`
            EXISTS (
                SELECT 1
                FROM movimientos mf
                WHERE mf.usuario_id = u.id
                  AND (
                    HOUR(mf.ingreso_at) = ?
                    OR HOUR(mf.salida_at) = ?
                  )
            )
        `)
        params.push(horaSolo, horaSolo)
    }

    // Construye dinámicamente el WHERE: si no hay filtros, queda vacío.
    const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : ''

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
            u.area_visita AS areaVisita,
            u.foto_ruta AS fotoRuta,
            DATE_FORMAT(u.created_at, '%Y-%m-%dT%H:%i:%s') AS createdAt,
            DATE_FORMAT(u.updated_at, '%Y-%m-%dT%H:%i:%s') AS updatedAt,
            DATE_FORMAT(um.ingreso_at, '%Y-%m-%dT%H:%i:%s') AS ingresoAt,
            DATE_FORMAT(um.salida_at, '%Y-%m-%dT%H:%i:%s') AS salidaAt,
            um.estado
        FROM usuarios u
        LEFT JOIN (
            SELECT m1.*
            FROM movimientos m1
            INNER JOIN (
                SELECT usuario_id, MAX(ingreso_at) AS max_ingreso
                FROM movimientos
                GROUP BY usuario_id
            ) t ON t.usuario_id = m1.usuario_id AND t.max_ingreso = m1.ingreso_at
        ) um ON um.usuario_id = u.id
        ${where}
        ORDER BY COALESCE(um.ingreso_at, u.created_at) DESC
        `,
        params
    )

    return Array.isArray(rows) ? rows : [] // Normaliza retorno a arreglo
}

// ===== Consulta: reporte detallado de personal y movimientos =====
// Usa los mismos filtros de adminPersonal, pero devuelve todos los movimientos que coinciden.
async function listarReportePersonalMovimientos({ nombre, cedula, rol, estado, dia, mes, desde, hasta, quincena, hora }) {
    const filtros = []
    const params = []

    if (nombre) {
        filtros.push('u.nombre LIKE ?')
        params.push(`%${nombre}%`)
    }

    if (cedula) {
        filtros.push('u.numero_documento LIKE ?')
        params.push(`%${cedula}%`)
    }

    if (rol) {
        filtros.push('u.rol = ?')
        params.push(rol)
    }

    if (estado) {
        filtros.push('m.estado = ?')
        params.push(estado)
    }

    if (dia) {
        filtros.push('(DATE(m.ingreso_at) = ? OR DATE(m.salida_at) = ?)')
        params.push(dia, dia)
    }

    if (mes) {
        filtros.push("(DATE_FORMAT(m.ingreso_at, '%Y-%m') = ? OR DATE_FORMAT(m.salida_at, '%Y-%m') = ?)")
        params.push(mes, mes)
    }

    if (desde) {
        filtros.push('DATE(m.ingreso_at) >= ?')
        params.push(desde)
    }

    if (hasta) {
        filtros.push('DATE(m.ingreso_at) <= ?')
        params.push(hasta)
    }

    if (quincena) {
        const desde = quincena === 'primera' ? 1 : 16
        const hasta = quincena === 'primera' ? 15 : 31

        filtros.push('(DAY(m.ingreso_at) BETWEEN ? AND ? OR DAY(m.salida_at) BETWEEN ? AND ?)')
        params.push(desde, hasta, desde, hasta)
    }

    if (hora) {
        const horaSolo = hora.slice(0, 2)
        filtros.push('(HOUR(m.ingreso_at) = ? OR HOUR(m.salida_at) = ?)')
        params.push(horaSolo, horaSolo)
    }

    const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : ''

    const [rows] = await conexion.query(
        `
        SELECT
            u.id AS usuarioId,
            u.nombre,
            u.tipo_documento AS tipoDocumento,
            u.numero_documento AS numeroDocumento,
            u.correo,
            u.telefono,
            u.rol,
            u.area_visita AS areaVisita,
            DATE_FORMAT(u.created_at, '%Y-%m-%dT%H:%i:%s') AS usuarioCreadoAt,
            m.id AS movimientoId,
            DATE_FORMAT(m.ingreso_at, '%Y-%m-%dT%H:%i:%s') AS ingresoAt,
            DATE_FORMAT(m.salida_at, '%Y-%m-%dT%H:%i:%s') AS salidaAt,
            m.estado,
            m.observacion_salida AS observacionSalida
        FROM usuarios u
        INNER JOIN movimientos m ON m.usuario_id = u.id
        ${where}
        ORDER BY u.nombre ASC, m.ingreso_at ASC
        `,
        params
    )

    return Array.isArray(rows) ? rows : []
}

// ===== Consulta: reporte publico de ingresos =====
// Devuelve solo los campos usados por la vista publica de reportes.
async function listarReporteIngresosPublico(filtros) {
    const movimientos = await listarReportePersonalMovimientos(filtros)
    return movimientos.map((movimiento) => ({
        nombre: movimiento.nombre,
        numeroDocumento: movimiento.numeroDocumento,
        rol: movimiento.rol,
        areaVisita: movimiento.areaVisita,
        movimientoId: movimiento.movimientoId,
        ingresoAt: movimiento.ingresoAt,
        salidaAt: movimiento.salidaAt,
        estado: movimiento.estado,
        observacionSalida: movimiento.observacionSalida
    }))
}



// ===== Exportación pública =====
module.exports = {
    consultarUsuarioDoc,
    consultarUsuarioPorValor,
    consultarUsuarioDocReg,
    usuarioCrearActualizar,
    actualizarUsuarioDatos,
    listarPersonal,
    listarReportePersonalMovimientos,
    listarReporteIngresosPublico
}
