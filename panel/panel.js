/* Panel de Jency Gómez SPA: edita datos/contenido.json y las fotos en GitHub, desde el celular. */
(function () {
  "use strict";
  var LLAVE_BORRADOR = "jg-borrador", LLAVE_ACCESO = "jg-acceso";
  var RUTA_DATOS = "datos/contenido.json";
  var el, op, conf = {}, token = null, publicado = null, sha = null, datos = null, pantalla = "inicio", lineaActiva = 0, avisoT;
  var RAIZ_FOTOS = "../", abiertos = {};

  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function guardarLocal(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function leerLocal(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function borrarLocal(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function copia(o) { return JSON.parse(JSON.stringify(o)); }
  function hayCambios() { return JSON.stringify(datos) !== JSON.stringify(publicado); }
  function aB64(texto) { var b = new TextEncoder().encode(texto), s = ""; b.forEach(function (x) { s += String.fromCharCode(x); }); return btoa(s); }
  function deB64(b) { return new TextDecoder().decode(Uint8Array.from(atob(b.replace(/\s/g, "")), function (c) { return c.charCodeAt(0); })); }
  function bytes(b) { return Uint8Array.from(atob(b), function (c) { return c.charCodeAt(0); }); }
  function b64(u) { var s = ""; new Uint8Array(u).forEach(function (x) { s += String.fromCharCode(x); }); return btoa(s); }

  /* El token de GitHub queda cifrado en este dispositivo; el PIN es lo único que se teclea a diario. */
  function llaveDePin(pin, sal) {
    return crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveKey"]).then(function (k) {
      return crypto.subtle.deriveKey({ name: "PBKDF2", salt: sal, iterations: 200000, hash: "SHA-256" }, k, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    });
  }
  function cifrar(pin, texto) {
    var sal = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    return llaveDePin(pin, sal).then(function (k) { return crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, k, new TextEncoder().encode(texto)); })
      .then(function (c) { return { sal: b64(sal), iv: b64(iv), dato: b64(c) }; });
  }
  function descifrar(pin, a) {
    return llaveDePin(pin, bytes(a.sal)).then(function (k) { return crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes(a.iv) }, k, bytes(a.dato)); })
      .then(function (t) { return new TextDecoder().decode(t); });
  }

  function api(ruta, opciones) {
    opciones = opciones || {};
    opciones.headers = { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    if (opciones.body) opciones.headers["Content-Type"] = "application/json";
    return fetch("https://api.github.com/repos/" + encodeURIComponent(conf.propietario) + "/" + encodeURIComponent(conf.repositorio) + ruta, opciones).then(function (r) {
      if (!r.ok) { var e = new Error("github"); e.estado = r.status; throw e; }
      return r.json();
    });
  }
  function leerDatos(ref) {
    return api("/contents/" + RUTA_DATOS + "?ref=" + encodeURIComponent(ref || conf.rama) + "&t=" + Date.now()).then(function (r) {
      return { sha: r.sha, contenido: JSON.parse(deB64(r.content)) };
    });
  }

  function aviso(texto, accion, fn) {
    var v = el.querySelector(".panel-aviso"); if (v) v.remove();
    clearTimeout(avisoT);
    var d = document.createElement("div"); d.className = "panel-aviso"; d.setAttribute("role", "status");
    d.innerHTML = "<span>" + esc(texto) + "</span>" + (accion ? "<button type=button>" + esc(accion) + "</button>" : "");
    if (accion) d.querySelector("button").onclick = function () { d.remove(); fn(); };
    el.querySelector(".panel").appendChild(d);
    avisoT = setTimeout(function () { d.remove(); }, accion ? 9000 : 6000);
  }
  function cambio() {
    if (hayCambios()) guardarLocal(LLAVE_BORRADOR, JSON.stringify(datos)); else borrarLocal(LLAVE_BORRADOR);
    if (op.alCambiar) op.alCambiar(datos);
    var b = el.querySelector(".panel-publicar");
    if (b) b.outerHTML = barraPublicar();
    enlazarPublicar();
  }

  function barraPublicar() {
    var c = hayCambios();
    return '<div class="panel-publicar"><span>' + (c ? "Tienes cambios sin publicar" : "Todo está publicado") + "</span>" +
      '<button type="button" data-a="ver">Ver cómo queda</button>' +
      '<button type="button" class="principal" data-a="publicar"' + (c ? "" : " disabled") + ">Publicar</button></div>";
  }
  function enlazarPublicar() {
    var b = el.querySelector(".panel-publicar"); if (!b) return;
    b.querySelector('[data-a=ver]').onclick = function () {
      if (op.alVer) return op.alVer();
      window.open("../index.html?borrador=1", "_blank", "noopener");
    };
    b.querySelector('[data-a=publicar]').onclick = publicar;
  }
  function publicar() {
    var boton = el.querySelector('[data-a=publicar]'); boton.disabled = true; boton.textContent = "Publicando…";
    if (op.demo) { publicado = copia(datos); cambio(); aviso("Demostración: en el sitio real, aquí se publicaría."); return; }
    api("/contents/" + RUTA_DATOS, { method: "PUT", body: JSON.stringify({
      message: "Panel: actualiza el contenido", branch: conf.rama, sha: sha, content: aB64(JSON.stringify(datos, null, 2) + "\n") }) })
      .then(function (r) {
        sha = r.content.sha; publicado = copia(datos); borrarLocal(LLAVE_BORRADOR); cambio();
        aviso("¡Listo! Tus cambios se verán en la página en uno o dos minutos.");
      }).catch(function (e) {
        cambio();
        if (e.estado === 409 || e.estado === 422) aviso("Alguien más cambió la página. Toca Actualizar para traer lo último; tus cambios sin publicar se perderán.", "Actualizar", function () { borrarLocal(LLAVE_BORRADOR); cargar(); });
        else if (e.estado === 401 || e.estado === 403) aviso("La llave de acceso ya no sirve. Pídele a Mauricio que la renueve.");
        else aviso("No se pudo publicar. Revisa tu internet e inténtalo otra vez; tus cambios siguen guardados aquí.");
      });
  }

  /* Pantallas */
  function marco(titulo, cuerpo, atras) {
    el.innerHTML = '<div class="panel">' + (op.demo ? '<div class="panel-demo">Demostración: los cambios no se publican de verdad.</div>' : "") +
      '<div class="panel-barra">' + (atras ? '<button type="button" class="mini" data-a="atras" aria-label="Volver">←</button>' : "") + "<h1>" + esc(titulo) + "</h1></div>" +
      '<div class="panel-cuerpo">' + cuerpo + "</div>" + (datos ? barraPublicar() : "") + "</div>";
    var a = el.querySelector("[data-a=atras]"); if (a) a.onclick = function () { ir("inicio"); };
    enlazarPublicar();
    window.scrollTo(0, 0);
  }
  function ir(p) { pantalla = p; dibujar(); }
  function dibujar() { ({ inicio: pInicio, testimonios: pTestimonios, piezas: pPiezas, promo: pPromo, tratamientos: pTratamientos, contacto: pContacto, textos: pTextos, fotos: pFotos, versiones: pVersiones })[pantalla](); }

  function obtener(ruta) { return ruta.split(".").reduce(function (o, k) { return o[k]; }, datos); }
  function poner(ruta, v) { var p = ruta.split("."), u = p.pop(); p.reduce(function (o, k) { return o[k]; }, datos)[u] = v; cambio(); }
  function campo(etq, ruta, tipo, ayuda) {
    var v = esc(obtener(ruta));
    var ctl = tipo === "largo" ? '<textarea data-r="' + ruta + '">' + v + "</textarea>" : '<input type="' + (tipo || "text") + '" data-r="' + ruta + '" value="' + v + '">';
    return '<label class="campo">' + esc(etq) + ctl + (ayuda ? '<span class="panel-ayuda" style="font-weight:400">' + esc(ayuda) + "</span>" : "") + "</label>";
  }
  function enlazarCampos() {
    el.querySelectorAll("[data-r]").forEach(function (c) {
      if (c.type === "checkbox") c.onchange = function () { poner(c.dataset.r, c.checked); };
      else c.oninput = function () { poner(c.dataset.r, c.value); };
    });
  }

  function pInicio() {
    var op2 = [["piezas", "Carrusel de tratamientos", datos.piezas.length + " piezas gráficas"],
      ["testimonios", "Testimonios de Google", datos.testimonios.activa ? datos.testimonios.lista.length + " testimonios" : "Ocultos"],
      ["promo", "Promoción", datos.promocion.activa ? "Activa ahora" : "Ninguna activa"],
      ["tratamientos", "Tratamientos y precios", "Agregar, cambiar, ocultar o quitar"],
      ["fotos", "Fotos", "Cambiar tu foto y la del spa"],
      ["contacto", "Horario y contacto", "Teléfono, dirección y redes"],
      ["textos", "Textos de la página", "Lo que se lee en el inicio"],
      ["versiones", "Versiones anteriores", "Volver a como estaba antes"]];
    var laser = datos.lineas.filter(function (l) { return l.id === "depilacion-laser"; })[0];
    var falta = laser && laser.visible && !laser.grupos.length ? '<div class="panel-pendiente"><b>Por completar:</b> la página de depilación láser solo nombra el servicio. Agrega los detalles o escóndela desde «Tratamientos y precios».</div>' : "";
    marco("Hola, Jency", falta + '<div class="panel-menu">' + op2.map(function (o) {
      return '<button type="button" data-p="' + o[0] + '"><b>' + esc(o[1]) + "</b><span>" + esc(o[2]) + "</span></button>";
    }).join("") + "</div>");
    el.querySelectorAll("[data-p]").forEach(function (b) { b.onclick = function () { ir(b.dataset.p); }; });
  }
  function pPiezas() {
    var filas = datos.piezas.map(function (d, i) {
      var r = "piezas." + i;
      var mini = d.imagen ? '<img alt="" src="' + esc(verFoto(d.imagen)) + '">' : '<div class="panel-sinfoto">Sin imagen</div>';
      return '<div class="panel-tarjeta"><div class="panel-foto">' + mini + '<label><span class="panel-ayuda">Elige la pieza gráfica.</span><br><input type="file" accept="image/*" data-f="' + r + '.imagen"></label></div>' +
        campo("Nombre del tratamiento", r + ".nombre", "text", "Es el que llega en el mensaje de WhatsApp.") +
        campo("Texto de la pieza", r + ".alt", "largo", "Copia lo que dice la imagen. Ayuda a personas con discapacidad visual y a Google.") +
        '<div class="panel-fila"><button type="button" class="mini" data-m="' + i + ',-1" aria-label="Mover antes">↑</button><button type="button" class="mini" data-m="' + i + ',1" aria-label="Mover después">↓</button>' +
        '<button type="button" class="mini peligro" data-q="' + i + '">Quitar</button></div></div>';
    }).join("");
    marco("Carrusel de tratamientos", '<p class="panel-ayuda">Las piezas se muestran completas, sin recortar. Una pieza sin imagen no sale en la página.</p>' + filas + '<button type="button" id="mas">+ Agregar pieza</button>', true);
    enlazarCampos();
    el.querySelector("#mas").onclick = function () { datos.piezas.push({ imagen: "", nombre: "Nuevo tratamiento", alt: "" }); cambio(); dibujar(); };
    el.querySelectorAll("[data-m]").forEach(function (b) { b.onclick = function () {
      var p = b.dataset.m.split(",").map(Number), j = p[0] + p[1], l = datos.piezas;
      if (j < 0 || j >= l.length) return;
      var t = l[p[0]]; l[p[0]] = l[j]; l[j] = t; cambio(); dibujar();
    }; });
    el.querySelectorAll("[data-q]").forEach(function (b) { b.onclick = function () {
      var i = +b.dataset.q, t = datos.piezas.splice(i, 1)[0]; cambio(); dibujar();
      aviso("Quitaste «" + t.nombre + "».", "Deshacer", function () { datos.piezas.splice(i, 0, t); cambio(); dibujar(); });
    }; });
    el.querySelectorAll("[data-f]").forEach(function (f) { f.onchange = function () { if (f.files[0]) subirFoto(f.files[0], f.dataset.f); }; });
  }
  function pTestimonios() {
    var t = datos.testimonios;
    var filas = t.lista.map(function (x, i) {
      var r = "testimonios.lista." + i;
      return '<div class="panel-tarjeta">' + campo("Nombre", r + ".autora", "text", "Nombre e inicial del apellido.") + campo("Reseña", r + ".texto", "largo") +
        '<label class="panel-interruptor"><input type="checkbox" data-r="' + r + '.visible"' + (x.visible ? " checked" : "") + "> Mostrar en la página</label>" +
        '<div class="panel-fila"><button type="button" class="mini" data-m="' + i + ',-1" aria-label="Mover antes">↑</button><button type="button" class="mini" data-m="' + i + ',1" aria-label="Mover después">↓</button><button type="button" class="mini peligro" data-q="' + i + '">Quitar</button></div></div>';
    }).join("");
    marco("Testimonios de Google", '<div class="panel-pendiente">Copia solo reseñas reales de tu ficha de Google, exactamente como están escritas, y pide permiso a la clienta. Evita las que prometan resultados de salud o de peso.</div>' +
      '<div class="panel-tarjeta"><label class="panel-interruptor"><input type="checkbox" data-r="testimonios.activa"' + (t.activa ? " checked" : "") + "> Mostrar la sección</label>" +
      campo("Calificación en Google", "testimonios.calificacion", "text", "Actualízala cuando cambie en Google.") + campo("Total de reseñas", "testimonios.total") +
      campo("Título", "testimonios.titulo") + campo("Título en letra de firma", "testimonios.firma") + campo("Enlace para ver las reseñas", "testimonios.enlaceVer", "url") + campo("Enlace para escribir una reseña", "testimonios.enlaceEscribir", "url") + "</div>" +
      filas + '<button type="button" id="mas">+ Agregar testimonio</button>', true);
    enlazarCampos();
    el.querySelector("#mas").onclick = function () { t.lista.push({ autora: "", texto: "", visible: true }); cambio(); dibujar(); };
    el.querySelectorAll("[data-m]").forEach(function (b) { b.onclick = function () {
      var p = b.dataset.m.split(",").map(Number), j = p[0] + p[1], l = t.lista;
      if (j < 0 || j >= l.length) return;
      var v = l[p[0]]; l[p[0]] = l[j]; l[j] = v; cambio(); dibujar();
    }; });
    el.querySelectorAll("[data-q]").forEach(function (b) { b.onclick = function () {
      var i = +b.dataset.q, v = t.lista.splice(i, 1)[0]; cambio(); dibujar();
      aviso("Quitaste el testimonio de " + (v.autora || "esta clienta") + ".", "Deshacer", function () { t.lista.splice(i, 0, v); cambio(); dibujar(); });
    }; });
  }
  function pPromo() {
    marco("Promoción", '<div class="panel-tarjeta"><p class="panel-ayuda">Aparece como una franja arriba, en todas las páginas.</p>' +
      '<label class="panel-interruptor"><input type="checkbox" data-r="promocion.activa"' + (datos.promocion.activa ? " checked" : "") + "> Mostrar promoción</label>" +
      campo("Texto de la promoción", "promocion.texto", "largo") + "</div>", true);
    enlazarCampos();
  }
  function pContacto() {
    marco("Horario y contacto", '<div class="panel-tarjeta">' + campo("Horario", "contacto.horario") +
      campo("Celular que se muestra", "contacto.telefonoVisible", "tel") +
      campo("Número de WhatsApp", "contacto.whatsapp", "tel", "Con 57 adelante y sin espacios.") +
      campo("Dirección", "contacto.direccion") + campo("Enlace de Google Maps", "contacto.mapaEnlace", "url", "En Google Maps: Compartir > Copiar enlace.") + campo("Código para insertar el mapa", "contacto.mapaInsertar", "largo", "En Google Maps: Compartir > Insertar un mapa > Copiar HTML.") + campo("Correo", "contacto.correo", "email") +
      campo("Instagram", "contacto.instagram", "url") + campo("Facebook", "contacto.facebook", "url") + campo("TikTok", "contacto.tiktok", "url") + "</div>", true);
    enlazarCampos();
  }
  function pTextos() {
    marco("Textos de la página", '<div class="panel-tarjeta"><h2>Portada</h2>' + campo("Título", "inicio.titulo") + campo("Título en letra de firma", "inicio.tituloFirma") + campo("Texto", "inicio.entrada", "largo") + "</div>" +
      '<div class="panel-tarjeta"><h2>Carrusel de tratamientos</h2>' + campo("Etiqueta", "inicio.piezasEtiqueta") + campo("Título", "inicio.piezasTitulo") + campo("Título en letra de firma", "inicio.piezasFirma") + "</div>" +
      '<div class="panel-tarjeta"><h2>Valoración</h2>' + campo("Título", "inicio.valoracionTitulo") + campo("Pregunta", "inicio.valoracionPregunta") + campo("Texto", "inicio.valoracionTexto", "largo") + "</div>" +
      '<div class="panel-tarjeta"><h2>Tu historia</h2>' + campo("Frase", "inicio.historia", "largo") + campo("Firma", "inicio.historiaFirma") + "</div>", true);
    enlazarCampos();
  }
  function pTratamientos() {
    var l = datos.lineas[lineaActiva], base = "lineas." + lineaActiva;
    var sel = '<label class="campo">¿Qué quieres cambiar?<select id="linea">' + datos.lineas.map(function (x, i) { return "<option value=" + i + (i === lineaActiva ? " selected" : "") + ">" + esc(x.nombreLargo) + "</option>"; }).join("") + "</select></label>";
    var cab = '<div class="panel-tarjeta"><label class="panel-interruptor"><input type="checkbox" data-r="' + base + '.visible"' + (l.visible ? " checked" : "") + "> Mostrar esta página en el sitio</label>" +
      campo("Texto de presentación", base + ".entrada", "largo") + campo("Resumen en el inicio", base + ".resumen", "largo") + "</div>";
    var infoBloques = (l.bloques || []).map(function (b, bi) {
      var r = base + ".bloques." + bi;
      return '<div class="panel-tarjeta"><h2>' + esc(b.titulo) + "</h2>" + campo("Título", r + ".titulo") + (b.lista && b.lista.length ? '<label class="campo">Lista (un punto por línea)<textarea data-lista="' + r + '.lista">' + esc(b.lista.join("\n")) + "</textarea></label>" : campo("Texto", r + ".texto", "largo")) + "</div>";
    }).join("");
    var grupos = l.grupos.map(function (g, gi) {
      var filas = g.tratamientos.map(function (t, ti) {
        var r = base + ".grupos." + gi + ".tratamientos." + ti;
        var listas = (t.detalle || []).map(function (d, di) {
          var rd = r + ".detalle." + di;
          return campo("Título de la lista", rd + ".titulo") + '<label class="campo">Puntos de la lista (uno por línea)<textarea data-lista="' + rd + '.items">' + esc((d.items || []).join("\n")) + "</textarea></label>";
        }).join("");
        return '<details class="panel-tarjeta panel-plegable" data-abre="' + r + '"' + (abiertos[r] ? " open" : "") + "><summary><b>" + esc(t.nombre) + "</b><span>" + (t.visible ? esc(t.precio || "Sin precio") : "Oculto") + "</span></summary>" +
          campo("Nombre", r + ".nombre") + campo("Descripción corta (opcional)", r + ".descripcion", "largo") + campo("Explicación (opcional)", r + ".explicacion", "largo", "Se ve al tocar «Ver detalle».") + listas +
          '<button type="button" class="mini" data-dl="' + gi + "," + ti + '">+ Agregar lista al detalle</button>' + campo("Precio (opcional)", r + ".precio", "text", "Si lo dejas vacío, no se muestra.") +
          '<label class="panel-interruptor"><input type="checkbox" data-r="' + r + '.visible"' + (t.visible ? " checked" : "") + "> Mostrar en la página</label>" +
          '<div class="panel-fila"><button type="button" class="mini" data-m="' + gi + "," + ti + ',-1" aria-label="Subir">↑</button><button type="button" class="mini" data-m="' + gi + "," + ti + ',1" aria-label="Bajar">↓</button>' +
          '<button type="button" class="mini peligro" data-q="' + gi + "," + ti + '">Quitar</button></div></details>';
      }).join("");
      return "<h2 style=\"font:500 1.6rem 'Cormorant Garamond',serif\">" + esc(g.nombre) + "</h2>" + (g.nota !== undefined ? '<div class="panel-tarjeta">' + campo("Nota de la lista", base + ".grupos." + gi + ".nota", "largo") + "</div>" : "") + filas + '<button type="button" data-n="' + gi + '">+ Agregar tratamiento en ' + esc(g.nombre) + "</button>";
    }).join("");
    var sinGrupos = l.grupos.length ? "" : '<button type="button" data-g="1">+ Agregar lista de tratamientos a esta página</button>';
    marco("Tratamientos y precios", sel + cab + infoBloques + grupos + sinGrupos, true);
    el.querySelectorAll("[data-lista]").forEach(function (c) { c.oninput = function () { poner(c.dataset.lista, c.value.split("\n").map(function (x) { return x.trim(); }).filter(Boolean)); }; });
    el.querySelector("#linea").onchange = function (e) { lineaActiva = +e.target.value; dibujar(); };
    el.querySelectorAll("[data-abre]").forEach(function (x) { x.ontoggle = function () { abiertos[x.dataset.abre] = x.open; }; });
    el.querySelectorAll("[data-dl]").forEach(function (b) { b.onclick = function () {
      var p = b.dataset.dl.split(",").map(Number), t = l.grupos[p[0]].tratamientos[p[1]];
      (t.detalle = t.detalle || []).push({ titulo: "Incluye", items: [] }); cambio(); dibujar();
    }; });
    enlazarCampos();
    el.querySelectorAll("[data-n]").forEach(function (b) { b.onclick = function () {
      l.grupos[+b.dataset.n].tratamientos.push({ nombre: "Nuevo tratamiento", descripcion: "", precio: "", visible: true }); cambio(); dibujar();
    }; });
    var g1 = el.querySelector("[data-g]"); if (g1) g1.onclick = function () { l.grupos.push({ nombre: "Tratamientos", tratamientos: [{ nombre: "Nuevo tratamiento", descripcion: "", precio: "", visible: true }] }); cambio(); dibujar(); };
    el.querySelectorAll("[data-m]").forEach(function (b) { b.onclick = function () {
      var p = b.dataset.m.split(",").map(Number), lista = l.grupos[p[0]].tratamientos, d = p[1] + p[2];
      if (d < 0 || d >= lista.length) return;
      var t = lista[p[1]]; lista[p[1]] = lista[d]; lista[d] = t; cambio(); dibujar();
    }; });
    el.querySelectorAll("[data-q]").forEach(function (b) { b.onclick = function () {
      var p = b.dataset.q.split(",").map(Number), lista = l.grupos[p[0]].tratamientos, t = lista.splice(p[1], 1)[0];
      cambio(); dibujar();
      aviso("Quitaste «" + t.nombre + "».", "Deshacer", function () { lista.splice(p[1], 0, t); cambio(); dibujar(); });
    }; });
  }
  function verFoto(p) {
    if (op.fotos && op.fotos[p]) return op.fotos[p];
    return /^data:image\//.test(p) ? p : RAIZ_FOTOS + p;
  }
  function pFotos() {
    function bloque(t, k, ka) {
      return '<div class="panel-tarjeta"><h2>' + esc(t) + '</h2><div class="panel-foto"><img alt="" src="' + esc(verFoto(datos.inicio[k])) + '"><label><span class="panel-ayuda">Elige una foto de tu celular.</span><br><input type="file" accept="image/*" data-f="inicio.' + k + '"></label></div>' +
        campo("¿Qué se ve en la foto?", "inicio." + ka, "text", "Ayuda a personas con discapacidad visual y a Google.") + "</div>";
    }
    marco("Fotos", '<p class="panel-ayuda">No uses fotos de clientas sin su autorización.</p>' + bloque("Tu foto de portada", "foto", "fotoAlt") + bloque("Foto del spa", "fotoLocal", "fotoLocalAlt"), true);
    enlazarCampos();
    el.querySelectorAll("[data-f]").forEach(function (i) { i.onchange = function () { if (i.files[0]) subirFoto(i.files[0], i.dataset.f); }; });
  }
  function reducir(archivo) {
    return new Promise(function (ok, mal) {
      var u = URL.createObjectURL(archivo), im = new Image();
      im.onload = function () {
        var e = Math.min(1, 1920 / Math.max(im.width, im.height)), c = document.createElement("canvas");
        c.width = Math.round(im.width * e); c.height = Math.round(im.height * e);
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u);
        ok(c.toDataURL("image/jpeg", 0.84));
      };
      im.onerror = function () { mal(new Error("imagen")); };
      im.src = u;
    });
  }
  function subirFoto(archivo, rutaDato) {
    var clave = rutaDato.replace(/\W+/g, "-");
    aviso("Subiendo la foto…");
    reducir(archivo).then(function (dataUrl) {
      if (op.demo) return dataUrl;
      var ruta = "recursos/fotos/" + clave + "-" + Date.now() + ".jpg";
      return api("/contents/" + ruta, { method: "PUT", body: JSON.stringify({ message: "Panel: sube una foto", branch: conf.rama, content: dataUrl.split(",")[1] }) }).then(function () { return ruta; });
    }).then(function (ruta) {
      poner(rutaDato, ruta); dibujar();
      aviso("Foto lista. Toca Publicar para que salga en la página.");
    }).catch(function () { aviso("No se pudo subir la foto. Inténtalo con otra o revisa tu internet."); });
  }
  function pVersiones() {
    marco("Versiones anteriores", '<div class="panel-tarjeta" id="lista"><p>Buscando…</p></div>', true);
    var caja = el.querySelector("#lista");
    if (op.demo) { caja.innerHTML = '<p class="panel-ayuda">En el sitio real, aquí aparecen las últimas publicaciones y puedes volver a cualquiera.</p>'; return; }
    api("/commits?sha=" + encodeURIComponent(conf.rama) + "&path=" + encodeURIComponent(RUTA_DATOS) + "&per_page=12").then(function (lista) {
      caja.innerHTML = '<p class="panel-ayuda">Al recuperar una, la verás como cambio sin publicar. Revísala y toca Publicar.</p>' + lista.map(function (c) {
        var f = new Date(c.commit.author.date).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
        return '<div class="panel-fila" style="justify-content:space-between"><span>' + esc(f) + '</span><button type="button" class="mini" data-v="' + esc(c.sha) + '">Recuperar</button></div>';
      }).join("");
      caja.querySelectorAll("[data-v]").forEach(function (b) { b.onclick = function () {
        leerDatos(b.dataset.v).then(function (r) { datos = r.contenido; cambio(); ir("inicio"); aviso("Versión recuperada. Toca Publicar para dejarla."); })
          .catch(function () { aviso("No se pudo recuperar esa versión."); });
      }; });
    }).catch(function () { caja.innerHTML = '<p class="panel-error">No se pudieron cargar las versiones.</p>'; });
  }

  /* Acceso */
  function pantallaConfigurar() {
    marco("Preparar este celular", '<form class="panel-tarjeta" id="conf"><p class="panel-ayuda">Se hace una sola vez en cada dispositivo. Normalmente lo prepara Mauricio.</p>' +
      '<label class="campo">Usuario de GitHub<input type="text" id="c-p" value="' + esc(conf.propietario || "") + '" autocapitalize="off" required></label>' +
      '<label class="campo">Repositorio<input type="text" id="c-r" value="' + esc(conf.repositorio || "") + '" autocapitalize="off" required></label>' +
      '<label class="campo">Llave de acceso de GitHub<input type="password" id="c-t" autocomplete="off" required></label>' +
      '<label class="campo">PIN que usará Jency (mínimo 6 números)<input type="password" id="c-n" inputmode="numeric" pattern="[0-9]{6,}" autocomplete="new-password" required></label>' +
      '<p class="panel-error" id="c-e" role="alert"></p><button class="principal" type="submit">Guardar</button></form>');
    el.querySelector("#conf").onsubmit = function (e) {
      e.preventDefault();
      conf.propietario = el.querySelector("#c-p").value.trim(); conf.repositorio = el.querySelector("#c-r").value.trim(); conf.rama = conf.rama || "main";
      token = el.querySelector("#c-t").value.trim();
      var pin = el.querySelector("#c-n").value;
      leerDatos().then(function () { return cifrar(pin, token); }).then(function (a) {
        a.propietario = conf.propietario; a.repositorio = conf.repositorio; a.rama = conf.rama;
        guardarLocal(LLAVE_ACCESO, JSON.stringify(a)); cargar();
      }).catch(function () { token = null; el.querySelector("#c-e").textContent = "No pude entrar al repositorio. Revisa el usuario, el repositorio y la llave."; });
    };
  }
  function pantallaPin(a) {
    marco("Entrar", '<img class="panel-logo" src="../recursos/fotos/logo.jpg" alt="Jency Gómez SPA"><form class="panel-tarjeta" id="pin"><label class="campo">Tu PIN<input type="password" id="p" inputmode="numeric" autocomplete="current-password" required></label>' +
      '<p class="panel-error" id="p-e" role="alert"></p><button class="principal" type="submit">Entrar</button></form>');
    el.querySelector("#pin").onsubmit = function (e) {
      e.preventDefault();
      descifrar(el.querySelector("#p").value, a).then(function (t) { token = t; conf.propietario = a.propietario; conf.repositorio = a.repositorio; conf.rama = a.rama; cargar(); })
        .catch(function () { el.querySelector("#p-e").textContent = "Ese PIN no es. Inténtalo otra vez."; });
    };
  }
  function cargar() {
    leerDatos().then(function (r) {
      sha = r.sha; publicado = r.contenido;
      var b = leerLocal(LLAVE_BORRADOR);
      datos = b ? JSON.parse(b) : copia(publicado);
      ir("inicio");
      if (b && hayCambios()) aviso("Recuperé tus cambios sin publicar.");
    }).catch(function (e) {
      datos = null;
      marco("No se pudo abrir", '<div class="panel-tarjeta"><p class="panel-error">' + (e.estado === 401 ? "La llave de acceso ya no sirve. Pídele a Mauricio que la renueve." : "Revisa tu internet e inténtalo otra vez.") + '</p><button type="button" id="r">Reintentar</button></div>');
      el.querySelector("#r").onclick = cargar;
    });
  }

  window.Panel = {
    iniciar: function (raiz, opciones) {
      el = raiz; op = opciones || {}; conf = Object.assign({ rama: "main" }, window.PANEL_CONFIG || {});
      if (op.demo) { publicado = copia(op.contenido); datos = op.contenido; return ir("inicio"); }
      var a = leerLocal(LLAVE_ACCESO);
      if (a) pantallaPin(JSON.parse(a)); else pantallaConfigurar();
    },
    refrescar: function () { dibujar(); }
  };
})();
