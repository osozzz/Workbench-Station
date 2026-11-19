//! workbench-space: mide qué ocupa espacio dentro de una carpeta o unidad. Solo lee; nunca cambia nada.
//!
//! Uso: workbench-space <carpeta> [--out <archivo.json>]
//!      workbench-space <unidad, como C:\> --mft [--out <archivo.json>]
//!
//! Modo normal: recorre las carpetas en paralelo sin seguir enlaces simbólicos ni uniones (junctions), así que nada se cuenta dos
//! veces por esa vía. Los archivos que solo existen en la nube (OneDrive y similares) cuentan 0 bytes, porque no
//! ocupan disco. Las carpetas sin permiso se saltan y se cuentan en `skipped`.
//! ponytail: un archivo con varios hard links (WinSxS, Edge, pnpm) se cuenta en cada carpeta donde aparece, porque
//! saber que es el mismo exige abrir cada archivo. El modo rápido sí lo cuenta una vez.
//!
//! Modo rápido (`--mft`): lee la tabla maestra de archivos (MFT) de una unidad NTFS de una sola pasada, como WizTree.
//! Necesita permisos de administrador y también solo lee. Mide lo que cada archivo ocupa en el disco (clusters
//! enteros, flujos con nombre, índices de carpetas), así que su total se acerca al espacio usado de la unidad.
//!
//! El reporte trae el tamaño y el espacio libre de la unidad (`volume`), para mostrar lo que ningún archivo explica.

use serde_json::{json, Value};
use std::collections::HashMap;
use std::os::windows::fs::MetadataExt;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Condvar, Mutex};
use std::time::Instant;

/// Archivos que no ocupan disco: fuera de línea o descargables al abrirlos.
const NOT_ON_DISK: u32 = 0x1000 | 0x40000 | 0x400000;
/// Cuántos archivos grandes se reportan.
const TOP_FILES: usize = 500;
/// Cuántos tipos de archivo se reportan.
const TOP_TYPES: usize = 60;
/// Una carpeta que pese menos que esta fracción del total se suma en `other` de su madre en vez de listarse.
const MIN_SHARE: f64 = 0.0005;

struct Dir {
    name: String,
    parent: usize,
    own: u64,
    files: u64,
    kids: Vec<usize>,
}

#[derive(Default)]
struct Queue {
    jobs: Vec<(usize, PathBuf)>,
    busy: usize,
}

struct Scan {
    dirs: Mutex<Vec<Dir>>,
    queue: Mutex<Queue>,
    ready: Condvar,
    largest: Mutex<Vec<(u64, PathBuf)>>,
    floor: AtomicU64,
    types: Mutex<HashMap<String, (u64, u64)>>,
    skipped: AtomicU64,
}

/// Lo que dejó un recorrido: cada carpeta con su madre siempre antes que sus hijas.
struct Measured {
    dirs: Vec<Dir>,
    largest: Vec<(u64, PathBuf)>,
    types: HashMap<String, (u64, u64)>,
    skipped: u64,
}

fn walk(root: &Path) -> std::io::Result<Measured> {
    std::fs::read_dir(root)?;
    let scan = Scan {
        dirs: Mutex::new(vec![Dir { name: root.display().to_string(), parent: 0, own: 0, files: 0, kids: Vec::new() }]),
        queue: Mutex::new(Queue { jobs: vec![(0, root.to_path_buf())], busy: 0 }),
        ready: Condvar::new(),
        largest: Mutex::new(Vec::new()),
        floor: AtomicU64::new(0),
        types: Mutex::new(HashMap::new()),
        skipped: AtomicU64::new(0),
    };
    // El trabajo es casi todo esperar al disco, así que conviene tener más hilos que núcleos.
    let threads = std::thread::available_parallelism().map_or(4, |n| n.get() * 2).min(32);
    std::thread::scope(|s| {
        for _ in 0..threads {
            s.spawn(|| worker(&scan));
        }
    });
    let mut largest = scan.largest.into_inner().unwrap();
    largest.sort_unstable_by_key(|f| std::cmp::Reverse(f.0));
    largest.truncate(TOP_FILES);
    Ok(Measured {
        dirs: scan.dirs.into_inner().unwrap(),
        largest,
        types: scan.types.into_inner().unwrap(),
        skipped: scan.skipped.into_inner(),
    })
}

