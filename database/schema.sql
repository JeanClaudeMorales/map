-- Venezuelan Administrative & Statistical Schema (Scalable Design)
-- This file consolidates States, Municipalities, Parishes and Cities with 3D visualization support.

SET SQL_MODE="NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

-- 1. States (Estados)
CREATE TABLE IF NOT EXISTS estados (
  id_estado int(11) NOT NULL AUTO_INCREMENT,
  estado varchar(250) NOT NULL,
  iso_3166_2 varchar(4) NOT NULL,
  PRIMARY KEY (id_estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- 2. Municipalities (Municipios)
CREATE TABLE IF NOT EXISTS municipios (
  id_municipio int(11) NOT NULL AUTO_INCREMENT,
  id_estado int(11) NOT NULL,
  municipio varchar(100) NOT NULL,
  PRIMARY KEY (id_municipio),
  KEY id_estado (id_estado),
  CONSTRAINT fk_municipio_estado FOREIGN KEY (id_estado) REFERENCES estados (id_estado) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- 3. Parishes (Parroquias)
CREATE TABLE IF NOT EXISTS parroquias (
  id_parroquia int(11) NOT NULL AUTO_INCREMENT,
  id_municipio int(11) NOT NULL,
  parroquia varchar(250) NOT NULL,
  PRIMARY KEY (id_parroquia),
  KEY id_municipio (id_municipio),
  CONSTRAINT fk_parroquia_municipio FOREIGN KEY (id_municipio) REFERENCES municipios (id_municipio) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- 4. Statistical Data (Supporting Isometric Visualization)
CREATE TABLE IF NOT EXISTS parroquia_stats (
    id_stat int(11) NOT NULL AUTO_INCREMENT,
    id_parroquia int(11) NOT NULL,
    poblacion int(11) DEFAULT 0,
    area_km2 decimal(10,2) DEFAULT 0,
    densidad decimal(10,2) DEFAULT 0,
    datos_extra json DEFAULT NULL, -- For flexible video-game style metadata (colors, icons)
    level_height int(11) DEFAULT 100, -- Height factor for 3D extrusion
    PRIMARY KEY (id_stat),
    UNIQUE KEY (id_parroquia),
    CONSTRAINT fk_stats_parroquia FOREIGN KEY (id_parroquia) REFERENCES parroquias (id_parroquia) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- 5. Cities (Ciudades) - Optional for map labels
CREATE TABLE IF NOT EXISTS ciudades (
  id_ciudad int(11) NOT NULL AUTO_INCREMENT,
  id_estado int(11) NOT NULL,
  ciudad varchar(200) NOT NULL,
  capital tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (id_ciudad),
  KEY id_estado (id_estado),
  CONSTRAINT fk_ciudad_estado FOREIGN KEY (id_estado) REFERENCES estados (id_estado) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
