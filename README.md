# Cadáver Exquisito

Una historia escrita entre varios: cada uno ve solo la última línea del anterior, y al final se despliega el papel entero.

- **Sin cuentas:** cada jugador tiene su link personal, y con ese link la app sabe quién es.
- **Avisos por mail:** cuando a alguien le toca, le llega un mail con su link. También se puede avisar por WhatsApp con un botón.
- **Gratis:** la página vive en GitHub Pages, y los datos y los mails en una planilla de Google tuya.

```
docs/        la página (GitHub Pages la publica desde acá)
backend/     Code.gs, el código que va en Apps Script
```

## Puesta en marcha (unos 15 minutos)

### 1. La planilla y el backend

1. Entrá a [sheets.new](https://sheets.new) con tu cuenta de Google. Ponele de nombre *Cadáver Exquisito*.
2. Andá a **Extensiones → Apps Script**.
3. Borrá lo que aparece y pegá todo el contenido de [`backend/Code.gs`](backend/Code.gs). Guardá con el ícono del disquete.
4. Arriba, en el selector de funciones, elegí **autorizarTodo** y tocá **Ejecutar**. Google te pide permisos: elegí tu cuenta, después **Configuración avanzada → Ir a Cadáver Exquisito (no seguro) → Permitir**. El aviso de "no seguro" aparece porque la app es tuya y no está verificada por Google; es normal.
5. Tocá **Implementar → Nueva implementación**. En el engranaje elegí **Aplicación web** y configurala así:
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier persona**
6. Tocá **Implementar** y copiá la **URL de la aplicación web** (termina en `/exec`).

### 2. Conectar la página

1. En este repo, abrí [`docs/config.js`](docs/config.js), tocá el lápiz y reemplazá `PEGAR_URL_DE_APPS_SCRIPT` por la URL que copiaste. Guardá con **Commit changes**.
2. En el repo, andá a **Settings → Pages**. En *Branch* elegí **main** y la carpeta **/docs**. Guardá.
3. En uno o dos minutos la página queda en `https://TU-USUARIO.github.io/cadaver-exquisito/`.

### 3. Jugar

Abrí la página, armá una partida con los nombres (y mails, si querés que les lleguen los avisos) y mandale a cada uno su link. El link de cada uno es personal: si alguien lo reenvía, el que lo recibe puede escribir en su lugar.

## Si cambiás el código del backend

Después de pegar una versión nueva de `Code.gs`, andá a **Implementar → Administrar implementaciones → lápiz → Versión: Nueva versión → Implementar**. Así la URL sigue siendo la misma.

## Límites

- Los mails salen de tu cuenta de Google. Una cuenta común manda unos 100 por día con Apps Script, y para un juego familiar sobra.
- Las partidas quedan guardadas en la hoja *partidas* de tu planilla. No las edites a mano.