fn worker(scan: &Scan) {
    loop {
        let job = {
            let mut q = scan.queue.lock().unwrap();
            loop {
                if let Some(job) = q.jobs.pop() {
                    q.busy += 1;
                    break Some(job);
                }
                if q.busy == 0 {
                    break None;
                }
                q = scan.ready.wait(q).unwrap();
            }
        };
        let Some((id, path)) = job else {
            scan.ready.notify_all();
            return;
        };
        let found = read_one(scan, id, &path);
        let mut q = scan.queue.lock().unwrap();
        q.jobs.extend(found);
        q.busy -= 1;
        drop(q);
        scan.ready.notify_all();
    }
}

/// Lee una carpeta: suma sus archivos y devuelve sus subcarpetas para recorrerlas.
fn read_one(scan: &Scan, id: usize, path: &Path) -> Vec<(usize, PathBuf)> {
    let Ok(entries) = std::fs::read_dir(path) else {
        scan.skipped.fetch_add(1, Ordering::Relaxed);
        return Vec::new();
    };
    let (mut own, mut files) = (0u64, 0u64);
    let mut subdirs = Vec::new();
    let mut types: HashMap<String, (u64, u64)> = HashMap::new();
    for entry in entries.flatten() {
        let Ok(kind) = entry.file_type() else { continue };
        // Enlaces simbólicos y uniones apuntan a algo que ya se cuenta en otro lado, o fuera de la carpeta.
        if kind.is_symlink() {
            continue;
        }
        if kind.is_dir() {
            subdirs.push(entry.path());
            continue;
        }
        // En Windows, estos metadatos vienen de la misma lectura de la carpeta, sin abrir el archivo.
        let Ok(meta) = entry.metadata() else { continue };
        let size = if meta.file_attributes() & NOT_ON_DISK != 0 { 0 } else { meta.len() };
        own += size;
        files += 1;
        let file = entry.path();
        let ext = file.extension().map_or(String::new(), |e| e.to_string_lossy().to_lowercase());
        let slot = types.entry(ext).or_default();
        slot.0 += size;
        slot.1 += 1;
        if size > scan.floor.load(Ordering::Relaxed) {
            let mut largest = scan.largest.lock().unwrap();
            largest.push((size, file));
            if largest.len() >= TOP_FILES * 2 {
                largest.sort_unstable_by_key(|f| std::cmp::Reverse(f.0));
                largest.truncate(TOP_FILES);
                scan.floor.store(largest[TOP_FILES - 1].0, Ordering::Relaxed);
            }
        }
    }
    {
        let mut all = scan.types.lock().unwrap();
        for (ext, (bytes, count)) in types {
            let slot = all.entry(ext).or_default();
            slot.0 += bytes;
            slot.1 += count;
        }
    }
    let mut dirs = scan.dirs.lock().unwrap();
    dirs[id].own = own;
    dirs[id].files = files;
    subdirs
        .into_iter()
        .map(|sub| {
            let child = dirs.len();
            let name = sub.file_name().map_or(String::new(), |n| n.to_string_lossy().into_owned());
            dirs.push(Dir { name, parent: id, own: 0, files: 0, kids: Vec::new() });
            dirs[id].kids.push(child);
            (child, sub)
        })
        .collect()
}

