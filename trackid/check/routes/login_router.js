const express = require('express')
const cors = require('cors')

const { login, logout } = require('../controlador/login_control.js')

const routerLogin = express.Router()

routerLogin.use(express.urlencoded({ extended: true }))
routerLogin.use(express.json())
routerLogin.use(express.text())
routerLogin.use(cors())

routerLogin.post('/login', login)
routerLogin.get('/logout', logout)

module.exports = routerLogin

