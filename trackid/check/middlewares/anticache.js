function anticache(req, res, next){
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
    res.set('Pragma', 'no-cache')
    res.header('set', '0')
    
    next()
}
module.exports = anticache