/// Tamaño total y espacio libre de la unidad donde está la carpeta.
fn volume(root: &Path) -> Option<(u64, u64)> {
    #[link(name = "kernel32")]
    extern "system" {
        fn GetDiskFreeSpaceExW(dir: *const u16, available: *mut u64, total: *mut u64, free: *mut u64) -> i32;
    }
    use std::os::windows::ffi::OsStrExt;
    let wide: Vec<u16> = root.as_os_str().encode_wide().chain([0]).collect();
    let (mut available, mut total, mut free) = (0u64, 0u64, 0u64);
    // SAFETY: la ruta termina en 0 y los tres punteros apuntan a variables vivas.
    let ok = unsafe { GetDiskFreeSpaceExW(wide.as_ptr(), &mut available, &mut total, &mut free) };
    (ok != 0).then_some((total, free))
}

/// Arma el reporte: el árbol de carpetas (las pequeñas se suman en `other`), los archivos más grandes y el peso por tipo.
fn report(measured: Measured, root: &Path, mode: &str, elapsed_ms: u128) -> Value {
    let Measured { dirs, largest, types, skipped } = measured;
    // Las hijas siempre van después de su madre, así que un recorrido al revés suma cada subárbol en una pasada.
    let mut bytes: Vec<u64> = dirs.iter().map(|d| d.own).collect();
    let mut files: Vec<u64> = dirs.iter().map(|d| d.files).collect();
    for i in (1..dirs.len()).rev() {
        let parent = dirs[i].parent;
        bytes[parent] += bytes[i];
        files[parent] += files[i];
    }
    let min = ((bytes[0] as f64 * MIN_SHARE) as u64).max(1);

    fn node(i: usize, dirs: &[Dir], bytes: &[u64], files: &[u64], min: u64) -> Value {
        let mut kids = dirs[i].kids.clone();
        kids.sort_unstable_by(|a, b| bytes[*b].cmp(&bytes[*a]));
        let (shown, hidden): (Vec<usize>, Vec<usize>) = kids.into_iter().partition(|k| bytes[*k] >= min);
        json!({
            "name": dirs[i].name,
            "bytes": bytes[i],
            "files": files[i],
            "own": dirs[i].own,
            "other": hidden.iter().map(|k| bytes[*k]).sum::<u64>(),
            "children": shown.iter().map(|k| node(*k, dirs, bytes, files, min)).collect::<Vec<_>>(),
        })
    }

    let mut types: Vec<(String, (u64, u64))> = types.into_iter().collect();
    types.sort_unstable_by_key(|t| std::cmp::Reverse(t.1 .0));
    types.truncate(TOP_TYPES);
    let volume = volume(root).map(|(total, free)| json!({ "total": total, "free": free }));
    json!({
        "version": 1,
        "root": root.display().to_string(),
        "mode": mode,
        // El modo normal mide el tamaño de cada archivo; el rápido, lo que ocupa en el disco.
        "measure": if mode == "mft" { "on-disk" } else { "size" },
        "volume": volume,
        "elapsedMs": elapsed_ms as u64,
        "finishedAt": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_or(0, |d| d.as_millis() as u64),
        "bytes": bytes[0],
        "files": files[0],
        "folders": dirs.len() as u64,
        "skipped": skipped,
        "tree": node(0, &dirs, &bytes, &files, min),
        "largest": largest.iter().map(|(b, p)| json!({ "path": p.display().to_string(), "bytes": b })).collect::<Vec<_>>(),
        "types": types.iter().map(|(ext, (b, n))| json!({ "ext": ext, "bytes": b, "files": n })).collect::<Vec<_>>(),
    })
}

/// Modo rápido: lee la MFT de una unidad NTFS directamente del disco.
mod mft {
    use super::{Dir, Measured, TOP_FILES};
    use std::collections::HashMap;
    use std::fs::File;
    use std::io::{Error, ErrorKind, Read, Result, Seek, SeekFrom};
    use std::path::{Path, PathBuf};

    /// La carpeta raíz de una unidad NTFS siempre es el registro 5.
    const ROOT: usize = 5;
    const REFERENCE: u64 = 0xFFFF_FFFF_FFFF;

