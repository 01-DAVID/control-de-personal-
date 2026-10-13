//conexion a la base de datos

const mysql = require('mysql2/promise')

const dotenv = require('dotenv')
dotenv.config()

const host = process.env.DB_HOST || process.env.HOST || 'localhost'
const user = process.env.DB_USER || process.env.USER || 'root'
const password = process.env.DB_PASSWORD || process.env.PASSWORD || ''
const database = process.env.DB_NAME || process.env.DATABASE || 'senacheck'
const port = Number(process.env.DB_PORT || 3306)

//importar el modulo de la bd
const conexion = mysql.createPool({
//parametros de conexion
    host,
    user,
    password,
    database,
    port
})

module.exports = conexion

