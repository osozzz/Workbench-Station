import { language } from "./i18n";

// The PowerShell engine writes its titles, findings and failure reasons in English, and the reports keep them that
// way so the command line and other tools read them as before (#276). In Spanish, the app recognizes each sentence
// here and translates it; anything it doesn't recognize stays in English.
//
// Each line is ["English template", "Spanish template"]. {name} matches any text and {count}, {total}, {major} or
// {seconds} only a number. {*name} is itself engine text, translated in turn. `pnpm build` runs
// scripts/check-i18n.mjs, which fails when a template's fixed words no longer appear in scripts/ or when the two
// sides don't use the same placeholders.
//
// ponytail: matching English sentences instead of message codes in the reports; move to codes if the engine's
// wording starts changing often.
const templates: [string, string][] = [
  // Update plan: titles (scripts/Core/UpdatePlan.Core.psm1).
  ["Upgrade {name} (Chocolatey)", "Actualizar {name} (Chocolatey)"],
  ["Upgrade the {name} CLI", "Actualizar la CLI de {name}"],
  ["Upgrade {name}", "Actualizar {name}"],
  ["Update the Windows Subsystem for Linux", "Actualizar el Subsistema de Windows para Linux"],
  ["Upgrade pip for the active Python", "Actualizar pip del Python activo"],
  ["Manage {name} with a single package manager", "Usar un solo gestor de paquetes para {name}"],
  ["Update {name} extensions", "Actualizar las extensiones de {name}"],
  ["Resolve the {key} deviation", "Resolver la desviación de {key}"],
  ["{*title} ({count})", "{title} ({count})"],
  ["Install the Windows application manager", "Instalar el gestor de aplicaciones de Windows"],
  ["Migrate Node.js to the configured version manager", "Pasar Node.js al gestor de versiones configurado"],
  ["Upgrade Node.js to its policy track", "Llevar Node.js a la línea de tu estándar"],
  ["Install the current Node.js release alongside LTS", "Instalar la versión Current de Node.js junto a la LTS"],
  ["Pin the Node.js version in projects", "Fijar la versión de Node.js en los proyectos"],
  ["Install pnpm", "Instalar pnpm"],
  ["Move global packages from npm to the policy package manager", "Pasar los paquetes globales de npm al gestor de tu estándar"],
  ["Add a lockfile to projects", "Agregar un lockfile a los proyectos"],
  ["Upgrade the Angular CLI", "Actualizar la CLI de Angular"],
  ["Upgrade the Prisma CLI", "Actualizar la CLI de Prisma"],
  ["Switch Flutter to its policy channel", "Cambiar Flutter al canal de tu estándar"],
  ["Upgrade the Flutter SDK", "Actualizar el SDK de Flutter"],
  ["Use the Dart SDK bundled with Flutter", "Usar el SDK de Dart que trae Flutter"],
  ["Remove missing PATH entries", "Quitar del PATH las rutas que no existen"],
  ["Remove duplicate PATH entries", "Quitar las rutas repetidas del PATH"],
  ["Move a prerelease to a stable release", "Pasar una versión preliminar a una estable"],
  ["Upgrade the Java runtime", "Actualizar el entorno de Java"],
  ["Set ANDROID_HOME to the Android SDK folder", "Apuntar ANDROID_HOME a la carpeta del SDK de Android"],
  ["Install the Python Install Manager", "Instalar Python Install Manager"],
  ["Upgrade Python to its policy track", "Llevar Python a la línea de tu estándar"],
  ["Upgrade the .NET SDK to its policy track", "Llevar el SDK de .NET a la línea de tu estándar"],
  ["Upgrade the stable Rust toolchain", "Actualizar la toolchain estable de Rust"],
  ["Upgrade Go to its policy track", "Llevar Go a la línea de tu estándar"],
  ["Migrate Rust to rustup", "Pasar Rust a rustup"],

  // Update plan: messages.
  ["WinGet reports a newer version.", "WinGet indica que hay una versión más nueva."],
  ["The Microsoft Store reports a newer version through WinGet.", "Microsoft Store indica, a través de WinGet, que hay una versión más nueva."],
  ["Chocolatey reports a newer version.", "Chocolatey indica que hay una versión más nueva."],
  ["Chocolatey upgrades need an elevated (administrator) shell.", "Las actualizaciones de Chocolatey necesitan una consola con permisos de administrador."],
  ["A newer WSL release is available.", "Hay una versión más nueva de WSL."],
  ["Running distributions are shut down while WSL updates.", "Las distribuciones abiertas se cierran mientras WSL se actualiza."],
  ["The npm registry reports a newer pnpm.", "El registro de npm indica que hay un pnpm más nuevo."],
  ["The npm registry reports a newer {name}, installed globally with {*manager}.", "El registro de npm indica que hay un {name} más nuevo, instalado de forma global con {manager}."],
  ["an unknown package manager", "un gestor de paquetes desconocido"],
  ["A newer {name} release is available.", "Hay una versión más nueva de {name}."],
  ["sdkmanager cannot update the command-line tools it runs from; update them in Android Studio > SDK Manager > SDK Tools.", "sdkmanager no puede actualizar las herramientas desde las que corre; actualízalas en Android Studio > SDK Manager > SDK Tools."],
  ["It was not installed with its standalone installer, so update it with the package manager that installed it.", "No se instaló con su instalador propio, así que actualízalo con el gestor de paquetes que lo instaló."],
  ["{name} is managed by {owners}.", "{name} lo administran {owners}."],
  ["Upgrading it through more than one of them can install side-by-side copies; apply only one manager's upgrade and remove the package from the others.", "Actualizarlo con más de uno puede dejar copias lado a lado; aplica la actualización de un solo gestor y quita el paquete de los demás."],
  ["WinGet is the policy's application manager, so this plan upgrades it through WinGet and leaves out the Chocolatey upgrades of {names}.", "WinGet es el gestor de aplicaciones de tu estándar, así que este plan lo actualiza con WinGet y deja por fuera las actualizaciones de Chocolatey de {names}."],
  ["To finish consolidating, remove those from Chocolatey without uninstalling the program: {command}", "Para terminar, quítalos de Chocolatey sin desinstalar el programa: {command}"],
  ["{name} has {count} extension(s); its CLI updates the ones with a newer version and leaves the rest.", "{name} tiene {count} extensión(es); su CLI actualiza las que tienen una versión más nueva y deja las demás."],
  ["Reload the editor afterwards.", "Después, recarga el editor."],
  ["Pending Windows update.", "Actualización de Windows pendiente."],
  ["Pending driver update.", "Actualización de controlador pendiente."],
  ["Install it from Settings > Windows Update.", "Instálala desde Configuración > Windows Update."],
  ["It may need a restart.", "Puede necesitar reiniciar."],
  ["{count} project(s): {*message}", "{count} proyecto(s): {message}"],
  ["WinGet package {id} manages this installation; apply its WinGet upgrade when one is listed.", "El paquete de WinGet {id} administra esta instalación; aplica su actualización de WinGet cuando aparezca."],
  ["This installation was not made with WinGet (vendor installer), so WinGet cannot upgrade it; use the vendor installer or the version manager the policy names.", "Esta instalación no se hizo con WinGet (instalador del fabricante), así que WinGet no puede actualizarla; usa el instalador del fabricante o el gestor de versiones de tu estándar."],

  // Your standard: findings (scripts/Core/PolicyEvaluation.Core.psm1).
  ["{name} is installed but {other} is not.", "{name} está instalado, pero {other} no."],
  ["{name} is installed.", "{name} está instalado."],
  ["Latest-version information for {name} was unavailable in this report.", "Este reporte no tiene la última versión de {name}."],
  ["{name} {version} meets the {track} track ({target}).", "{name} {version} cumple la línea {track} ({target})."],
  ["{name} {version} does not meet the {track} track ({target}).", "{name} {version} no cumple la línea {track} ({target})."],
  ["PATH health evidence was not collected.", "No se revisó el estado del PATH."],
  ["Persistent PATH has {total} missing entry.", "El PATH guardado tiene {total} ruta que no existe."],
  ["Persistent PATH has {total} missing entries.", "El PATH guardado tiene {total} rutas que no existen."],
  ["Persistent PATH has {total} duplicate entry.", "El PATH guardado tiene {total} ruta repetida."],
  ["Persistent PATH has {total} duplicate entries.", "El PATH guardado tiene {total} rutas repetidas."],
  ["The application manager was not audited.", "No se auditó el gestor de aplicaciones."],
  ["{name} is not available.", "{name} no está disponible."],
  ["{name} is available.", "{name} está disponible."],
  ["The latest Node Current release was unavailable in this report.", "Este reporte no tiene la última versión Current de Node."],
  ["A Node {major}.x (Current) installation is present.", "Hay una instalación de Node {major}.x (Current)."],
  ["No Node {major}.x (Current) installation is present.", "No hay ninguna instalación de Node {major}.x (Current)."],
  ["Project declares a Node version pin.", "El proyecto fija su versión de Node."],
  ["Project declares no Node version pin.", "El proyecto no fija su versión de Node."],
  ["The npm global inventory could not be read.", "No se pudo leer la lista de paquetes globales de npm."],
  ["{count} tracked global package(s) are installed with npm instead of {name}.", "{count} paquete(s) global(es) se instalaron con npm en vez de {name}."],
  ["Project dependencies are pinned by a lockfile.", "Un lockfile fija las dependencias del proyecto."],
  ["Project has no lockfile.", "El proyecto no tiene lockfile."],
  ["The Flutter channel was not reported.", "No se informó el canal de Flutter."],
  ["Flutter is on the {channel} channel.", "Flutter está en el canal {channel}."],
  ["The active Dart comes from: {source}.", "El Dart activo viene de: {source}."],
  ["Command precedence was not audited.", "No se auditó qué copia de cada comando se ejecuta."],
  ["Command collisions were audited; {count} conflict(s) reported.", "Se revisaron los comandos repetidos: {count} conflicto(s)."],
  ["No installed component is on a prerelease version.", "Ningún componente instalado está en una versión preliminar."],
  ["{name} {version} is a prerelease allowed by {key}.", "{name} {version} es una versión preliminar que permite {key}."],
  ["{name} {version} is a prerelease without an explicit opt-in.", "{name} {version} es una versión preliminar que tu estándar no permite."],
  ["Android environment variables were not audited.", "No se auditaron las variables de entorno de Android."],
  ["ANDROID_HOME is configured.", "ANDROID_HOME está configurada."],
  ["An Android SDK is installed but ANDROID_HOME is not configured.", "Hay un SDK de Android instalado, pero ANDROID_HOME no está configurada."],
  ["The WinGet inventory was not collected, so the Python manager is unknown.", "No se leyó la lista de WinGet, así que no se sabe con qué se administra Python."],
  ["The Python Install Manager is installed.", "Python Install Manager está instalado."],
  ["Python is installed without the Python Install Manager.", "Python está instalado sin Python Install Manager."],

  // History: why an update didn't install (scripts/Execution/Execution.Core.psm1).
  ["The installer failed (WinGet 0x8A150006).", "El instalador falló (WinGet 0x8A150006)."],
  ["WinGet found no installed package with this ID (0x8A150014).", "WinGet no encontró un paquete instalado con este ID (0x8A150014)."],
  ["WinGet found no update that applies to this installation (0x8A15002B); update it from the app itself.", "WinGet no encontró una actualización que aplique a esta instalación (0x8A15002B); actualízala desde la propia app."],
  ["The new version uses a different installer technology than the installed one; uninstall it and install the new version (WinGet 0x8A15008E).", "La versión nueva usa otra tecnología de instalador; desinstala la actual e instala la nueva (WinGet 0x8A15008E)."],
  ["The application is running; close it and retry (WinGet 0x8A150101).", "La aplicación está abierta; ciérrala y vuelve a intentarlo (WinGet 0x8A150101)."],
  ["Another installation is in progress; retry when it finishes (WinGet 0x8A150102).", "Hay otra instalación en curso; vuelve a intentarlo cuando termine (WinGet 0x8A150102)."],
  ["Installed; restart Windows to finish (WinGet 0x8A150109).", "Instalada; reinicia Windows para terminar (WinGet 0x8A150109)."],
  ["The vendor download server refused the download (HTTP 403, 0x80190193); retry later.", "El servidor del fabricante rechazó la descarga (HTTP 403, 0x80190193); vuelve a intentarlo más tarde."],
  ["Windows could not create a restore point: {*detail}", "Windows no pudo crear un punto de restauración: {detail}"],
  ["Windows did not create a restore point.", "Windows no creó un punto de restauración."],
  ["Turn on System Protection for the system drive (search Windows for \"Create a restore point\"), or install without one.", "Activa la Protección del sistema en la unidad del sistema (busca \"Crear un punto de restauración\" en Windows) o instala sin punto de restauración."],
  ["Windows makes at most one restore point a day, so the one from the last 24 hours covers this install.", "Windows crea como máximo un punto de restauración al día, así que el de las últimas 24 horas cubre esta instalación."],
  ["The download stalled and timed out after {seconds} seconds.", "La descarga se detuvo y se agotó el tiempo después de {seconds} segundos."],
  ["WinGet's Delivery Optimization downloader can hang; set network.downloader to wininet (winget settings) and retry.", "El descargador de Optimización de distribución de WinGet puede quedarse colgado; pon network.downloader en wininet (winget settings) y vuelve a intentarlo."],
  ["Timed out after {seconds} seconds; the process was stopped.", "Se agotó el tiempo después de {seconds} segundos y se detuvo el proceso."],
  ["Last output: {output}", "Lo último que mostró: {output}"],
  ["Exit code {code}.", "Código de salida {code}."],
  ["High-risk actions are always manual.", "Las actualizaciones de riesgo alto siempre son manuales."],
  ["Needs an elevated (administrator) shell; the executor never elevates itself.", "Necesita una consola con permisos de administrador; el motor nunca se los da a sí mismo."],
  ["Dry run.", "Prueba sin cambios."],
  ["The action is manual; it has no command to run.", "Esta actualización es manual: no tiene un comando para correr."],
  ["Batch not confirmed by the operator.", "No se confirmó el grupo de actualizaciones."],
  ["Declined by the operator.", "La rechazaste al confirmar."],
  ["Command '{command}' was not found.", "No se encontró el comando '{command}'."],
  ["The command is not in the execution allow-list: {command}", "El comando no está en la lista de comandos permitidos: {command}"],
  ["The audit report behind this plan is older than {hours} hours ({date}).", "La auditoría de este plan tiene más de {hours} horas ({date})."],
  ["Re-run the audit and the plan.", "Vuelve a auditar este PC."],
];