    #[derive(Default)]
    struct Rec {
        used: bool,
        dir: bool,
        parent: usize,
        name: String,
        /// Qué tan bueno es el nombre: 0 el de Windows, 1 POSIX, 2 el corto de DOS.
        rank: u8,
        /// Bytes que ocupa en el disco.
        size: u64,
    }

    fn u16le(b: &[u8], o: usize) -> u16 {
        u16::from_le_bytes([b[o], b[o + 1]])
    }
    fn u32le(b: &[u8], o: usize) -> u32 {
        u32::from_le_bytes(b[o..o + 4].try_into().unwrap())
    }
    fn u64le(b: &[u8], o: usize) -> u64 {
        u64::from_le_bytes(b[o..o + 8].try_into().unwrap())
    }

    /// Cada sector de un registro guarda en sus 2 últimos bytes un número de control; los bytes reales están en la
    /// tabla del encabezado. Devuelve false si el registro no es válido o quedó a medio escribir.
    pub(super) fn fixup(r: &mut [u8]) -> bool {
        if r.len() < 48 || &r[0..4] != b"FILE" {
            return false;
        }
        let (off, count) = (u16le(r, 4) as usize, u16le(r, 6) as usize);
        if count < 2 || off + count * 2 > r.len() || (count - 1) * 512 > r.len() {
            return false;
        }
        for i in 1..count {
            let end = i * 512 - 2;
            if r[end..end + 2] != r[off..off + 2] {
                return false;
            }
            r[end] = r[off + 2 * i];
            r[end + 1] = r[off + 2 * i + 1];
        }
        true
    }

    /// Los atributos de un registro: (tipo, bytes del atributo).
    fn attributes(r: &[u8]) -> Vec<(u32, &[u8])> {
        let mut found = Vec::new();
        let mut p = u16le(r, 0x14) as usize;
        while p + 16 <= r.len() {
            let kind = u32le(r, p);
            let len = u32le(r, p + 4) as usize;
            if kind == 0xFFFF_FFFF || len < 16 || p + len > r.len() {
                break;
            }
            found.push((kind, &r[p..p + len]));
            p += len;
        }
        found
    }

    /// El valor de un atributo guardado dentro del registro.
    fn resident(a: &[u8]) -> Option<&[u8]> {
        if a[8] != 0 || a.len() < 0x18 {
            return None;
        }
        let (len, off) = (u32le(a, 0x10) as usize, u16le(a, 0x14) as usize);
        a.get(off..off + len)
    }

    /// Dónde está en disco un atributo guardado fuera del registro: (cluster inicial, o None si es disperso; clusters).
    pub(super) fn runs(a: &[u8], from: usize) -> Option<Vec<(Option<u64>, u64)>> {
        let mut found = Vec::new();
        let (mut p, mut lcn) = (from, 0i64);
        while p < a.len() && a[p] != 0 {
            let (ls, os) = ((a[p] & 0xF) as usize, (a[p] >> 4) as usize);
            p += 1;
            if ls == 0 || ls > 8 || os > 8 || p + ls + os > a.len() {
                return None;
            }
            let len = a[p..p + ls].iter().rev().fold(0u64, |v, b| v << 8 | *b as u64);
            p += ls;
            if os == 0 {
                found.push((None, len));
                continue;
            }
            let raw = a[p..p + os].iter().rev().fold(0i64, |v, b| v << 8 | *b as i64);
            let shift = 64 - 8 * os as u32;
            lcn += raw << shift >> shift;
            p += os;
            found.push((Some(lcn as u64), len));
        }
        Some(found)
    }

