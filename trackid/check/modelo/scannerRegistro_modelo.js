const usuarioModelo = require('./usuario_modelo.js')
const movimientoModelo = require('./movimiento_modelo.js')

async function consultarRegistroPorScanner(valorScanner) {
    const valor = String(valorScanner || '').trim()
    const usuario = await usuarioModelo.consultarUsuarioPorValor(valor)
    if (!usuario) return null
    if (usuario.multipleMatches) return usuario

    const movimiento = await movimientoModelo.movimientoActivo(usuario.id)

    return {
        usuario: {
            ...usuario,
            movimiento: movimiento || null
        }
    }
}

module.exports = {
    consultarRegistroPorScanner
}