const numbers = new Set(["count", "total", "major", "seconds", "hours"]);

interface Compiled {
  pattern: RegExp;
  names: string[];
  nested: Set<string>;
  spanish: string;
}

// Templates with more fixed words are tried first, so "Upgrade {name} (Chocolatey)" wins over "Upgrade {name}".
const compiled: Compiled[] = templates
  .map(([english, spanish]) => {
    const names: string[] = [];
    const nested = new Set<string>();
    const source = english
      .split(/(\{\*?\w+\})/)
      .map((part) => {
        const placeholder = /^\{(\*?)(\w+)\}$/.exec(part);
        if (!placeholder) return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        names.push(placeholder[2]);
        if (placeholder[1]) nested.add(placeholder[2]);
        return numbers.has(placeholder[2]) ? "(-?\\d+)" : "(.+?)";
      })
      .join("");
    return { pattern: new RegExp(`^${source}$`), names, nested, spanish, fixed: english.replace(/\{\*?\w+\}/g, "").length };
  })
  .sort((a, b) => b.fixed - a.fixed);

function sentence(text: string, depth: number): string | null {
  for (const template of compiled) {
    const match = template.pattern.exec(text);
    if (!match) continue;
    return template.spanish.replace(/\{(\w+)\}/g, (whole, name: string) => {
      const index = template.names.indexOf(name);
      if (index < 0) return whole;
      const value = match[index + 1];
      return template.nested.has(name) ? translate(value, depth + 1) : value;
    });
  }
  return null;
}

function translate(text: string, depth: number): string {
  if (depth > 3) return text;
  const whole = sentence(text, depth);
  if (whole !== null) return whole;
  // Messages are often several engine sentences joined; each is translated on its own.
  const parts = text.split(/(?<=\.)\s+/);
  return parts.length < 2 ? text : parts.map((part) => sentence(part, depth) ?? part).join(" ");
}

const cache = new Map<string, string>();

/** Text written by the engine, in the app's language when it's a sentence the app knows. */
export function engineText(text: string | null | undefined): string {
  if (!text) return "";
  if (language() !== "es") return text;
  let translated = cache.get(text);
  if (translated === undefined) {
    translated = translate(text, 0);
    cache.set(text, translated);
  }
  return translated;
}

/** For the build check: every template, English and Spanish. */
export const engineTemplates = templates;
