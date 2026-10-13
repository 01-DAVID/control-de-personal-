const scannerSalidaModelo = require('../modelo/scannerSalida_modelo.js')

function httpError(status, message) {
    const err = new Error(message)
    err.status = status
    return err
}

const buscarUsuarioScannerSalida = async (req, res, next) => {
    try {
        const valor = String(req.query?.valor || '').trim()
        if (valor.length < 3) {
            throw httpError(400, 'El escaneo debe tener minimo 3 caracteres.')
        }

        const resultado = await scannerSalidaModelo.consultarSalidaPorScanner(valor)
        if (!resultado) throw httpError(404, 'Usuario no encontrado con el escaneo.')
        if (resultado.multipleMatches) throw httpError(409, resultado.message)

        res.json({ ok: true, ...resultado })
    } catch (error) {
        next(error)
    }
}

module.exports = {
    buscarUsuarioScannerSalida
}