    fn read(recs: &mut Vec<Rec>, r: &mut [u8], index: usize, cluster: u64) {
        if !fixup(r) || u16le(r, 0x16) & 1 == 0 {
            return;
        }
        // Un archivo con muchos atributos sigue en registros de extensión, que apuntan a su registro base.
        let base = (u64le(r, 0x20) & REFERENCE) as usize;
        let target = if base != 0 { base } else { index };
        if recs.len() <= target {
            recs.resize_with(target + 1, Rec::default);
        }
        let rec = &mut recs[target];
        if base == 0 {
            rec.used = true;
            rec.dir = u16le(r, 0x16) & 2 != 0;
        }
        for (kind, a) in attributes(r) {
            match kind {
                0x30 => {
                    let Some(v) = resident(a).filter(|v| v.len() >= 0x42) else { continue };
                    let rank = match v[0x41] {
                        1 | 3 => 0,
                        0 => 1,
                        _ => 2,
                    };
                    if rank < rec.rank || rec.name.is_empty() {
                        let Some(raw) = v.get(0x42..0x42 + v[0x40] as usize * 2) else { continue };
                        let units: Vec<u16> = raw.as_chunks::<2>().0.iter().map(|c| u16::from_le_bytes(*c)).collect();
                        rec.name = String::from_utf16_lossy(&units);
                        rec.parent = (u64le(v, 0) & REFERENCE) as usize;
                        rec.rank = rank;
                    }
                }
                // Lo que ocupa en el disco: todo atributo guardado fuera del registro, sea el contenido, un flujo con
                // nombre (el diario de cambios, los datos comprimidos de Windows) o el índice de una carpeta. Lo que
                // cabe dentro del registro ya se cuenta en $MFT. Se suman los clusters que de verdad tiene asignados,
                // no el tamaño declarado: $BadClus declara toda la unidad y los archivos dispersos tienen huecos.
                // Un atributo partido en varios registros trae sus propios clusters en cada parte.
                _ if a[8] == 1 && a.len() >= 0x40 => {
                    let held = runs(a, u16le(a, 0x20) as usize).map(|r| r.iter().filter(|(lcn, _)| lcn.is_some()).map(|(_, n)| n).sum::<u64>());
                    rec.size += held.unwrap_or(0) * cluster;
                }
                _ => {}
            }
        }
    }

    pub fn scan(volume: &Path) -> Result<Measured> {
        let text = volume.display().to_string();
        let letter = text.strip_suffix(":\\").filter(|l| l.len() == 1).ok_or_else(|| {
            Error::new(ErrorKind::InvalidInput, "fast mode measures a whole drive: pass its root, like C:\\")
        })?;
        let mut disk = File::open(format!(r"\\.\{letter}:"))?;
        let mut boot = [0u8; 512];
        disk.read_exact(&mut boot)?;
        if &boot[3..11] != b"NTFS    " {
            return Err(Error::new(ErrorKind::Unsupported, "fast mode only reads NTFS drives; use the normal mode"));
        }
        let cluster = u16le(&boot, 0x0B) as u64 * boot[0x0D] as u64;
        let per = boot[0x40] as i8;
        let size = if per < 0 { 1u64 << -(per as i32) } else { per as u64 * cluster } as usize;
        let bad = || Error::new(ErrorKind::InvalidData, "the drive's file table couldn't be read");

        // El registro 0 es la propia MFT: su contenido dice en qué partes del disco está el resto.
        // ponytail: si la MFT está tan fragmentada que sus partes siguen en otro registro, solo se lee lo del registro 0.
        let mut first = vec![0u8; size];
        disk.seek(SeekFrom::Start(u64le(&boot, 0x30) * cluster))?;
        disk.read_exact(&mut first)?;
        if !fixup(&mut first) {
            return Err(bad());
        }
        let data = attributes(&first).into_iter().find(|(k, a)| *k == 0x80 && a[8] == 1 && a[9] == 0).ok_or_else(bad)?.1;
        let parts = runs(data, u16le(data, 0x20) as usize).ok_or_else(bad)?;

        let mut recs: Vec<Rec> = Vec::new();
        let mut buf = vec![0u8; size * 4096];
        let mut index = 0usize;
        for (start, clusters) in parts {
            let mut left = (clusters * cluster) as usize;
            let Some(start) = start else {
                index += left / size;
                continue;
            };
            disk.seek(SeekFrom::Start(start * cluster))?;
            while left > 0 {
                let n = left.min(buf.len());
                disk.read_exact(&mut buf[..n])?;
                for r in buf[..n].chunks_exact_mut(size) {
                    read(&mut recs, r, index, cluster);
                    index += 1;
                }
                left -= n;
            }
        }
        if recs.len() <= ROOT || !recs[ROOT].dir {
            return Err(bad());
        }
        Ok(measure(recs, text))
    }

