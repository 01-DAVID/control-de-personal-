// =========================================================
// CONTROLADOR API (Express)
// =========================================================
// Este archivo define handlers (controladores) para endpoints JSON.
// Se encarga de:
// - Validar y normalizar datos que llegan por `req` (query/body/params).
// - Llamar a la capa de modelos (consultas/operaciones en BD).
// - Responder con `res.json(...)` o delegar errores a `next(...)`.

// ===== Importación de modelos (capa de acceso a datos) =====
const dbModelo = require('../modelo/db_modelo.js') // Funciones utilitarias de BD (ej: health check)
const usuarioModelo = require('../modelo/usuario_modelo.js') // CRUD/consultas de usuarios
const equipoModelo = require('../modelo/equipo_modelo.js') // CRUD/consultas de equipos
const movimientoModelo = require('../modelo/movimiento_modelo.js') // Movimientos de ingreso/salida
const accesoModelo = require('../modelo/acceso_modelo.js') // CRUD/consultas de accesos
const ExcelJS = require('exceljs') // Generacion de reportes Excel
const bcrypt = require('bcryptjs')
const fs = require('fs/promises')
const path = require('path')

// ===== Helper: creación de errores HTTP controlados =====
// Crea un error con código HTTP para que lo maneje el middleware de errores.
function httpError(status, message) {
    const err = new Error(message) // Mensaje legible para el cliente
    err.status = status // Código HTTP sugerido (lo leerá el middleware)
    return err // Se lanza/propaga para cortar el flujo normal
}

// ===== Helper: validación de documento =====
// Valida que el documento tenga solo dígitos y un largo razonable.
function validarDocumento(value) {
    return /^\d{6,15}$/.test(String(value || "")) // 6 a 15 dígitos (sin espacios ni letras)
}

// ===== Helper: validación de nombre de persona =====
// Permite solo letras y espacios para evitar números o símbolos en nombres.
function validarNombrePersona(value) {
    return /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*$/.test(String(value || "").trim())
}

function validarCorreo(value) {
    return /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/.test(String(value || "").trim())
}

function normalizarTextoComparacion(value) {
    return String(value || "").trim().replace(/\s+/g, " ").toLowerCase()
}

function normalizarTipoDocumentoComparacion(value) {
    return String(value || "").trim().toUpperCase().replace(/\./g, "")
}

function datosUsuarioCambiaron(usuarioExistente, datosNuevos, tieneFotoNueva) {
    if (!usuarioExistente) return false
    if (tieneFotoNueva) return true

    return (
        normalizarTextoComparacion(usuarioExistente.nombre) !== normalizarTextoComparacion(datosNuevos.nombre) ||
        normalizarTipoDocumentoComparacion(usuarioExistente.tipoDocumento) !== normalizarTipoDocumentoComparacion(datosNuevos.tipoDocumento) ||
        String(usuarioExistente.numeroDocumento || "").trim() !== String(datosNuevos.numeroDocumento || "").trim() ||
        normalizarTextoComparacion(usuarioExistente.correo) !== normalizarTextoComparacion(datosNuevos.correo) ||
        String(usuarioExistente.telefono || "").trim() !== String(datosNuevos.telefono || "").trim() ||
        normalizarTextoComparacion(usuarioExistente.rol) !== normalizarTextoComparacion(datosNuevos.rol) ||
        normalizarTextoComparacion(usuarioExistente.areaVisita) !== normalizarTextoComparacion(datosNuevos.areaVisita)
    )
}

// ===== Helper: formato presentable para nombres =====
// Convierte entradas como "aLeJandro pErez" en "Alejandro Perez".
function formatoTitulo(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .map((palabra) => palabra.charAt(0).toUpperCase() + palabra.slice(1))
        .join(" ")
}

// ===== Helper: fecha legible para reportes =====
function formatoFechaReporte(value) {
    if (!value) return ''

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return String(value)

    return date.toLocaleString('es-CO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    })
}

// ===== Helper: une la fecha actual con la hora editable del formulario =====
function normalizarFechaIngreso(value) {
    const str = String(value || "").trim()
    const match = str.match(/^(\d{2}):(\d{2})(?::(\d{2}))?/)
    if (!match) return null

    const hh = match[1]
    const mm = match[2]
    const ss = match[3] || "00"
    const hora = `${hh}:${mm}:${ss}`

    const hoy = new Date() // La fecha no viene del formulario: siempre se toma la fecha actual del servidor
    const year = hoy.getFullYear()
    const month = String(hoy.getMonth() + 1).padStart(2, "0")
    const day = String(hoy.getDate()).padStart(2, "0")
    return `${year}-${month}-${day} ${hora}`
}

const MIME_IMAGENES = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp'
}

function esMultipart(req) {
    return String(req.headers?.['content-type'] || '').toLowerCase().includes('multipart/form-data')
}

