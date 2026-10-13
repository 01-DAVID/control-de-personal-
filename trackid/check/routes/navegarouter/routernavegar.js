const express = require('express')
const cors = require('cors')
const { validartoken } = require('../../middlewares/validartoken.js')

//creamos el router navegar
const routerNavegar = express.Router()

const {
    navegarAindex,
    registroView,
    salidaView,
    adminView,
    personalView,
    personalActivo,
    personalInactivo,
    reportePorteria,
    perfilesUsu
} = require('../../controlador/navegar_control.js')

routerNavegar.use(express.json())
routerNavegar.use(express.text())
routerNavegar.use(cors())

routerNavegar.get('/', navegarAindex)
routerNavegar.get('/registro', validartoken, registroView)
routerNavegar.get('/salida', validartoken, salidaView)
routerNavegar.get('/reporte', reportePorteria)
routerNavegar.get('/admin', validartoken, adminView)
routerNavegar.get('/personal', validartoken, personalView)
routerNavegar.get('/personal_activo', validartoken, personalActivo)
routerNavegar.get('/personal_inactivo', validartoken, personalInactivo)
routerNavegar.get('/perfiles', validartoken, perfilesUsu)



module.exports = routerNavegar
