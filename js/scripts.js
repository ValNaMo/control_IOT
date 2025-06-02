document.addEventListener('DOMContentLoaded', () => {
    const API_URL_DEVICES = 'http://44.193.200.137:5000/api/devices'; // Para acciones
    const API_URL_SPEED = 'http://44.193.200.137:5000/api/speed';   // Para velocidad

    const historial = document.getElementById('historial');
    const estadoMovimiento = document.getElementById('estadoMovimiento');
    const actionButtons = document.querySelectorAll('[data-action]');
    const btnGenerarRutina = document.getElementById('btnGenerarRutina');

    // Nuevos elementos para el control de velocidad
    const speedControlSlider = document.getElementById('speedControlSlider');
    const speedValueDisplay = document.getElementById('speedValueDisplay');
    let currentSpeedPercent = 75; // Valor inicial, debería coincidir con el 'value' del slider

    console.log("Script cargado y DOM listo.");
    // (Puedes mantener tus otros console.log de depuración inicial si lo deseas)

    let ipGlobal = null;

    const obtenerIP = async () => {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            if (!response.ok) throw new Error('Error al obtener la IP');
            const data = await response.json();
            ipGlobal = data.ip;
            console.log('IP obtenida:', ipGlobal);
        } catch (error) {
            console.error('Falló la obtención de IP:', error);
            ipGlobal = '192.168.1.100';
            console.log('Usando IP por defecto:', ipGlobal);
        }
    };
    
    obtenerIP();

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

    const requestOptionsBase = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    };

    // Tiempos de espera para la rutina (los últimos que ajustamos)
    const JS_WAIT_TIMES_RUTINA = {
        'AVANZAR': 2000, 'RETROCEDER': 2000,
        'VUE_ADE_IZQ': 3700, 'VUE_ADE_DER': 3200,
        'VUE_ATR_IZQ': 2700, 'VUE_ATR_DER': 2700,
        'GIRO_90_IZQ': 2100, 'GIRO_90_DER': 2100,
        'GIRO_360_IZQ': 3850, 'GIRO_360_DER': 3820,
        'DETENER': 1300
    };

    const pause = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // --- Lógica para el Deslizador de Velocidad ---
    if (speedControlSlider && speedValueDisplay) {
        currentSpeedPercent = parseInt(speedControlSlider.value); // Sincronizar con el valor inicial del HTML
        speedValueDisplay.textContent = `${currentSpeedPercent}%`; // Mostrar valor inicial

        speedControlSlider.addEventListener('input', () => {
            currentSpeedPercent = parseInt(speedControlSlider.value);
            speedValueDisplay.textContent = `${currentSpeedPercent}%`;
            // Opcional: Podrías añadir un pequeño debounce aquí si envías la velocidad muy frecuentemente
        });

        // Enviar la velocidad al servidor cuando el usuario suelta el deslizador (mouseup)
        // o cuando cambia significativamente (change event, que es similar a mouseup para sliders)
        speedControlSlider.addEventListener('change', async () => {
            console.log(`Slider 'change' event. Nueva velocidad a enviar: ${currentSpeedPercent}%`);
            await enviarNuevaVelocidad(currentSpeedPercent);
        });
    } else {
        console.warn("Elementos del slider de velocidad no encontrados. El control de velocidad no funcionará.");
    }

    async function enviarNuevaVelocidad(velocidad) {
        if (!ipGlobal) { // Aunque la IP no se usa directamente para el endpoint de velocidad, es bueno tenerla.
            console.warn('IP no disponible al intentar enviar velocidad. Reintentando obtenerIP...');
            await obtenerIP();
            if (!ipGlobal) {
                console.error("FALLO CRÍTICO AL OBTENER IP. No se puede asegurar la identidad para enviar velocidad.");
                // Podrías mostrar un error en la UI si lo deseas
                return false;
            }
        }
        console.log(`Enviando velocidad: ${velocidad}% a ${API_URL_SPEED}`);
        try {
            const response = await fetch(API_URL_SPEED, {
                ...requestOptionsBase, // method: 'POST', headers
                body: JSON.stringify({ speed_value: velocidad })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({})); // Intenta parsear error JSON
                console.error(`Error al enviar velocidad (${response.status}):`, errorData.error || response.statusText);
                if (historial) {
                    const entry = document.createElement('div');
                    entry.className = 'text-warning'; // Usar warning para errores de ajuste de velocidad
                    entry.innerHTML = `⚠️ ${new Date().toLocaleTimeString()}: Error al ajustar velocidad (${velocidad}%). Servidor: ${errorData.error || response.statusText}`;
                    historial.prepend(entry);
                }
                return false;
            }
            
            const responseData = await response.json();
            console.log("Respuesta del servidor al enviar velocidad:", responseData);
            if (historial) {
                const entry = document.createElement('div');
                entry.className = 'text-muted'; // O text-info
                entry.innerHTML = `⚙️ ${new Date().toLocaleTimeString()}: Velocidad ajustada a ${velocidad}%.`;
                historial.prepend(entry);
            }
            return true;
        } catch (error) {
            console.error("Excepción al enviar velocidad:", error);
            if (historial) {
                const entry = document.createElement('div');
                entry.className = 'text-warning';
                entry.innerHTML = `⚠️ ${new Date().toLocaleTimeString()}: Excepción al ajustar velocidad (${velocidad}%). ${error.message}`;
                historial.prepend(entry);
            }
            return false;
        }
    }

    // --- Función para Enviar Acciones (Movimientos) ---
    // Esta función YA NO ENVÍA LA VELOCIDAD. El ESP8266 la obtendrá de /api/speed/last
    async function enviarAccion(action, customLogMessage = null) {
        console.log(`Función enviarAccion llamada con: ${action}, IP: ${ipGlobal}`);

        if (!ipGlobal) {
            console.warn('IP no disponible en enviarAccion. Reintentando obtenerIP...');
            await obtenerIP();
            if (!ipGlobal) {
                console.error("FALLO CRÍTICO AL OBTENER IP. ACCIÓN NO ENVIADA.");
                if(estadoMovimiento) estadoMovimiento.textContent = 'ERROR IP';
                return false;
            }
        }
        
        if (estadoMovimiento) {
            estadoMovimiento.textContent = estados[action] || 'EJECUTANDO...';
        } else {
            console.error("El elemento 'estadoMovimiento' es null.");
            return false; 
        }

        try {
            const payload = {
                name: "Valeria NaMo", // O el nombre que desees
                ip: ipGlobal,
                status: action
                // NOTA: 'speed' ya no se envía aquí.
            };
            console.log("Enviando payload de ACCIÓN a API:", payload);

            const response = await fetch(API_URL_DEVICES, { // Usar API_URL_DEVICES
                ...requestOptionsBase,
                body: JSON.stringify(payload)
            });
            console.log(`Respuesta fetch para ACCIÓN ${action} - status: ${response.status}`);

            if (!response.ok) {
                throw new Error(`Error en la petición API de acción (${response.status}) para ${action}`);
            }
            
            if (historial) {
                const entry = document.createElement('div');
                entry.className = 'text-success';
                const logText = customLogMessage || `✅ ${new Date().toLocaleTimeString()}: ${estados[action]}`;
                entry.innerHTML = logText;
                // (Lógica para limpiar mensaje inicial y limitar historial)
                const initialMessage = Array.from(historial.children).find(child => child.classList.contains('text-muted') && child.textContent.includes('Presione algún botón'));
                if (initialMessage) initialMessage.remove();
                historial.prepend(entry);
                const MAX_HISTORIAL_ENTRIES = 25;
                while (historial.children.length > MAX_HISTORIAL_ENTRIES) historial.lastChild.remove();
            }
            return true; 
        } catch (error) {
            console.error(`Error en enviarAccion (${action}):`, error);
            if (estadoMovimiento) estadoMovimiento.textContent = 'ERROR';
            if (historial) {
                const errorEntry = document.createElement('div');
                errorEntry.className = 'text-danger fw-bold';
                errorEntry.textContent = `❌ ${new Date().toLocaleTimeString()}: Fallo en ${action} - ${error.message}`;
                historial.prepend(errorEntry);
            }
            return false; 
        }
    }

    // --- Event Listeners para Botones de Acción Individual ---
    if (actionButtons.length > 0) {
        actionButtons.forEach(button => {
            button.addEventListener('click', async () => {
                const action = button.dataset.action;
                console.log(`Clic en botón individual. Acción: ${action}`);
                button.disabled = true;
                await enviarAccion(action);
                button.disabled = false;
            });
        });
    }

    // --- Lógica para el Botón de Generar Rutina (con paradas intermedias) ---
    if (btnGenerarRutina) {
        btnGenerarRutina.addEventListener('click', async () => {
            console.log("Clic en botón Generar Rutina (con paradas intermedias y velocidad independiente)");
            btnGenerarRutina.disabled = true;
            actionButtons.forEach(btn => btn.disabled = true);
            if(speedControlSlider) speedControlSlider.disabled = true; // Deshabilitar slider durante rutina

            if (estadoMovimiento) estadoMovimiento.textContent = 'INICIANDO RUTINA...';
            // (Lógica del historial para inicio de rutina)
            if (historial) {
                const rutinaStartEntry = document.createElement('div');
                rutinaStartEntry.className = 'text-info fw-bold';
                rutinaStartEntry.innerHTML = `🏁 ${new Date().toLocaleTimeString()}: Rutina aleatoria (con paradas) iniciada.`;
                historial.prepend(rutinaStartEntry);
            }


            const posiblesAccionesPrincipales = Object.keys(estados).filter(accion => accion !== 'DETENER');
            const NUM_MOVIMIENTOS_RUTINA = 10;
            let rutinaInterrumpida = false;

            for (let i = 0; i < NUM_MOVIMIENTOS_RUTINA; i++) {
                let randomAction = posiblesAccionesPrincipales.length > 0 ? 
                                   posiblesAccionesPrincipales[Math.floor(Math.random() * posiblesAccionesPrincipales.length)] : 
                                   'AVANZAR'; // Fallback

                console.log(`Rutina - Paso ${i + 1}: Ejecutando ${randomAction}`);
                // (Lógica del historial para cada paso de rutina)
                if (historial) {
                    const pasoRutinaEntry = document.createElement('div');
                    pasoRutinaEntry.className = 'text-muted fst-italic';
                    pasoRutinaEntry.innerHTML = `➡️ Rutina paso ${i + 1}/${NUM_MOVIMIENTOS_RUTINA}: Preparando ${estados[randomAction]}`;
                    historial.prepend(pasoRutinaEntry);
                }
                
                const logMessageAccion = `✅ ${new Date().toLocaleTimeString()}: ${estados[randomAction]} (Rutina ${i+1}/${NUM_MOVIMIENTOS_RUTINA})`;
                const exitoAccion = await enviarAccion(randomAction, logMessageAccion);
                
                if (!exitoAccion) { rutinaInterrumpida = true; break; }
                
                const tiempoEsperaAccion = JS_WAIT_TIMES_RUTINA[randomAction] || 1500;
                await pause(tiempoEsperaAccion);

                if (i < NUM_MOVIMIENTOS_RUTINA - 1) { // Parada intermedia
                    console.log(`Rutina - Parada Intermedia ${i + 1}: Enviando DETENER.`);
                    if (estadoMovimiento) estadoMovimiento.textContent = 'PARADA INTERMEDIA...';
                    
                    const logMessageStopIntermedio = `✅ ${new Date().toLocaleTimeString()}: ${estados['DETENER']} (Parada Intermedia ${i+1})`;
                    const exitoStopIntermedio = await enviarAccion('DETENER', logMessageStopIntermedio);

                    if (!exitoStopIntermedio) { rutinaInterrumpida = true; break; }
                    await pause(JS_WAIT_TIMES_RUTINA['DETENER']);
                }
            }
            
            // Detener final
            if (!rutinaInterrumpida) {
                console.log("Rutina completada (pasos principales). Enviando comando DETENER final.");
                if(estadoMovimiento) estadoMovimiento.textContent = 'FINALIZANDO RUTINA...';
                const logFinalStop = `✅ ${new Date().toLocaleTimeString()}: ${estados['DETENER']} (Fin de Rutina)`;
                await enviarAccion('DETENER', logFinalStop);
                await pause(JS_WAIT_TIMES_RUTINA['DETENER']); 
                if(estadoMovimiento) estadoMovimiento.textContent = 'RUTINA FINALIZADA';
                // (Lógica del historial para fin de rutina)
                if (historial) {
                    const rutinaEndEntry = document.createElement('div');
                    rutinaEndEntry.className = 'text-info fw-bold';
                    rutinaEndEntry.innerHTML = `🏁 ${new Date().toLocaleTimeString()}: Rutina completada y vehículo detenido.`;
                    historial.prepend(rutinaEndEntry);
                }
            } else {
                console.log("Rutina interrumpida debido a un error.");
                if(estadoMovimiento && estadoMovimiento.textContent !== 'ERROR IP' && !estadoMovimiento.textContent.includes('ERROR')) {
                    estadoMovimiento.textContent = 'RUTINA INTERRUMPIDA';
                }
            }

            btnGenerarRutina.disabled = false;
            actionButtons.forEach(btn => btn.disabled = false);
            if(speedControlSlider) speedControlSlider.disabled = false; // Rehabilitar slider
            console.log("Botones y slider rehabilitados.");
        });
    } else {
        console.warn("Botón de generar rutina (btnGenerarRutina) no encontrado.");
    }
});
