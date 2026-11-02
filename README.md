# Sitio de Jency Gómez SPA

Todo lo editable está en `datos/contenido.json` y `recursos/fotos/`. El sitio lo lee al abrirse; el panel (`/panel/`) lo modifica.

## Puesta en marcha

1. Crea un repositorio en GitHub y sube todo el contenido de este zip a la rama `main`.
2. En **Settings > Pages**, publica desde la rama `main`, carpeta `/ (root)`.
3. `panel/config.js` ya tiene el usuario y el repositorio; cámbialos solo si mueves el sitio.
4. Crea un token en **Settings > Developer settings > Fine-grained tokens**: solo este repositorio, permiso **Contents: Read and write**.
5. En el celular de Jency abre `/panel/`, pega el token y define un PIN de 6 números o más.

## Qué tener en cuenta

- El token queda cifrado con el PIN, solo en ese dispositivo. Quien tenga el token puede modificar este repositorio, así que no lo compartas; si se pierde el celular, revócalo en GitHub.
- `datos/respaldo.js` es una copia de emergencia que se usa solo si `contenido.json` no carga. No se actualiza desde el panel.
- Cada publicación queda en el historial de GitHub; el panel permite recuperar versiones anteriores.
- Diseño y estructura se cambian en `recursos/estilos.css` y `recursos/sitio.js`.
