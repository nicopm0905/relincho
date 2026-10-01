# Definición de producto de Relincho

## Resumen

**Relincho es el cuaderno de trabajo compartido de una yeguada:** reúne la ficha e historia de cada caballo, los cuidados y tareas que tocan, la reproducción y el trabajo diario del equipo. Debe hacer que dejar papel y Excel sea una transición gradual y reversible, no una migración arriesgada ni una obligación de rellenarlo todo el primer día.

La promesa no es «tener muchos módulos». Es que una persona de la cuadra pueda encontrar el dato correcto, anotarlo una vez y saber qué toca después, desde el móvil o el ordenador.

## Para quién

### Cliente principal

Propietario, encargado o mayoral de una yeguada PRE o picadero, inicialmente en Andalucía. Gestiona varios caballos y coordina tareas con personal, veterinario, herrador, clientes o propietarios externos. Esta descripción es el segmento objetivo del proyecto; falta validarla con observación de uso en fincas reales.

### Personas que usan el producto

- **Propietario/encargado:** necesita tener control de la operación, compartir el trabajo y no perder historial cuando cambia quien lo apunta.
- **Personal de cuadra:** registra tareas breves mientras trabaja, a menudo desde el móvil y con poco tiempo; necesita acciones claras y pocos campos obligatorios.
- **Veterinario o propietario externo:** necesita acceder a la información pertinente de los caballos que tiene asignados, no a toda la yeguada.
- **Gestoría:** necesita exportaciones legibles en Excel para seguir usando sus procesos sin volver a copiar los datos a mano.

Son perfiles de diseño a validar, no testimonios atribuidos a personas concretas.

## Trabajos que Relincho debe resolver

1. **Saber qué caballo es y dónde está:** ficha, identificación, ubicación, genealogía y propietario.
2. **Conservar una historia fiable:** sanidad, documentos y movimientos enlazados al caballo.
3. **No olvidar lo que vence:** recordatorios, tareas y una lista priorizada de lo que requiere atención.
4. **Coordinar la temporada reproductiva y el entrenamiento** cuando sean relevantes para esa explotación, sin imponer esos módulos a todos.
5. **Pasar del cuaderno disperso al registro compartido:** importar lo que ya existe, revisar antes de confirmar y poder sacar los datos después.

## Alcance actual comprobable

El repositorio implementa fichas y alta/importación Excel de caballos; sanidad y libro de tratamientos; documentos privados; tareas, calendario y avisos; reproducción; rendimiento, periodización y nutrición; movimientos; contactos; pupilaje y facturación; roles y acceso a caballos; portal externo; una demo pública de solo lectura. El alcance y disponibilidad comercial de cada módulo o integración debe comunicarse por separado: que exista código no significa que esté habilitado para cada plan ni que una integración legal esté operativa.

La entrada Excel ofrece vista previa y confirmación, y ya admite varias cabeceras habituales además de la plantilla propia. La exportación CSV de caballos devuelve los datos principales de ficha. No hay evidencia en el repositorio de importación general de historiales sanitarios desde hojas arbitrarias ni de exportación completa de todos los módulos.

## Principios de producto

- **Primero el caballo, luego el módulo:** cada registro importante debe poder entenderse desde la ficha e historial del caballo.
- **Captura mínima y progresiva:** pedir al principio solo lo necesario; completar datos conforme se trabaja.
- **Acciones de cuadra antes que configuración:** priorizar registrar, consultar y completar tareas por encima de paneles cargados de métricas.
- **Seguro y reversible:** vista previa antes de importar; permisos mínimos; datos exportables; ninguna escritura desde la demo.
- **Diseñado para móvil, no solo adaptable:** controles táctiles cómodos, lectura rápida y formularios utilizables en condiciones de trabajo.
- **Sin falsas promesas:** no presentar funciones futuras como disponibles; el software ayuda a organizar información, no sustituye el criterio veterinario, contable o legal.
- **No duplicar el sistema actual sin motivo:** evitar añadir módulos genéricos de ERP/CRM antes de probar que resuelven una tarea frecuente de una yeguada.

