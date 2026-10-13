const usuarioModelo = require('./usuario_modelo.js')
const equipoModelo = require('./equipo_modelo.js')
const movimientoModelo = require('./movimiento_modelo.js')

async function consultarSalidaPorScanner(valorScanner) {
    const valor = String(valorScanner || '').trim()
    const usuario = await usuarioModelo.consultarUsuarioPorValor(valor)
    if (!usuario) return null
    if (usuario.multipleMatches) return usuario

    const equipos = await equipoModelo.listaEquipos(usuario.id)
    const movimientoAbierto = await movimientoModelo.movimientoActivo(usuario.id)
    const ultimoMov = movimientoAbierto ? null : await movimientoModelo.ultimoMovimiento(usuario.id)

    return {
        usuario,
        equipos,
        movimiento: movimientoAbierto || ultimoMov || null
    }
}

module.exports = {
    consultarSalidaPorScanner
}