function extraerBoundary(contentType) {
    const match = String(contentType || '').match(/boundary=(?:"([^"]+)"|([^;]+))/i)
    return match ? (match[1] || match[2]).trim() : ''
}

function leerRequestBuffer(req) {
    return new Promise((resolve, reject) => {
        const chunks = []
        req.on('data', (chunk) => chunks.push(chunk))
        req.on('end', () => resolve(Buffer.concat(chunks)))
        req.on('error', reject)
    })
}

async function leerMultipart(req) {
    const contentType = req.headers?.['content-type']
    const boundary = extraerBoundary(contentType)
    if (!boundary) throw httpError(400, 'Formulario multipart invalido.')

    const body = await leerRequestBuffer(req)
    if (body.length > 6 * 1024 * 1024) {
        throw httpError(400, 'La solicitud es demasiado grande. Usa una imagen menor a 4 MB.')
    }

    const delimiter = Buffer.from(`--${boundary}`)
    const fields = {}
    const files = {}
    let start = body.indexOf(delimiter)

    while (start !== -1) {
        start += delimiter.length
        if (body[start] === 45 && body[start + 1] === 45) break
        if (body[start] === 13 && body[start + 1] === 10) start += 2

        const headerEnd = body.indexOf(Buffer.from('\r\n\r\n'), start)
        if (headerEnd === -1) break

        const headersText = body.slice(start, headerEnd).toString('utf8')
        let valueStart = headerEnd + 4
        let next = body.indexOf(delimiter, valueStart)
        if (next === -1) break

        let valueEnd = next
        if (body[valueEnd - 2] === 13 && body[valueEnd - 1] === 10) valueEnd -= 2

        const disposition = headersText.match(/content-disposition:\s*form-data;([^\r\n]+)/i)?.[1] || ''
        const name = disposition.match(/name="([^"]+)"/i)?.[1] || ''
        const filename = disposition.match(/filename="([^"]*)"/i)?.[1] || ''
        const mimeType = headersText.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim().toLowerCase() || ''

        if (name) {
            const value = body.slice(valueStart, valueEnd)
            if (filename) {
                files[name] = { filename, mimeType, buffer: value }
            } else {
                fields[name] = value.toString('utf8')
            }
        }

        start = next
    }

    return { fields, files }
}

async function leerDatosFormulario(req) {
    if (!esMultipart(req)) return { fields: req.body || {}, files: {} }
    return leerMultipart(req)
}

function normalizarRolCarpeta(rol) {
    return String(rol || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '')
}

async function guardarFotoPerfil(file) {
    if (!file || !file.buffer?.length) return null

    const extension = MIME_IMAGENES[file.mimeType]
    if (!extension) {
        throw httpError(400, 'La foto debe ser una imagen JPG, PNG o WEBP.')
    }

    if (file.buffer.length > 4 * 1024 * 1024) {
        throw httpError(400, 'La foto es demasiado grande. Usa una imagen menor a 4 MB.')
    }

    const nombreLimpio = String(file.filename || 'foto')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/\.[^.]+$/, '')

    const dir = path.join(global._basedir || path.join(__dirname, '..'), 'public', 'imagenes', 'personal', 'administrador')
    await fs.mkdir(dir, { recursive: true })

    const nombreArchivo = `${nombreLimpio}.${extension}`
    const rutaFisica = path.join(dir, nombreArchivo)

    await fs.writeFile(rutaFisica, file.buffer)

    return `/imagenes/personal/administrador/${nombreArchivo}`
}

async function guardarFotoPersonal(file, { rol, numeroDocumento }) {
    if (!file || !file.buffer?.length) return ''

    const extension = MIME_IMAGENES[file.mimeType]
    if (!extension) {
        throw httpError(400, 'La foto debe ser una imagen JPG, PNG o WEBP.')
    }

    if (file.buffer.length > 4 * 1024 * 1024) {
        throw httpError(400, 'La foto es demasiado grande. Usa una imagen menor a 4 MB.')
    }

    const carpetaRol = normalizarRolCarpeta(rol)
    const documento = String(numeroDocumento || '').replace(/\D/g, '')
    if (!carpetaRol || !documento) {
        throw httpError(400, 'No se pudo definir la carpeta de la foto.')
    }

    const dir = path.join(global._basedir || path.join(__dirname, '..'), 'public', 'imagenes', 'personal', carpetaRol)
    await fs.mkdir(dir, { recursive: true })

    const nombreArchivo = `${documento}.${extension}`
    const rutaFisica = path.join(dir, nombreArchivo)
    const personalDir = path.join(global._basedir || path.join(__dirname, '..'), 'public', 'imagenes', 'personal')

    try {
        const carpetas = await fs.readdir(personalDir, { withFileTypes: true })
        for (const carpeta of carpetas) {
            if (!carpeta.isDirectory()) continue
            const carpetaPath = path.join(personalDir, carpeta.name)
            const archivos = await fs.readdir(carpetaPath)
            await Promise.all(
                archivos
                    .filter((archivo) => archivo.startsWith(`${documento}.`))
                    .map((archivo) => fs.unlink(path.join(carpetaPath, archivo)).catch(() => null))
            )
        }
    } catch (error) {
        // Si no hay fotos anteriores, se continua con el guardado normal.
    }

    await fs.writeFile(rutaFisica, file.buffer)

    return `/imagenes/personal/${carpetaRol}/${nombreArchivo}`
}

