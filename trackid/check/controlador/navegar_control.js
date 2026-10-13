// =========================================================
// CONTROLADOR DE NAVEGACIÓN (Vistas)
// =========================================================
// Este archivo contiene controladores que renderizan vistas (EJS/Pug/Handlebars, etc.).
// No consulta BD: solo decide qué plantilla mostrar.

// ===== Vista: Login / Index =====
const navegarAindex = (req, res) => {
    res.render('index') // Renderiza la vista principal (login)
}

// ===== Vista: Registro de ingreso / creación usuario/equipo =====
const registroView = (req, res) => {
    res.render('registro') // Renderiza formulario de registro
}

// ===== Vista: Salida (cerrar movimiento) =====
const salidaView = (req, res) => {
    res.render('salida') // Renderiza pantalla para registrar salida
}

// ===== Vista: Panel admin =====
const adminView = (req, res) => {
    res.render('admin') // Renderiza dashboard de administración
}

// ===== Vista: Listado general de personal =====
const personalView = (req, res) => {
    res.render('adminPersonal') // Renderiza listado completo del personal
}

// ===== Vista: Personal activo (en sede) =====
const personalActivo = (req, res) => {
    res.render('activo') // Renderiza tabla de personal con ingreso abierto
}

// ===== Vista: Personal inactivo (ya salió) =====
const personalInactivo = (req, res) => {
    res.render('inactivo') // Renderiza tabla de personal con salida registrada

}
// ===== vista: generar reportes de ingresos y salidas
const reportePorteria = (req, res) =>{
    res.render('reporte') // Renderiza tabla de personal con salida registrada
}

const perfilesUsu = (req,res) =>  {
    res.render('perfiles') // REnderiza la vista para crear perfiles
}


    // ===== Exportación de controladores =====
module.exports = {
    navegarAindex,
    registroView,
    salidaView,
    adminView,
    personalView,
    personalActivo,
    personalInactivo,
    reportePorteria,
    perfilesUsu
}
