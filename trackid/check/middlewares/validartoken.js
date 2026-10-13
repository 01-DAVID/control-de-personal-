const jwt = require('jsonwebtoken')
const dotenv = require('dotenv')

dotenv.config()

const secretjwt = process.env.SECRETJWT || 'dev_secret_cambia_esto'

function getToken(req) {
    return req?.cookies?.token
}

function verifyToken(token) {
    return jwt.verify(token, secretjwt)
}

function validartoken(req, res, next){
    try {
        const token = getToken(req)
        if(!token){
            return res.redirect('/')
        }

        req.user = verifyToken(token)
        next()
    } catch (error) {
        return res.redirect('/')
    }
}

function validartokenApi(req, res, next){
    try {
        const token = getToken(req)
        if(!token){
            return res.status(401).json({ ok: false, message: 'No autorizado.' })
        }
        req.user = verifyToken(token)
        next()
    } catch (error) {
        return res.status(401).json({ ok: false, message: 'No autorizado.' })
    }
}

module.exports = { validartoken, validartokenApi }