// ===== Helper: lectura de filtros desde querystring =====
function leerFiltros(req) {
    const nombre = String(req.query?.nombre || '').trim() // Filtro por nombre (opcional)
    const cedula = String(req.query?.cedula || '').trim() // Filtro por cédula/documento (opcional)
    const rol = String(req.query?.rol || '').trim() // Filtro por rol (opcional)
    const estado = String(req.query?.estado || '').trim() // Filtro por estado del movimiento
    const dia = String(req.query?.dia || '').trim() // Filtro por día de movimiento: YYYY-MM-DD
    const mes = String(req.query?.mes || '').trim() // Filtro por mes de movimiento: YYYY-MM
    const desde = String(req.query?.desde || '').trim() // Fecha inicial del rango
    const hasta = String(req.query?.hasta || '').trim() // Fecha final del rango
    const quincena = String(req.query?.quincena || '').trim() // primera | segunda
    const hora = String(req.query?.hora || '').trim() // Filtro por hora de movimiento: HH:MM

    return {
        nombre: nombre || null, // Normaliza "" -> null para simplificar en el modelo
        cedula: cedula || null, // Normaliza "" -> null para simplificar en el modelo
        rol: rol || null,
        estado: ['en_sede', 'salio'].includes(estado) ? estado : null,
        dia: /^\d{4}-\d{2}-\d{2}$/.test(dia) ? dia : null,
        mes: /^\d{4}-\d{2}$/.test(mes) ? mes : null,
        desde: /^\d{4}-\d{2}-\d{2}$/.test(desde) ? desde : null,
        hasta: /^\d{4}-\d{2}-\d{2}$/.test(hasta) ? hasta : null,
        quincena: ['primera', 'segunda'].includes(quincena) ? quincena : null,
        hora: /^\d{2}:\d{2}$/.test(hora) ? hora : null
    }
}

function calcularResumenIngresos(ingresos) {
    const lista = Array.isArray(ingresos) ? ingresos : []
    return {
        total: lista.length,
        enSede: lista.filter((item) => item?.estado === 'en_sede').length,
        salidas: lista.filter((item) => item?.salidaAt || item?.estado === 'salio').length
    }
}

// =========================================================
// ENDPOINTS
// =========================================================

// ===== GET /api/health: valida conexión con la base de datos =====
const health = async (_req, res, next) => {
    try {
        await dbModelo.bdCheck() // Ejecuta una consulta simple para verificar conectividad
        res.json({ ok: true }) // Respuesta estándar "ok"
        
    } catch (error) {
        next(httpError(500, "No se pudo conectar a la BD.")) // Fuerza un 500 si la BD falla
    }
}

// ===== GET /api/personal: lista usuarios (filtros por nombre/cédula) =====
const listarPersonal = async (req, res, next) => {
    try {
        const filtros = leerFiltros(req) // Lee query params y los normaliza
        const personal = await usuarioModelo.listarPersonal(filtros) // Consulta en BD con filtros opcionales
        res.json({ ok: true, personal }) // Devuelve arreglo de usuarios
    } catch (error) {
        next(error) // Propaga el error para que lo maneje el middleware global
    }
}