    /// Ordena las carpetas desde la raíz y suma cada archivo en la carpeta que lo contiene.
    fn measure(recs: Vec<Rec>, root_name: String) -> Measured {
        let mut pairs: Vec<(usize, usize)> =
            (0..recs.len()).filter(|&i| i != ROOT && recs[i].used && recs[i].dir).map(|i| (recs[i].parent, i)).collect();
        pairs.sort_unstable();
        let mut slot = vec![usize::MAX; recs.len()];
        let mut dirs = vec![Dir { name: root_name, parent: 0, own: 0, files: 0, kids: Vec::new() }];
        slot[ROOT] = 0;
        let mut order = vec![ROOT];
        let mut next = 0;
        while next < order.len() {
            let rec = order[next];
            let from = pairs.partition_point(|p| p.0 < rec);
            for &(_, child) in pairs[from..].iter().take_while(|p| p.0 == rec) {
                let (id, parent) = (dirs.len(), slot[rec]);
                slot[child] = id;
                dirs[parent].kids.push(id);
                dirs.push(Dir { name: recs[child].name.clone(), parent, own: 0, files: 0, kids: Vec::new() });
                order.push(child);
            }
            next += 1;
        }

        let mut types: HashMap<String, (u64, u64)> = HashMap::new();
        let mut largest: Vec<(u64, usize)> = Vec::new();
        for (i, rec) in recs.iter().enumerate() {
            // El índice de una carpeta grande también ocupa disco: se suma a la propia carpeta.
            if rec.used && rec.dir && slot[i] != usize::MAX {
                dirs[slot[i]].own += rec.size;
            }
            if !rec.used || rec.dir || rec.parent >= slot.len() || slot[rec.parent] == usize::MAX {
                continue;
            }
            let size = rec.size;
            let d = &mut dirs[slot[rec.parent]];
            d.own += size;
            d.files += 1;
            let ext = Path::new(&rec.name).extension().map_or(String::new(), |e| e.to_string_lossy().to_lowercase());
            let t = types.entry(ext).or_default();
            t.0 += size;
            t.1 += 1;
            largest.push((size, i));
        }
        largest.sort_unstable_by_key(|f| std::cmp::Reverse(f.0));
        largest.truncate(TOP_FILES);
        let largest = largest
            .into_iter()
            .map(|(size, i)| {
                let mut names = vec![recs[i].name.as_str()];
                let mut at = recs[i].parent;
                while at != ROOT && at < recs.len() && names.len() < 512 {
                    names.push(&recs[at].name);
                    at = recs[at].parent;
                }
                let mut path = PathBuf::from(&dirs[0].name);
                path.extend(names.iter().rev());
                (size, path)
            })
            .collect();
        Measured { dirs, largest, types, skipped: 0 }
    }
}

