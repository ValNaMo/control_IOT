document.addEventListener('DOMContentLoaded', () => {
    const API_URL = 'http://44.192.129.193:5000/api/devices';
    const historial = document.getElementById('historial');
    const estadoMovimiento = document.getElementById('estadoMovimiento');
    const btnGenerarRutina = document.getElementById('btnGenerarRutina'); // Nuevo botón
    const actionButtons = document.querySelectorAll('[data-action]'); // Botones de acción individual

    let ipGlobal = null;

    const obtenerIP = async () => {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            if (!response.ok) {
                throw new Error('Error al obtener la IP');
            }
            const data = await response.json();
            ipGlobal = data.ip;
            console.log('IP obtenida:', ipGlobal);
        } catch (error) {
            console.error('Falló la obtención de IP:', error);
            ipGlobal = '192.168.1.100'; // Valor por defecto
            console.log('Usando IP por defecto:', ipGlobal);
        }
    };

    // Ejecutar al cargar la aplicación para obtener la IP
    // Hacemos que la obtención inicial de IP sea algo que podamos esperar si es necesario.
    const inicializarApp = async () => {
        await obtenerIP();
        // Aquí podrías habilitar botones o hacer otras inicializaciones que dependan de la IP
    };
    
    inicializarApp(); // Llama para obtener la IP al inicio.

    const estados = {
        'AVANZAR': 'AVANZANDO',
        'RETROCEDER': 'RETROCEDIENDO',
        'VUE_ADE_IZQ': 'GIRANDO ADELANTE IZQUIERDA',
        'VUE_ADE_DER': 'GIRANDO ADELANTE DERECHA',
        'VUE_ATR_IZQ': 'GIRANDO ATRÁS IZQUIERDA',
        'VUE_ATR_DER': 'GIRANDO ATRÁS DERECHA',
        'GIRO_90_IZQ': 'GIRO 90° IZQUIERDA',
        'GIRO_90_DER': 'GIRO 90° DERECHA',
        'GIRO_360_IZQ': 'GIRO 360° IZQUIERDA',
        'GIRO_360_DER': 'GIRO 360° DERECHA',
        'DETENER': 'DETENIDO'
    };

    // Tiempos de espera en JS después de enviar un comando, antes de enviar el siguiente en una rutina.
    const JS_WAIT_TIMES = {
        'AVANZAR': 1500,
        'RETROCEDER': 1500,
        'VUE_ADE_IZQ': 2500 + 500 + 200, // 3200
        'VUE_ADE_DER': 2000 + 500 + 200, // 2700
        'VUE_ATR_IZQ': 1500 + 500 + 200, // 2200
        'VUE_ATR_DER': 1500 + 500 + 200, // 2200
        'GIRO_90_IZQ': 900 + 500 + 200,  // 1600
        'GIRO_90_DER': 900 + 500 + 200,  // 1600
        'GIRO_360_IZQ': 2650 + 500 + 200,// 3350
        'GIRO_360_DER': 2620 + 500 + 200,// 3320
        'DETENER': 100 + 500 + 200       // 800
    };

    const requestOptionsBase = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    };

    // Función para pausar la ejecución
    const pause = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Función refactorizada para enviar una acción y actualizar UI
    async function enviarAccion(action, esRutina = false) {
        if (!ipGlobal) { // Si por alguna razón la IP no se obtuvo al inicio
            console.warn('IP no disponible. Intentando obtenerla de nuevo...');
            await obtenerIP();
            if (!ipGlobal) {
                estadoMovimiento.textContent = 'ERROR IP';
                const errorEntry = document.createElement('div');
                errorEntry.className = 'text-danger fw-bold';
                errorEntry.textContent = `❌ ${new Date().toLocaleTimeString()}: FALLO CRÍTICO AL OBTENER IP. ACCIÓN "${action}" NO ENVIADA.`;
                historial.prepend(errorEntry);
                return false; // Indicar fallo
            }
        }

        estadoMovimiento.textContent = estados[action] || 'EJECUTANDO...';
        try {
            const response = await fetch(API_URL, {
                ...requestOptionsBase,
                body: JSON.stringify({
                    name: "Valeria NaMo",
                    ip: ipGlobal,
                    status: action
                })
            });

            if (!response.ok) {
                throw new Error(`Error en la petición API (${response.status})`);
            }
            
            // const responseData = await response.json(); // Si la API devolviera JSON útil
            // console.log('Respuesta API:', responseData);

            const entry = document.createElement('div');
            entry.className = 'text-success';
            entry.innerHTML = `✅ ${new Date().toLocaleTimeString()}: ${estados[action]}${esRutina ? ' (Rutina)' : ''}`;
            historial.prepend(entry);
            
            // Mantener máximo N entradas en el historial (aumentado a 15 para rutinas)
            const MAX_HISTORIAL_ENTRIES = 15;
            if (historial.children.length > MAX_HISTORIAL_ENTRIES) {
                 // Eliminar el mensaje inicial "Presione algún botón..." si aún está y hay más de N entradas
                const initialMessage = Array.from(historial.children).find(child => child.classList.contains('text-muted'));
                if (initialMessage && historial.children.length > MAX_HISTORIAL_ENTRIES) {
                    initialMessage.remove();
                }
                // Luego eliminar el más antiguo si todavía excede
                if (historial.children.length > MAX_HISTORIAL_ENTRIES) {
                    historial.lastChild.remove();
                }
            }
            // Eliminar el mensaje "Presione algún botón..." si es el único que queda y se añade uno nuevo.
            if (historial.children.length > 1 && historial.lastChild.classList.contains('text-muted')) {
                historial.lastChild.remove();
            }


            return true; // Éxito

        } catch (error) {
            console.error('Error al enviar acción:', error);
            estadoMovimiento.textContent = 'ERROR';
            const errorEntry = document.createElement('div');
            errorEntry.className = 'text-danger fw-bold';
            errorEntry.textContent = `❌ ${new Date().toLocaleTimeString()}: ${action} - ${error.message}`;
            historial.prepend(errorEntry);
            return false; // Fallo
        }
    }

    // Event listeners para botones de acción individual
    actionButtons.forEach(button => {
        button.addEventListener('click', async () => {
            const action = button.dataset.action;
            button.disabled = true; // Deshabilitar botón momentáneamente
            await enviarAccion(action, false);
            button.disabled = false; // Rehabilitar botón
        });
    });

    // Lógica para el botón de generar rutina
    if (btnGenerarRutina) {
        btnGenerarRutina.addEventListener('click', async () => {
            // Deshabilitar todos los botones de control durante la rutina
            btnGenerarRutina.disabled = true;
            actionButtons.forEach(btn => btn.disabled = true);

            const statusOriginal = estadoMovimiento.textContent;
            estadoMovimiento.textContent = 'INICIANDO RUTINA...';
            const rutinaEntry = document.createElement('div');
            rutinaEntry.className = 'text-info fw-bold';
            rutinaEntry.innerHTML = `🏁 ${new Date().toLocaleTimeString()}: Rutina aleatoria iniciada.`;
            historial.prepend(rutinaEntry);


            const posiblesAcciones = Object.keys(estados); // Todas las acciones definidas
            const NUM_MOVIMIENTOS_RUTINA = 10;

            for (let i = 0; i < NUM_MOVIMIENTOS_RUTINA; i++) {
                const randomAction = posiblesAcciones[Math.floor(Math.random() * posiblesAcciones.length)];
                
                // Mostrar qué acción se va a ejecutar
                const pasoRutinaEntry = document.createElement('div');
                pasoRutinaEntry.className = 'text-muted';
                pasoRutinaEntry.innerHTML = `➡️ ${new Date().toLocaleTimeString()}: Rutina paso ${i + 1}/${NUM_MOVIMIENTOS_RUTINA}: ${estados[randomAction]}`;
                historial.prepend(pasoRutinaEntry);


                const exitoPaso = await enviarAccion(randomAction, true);
                if (!exitoPaso) {
                    estadoMovimiento.textContent = 'ERROR EN RUTINA';
                    const errorRutinaEntry = document.createElement('div');
                    errorRutinaEntry.className = 'text-danger fw-bold';
                    errorRutinaEntry.innerHTML = `❌ ${new Date().toLocaleTimeString()}: Rutina interrumpida por error en acción "${randomAction}".`;
                    historial.prepend(errorRutinaEntry);
                    break; // Interrumpir rutina si un paso falla
                }
                
                const tiempoEspera = JS_WAIT_TIMES[randomAction] || 1000; // Tiempo de espera por defecto si no está definido
                await pause(tiempoEspera);
            }
            
            // Pequeña pausa final y luego DETENER como buena medida, a menos que la última acción ya fuera DETENER.
            // Opcional: if (ultimaAccionDeRutina !== 'DETENER') { await enviarAccion('DETENER', true); await pause(JS_WAIT_TIMES['DETENER']); }


            const rutinaFinEntry = document.createElement('div');
            rutinaFinEntry.className = 'text-info fw-bold';
            rutinaFinEntry.innerHTML = `🏁 ${new Date().toLocaleTimeString()}: Rutina completada.`;
            historial.prepend(rutinaFinEntry);
            estadoMovimiento.textContent = 'RUTINA FINALIZADA'; // O volver al estado original si es 'INACTIVO'

            // Rehabilitar botones
            btnGenerarRutina.disabled = false;
            actionButtons.forEach(btn => btn.disabled = false);
        });
    }
});