// ===== GET /api/personal/reporte-excel: descarga reporte detallado =====
const descargarReportePersonalExcel = async (req, res, next) => {
    try {
        const filtros = leerFiltros(req)
        const movimientos = await usuarioModelo.listarReportePersonalMovimientos(filtros)

        const workbook = new ExcelJS.Workbook()
        workbook.creator = 'SenaCheck'
        workbook.created = new Date()

        const worksheet = workbook.addWorksheet('Movimientos')
        worksheet.columns = [
            { header: 'ID usuario', key: 'usuarioId', width: 12 },
            { header: 'Nombre', key: 'nombre', width: 30 },
            { header: 'Tipo documento', key: 'tipoDocumento', width: 18 },
            { header: 'Numero documento', key: 'numeroDocumento', width: 20 },
            { header: 'Correo', key: 'correo', width: 30 },
            { header: 'Telefono', key: 'telefono', width: 18 },
            { header: 'Rol', key: 'rol', width: 20 },
            { header: 'Area visita', key: 'areaVisita', width: 24 },
            { header: 'Usuario creado', key: 'usuarioCreadoAt', width: 22 },
            { header: 'ID movimiento', key: 'movimientoId', width: 14 },
            { header: 'Ingreso', key: 'ingresoAt', width: 22 },
            { header: 'Salida', key: 'salidaAt', width: 22 },
            { header: 'Estado', key: 'estado', width: 14 },
            { header: 'Observacion salida', key: 'observacionSalida', width: 36 }
        ]

        worksheet.getRow(1).font = { bold: true }
        worksheet.getRow(1).alignment = { vertical: 'middle' }
        worksheet.autoFilter = {
            from: 'A1',
            to: 'N1'
        }

        movimientos.forEach((movimiento) => {
            worksheet.addRow({
                usuarioId: movimiento.usuarioId,
                nombre: movimiento.nombre,
                tipoDocumento: movimiento.tipoDocumento,
                numeroDocumento: movimiento.numeroDocumento,
                correo: movimiento.correo,
                telefono: movimiento.telefono,
                rol: movimiento.rol,
                areaVisita: movimiento.areaVisita || '',
                usuarioCreadoAt: formatoFechaReporte(movimiento.usuarioCreadoAt),
                movimientoId: movimiento.movimientoId,
                ingresoAt: formatoFechaReporte(movimiento.ingresoAt),
                salidaAt: formatoFechaReporte(movimiento.salidaAt),
                estado: movimiento.estado || '',
                observacionSalida: movimiento.observacionSalida || ''
            })
        })

        const fecha = new Date().toISOString().slice(0, 10)
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        res.setHeader('Content-Disposition', `attachment; filename="reporte_personal_movimientos_${fecha}.xlsx"`)

        await workbook.xlsx.write(res)
        res.end()
    } catch (error) {
        next(error)
    }
}

// ===== GET /api/ingresos: consulta movimientos de ingreso/salida con filtros =====
const listarIngresos = async (req, res, next) => {
    try {
        const filtros = leerFiltros(req)
        const ingresos = await usuarioModelo.listarReporteIngresosPublico(filtros)
        res.json({
            ok: true,
            ingresos,
            resumen: calcularResumenIngresos(ingresos)
        })
    } catch (error) {
        next(error)
    }
}

// ===== GET /api/ingresos/reporte-excel: descarga el reporte filtrado de ingresos =====
const descargarReporteIngresosExcel = async (req, res, next) => {
    try {
        const filtros = leerFiltros(req)
        const movimientos = await usuarioModelo.listarReporteIngresosPublico(filtros)

        const workbook = new ExcelJS.Workbook()
        workbook.creator = 'TrackID'
        workbook.created = new Date()

        const worksheet = workbook.addWorksheet('Ingresos')
        worksheet.columns = [
            { header: 'ID movimiento', key: 'movimientoId', width: 14 },
            { header: 'Nombre', key: 'nombre', width: 30 },
            { header: 'Numero documento', key: 'numeroDocumento', width: 20 },
            { header: 'Rol', key: 'rol', width: 20 },
            { header: 'Area visita', key: 'areaVisita', width: 24 },
            { header: 'Ingreso', key: 'ingresoAt', width: 22 },
            { header: 'Salida', key: 'salidaAt', width: 22 },
            { header: 'Estado', key: 'estado', width: 14 },
            { header: 'Observacion salida', key: 'observacionSalida', width: 36 }
        ]

        worksheet.getRow(1).font = { bold: true }
        worksheet.autoFilter = {
            from: 'A1',
            to: 'I1'
        }

        movimientos.forEach((movimiento) => {
            worksheet.addRow({
                movimientoId: movimiento.movimientoId,
                nombre: movimiento.nombre,
                numeroDocumento: movimiento.numeroDocumento,
                rol: movimiento.rol,
                areaVisita: movimiento.areaVisita || '',
                ingresoAt: formatoFechaReporte(movimiento.ingresoAt),
                salidaAt: formatoFechaReporte(movimiento.salidaAt),
                estado: movimiento.estado || '',
                observacionSalida: movimiento.observacionSalida || ''
            })
        })

        const fecha = new Date().toISOString().slice(0, 10)
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        res.setHeader('Content-Disposition', `attachment; filename="reporte_ingresos_${fecha}.xlsx"`)

        await workbook.xlsx.write(res)
        res.end()
    } catch (error) {
        next(error)
    }
}

// ===== GET /api/personal/activos: lista personal con ingreso abierto =====
const listarPersonalActivo = async (req, res, next) => {
    try {
        const filtros = leerFiltros(req) // Lee query params y los normaliza
        const personal = await movimientoModelo.listarPersonalActivo(filtros) // Personal con movimiento sin salida
        res.json({ ok: true, personal }) // Devuelve arreglo de personas activas
    } catch (error) {
        next(error) // Propaga el error al middleware
    }
}

// ===== GET /api/personal/inactivos: lista personal cuyo último movimiento está cerrado =====
const listarPersonalInactivo = async (req, res, next) => {
    try {
        const filtros = leerFiltros(req) // Lee query params y los normaliza
        const personal = await movimientoModelo.listarPersonalInactivo(filtros) // Personal sin ingreso abierto
        res.json({ ok: true, personal }) // Devuelve arreglo de personas inactivas
    } catch (error) {
        next(error) // Propaga el error al middleware
    }
}