const USAGE: &str = "Usage: workbench-space <folder> [--out <file.json>]\n       workbench-space <drive, like C:\\> --mft [--out <file.json>]";

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let mut root = None;
    let mut out = None;
    let mut fast = false;
    let mut i = 0;
    while i < args.len() {
        match args[i].as_str() {
            "--out" if i + 1 < args.len() => {
                out = Some(PathBuf::from(&args[i + 1]));
                i += 1;
            }
            "--mft" => fast = true,
            a if !a.starts_with("--") && root.is_none() => root = Some(PathBuf::from(a)),
            _ => {
                eprintln!("{USAGE}");
                std::process::exit(2);
            }
        }
        i += 1;
    }
    let Some(root) = root else {
        eprintln!("{USAGE}");
        std::process::exit(2);
    };
    let root = dunce::canonicalize(&root).unwrap_or(root);
    let started = Instant::now();
    let measured = if fast { mft::scan(&root) } else { walk(&root) };
    let measured = match measured {
        Ok(m) => m,
        Err(e) if fast && e.kind() == std::io::ErrorKind::PermissionDenied => {
            eprintln!("Fast mode reads the drive directly, so it needs administrator rights.");
            std::process::exit(3);
        }
        Err(e) => {
            eprintln!("Can't read {}: {e}", root.display());
            std::process::exit(1);
        }
    };
    let mode = if fast { "mft" } else { "walk" };
    let result = report(measured, &root, mode, started.elapsed().as_millis()).to_string();
    match out {
        Some(file) => {
            if let Err(e) = std::fs::write(&file, result) {
                eprintln!("Can't write {}: {e}", file.display());
                std::process::exit(1);
            }
        }
        None => println!("{result}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sums_folders_skips_links_and_lists_largest() {
        let root = std::env::temp_dir().join(format!("workbench-space-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(root.join("a/b")).unwrap();
        std::fs::create_dir_all(root.join("c")).unwrap();
        std::fs::write(root.join("top.txt"), vec![0u8; 10]).unwrap();
        std::fs::write(root.join("a/one.bin"), vec![0u8; 100]).unwrap();
        std::fs::write(root.join("a/b/two.bin"), vec![0u8; 1000]).unwrap();
        // Una unión hacia "a" no debe contarse otra vez. Si Windows no deja crearla, la prueba sigue sin ella.
        let _ = std::process::Command::new("cmd")
            .args(["/c", "mklink", "/J"])
            .arg(root.join("c/link"))
            .arg(root.join("a"))
            .output();

        let value = report(walk(&root).unwrap(), &root, "walk", 0);
        assert_eq!(value["bytes"], 1110);
        assert_eq!(value["files"], 3);
        assert_eq!(value["tree"]["own"], 10);
        assert_eq!(value["tree"]["children"][0]["name"], "a");
        assert_eq!(value["tree"]["children"][0]["bytes"], 1100);
        assert_eq!(value["tree"]["children"][0]["children"][0]["bytes"], 1000);
        assert_eq!(value["largest"][0]["bytes"], 1000);
        assert_eq!(value["types"][0]["ext"], "bin");
        assert_eq!(value["types"][0]["bytes"], 1100);
        std::fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn decodes_data_runs_with_relative_and_sparse_parts() {
        // 0x18 clusters desde 0x5634, luego 0x30 clusters 16 antes de ese punto, luego 2 clusters dispersos.
        let runs = mft::runs(&[0x21, 0x18, 0x34, 0x56, 0x11, 0x30, 0xF0, 0x01, 0x02, 0x00], 0).unwrap();
        assert_eq!(runs, vec![(Some(0x5634), 0x18), (Some(0x5624), 0x30), (None, 2)]);
    }

    #[test]
    fn restores_sector_ends_and_rejects_torn_records() {
        let mut r = vec![0u8; 1024];
        r[0..4].copy_from_slice(b"FILE");
        r[4] = 0x30;
        r[6] = 3;
        r[0x30..0x36].copy_from_slice(&[7, 0, 0xAA, 0xBB, 0xCC, 0xDD]);
        r[510..512].copy_from_slice(&[7, 0]);
        r[1022..1024].copy_from_slice(&[7, 0]);
        let mut good = r.clone();
        assert!(mft::fixup(&mut good));
        assert_eq!(&good[510..512], &[0xAA, 0xBB]);
        assert_eq!(&good[1022..1024], &[0xCC, 0xDD]);
        r[1022] = 8;
        assert!(!mft::fixup(&mut r));
    }
}
