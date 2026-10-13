console.clear()


//importar modulos necesarios para implementacion
const express = require('express')
const path = require('path')
const cors = require('cors')
const dotenv = require('dotenv')
const cookies = require('cookie-parser')
const anticache = require('./middlewares/anticache.js')

dotenv.config()
//variable global 
global._basedir = __dirname

const app = express()

const puerto = process.env.PUERTO || 3100

//app.use(express.static(path.join(__dirname, 'public')))
app.use(express.static('public'))
app.use('/vendor/sweetalert2', express.static(path.join(__dirname, 'node_modules', 'sweetalert2', 'dist')))
app.use(cookies())
app.use(express.urlencoded({ extended: true }))
app.use(express.json({ limit: '5mb' })) // Sube el limite para aceptar la foto base64 del registro
app.use(express.text())
app.use(cors())
app.use(anticache)

//configurara las plnatillas
app.set('view engine','ejs')
app.set('views', [
    path.join(__dirname, 'public', 'views'),
    path.join(__dirname, 'public', 'viewAdm')
])



const rutaApp = require('./routes/admin_router')
app.use(rutaApp)

app.use((err, _req, res, _next) => {
    const status = Number(err?.status || 500)
    const message = err?.message || "Error interno del servidor."
    const payload = { ok: false, message }
    if (err?.code) payload.code = err.code
    if (err?.usuario) payload.usuario = err.usuario
    res.status(status).json(payload)
})


app.listen(puerto, ()=>{
    console.log(`Servidor en funcionamiento http://localhost:${puerto}`)
})
