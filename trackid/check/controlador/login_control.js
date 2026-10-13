// =========================================================
// CONTROLADOR DE AUTENTICACIÓN (Login / Logout)
// =========================================================
// Este archivo controla el acceso al sistema:
// - Verifica credenciales contra la tabla `accesos` en la BD.
// - Genera un JWT y lo guarda en una cookie httpOnly.
// - Redirige según el rol del usuario.

// ===== Dependencias de seguridad y configuración =====
const bcrypt = require('bcryptjs') // Comparación segura de contraseñas (hash)
const jwt = require('jsonwebtoken') // Firma/verificación de tokens JWT
const dotenv = require('dotenv') // Carga variables de entorno desde .env

// ===== Conexión a base de datos =====
const conexion = require('../database/conexion.js') // Pool/cliente MySQL (o similar)

dotenv.config() // Lee variables de entorno del archivo .env (si existe)

// ===== Secreto para firmar JWT =====
const secretjwt = process.env.SECRETJWT || 'dev_secret_cambia_esto' // Fallback: útil en desarrollo (no recomendado en producción)

// Nota: este helper no se usa actualmente en este archivo, pero queda disponible si luego se maneja con `next(err)`.
function httpError(status, message) {
    const err = new Error(message) // Crea un Error estándar
    err.status = status // Adjunta un status HTTP sugerido
    return err // Devuelve el error para lanzar/propagar
}

// =========================================================
// POST /login
// =========================================================
const login = async (req, res, next) => {
    try {
        // ===== 1) Leer y normalizar credenciales =====
        const codigo = String(req.body?.codigo || '').trim() // Código de acceso (ej: usuario interno)
        const contrasena = String(req.body?.contrasena || '').trim() // Contraseña en texto plano (se compara con hash)

        if (!codigo || !contrasena) {
            // Si faltan datos, se vuelve al login con un mensaje en querystring.
            return res.redirect('/?error=' + encodeURIComponent('Ingresa codigo y contraseña.'))
        }

        // ===== 2) Consultar el usuario en BD =====
        // Se busca el registro de `accesos` por `codigo`.
        const [rows] = await conexion.query(
            `
            SELECT id, codigo, password_hash AS passwordHash, rol, activo
            FROM accesos
            WHERE codigo = ?
            LIMIT 1
            `,
            [codigo]
        )

        // ===== 3) Validar existencia y estado =====
        const user = rows?.[0]
        if (!user || Number(user.activo) !== 1) {
            return res.redirect('/?error=' + encodeURIComponent('Acceso denegado.'))
        }

        // ===== 4) Verificar contraseña (hash vs texto) =====
        const ok = await bcrypt.compare(contrasena, String(user.passwordHash || ''))
        if (!ok) {
            return res.redirect('/?error=' + encodeURIComponent('Acceso denegado.'))
        }

        // ===== 5) Generar JWT =====
        // El payload incluye: sujeto (id), código y rol; expira en 1 día.
        const token = jwt.sign(
            { sub: user.id, codigo: user.codigo, rol: user.rol },
            secretjwt,
            { expiresIn: '1d' }
        )

        // ===== 6) Guardar token en cookie segura (httpOnly) =====
        res.cookie('token', token, {
            httpOnly: true,
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000,
        })
        
        // ===== 7) Redirigir según rol =====
        const rolUsuario = String(user.rol || '').toLowerCase()

        if (rolUsuario === 'administrador') {
            return res.redirect('/admin')
        } else {
            return res.redirect('/registro')
        }

    } catch (error) {
        // Si hay error de servidor/BD, se redirige con un mensaje genérico.
        return res.redirect('/?error=' + encodeURIComponent('Error de servidor.'))
    }
}

// =========================================================
// GET /logout
// =========================================================
const logout = (req, res) => {
    res.clearCookie('token') // Elimina cookie del navegador
    res.redirect('/') // Regresa a la pantalla de login
}

module.exports = { login, logout }