// ===== POST /api/perfiles: crea un perfil de acceso en la tabla accesos =====
const crearPerfil = async (req, res, next) => {
    try {
        const { fields, files } = await leerDatosFormulario(req)
        const nombre = formatoTitulo(fields?.nombre)
        const contrasena = String(fields?.contrasena || '').trim()
        const rol = String(fields?.rol || '').trim().toLowerCase()

        if (!nombre || !contrasena || !rol) {
            throw httpError(400, 'Completa todos los campos obligatorios.')
        }

        if (!validarNombrePersona(nombre)) {
            throw httpError(400, 'El nombre solo debe contener letras y espacios.')
        }

        if (contrasena.length < 6) {
            throw httpError(400, 'La contraseña debe tener al menos 6 caracteres.')
        }

        if (!['administrador', 'vigilante'].includes(rol)) {
            throw httpError(400, 'El rol debe ser administrador o vigilante.')
        }

        const codigo = nombre

        const existente = await accesoModelo.consultarAccesoPorCodigo(codigo)
        if (existente) {
            throw httpError(409, 'Ya existe un perfil con ese código.')
        }

        let fotoRuta = null
        if (files?.foto) {
            fotoRuta = await guardarFotoPerfil(files.foto)
        }

        const passwordHash = await bcrypt.hash(contrasena, 10)

        const acceso = await accesoModelo.crearAcceso({
            codigo,
            passwordHash,
            rol,
            fotoRuta
        })

        res.status(201).json({ ok: true, acceso })
    } catch (error) {
        if (error?.code === 'ER_DUP_ENTRY') {
            next(httpError(409, 'Ya existe un perfil con ese código.'))
            return
        }
        next(error)
    }
}

// ===== POST /api/usuarios: crea/actualiza usuario y garantiza ingreso abierto =====
// Crea/actualiza usuario y asegura que quede con ingreso abierto (movimiento en sede).
// Campos obligatorios: nombre, tipoDocumento, numeroDocumento, rol, horaIngreso.
// Campos opcionales: correo, telefono, foto.
// Si viene `documentoOriginal` (usuario consultado previamente) y difiere del
// `numeroDocumento` actual, se actualiza la fila original (no se inserta otra).
const crearUsuario = async (req, res, next) => {
    try {
        const { fields, files } = await leerDatosFormulario(req)
        const nombre = formatoTitulo(fields?.nombre) // Campo requerido
        const tipoDocumento = String(fields?.tipoDocumento || "").trim() // Campo requerido (CC, TI, etc.)
        const numeroDocumento = String(fields?.numeroDocumento || "").trim() // Campo requerido (solo dígitos)
        const correo = String(fields?.correo || "").trim().toLowerCase() // Campo opcional
        const telefono = String(fields?.telefono || "").trim() // Campo opcional
        const rol = String(fields?.rol || "").trim().toLowerCase() // Campo requerido (admin, aprendiz, etc.)
        const areaVisita = formatoTitulo(fields?.areaVisita) // Requerido solo para visitantes
        const horaIngreso = normalizarFechaIngreso(fields?.horaIngreso) // Hora editable enviada por el formulario
        const confirmarActualizacion = ['true', '1', 'si', 'sí'].includes(String(fields?.confirmarActualizacion || '').trim().toLowerCase())
        const documentoOriginal = String(fields?.documentoOriginal || "").trim() // Documento del usuario consultado antes de modificar

        if (!nombre || !tipoDocumento || !numeroDocumento || !rol || !horaIngreso) {
            throw httpError(400, "Completa los campos obligatorios (nombre, tipo y numero de documento, rol).")
        }

        if (!validarNombrePersona(nombre)) {
            throw httpError(400, "El nombre solo debe contener letras y espacios.")
        }

        if (correo && !validarCorreo(correo)) {
            throw httpError(400, "Ingresa un correo valido sin emojis.")
        }

        if (!validarDocumento(numeroDocumento)) {
            throw httpError(400, "El numero de documento debe contener entre 6 y 15 digitos.")
        }

        if (telefono && !/^\d{7,15}$/.test(telefono)) {
            throw httpError(400, "El telefono debe contener entre 7 y 15 digitos.")
        }

        if (rol === "visitante" && !areaVisita) {
            throw httpError(400, "Indica el area a la que se dirige el visitante.")
        }

        const datosNormalizados = {
            nombre,
            tipoDocumento,
            numeroDocumento,
            correo,
            telefono,
            rol,
            areaVisita: rol === "visitante" ? areaVisita : ""
        }

        const tieneFotoNueva = Boolean(files?.foto?.buffer?.length)
        const fotoRuta = await guardarFotoPersonal(files?.foto, { rol, numeroDocumento })

        const esCambioDocumentoConsulta = Boolean(documentoOriginal) && documentoOriginal !== numeroDocumento

        if (esCambioDocumentoConsulta) {
            // El usuario fue consultado y su documento fue modificado:
            // se actualiza la misma fila (nunca se crea un registro nuevo).
            const usuarioOriginal = await usuarioModelo.consultarUsuarioDoc(documentoOriginal)
            if (!usuarioOriginal) {
                throw httpError(404, "El usuario consultado originalmente ya no existe.")
            }

            // Regla obligatoria: si cambia el documento tambien debe cambiar el nombre.
            if (normalizarTextoComparacion(usuarioOriginal.nombre) === normalizarTextoComparacion(nombre)) {
                throw httpError(400, "Si cambia el documento, tambien debe modificar el nombre.")
            }

            // Proteccion anti-duplicados: el nuevo documento no puede pertenecer a otro usuario.
            const duenoNuevoDocumento = await usuarioModelo.consultarUsuarioDoc(numeroDocumento)
            if (duenoNuevoDocumento && Number(duenoNuevoDocumento.id) !== Number(usuarioOriginal.id)) {
                throw httpError(409, "Ya existe otro usuario con ese numero de documento.")
            }

            const usuario = await usuarioModelo.actualizarUsuarioDatos(documentoOriginal, {
                nombre,
                tipoDocumento,
                numeroDocumento,
                correo,
                telefono,
                rol,
                areaVisita: datosNormalizados.areaVisita,
                fotoRuta
            })
            if (!usuario) throw httpError(500, "No se pudo guardar el usuario.")

            const movimiento = await movimientoModelo.garantizarMovimiento(usuario.id, horaIngreso)
            res.json({ ok: true, usuario, movimiento })
            return
        }

        const usuarioExistente = await usuarioModelo.consultarUsuarioDoc(numeroDocumento)
        if (usuarioExistente && datosUsuarioCambiaron(usuarioExistente, datosNormalizados, tieneFotoNueva) && !confirmarActualizacion) {
            const err = httpError(409, `Ya existe un usuario con el documento ${numeroDocumento}, pero los datos no coinciden.`)
            err.code = 'USUARIO_EXISTE'
            err.usuario = usuarioExistente
            throw err
        }

        const usuario = await usuarioModelo.usuarioCrearActualizar({ // Upsert del usuario (crea o actualiza)
            nombre,
            tipoDocumento,
            numeroDocumento,
            correo,
            telefono,
            rol,
            areaVisita: datosNormalizados.areaVisita,
            fotoRuta
        })
        if (!usuario) throw httpError(500, "No se pudo guardar el usuario.") // Seguridad: si el modelo no retorna usuario

        const movimiento = await movimientoModelo.garantizarMovimiento(usuario.id, horaIngreso) // Asegura movimiento de ingreso abierto con hora elegida

        res.json({ ok: true, usuario, movimiento }) // Respuesta con usuario y movimiento actual
    } catch (error) {
        if (error?.code === 'ER_DUP_ENTRY') {
            next(httpError(409, 'Ya existe un usuario con ese numero de documento.'))
            return
        }
        next(error) // Propaga el error al middleware
    }
}