## Prioridades

| Prioridad | Resultado buscado | Evidencia actual | Siguiente comprobación |
| --- | --- | --- | --- |
| P0 · Adopción | Importar una lista existente con pocos arreglos y detectar errores antes de crear fichas | Hay una plantilla Excel estricta y una vista previa | Probar con copias anonimizadas de hojas reales; anotar columnas y errores frecuentes |
| P0 · Confianza | Poder exportar y llevarse la información de caballos a Excel | El roadmap ya contempla exportar; había exportación CSV solo para facturas | Comprobar con Excel en español y confirmar que el cliente puede abrir, editar y conservar identificadores |
| P0 · Rutina diaria | Completar sanidad/tareas sin fricción en móvil | Existen flujos de sanidad, tareas, inicio y kiosko | Observar un turno real y medir pasos, tiempo, errores y campos que quedan vacíos |
| P1 · Comprensión | Que alguien nuevo entienda qué hacer primero y qué significa cada estado | Hay pasos iniciales y una demo pública | Prueba sin explicación previa; registrar dudas literalmente y no atribuirlas a terceros |
| P1 · Coherencia visual | Que módulos densos compartan jerarquía, densidad, tablas y estados | Hay checklist visual, pero no capturas comparativas automáticas | Elegir tres pantallas peor valoradas por probadores, con captura/viewport y motivo concreto |
| P2 · Gestión | Reducir trabajo administrativo repetido y entender costes | Contactos, pupilaje y facturación existen; costes por caballo figura pendiente | Validar el problema y fuentes contables antes de diseñar el cálculo |

**No se puede concluir todavía qué sección visual concreta falla ni qué dijo el profesor de informática:** no se han compartido notas o ejemplos específicos de sus pruebas. Los cambios visuales grandes deben esperar a una incidencia concreta o a observación directa, para no sustituir preferencias reales por suposiciones.

## Cómo decidir qué construir

Antes de abrir un módulo nuevo, responder:

1. ¿Quién hace la tarea y con qué frecuencia?
2. ¿Qué usa hoy (papel, WhatsApp, Excel, llamada)?
3. ¿Qué error, retraso o doble apunte evita Relincho?
4. ¿Se puede resolver mejor conectando una ficha o flujo existente?
5. ¿Cómo se comprobará el resultado con usuarios?

Priorizar por frecuencia del dolor, riesgo de perder información, personas afectadas y facilidad para probarlo. Una petición aislada puede ser valiosa, pero se anota como tal y no se convierte automáticamente en dirección de producto.

## Medidas de éxito a instrumentar

No fijar objetivos numéricos sin línea base. Medir primero:

- tiempo y porcentaje de filas aceptadas en la primera importación;
- porcentaje de altas que registran al menos un cuidado o tarea durante la primera semana;
- tiempo/taps para anotar una acción frecuente desde móvil;
- incidencias de duplicados y correcciones después de importar;
- uso de exportación y solicitudes de ayuda para salir o recuperar datos;
- tareas vencidas frente a tareas registradas/completadas.

Recoger feedback con fecha, perfil, dispositivo, flujo, cita literal (con permiso), resultado esperado/observado y severidad. No guardar datos personales o clínicos de clientes en informes públicos.

## Mensaje público recomendado

> **Toda la información de tu cuadra, por caballo y en un solo sitio.** Registra cuidados, tareas y documentación; coordina a tu equipo y consulta qué toca después. Empieza importando tu lista de caballos y prueba la demo sin dar de alta una cuenta.

Antes de publicarlo, verificar que importación, demo, permisos, planes e integraciones visibles están activos en el entorno de producción. Evitar prometer «el fin del papel», cumplimiento legal automático o consejos veterinarios como resultados garantizados.
