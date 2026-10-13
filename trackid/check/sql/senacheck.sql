CREATE DATABASE IF NOT EXISTS senacheck
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE senacheck;

CREATE TABLE IF NOT EXISTS usuarios (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(120) NOT NULL,
  tipo_documento VARCHAR(20) NOT NULL,
  numero_documento VARCHAR(15) NOT NULL,
  correo VARCHAR(150) NOT NULL,
  telefono VARCHAR(20) NOT NULL,
  rol VARCHAR(40) NOT NULL,
  area_visita VARCHAR(120) NULL,
  foto_ruta VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_usuarios_numero_documento (numero_documento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS equipos (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id INT UNSIGNED NOT NULL,
  nombre_equipo VARCHAR(120) NOT NULL,
  serial_equipo VARCHAR(120) NOT NULL,
  adicional_equipo TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_equipos_usuario (usuario_id),
  CONSTRAINT fk_equipos_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS movimientos (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id INT UNSIGNED NOT NULL,
  ingreso_at DATETIME NOT NULL,
  salida_at DATETIME NULL,
  estado ENUM('en_sede','salio') NOT NULL DEFAULT 'en_sede',
  observacion_salida TEXT NULL,
  PRIMARY KEY (id),
  KEY idx_movimientos_usuario (usuario_id),
  KEY idx_movimientos_usuario_salida (usuario_id, salida_at),
  CONSTRAINT fk_movimientos_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS accesos (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo VARCHAR(50) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  rol VARCHAR(40) NOT NULL DEFAULT 'admin',
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_accesos_codigo (codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Usuario de acceso de ejemplo:
-- codigo: admin
-- contraseña: 1234
INSERT INTO accesos (codigo, password_hash, rol, activo)
VALUES ('admin', '$2b$10$FEPFoK2A61OkfbuhxdrkRuo5vdjT8iIVnTCWZfOZAgnPqDwHDO03a', 'admin', 1)
ON DUPLICATE KEY UPDATE
  password_hash = VALUES(password_hash),
  rol = VALUES(rol),
  activo = VALUES(activo);