// ===== PUT /api/usuarios/:numeroDocumento: actualiza datos personales =====
// Actualiza solo la informacion del usuario. No cambia su ingreso activo ni registra salida.
const actualizarUsuario = async (req, res, next) => {
    try {
        const documentoActual = String(req.params?.numeroDocumento || "").trim()
        const nombre = formatoTitulo(req.body?.nombre)
        const tipoDocumento = String(req.body?.tipoDocumento || "").trim()
        const numeroDocumento = String(req.body?.numeroDocumento || "").trim()
        const correo = String(req.body?.correo || "").trim().toLowerCase()
        const telefono = String(req.body?.telefono || "").trim()
        const rol = String(req.body?.rol || "").trim().toLowerCase()
        const areaVisita = formatoTitulo(req.body?.areaVisita)

        if (!validarDocumento(documentoActual) || !validarDocumento(numeroDocumento)) {
            throw httpError(400, "El numero de documento debe contener entre 6 y 15 digitos.")
        }

        if (!nombre || !tipoDocumento || !numeroDocumento || !rol) {
            throw httpError(400, "Completa todos los campos obligatorios.")
        }

        if (!validarNombrePersona(nombre)) {
            throw httpError(400, "El nombre solo debe contener letras y espacios.")
        }

        if (correo && !validarCorreo(correo)) {
            throw httpError(400, "Ingresa un correo valido sin emojis.")
        }

        if (telefono && !/^\d{7,15}$/.test(telefono)) {
            throw httpError(400, "El telefono debe contener entre 7 y 15 digitos.")
        }

        const usuarioActual = await usuarioModelo.consultarUsuarioDoc(documentoActual)
        if (!usuarioActual) throw httpError(404, "Usuario no encontrado.")

        const areaVisitaFinal = rol === "visitante" ? (areaVisita || usuarioActual.areaVisita || "") : ""

        const usuario = await usuarioModelo.actualizarUsuarioDatos(documentoActual, {
            nombre,
            tipoDocumento,
            numeroDocumento,
            correo,
            telefono,
            rol,
            areaVisita: areaVisitaFinal
        })

        if (!usuario) throw httpError(500, "No se pudo actualizar el usuario.")
        res.json({ ok: true, usuario })
    } catch (error) {
        if (error?.code === "ER_DUP_ENTRY") {
            next(httpError(409, "Ya existe un usuario con ese numero de documento."))
            return
        }
        next(error)
    }
}

