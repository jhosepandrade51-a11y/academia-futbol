const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const app = express();
app.use(cors());
app.use(express.json());

let db;

(async () => {
    db = await open({
        filename: './academia.db',
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS alumnos (
            dni TEXT PRIMARY KEY,
            nombre TEXT NOT NULL,
            apellido TEXT NOT NULL,
            cuota_al_dia INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS asistencias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            dni_alumno TEXT,
            fecha_hora TEXT
        );
    `);
})();

// 1. Marcar Asistencia por DNI
app.post('/api/asistencia', async (req, res) => {
    const { dni } = req.body;

    try {
        const alumno = await db.get('SELECT * FROM alumnos WHERE dni = ?', [dni]);

        if (!alumno) {
            return res.status(404).json({ error: "El DNI no pertenece a ningún alumno registrado." });
        }

        if (alumno.cuota_al_dia === 0) {
            return res.status(403).json({ 
                error: `Acceso Denegado: ${alumno.nombre} ${alumno.apellido} tiene pagos pendientes.` 
            });
        }

        const fechaHora = new Date().toLocaleString();
        await db.run('INSERT INTO asistencias (dni_alumno, fecha_hora) VALUES (?, ?)', [dni, fechaHora]);

        return res.json({ 
            mensaje: `¡Bienvenido ${alumno.nombre} ${alumno.apellido}! Entrada registrada.` 
        });
    } catch (err) {
        return res.status(500).json({ error: "Error en el servidor al procesar asistencia." });
    }
});

// 2. Obtener la lista de todos los alumnos
app.get('/api/alumnos', async (req, res) => {
    try {
        const alumnos = await db.all('SELECT * FROM alumnos');
        res.json(alumnos);
    } catch (err) {
        res.status(500).json({ error: "Error al obtener la lista de alumnos." });
    }
});

// 3. Registrar un nuevo alumno
app.post('/api/alumnos', async (req, res) => {
    const { dni, nombre, apellido } = req.body;

    if (!dni || !nombre || !apellido) {
        return res.status(400).json({ error: "Todos los campos son obligatorios." });
    }

    try {
        const existe = await db.get('SELECT * FROM alumnos WHERE dni = ?', [dni]);
        if (existe) {
            return res.status(400).json({ error: "El DNI ya se encuentra registrado." });
        }

        await db.run(
            'INSERT INTO alumnos (dni, nombre, apellido, cuota_al_dia) VALUES (?, ?, ?, 1)',
            [dni, nombre, apellido]
        );
        res.json({ mensaje: "Alumno registrado exitosamente." });
    } catch (err) {
        res.status(500).json({ error: "Error al guardar el alumno." });
    }
});

// 4. Cambiar estado de pago de un alumno
app.put('/api/alumnos/:dni/pago', async (req, res) => {
    const { dni } = req.params;
    const { cuota_al_dia } = req.body;

    try {
        await db.run('UPDATE alumnos SET cuota_al_dia = ? WHERE dni = ?', [cuota_al_dia, dni]);
        res.json({ mensaje: "Estado de pago actualizado." });
    } catch (err) {
        res.status(500).json({ error: "Error al actualizar el estado de pago." });
    }
});

// 5. NUEVO: Obtener reporte de asistencias con nombres de los alumnos
app.get('/api/asistencias', async (req, res) => {
    try {
        const reporte = await db.all(`
            SELECT 
                asistencias.id,
                asistencias.dni_alumno,
                alumnos.nombre,
                alumnos.apellido,
                asistencias.fecha_hora
            FROM asistencias
            JOIN alumnos ON asistencias.dni_alumno = alumnos.dni
            ORDER BY asistencias.id DESC
        `);
        res.json(reporte);
    } catch (err) {
        res.status(500).json({ error: "Error al obtener el historial de asistencias." });
    }
});

app.listen(3000, () => {
    console.log('Servidor corriendo en: http://localhost:3000');
});