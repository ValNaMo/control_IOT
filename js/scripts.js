document.addEventListener('DOMContentLoaded', () => {
    const API_URL = 'http://44.193.200.137:5000/api/devices'; // Tu URL de API
    const historial = document.getElementById('historial');
    const estadoMovimiento = document.getElementById('estadoMovimiento');
    const actionButtons = document.querySelectorAll('[data-action]');
    const btnGenerarRutina = document.getElementById('btnGenerarRutina');

    // --- Consoles de Depuración Inicial ---
    console.log("Script cargado y DOM listo.");
    console.log("Elemento estadoMovimiento:", estadoMovimiento);
    console.log("Botones de acción encontrados:", actionButtons);
    console.log("Botón de rutina (btnGenerarRutina):", btnGenerarRutina);

    if (actionButtons.length === 0 && !btnGenerarRutina) {
        console.error("¡ADVERTENCIA: No se encontraron botones con 'data-action' ni el botón de rutina 'btnGenerarRutina'!");
    }
    if (!historial) console.error("Elemento 'historial' no encontrado.");
    if (!estadoMovimiento) console.error("Elemento 'estadoMovimiento' no encontrado.");
    // --- Fin Consoles de Depuración Inicial ---

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
            ipGlobal = '192.168.1.100'; // Valor por defecto como fallback
            console.log('Usando IP por defecto:', ipGlobal);
        }
    };
    
    obtenerIP(); // Llamar para obtener la IP al inicio

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
    console.log("Objeto estados definido:", estados);

    const requestOptionsBase = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    };

    // Tiempos de espera en JS para la rutina (versión con mayor margen para latencia)
    const JS_WAIT_TIMES_RUTINA = {
        'AVANZAR': 2000,
        'RETROCEDER': 2000,
        'VUE_ADE_IZQ': 2500 + 500 + 700, // 3700
        'VUE_ADE_DER': 2000 + 500 + 700, // 3200
        'VUE_ATR_IZQ': 1500 + 500 + 700, // 2700
        'VUE_ATR_DER': 1500 + 500 + 700, // 2700
        'GIRO_90_IZQ': 900 + 500 + 700,  // 2100
        'GIRO_90_DER': 900 + 500 + 700,  // 2100
        'GIRO_360_IZQ': 2650 + 500 + 700,// 3850
        'GIRO_360_DER': 2620 + 500 + 700,// 3820
        'DETENER': 100 + 500 + 700       // 1300
    };
    console.log("Tiempos de espera para rutina (con mayor margen):", JS_WAIT_TIMES_RUTINA);

    const pause = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    async function enviarAccion(action, customLogMessage = null) {
        console.log(`Función enviarAccion llamada con: ${action}, IP: ${ipGlobal}`);

        if (!ipGlobal) {
            console.warn('IP no disponible en enviarAccion. Reintentando obtenerIP...');
            await obtenerIP();
            if (!ipGlobal) {
                console.error("FALLO CRÍTICO AL OBTENER IP. ACCIÓN NO ENVIADA.");
                if(estadoMovimiento) estadoMovimiento.textContent = 'ERROR IP';
                // Aquí podrías añadir al historial también si lo deseas
                return false;
            }
        }
        
        if (estadoMovimiento) {
            estadoMovimiento.textContent = estados[action] || 'EJECUTANDO...';
        } else {
            console.error("El elemento 'estadoMovimiento' es null. No se puede actualizar el texto de estado.");
            return false; 
        }

        try {
            const payload = {
                name: "Valeria NaMo", // Puedes cambiar este nombre si quieres
                ip: ipGlobal,
                status: action
                // Cuando integres el control de velocidad, añadirías:
                // speed: currentSpeedPercent 
            };
            console.log("Enviando payload a API:", payload);

            const response = await fetch(API_URL, {
                ...requestOptionsBase,
                body: JSON.stringify(payload)
            });
            console.log(`Respuesta fetch para ${action} - status: ${response.status}`);

            if (!response.ok) {
                throw new Error(`Error en la petición API (${response.status}) para la acción ${action}`);
            }
            
            if (historial) {
                const entry = document.createElement('div');
                entry.className = 'text-success';
                const logText = customLogMessage || `✅ ${new Date().toLocaleTimeString()}: ${estados[action]}`;
                entry.innerHTML = logText;

                const initialMessage = Array.from(historial.children).find(child => child.classList.contains('text-muted') && child.textContent.includes('Presione algún botón'));
                if (initialMessage) {
                    initialMessage.remove();
                }
                historial.prepend(entry);
                const MAX_HISTORIAL_ENTRIES = 25; // Aumentado para ver más pasos de la rutina
                while (historial.children.length > MAX_HISTORIAL_ENTRIES) {
                    historial.lastChild.remove();
                }
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

    // Event listeners para botones de acción individual
    if (actionButtons.length > 0) {
        actionButtons.forEach(button => {
            button.addEventListener('click', async () => {
                const action = button.dataset.action;
                console.log(`Clic en botón individual. Acción: ${action}`);
                button.disabled = true;
                await enviarAccion(action); // Usa el mensaje de log por defecto de enviarAccion
                button.disabled = false;
            });
        });
    }

    // Lógica para el botón de generar rutina
    if (btnGenerarRutina) {
        btnGenerarRutina.addEventListener('click', async () => {
            console.log("Clic en botón Generar Rutina (con paradas intermedias)");
            btnGenerarRutina.disabled = true;
            actionButtons.forEach(btn => btn.disabled = true);

            if (estadoMovimiento) estadoMovimiento.textContent = 'INICIANDO RUTINA CON PARADAS...';
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
                let randomAction;
                if (posiblesAccionesPrincipales.length > 0) {
                    randomAction = posiblesAccionesPrincipales[Math.floor(Math.random() * posiblesAccionesPrincipales.length)];
                } else {
                    console.warn("No hay acciones principales disponibles para la rutina, usando AVANZAR por defecto.");
                    randomAction = 'AVANZAR'; // Fallback
                }

                console.log(`Rutina - Paso ${i + 1}: Ejecutando ${randomAction}`);
                if (historial) {
                    const pasoRutinaEntry = document.createElement('div');
                    pasoRutinaEntry.className = 'text-muted fst-italic';
                    pasoRutinaEntry.innerHTML = `➡️ Rutina paso ${i + 1}/${NUM_MOVIMIENTOS_RUTINA}: Preparando ${estados[randomAction]}`;
                    historial.prepend(pasoRutinaEntry);
                }
                
                const logMessageAccion = `✅ ${new Date().toLocaleTimeString()}: ${estados[randomAction]} (Rutina ${i+1}/${NUM_MOVIMIENTOS_RUTINA})`;
                const exitoAccion = await enviarAccion(randomAction, logMessageAccion);
                
                if (!exitoAccion) {
                    rutinaInterrumpida = true;
                    break; 
                }
                
                const tiempoEsperaAccion = JS_WAIT_TIMES_RUTINA[randomAction] || 1700;
                console.log(`Rutina - Esperando ${tiempoEsperaAccion}ms después de ${randomAction}`);
                await pause(tiempoEsperaAccion);

                // PARADA INTERMEDIA (si no es el último movimiento principal)
                if (i < NUM_MOVIMIENTOS_RUTINA - 1) {
                    console.log(`Rutina - Parada Intermedia ${i + 1}: Enviando DETENER.`);
                    if (estadoMovimiento) estadoMovimiento.textContent = 'PARADA INTERMEDIA...';
                    
                    const logMessageStopIntermedio = `✅ ${new Date().toLocaleTimeString()}: ${estados['DETENER']} (Parada Intermedia ${i+1})`;
                    const exitoStopIntermedio = await enviarAccion('DETENER', logMessageStopIntermedio);

                    if (!exitoStopIntermedio) {
                        rutinaInterrumpida = true;
                        break;
                    }
                    await pause(JS_WAIT_TIMES_RUTINA['DETENER']);
                }
            } // Fin del bucle FOR
            
            // DETENER FINAL DE LA RUTINA
            if (!rutinaInterrumpida) {
                console.log("Rutina completada (pasos principales). Enviando comando DETENER final.");
                if(estadoMovimiento) estadoMovimiento.textContent = 'FINALIZANDO RUTINA...';
                
                const logFinalStop = `✅ ${new Date().toLocaleTimeString()}: ${estados['DETENER']} (Fin de Rutina)`;
                await enviarAccion('DETENER', logFinalStop);
                await pause(JS_WAIT_TIMES_RUTINA['DETENER']); 
                
                if(estadoMovimiento) estadoMovimiento.textContent = 'RUTINA FINALIZADA';
                if (historial) {
                    const rutinaEndEntry = document.createElement('div');
                    rutinaEndEntry.className = 'text-info fw-bold';
                    rutinaEndEntry.innerHTML = `🏁 ${new Date().toLocaleTimeString()}: Rutina completada y vehículo detenido.`;
                    historial.prepend(rutinaEndEntry);
                }
            } else {
                console.log("Rutina interrumpida debido a un error.");
                 if(estadoMovimiento && estadoMovimiento.textContent !== 'ERROR IP' && !estadoMovimiento.textContent.includes('ERROR')) { // No sobrescribir el error específico
                    estadoMovimiento.textContent = 'RUTINA INTERRUMPIDA';
                }
            }

            btnGenerarRutina.disabled = false;
            actionButtons.forEach(btn => btn.disabled = false);
            console.log("Botones rehabilitados.");
        });
    } else {
        console.warn("Botón de generar rutina (btnGenerarRutina) no encontrado en el DOM. La funcionalidad de rutina no estará disponible.");
    }
});