// ===== GET /api/usuarios/buscar?valor=: consulta por documento o nombre =====
// Permite que el boton Consultar funcione con documento exacto o coincidencia por nombre.
const buscarUsuarioRegistro = async (req, res, next) => {
    try {
        const valor = String(req.query?.valor || "").trim()
        if (valor.length < 3) throw httpError(400, "Ingresa minimo 3 caracteres del nombre o documento.")

        const usuario = await usuarioModelo.consultarUsuarioPorValor(valor)
        if (!usuario) throw httpError(404, "Usuario no encontrado.")
        if (usuario.multipleMatches) throw httpError(409, usuario.message)

        const equipos = await equipoModelo.listaEquipos(usuario.id)
        const movimientoAbierto = await movimientoModelo.movimientoActivo(usuario.id)
        const ultimoMov = movimientoAbierto ? null : await movimientoModelo.ultimoMovimiento(usuario.id)

        res.json({
            ok: true,
            usuario,
            equipos,
            movimiento: movimientoAbierto || ultimoMov || null
        })
    } catch (error) {
        next(error)
    }
}

// ===== GET /api/usuarios/:numeroDocumento: consulta usuario + equipos + movimiento =====
// Consulta usuario por documento, trae equipos y el movimiento (abierto o el último).
const consultarUsuario = async (req, res, next) => {
    try {
        const numeroDocumento = String(req.params?.numeroDocumento || "").trim() // Documento viene en la URL
        if (!validarDocumento(numeroDocumento)) throw httpError(400, "Documento invalido.") // Si no cumple regex, se rechaza

        const usuario = await usuarioModelo.consultarUsuarioDoc(numeroDocumento) // Busca usuario por documento
        if (!usuario) throw httpError(404, "Usuario no encontrado.") // 404 si no existe

        const equipos = await equipoModelo.listaEquipos(usuario.id) // Lista equipos asociados
        const movimientoAbierto = await movimientoModelo.movimientoActivo(usuario.id) // Intenta encontrar ingreso abierto
        const ultimoMov = movimientoAbierto ? null : await movimientoModelo.ultimoMovimiento(usuario.id) // Si no hay abierto, trae el último

        res.json({ ok: true, usuario, equipos, movimiento: movimientoAbierto || ultimoMov || null }) // Normaliza "movimiento" a un solo objeto
    } catch (error) {
        next(error) // Propaga el error al middleware
    }
}

// controlador para lo consulta de datos al registro
const consultarUsuarioReg = async (req, res, next) => {
    try {
        const numdoc = String(req.params?.numdoc || "").trim() // Documento viene en la URL
        if (!validarDocumento(numdoc)) throw httpError(400, "Documento invalido.") // Si no cumple regex, se rechaza

        const usuario = await usuarioModelo.consultarUsuarioDocReg(numdoc) // Busca usuario por documento
        if (!usuario) throw httpError(404, "Usuario no encontrado.") // 404 si no existe

        // const equipos = await equipoModelo.listaEquipos(usuario.id) // Lista equipos asociados
        // const movimientoAbierto = await movimientoModelo.movimientoActivo(usuario.id) // Intenta encontrar ingreso abierto
        // const ultimoMov = movimientoAbierto ? null : await movimientoModelo.ultimoMovimiento(usuario.id) // Si no hay abierto, trae el último

        res.json({ ok: true, usuario }) // Normaliza "movimiento" a un solo objeto
        console.log(usuario)
    } catch (error) {
        next(error) // Propaga el error al middleware
    }
}



// ===== POST /api/equipos: crea un equipo y lo asocia a un usuario por documento =====
// Crea un equipo y lo asocia al usuario encontrado por documento.
const crearEquipo = async (req, res, next) => {
    try {
        const numeroDocumento = String(req.body?.numeroDocumento || "").trim() // Documento del usuario dueño del equipo
        const nombreEquipo = String(req.body?.nombreEquipo || "").trim() // Nombre/alias del equipo
        const serialEquipo = String(req.body?.serialEquipo || "").trim() // Serial del equipo
        const adicionalEquipoRaw = req.body?.adicionalEquipo // Campo opcional
        const adicionalEquipo = adicionalEquipoRaw === undefined || adicionalEquipoRaw === null ? "" : String(adicionalEquipoRaw).trim() // Normaliza null/undefined a ""

        if (!validarDocumento(numeroDocumento)) throw httpError(400, "Documento invalido.") // Valida documento
        if (!nombreEquipo || !serialEquipo) throw httpError(400, "Registra nombre y serial del equipo.") // Campos requeridos del equipo

        const usuario = await usuarioModelo.consultarUsuarioDoc(numeroDocumento) // Verifica que exista usuario
        if (!usuario) throw httpError(404, "Usuario no encontrado para asociar el equipo.") // 404 si el documento no existe

        await equipoModelo.crearEquipo({ // Inserta el equipo en la tabla `equipos`
            usuarioId: usuario.id,
            nombreEquipo,
            serialEquipo,
            adicionalEquipo
        })

        res.json({ ok: true }) // Respuesta simple (el frontend no requiere más datos aquí)
    } catch (error) {
        next(error) // Propaga el error al middleware
    }
}

