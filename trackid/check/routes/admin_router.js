const express = require('express')
const cors = require('cors')

const routerApi = require('./api_routes/router_api.js')
const routerLogin = require('./login_router.js')
const routerNavegar = require('./navegarouter/routernavegar.js')

//creamos router admin  

const rutadmin = express.Router()

rutadmin.use(express.json())
rutadmin.use(express.text())
rutadmin.use(cors())

rutadmin.use(routerLogin)
rutadmin.use('/api', routerApi)
rutadmin.use(routerNavegar)

module.exports = rutadmin
