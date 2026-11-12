import type { Guide, GuideId } from "./guides";

// The guides in Spanish. Each one replaces the English title, summary and body; Windows menus are named
// as Windows shows them in Spanish.
export const guidesEs: Record<GuideId, Pick<Guide, "title" | "summary" | "body">> = {
  "how-it-works": {
    title: "Cómo funciona Workbench Station",
    summary: "Qué revisa la auditoría y qué pasa cuando instalas.",
    body: [
      { text: "Workbench Station mantiene este equipo al día en tres pasos, y tú decides en cada uno." },
      {
        steps: [
          "Auditar. Lee las aplicaciones, herramientas de desarrollo y configuraciones de este equipo y busca en línea versiones más nuevas. Solo lee: no cambia nada y tarda unos minutos.",
          "Elegir. Actualizaciones muestra qué se puede actualizar, qué tan arriesgada es cada actualización y el comando exacto que ejecutaría. No se selecciona nada por ti.",
          "Instalar. Windows pide permiso una vez, las actualizaciones que elegiste se ejecutan una por una y luego se audita el equipo otra vez para comprobar que cada una quedó instalada.",
        ],
      },
      { text: "Algunas actualizaciones nunca se ejecutan desde aquí: las de riesgo alto y las que te necesitan, que no tienen comando. Sus guías explican cómo hacerlas tú." },
      { aside: "Una lista de actualizaciones de más de un día queda bloqueada. Las versiones cambian rápido, así que audita de nuevo antes de instalar." },
    ],
  },
  glossary: {
    title: "Palabras que verás",
    summary: "Riesgo, deshacer, Te necesita, tu estándar y lo demás, en palabras sencillas.",
    body: [
      {
        terms: [
          ["Riesgo bajo", "Una actualización de rutina de una fuente confiable, como una versión más nueva de una aplicación con WinGet. Se puede instalar junto con otras."],
          ["Riesgo medio", "Conviene revisarla primero, por ejemplo un salto a una versión principal nueva que puede cambiar cómo se comporta una herramienta."],
          ["Riesgo alto", "Podría romper una configuración de la que dependes. Nunca se ejecuta desde aquí; su guía explica cómo hacerla tú."],
          ["Punto de restauración", "Una copia de la configuración de Windows, los controladores y los programas instalados a la que puedes volver. Tus archivos no se tocan. Es opcional al instalar."],
          ["Se puede deshacer", "Puedes volver a la versión o configuración anterior si lo necesitas. \"No se puede deshacer\" quiere decir que lo planees."],
          ["Te necesita", "Algo que encontró la auditoría y que no tiene un comando seguro, así que lo haces tú. Cada uno enlaza a su guía."],
          ["Tu estándar", "Las reglas con las que se revisa este equipo, como qué versiones de Node.js mantener. Resumen muestra cuántas cumple."],
          ["Duplicados", "La misma herramienta instalada más de una vez, o entradas repetidas en PATH, que pueden hacer que se ejecute la versión equivocada."],
          ["Herramientas de desarrollo", "SDK y cadenas de herramientas como Node.js, Python, Flutter o Rust, que se actualizan con sus propias herramientas."],
        ],
      },
    ],
  },
  "needs-you": {
    title: "Actualizaciones sin comando",
    summary: "Qué hacer con lo que aparece en Te necesita.",
    body: [
      { text: "Son cosas que la auditoría encontró pero no puede arreglar sola de forma segura. Cada una dice qué encontró; tú haces el cambio y la siguiente auditoría lo comprueba." },
      {
        steps: [
          "Abre la actualización en Actualizaciones y lee qué encontró.",
          "Haz el cambio tú. Las guías de este grupo cubren los casos comunes.",
          "Audita este equipo otra vez desde Resumen. El elemento desaparece cuando está hecho.",
        ],
      },
    ],
  },
  "windows-update": {
    title: "Actualizaciones de Windows y controladores",
    summary: "Instálalas desde Windows Update, que sabe reiniciar de forma segura.",
    body: [
      { text: "Workbench Station muestra las actualizaciones pendientes de Windows y de controladores para que no se te pase ninguna, pero instalarlas le corresponde a Windows Update." },
      {
        steps: [
          "Abre Configuración > Windows Update y elige Buscar actualizaciones.",
          "Instala lo que ofrezca. Para los controladores, abre Opciones avanzadas > Actualizaciones opcionales.",
          "Reinicia cuando Windows lo pida y luego audita este equipo otra vez.",
        ],
      },
    ],
  },
  "your-standard": {
    title: "Cumplir tu estándar",
    summary: "Reglas sobre versiones, herramientas y configuración que este equipo aún no cumple.",
    body: [
      { text: "Tu estándar describe cómo debería estar configurado este equipo: qué versiones mantener, qué herramientas usar y cómo fijar las versiones en los proyectos. Una regla sin cumplir aparece en Te necesita con lo que falta." },
      {
        steps: [
          "Lee la regla en el detalle de la actualización. Nombra la herramienta, la versión o la configuración.",
          "Instala, configura o quita lo que describe, con el instalador o la configuración de esa herramienta.",
          "Audita este equipo otra vez. La puntuación de Resumen sube cuando la regla se cumple.",
        ],
      },
      { aside: "Si una regla no encaja con tu forma de trabajar, se puede cambiar en el estándar (config/workstation.policy.json en el repositorio) en vez de en este equipo." },
    ],
  },
  duplicates: {
    title: "Quitar duplicados",
    summary: "La misma herramienta dos veces, o entradas repetidas en PATH.",
    body: [
      { text: "Cuando una herramienta está instalada más de una vez, la que se ejecuta depende del orden de PATH, y actualizar una copia puede dejar a la vieja al mando." },
      {
        steps: [
          "Lee qué copias o entradas lista la actualización.",
          "Quédate con la copia que usas y desinstala las demás desde Configuración > Aplicaciones.",
          "Para las entradas repetidas de PATH, busca en Windows \"Editar las variables de entorno del sistema\", elige Variables de entorno y quita las repetidas de Path.",
          "Abre una terminal nueva y audita este equipo otra vez.",
        ],
      },
    ],
  },
  "developer-tools": {
    title: "Herramientas de desarrollo",
    summary: "SDK y cadenas de herramientas que se actualizan con sus propias herramientas.",
    body: [
      { text: "Algunas herramientas de desarrollo tienen su propio actualizador, y unas pocas no deben actualizarse desde fuera. Cuando no hay un comando seguro, actualízalas como la herramienta espera." },
      {
        steps: [
          "Lee qué herramienta y versión nombra la actualización.",
          "Usa el actualizador de la herramienta, por ejemplo rustup update, flutter upgrade o nvm install, o su instalador oficial.",
          "Abre una terminal nueva y audita este equipo otra vez.",
        ],
      },
    ],
  },
  "high-risk": {
    title: "Actualizaciones de riesgo alto",
    summary: "Por qué no se ejecutan desde aquí y cómo hacerlas con cuidado.",
    body: [
      { text: "Una actualización de riesgo alto podría romper una configuración de la que dependes, como una base de datos o un entorno de ejecución al que están fijados tus proyectos. Workbench Station muestra el comando exacto pero nunca lo ejecuta, para que tú elijas el momento." },
      {
        steps: [
          "Lee el detalle de la actualización y revisa qué depende de esa herramienta.",
          "Haz una copia de seguridad de lo importante, por ejemplo los datos de la base de datos o los archivos de bloqueo de los proyectos.",
          "Copia el comando del detalle y ejecútalo en una terminal cuando tengas tiempo de atender el resultado.",
          "Audita este equipo otra vez para confirmar la versión nueva.",
        ],
      },
    ],
  },
  "app-running": {
    title: "La aplicación estaba abierta",
    summary: "Cierra la aplicación, o las ventanas que la usan, y reintenta.",
    body: [
      { text: "Muchos instaladores se detienen cuando la aplicación que actualizan está abierta. Git, por ejemplo, no se puede actualizar mientras haya una ventana de Git Bash abierta." },
      {
        steps: [
          "Cierra la aplicación, y cualquiera de sus ventanas en los iconos ocultos de la barra de tareas.",
          "Si Historial nombró programas que la estaban usando, ciérralos también.",
          "Elige Reintentar en Historial, o selecciona la actualización otra vez en Actualizaciones.",
        ],
      },
      { aside: "Cuando empieza una instalación, Resumen muestra las aplicaciones abiertas que bloquearían su propia actualización, para que alcances a cerrarlas." },
    ],
  },
  "stalled-download": {
    title: "La descarga se quedó detenida",
    summary: "El descargador de WinGet se colgó; cámbialo por el estándar.",
    body: [
      { text: "WinGet descarga con Optimización de distribución de forma predeterminada, y en algunas redes se cuelga hasta que la instalación agota el tiempo. Cambiar WinGet al descargador estándar de Windows lo soluciona." },
      {
        steps: [
          "Abre una terminal y ejecuta winget settings. Abre el archivo de configuración de WinGet.",
          "Agrega la configuración de red de abajo, conservando la que ya haya, y guarda.",
          "Elige Reintentar en Historial.",
        ],
      },
      { code: '"network": {\n  "downloader": "wininet"\n}' },
      { aside: "Desde la línea de comandos, Update-Workstation.ps1 -FixWinGetDownloader hace el mismo cambio después de preguntar, y antes guarda una copia de la configuración." },
    ],
  },
  "download-refused": {
    title: "La descarga fue rechazada",
    summary: "El servidor del fabricante dijo que no por ahora; reintenta más tarde.",
    body: [
      { text: "El servidor de descargas del fabricante rechazó la solicitud (HTTP 403). Suele ser temporal, a menudo un límite de solicitudes, y nada cambió en este equipo." },
      { steps: ["Espera un rato; una hora suele bastar.", "Elige Reintentar en Historial."] },
    ],
  },
  "installer-technology": {
    title: "El instalador cambió",
    summary: "La versión nueva se instala de otra forma; reinstálala.",
    body: [
      { text: "La versión nueva usa otro tipo de instalador que el que hay en este equipo, así que no se puede actualizar en el mismo lugar." },
      {
        steps: [
          "Desinstala la aplicación desde Configuración > Aplicaciones. Tus archivos y tu configuración suelen conservarse.",
          "Instala la versión nueva desde el sitio del fabricante o con winget install.",
          "Audita este equipo otra vez.",
        ],
      },
    ],
  },
  "another-install": {
    title: "Había otra instalación en curso",
    summary: "Windows instala una cosa a la vez; reintenta cuando termine.",
    body: [
      { text: "Windows solo ejecuta un instalador a la vez. Otra instalación, a menudo Windows Update o una aplicación actualizándose sola, estaba ocupando el turno." },
      { steps: ["Espera a que termine la otra instalación.", "Elige Reintentar en Historial."] },
    ],
  },
  restart: {
    title: "Reinicia para terminar",
    summary: "Se instaló; Windows necesita reiniciar para completarla.",
    body: [
      { text: "La actualización se instaló, pero algunos de sus archivos están en uso hasta que Windows se reinicie." },
      { steps: ["Guarda tu trabajo y reinicia Windows.", "Audita este equipo otra vez para confirmar la versión nueva."] },
    ],
  },
  "no-applicable-update": {
    title: "Ninguna actualización aplica aquí",
    summary: "WinGet no puede actualizar esta copia; actualízala desde la aplicación.",
    body: [
      { text: "WinGet ve una versión más nueva, pero ninguna que corresponda a cómo se instaló esta copia, por ejemplo una aplicación que se actualiza sola o una instalada para un solo usuario." },
      { steps: ["Abre la aplicación y usa su propia opción para buscar actualizaciones.", "Audita este equipo otra vez."] },
    ],
  },
  "permission-declined": {
    title: "Se rechazó el permiso de Windows",
    summary: "No se instaló nada; elige Sí cuando Windows pregunte.",
    body: [
      { text: "Instalar necesita permiso de administrador, que Windows pide una vez por instalación. Si el aviso se rechaza o se cierra, no se ejecuta nada." },
      { steps: ["Elige las actualizaciones otra vez en Actualizaciones e instala.", "Cuando Windows pregunte si quieres permitir cambios, elige Sí."] },
    ],
  },
  "restore-point": {
    title: "Sin punto de restauración",
    summary: "Windows no pudo crearlo, así que no se instaló nada.",
    body: [
      { text: "Pediste un punto de restauración antes de instalar. Windows no pudo crearlo, así que no se instaló nada. Normalmente la Protección del sistema está desactivada en la unidad del sistema." },
      {
        steps: [
          "Busca en Windows \"Crear un punto de restauración\" y ábrelo.",
          "Selecciona la unidad del sistema, normalmente C:, elige Configurar y luego Activar protección del sistema. Dale un pequeño porcentaje del disco.",
          "Elige las actualizaciones otra vez en Actualizaciones e instala.",
        ],
      },
      { aside: "Para instalar sin uno, desmarca Crear primero un punto de restauración en la confirmación. Para volver más adelante, abre la misma ventana y elige Restaurar sistema." },
    ],
  },
  "other-failure": {
    title: "Cualquier otro error",
    summary: "Lee el motivo, revisa el registro del instalador y reintenta.",
    body: [
      { text: "Historial muestra el motivo que dio el instalador, en inglés. Cuando menciona un registro del instalador, las últimas líneas de ese registro suelen explicar la causa." },
      {
        steps: [
          "Lee el motivo en Historial, y abre el registro del instalador si aparece uno.",
          "Corrige lo que indica y elige Reintentar.",
          "Si sigue fallando, ejecuta el comando del detalle de la actualización en una terminal para ver la salida completa.",
        ],
      },
    ],
  },
};