// ===== DELETE /api/equipos/:equipoId/salida: registra salida de un equipo =====
// En esta version la salida del equipo se representa eliminandolo de los equipos activos del usuario.
const registrarSalidaEquipo = async (req, res, next) => {
    try {
        const equipoId = Number(req.params?.equipoId || 0)
        if (!Number.isInteger(equipoId) || equipoId <= 0) throw httpError(400, "Equipo invalido.")

        const eliminado = await equipoModelo.eliminarEquipo(equipoId)
        if (!eliminado) throw httpError(404, "Equipo no encontrado.")

        res.json({ ok: true })
    } catch (error) {
        next(error)
    }
}

// ===== PUT /api/movimientos/:movimientoId/observacion: adjunta observacion opcional =====
const adjuntarObservacionMovimiento = async (req, res, next) => {
    try {
        const movimientoId = Number(req.params?.movimientoId || 0)
        if (!Number.isInteger(movimientoId) || movimientoId <= 0) throw httpError(400, "Movimiento invalido.")

        const observacionSalida = String(req.body?.observacionSalida || "").trim()
        const movimiento = await movimientoModelo.actualizarObservacionSalida(movimientoId, observacionSalida)
        if (!movimiento) throw httpError(404, "Movimiento abierto no encontrado.")

        res.json({ ok: true, movimiento })
    } catch (error) {
        next(error)
    }
}

// ===== POST /api/salida: registra la salida cerrando el movimiento abierto =====
// Registra la salida del usuario cerrando el movimiento abierto.
const registrarSalida = async (req, res, next) => {
    try {
        const numeroDocumento = String(req.body?.numeroDocumento || "").trim() // Documento viene en el body (JSON)        
        const observacionSalida = String(req.body?.observacionSalida || "").trim()
        if (!validarDocumento(numeroDocumento)) throw httpError(400, "Documento invalido.") // Valida documento

        const usuario = await usuarioModelo.consultarUsuarioDoc(numeroDocumento) // Busca usuario por documento
        if (!usuario) throw httpError(404, "Usuario no encontrado.") // 404 si no existe

        const movimientoAbierto = await movimientoModelo.movimientoActivo(usuario.id) // Busca ingreso abierto
        if (!movimientoAbierto) throw httpError(400, "No hay un ingreso abierto para este usuario.") // No se puede dar salida si no hay ingreso
        
        const movimiento = await movimientoModelo.cerrarMovimiento(movimientoAbierto.id, observacionSalida || null) // Marca salida y estado "salio"
        if (!movimiento) throw httpError(409, "La salida ya fue registrada o el movimiento no esta abierto.")

        const equipos = await equipoModelo.listaEquipos(usuario.id) // Incluye equipos para mostrar en pantalla

        res.json({ ok: true, usuario, movimiento, equipos }) // Respuesta completa para la vista de salida
    } catch (error) {
        next(error) // Propaga el error al middleware
    }
}

// ===== GET /api/auth/me: devuelve datos del usuario logueado =====
const obtenerUsuarioActual = async (req, res, next) => {
    try {
        const userId = req.user?.sub
        if (!userId) throw httpError(401, 'No autorizado.')

        const acceso = await accesoModelo.consultarAccesoPorId(userId)
        if (!acceso) throw httpError(404, 'Usuario no encontrado.')

        res.json({
            ok: true,
            usuario: {
                id: acceso.id,
                nombre: acceso.codigo,
                rol: acceso.rol,
                fotoRuta: acceso.fotoRuta || null
            }
        })
    } catch (error) {
        next(error)
    }
}

// ===== Exportación pública del controlador =====
module.exports = {
    health,
    listarPersonal,
    descargarReportePersonalExcel,
    listarIngresos,
    descargarReporteIngresosExcel,
    listarPersonalActivo,
    listarPersonalInactivo,
    crearPerfil,
    crearUsuario,
    actualizarUsuario,
    consultarUsuario,
    buscarUsuarioRegistro,
    consultarUsuarioReg,
    crearEquipo,
    registrarSalidaEquipo,
    adjuntarObservacionMovimiento,
    registrarSalida,
    obtenerUsuarioActual
}
