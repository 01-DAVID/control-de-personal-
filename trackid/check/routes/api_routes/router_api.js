const express = require('express')
const cors = require('cors')

const routerApi = express.Router()
const { validartokenApi } = require('../../middlewares/validartoken.js')

const {
    health,
    listarPersonal,
    descargarReportePersonalExcel,
    listarIngresos,
    crearPerfil,
    descargarReporteIngresosExcel,
    listarPersonalActivo,
    listarPersonalInactivo,
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
} = require('../../controlador/api_control.js')

const {
    buscarUsuarioScannerSalida
} = require('../../controlador/scannerSalida_control.js')

const {
    buscarUsuarioScannerRegistro
} = require('../../controlador/scannerRegistro_control.js')

routerApi.use(express.json({ limit: '5mb' }))
routerApi.use(express.text())
routerApi.use(cors())

routerApi.get('/health', health)
routerApi.get('/auth/me', validartokenApi, obtenerUsuarioActual)
routerApi.get('/ingresos', listarIngresos)
routerApi.get('/ingresos/reporte-excel', descargarReporteIngresosExcel)
routerApi.use(validartokenApi)
routerApi.get('/personal', listarPersonal)
routerApi.get('/personal/reporte-excel', descargarReportePersonalExcel)
routerApi.get('/personal/activos', listarPersonalActivo)
routerApi.get('/personal/inactivos', listarPersonalInactivo)
routerApi.post('/perfiles', crearPerfil)
routerApi.post('/usuarios', crearUsuario)
routerApi.get('/usuarios/buscar', buscarUsuarioRegistro)
routerApi.get('/scanner-salida/buscar', buscarUsuarioScannerSalida)
routerApi.get('/scanner-registro/buscar', buscarUsuarioScannerRegistro)
routerApi.put('/usuarios/:numeroDocumento', actualizarUsuario)
routerApi.get('/usuarios/:numeroDocumento', consultarUsuario)
routerApi.post('/equipos', crearEquipo)
routerApi.delete('/equipos/:equipoId/salida', registrarSalidaEquipo)
routerApi.put('/movimientos/:movimientoId/observacion', adjuntarObservacionMovimiento)
routerApi.post('/salida', registrarSalida)

module.exports = routerApi
