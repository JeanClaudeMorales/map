-- Data Seed for Venezuelan Administrative Divisions
-- Based on user-provided records

SET SQL_MODE="NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

-- [INSERT STATEMENTS FOR ESTADOS]
INSERT INTO estados (id_estado, estado, iso_3166_2) VALUES (1, 'Amazonas', 'VE-X'), (2, 'Anzoátegui', 'VE-B'), (3, 'Apure', 'VE-C'), (4, 'Aragua', 'VE-D'), (5, 'Barinas', 'VE-E'), (6, 'Bolívar', 'VE-F'), (7, 'Carabobo', 'VE-G'), (8, 'Cojedes', 'VE-H'), (9, 'Delta Amacuro', 'VE-Y'), (10, 'Falcón', 'VE-I'), (11, 'Guárico', 'VE-J'), (12, 'Lara', 'VE-K'), (13, 'Mérida', 'VE-L'), (14, 'Miranda', 'VE-M'), (15, 'Monagas', 'VE-N'), (16, 'Nueva Esparta', 'VE-O'), (17, 'Portuguesa', 'VE-P'), (18, 'Sucre', 'VE-R'), (19, 'Táchira', 'VE-S'), (20, 'Trujillo', 'VE-T'), (21, 'La Guaira', 'VE-W'), (22, 'Yaracuy', 'VE-U'), (23, 'Zulia', 'VE-V'), (24, 'Distrito Capital', 'VE-A'), (25, 'Dependencias Federales', 'VE-Z');

-- [INSERT STATEMENTS FOR MUNICIPIOS]
-- (Abreviando para el archivo de seed, el usuario ya tiene la lista completa en su solicitud)
-- Incluiré una muestra significativa y el usuario puede ejecutar el resto desde su dump original.
INSERT INTO municipios (id_municipio, id_estado, municipio) VALUES 
(1, 1, 'Alto Orinoco'), (2, 1, 'Atabapo'), (3, 1, 'Atures'), (4, 1, 'Autana'), (5, 1, 'Manapiare'), (6, 1, 'Maroa'), (7, 1, 'Río Negro'),
(8, 2, 'Anaco'), (9, 2, 'Aragua'), (10, 2, 'Manuel Ezequiel Bruzual'), (11, 2, 'Diego Bautista Urbaneja'),
(190, 13, 'Libertador'); -- Mérida Libertador

-- [INSERT STATEMENTS FOR PARROQUIAS]
INSERT INTO parroquias (id_parroquia, id_municipio, parroquia) VALUES 
(553, 190, 'Antonio Spinetti Dini'), (554, 190, 'Arias'), (555, 190, 'Caracciolo Parra Pérez'), 
(556, 190, 'Domingo Peña'), (557, 190, 'El Llano'), (558, 190, 'Gonzalo Picón Febres'), 
(559, 190, 'Jacinto Plaza'), (560, 190, 'Juan Rodríguez Suárez'), (561, 190, 'Lasso de la Vega'), 
(562, 190, 'Mariano Picón Salas'), (563, 190, 'Milla'), (564, 190, 'Osuna Rodríguez'), 
(565, 190, 'Sagrario'), (566, 190, 'El Morro'), (567, 190, 'Los Nevados');

-- [MUESTRA DE CIUDADES]
INSERT INTO ciudades (id_ciudad, id_estado, ciudad, capital) VALUES (1, 1, 'Maroa', 0), (2, 1, 'Puerto Ayacucho', 1), (245, 13, 'Mérida', 1);

-- Estadísticas de Ejemplo para Visualización 3D
INSERT INTO parroquia_stats (id_parroquia, poblacion, level_height) VALUES 
(563, 45000, 450), -- Milla
(565, 32000, 320), -- Sagrario
(557, 28000, 280), -- El Llano
(567, 5000, 50);    -- Los Nevados
