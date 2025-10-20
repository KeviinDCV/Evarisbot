-- Script para crear la base de datos Evarisbot
-- Ejecutar en phpMyAdmin o desde línea de comandos MySQL

CREATE DATABASE IF NOT EXISTS `evarisbot` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

-- Seleccionar la base de datos
USE `evarisbot`;

-- Mensaje de confirmación
SELECT 'Base de datos evarisbot creada exitosamente' AS mensaje;
