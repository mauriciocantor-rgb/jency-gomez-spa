/* Dibuja el sitio a partir de datos/contenido.json. Todo lo editable vive en ese archivo. */
(function () {
  "use strict";
  var raiz = window.SITIO_RAIZ || "";
  var rutaPagina = window.SITIO_RUTA || function (id) { return id + ".html"; };

  function esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function enlaceSeguro(u) { return /^https?:\/\//i.test(u || "") ? u : "#"; }
  function foto(p) {
    if (window.SITIO_FOTOS && window.SITIO_FOTOS[p]) return window.SITIO_FOTOS[p];
    return /^(data:image\/|https?:)/.test(p || "") ? p : raiz + (p || "");
  }
  function wa(c, tema) {
    return "https://api.whatsapp.com/send?phone=" + encodeURIComponent(c.contacto.whatsapp) +
      "&text=" + encodeURIComponent(c.contacto.saludo + (tema || "sus tratamientos"));
  }

  var FILTRO = '<filter id="acuarela" x="-10%" y="-20%" width="120%" height="140%">' +
    '<feTurbulence type="fractalNoise" baseFrequency=".012 .09" numOctaves="4" seed="7"/>' +
    '<feDisplacementMap in="SourceGraphic" scale="46"/></filter>';
  var DEFS = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' + FILTRO +
    '<linearGradient id="oroAro" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#dcc080"/>' +
    '<stop offset=".5" stop-color="#b89447"/><stop offset="1" stop-color="#d4b673"/></linearGradient></defs></svg>';
  var PINCELADA = '<div class="pincelada" aria-hidden="true"><svg viewBox="0 0 600 220" preserveAspectRatio="none">' +
    '<path filter="url(#acuarela)" fill="currentColor" d="M18 74C120 36 300 30 586 26c10 40 8 118-8 168-190 8-390 14-552 6C6 160 6 112 18 74z"/></svg></div>';
  /* Gestos del logo: arcos abiertos, puntos dorados y rama de hojas */
  var RAMA = '<g fill="none" stroke-linejoin="round" stroke-linecap="round"><path d="M0 0C10-14 20-30 26-52"/>' +
    '<path d="M26-52C14-62 12-80 20-96 32-84 34-66 26-52Z"/><path d="M15-27C2-30-10-42-14-56 2-54 12-42 15-27Z"/><path d="M20-38C32-52 46-58 62-60 56-44 40-34 20-38Z"/><path d="M7-13C18-20 32-22 44-20 36-10 20-6 7-13Z"/></g>';
  var AROS = '<div class="aros" aria-hidden="true"><svg viewBox="0 0 200 200" fill="none" stroke="url(#oroAro)">' +
    '<path class="trazar" pathLength="1" stroke-width="1.1" stroke-linecap="round" d="M112 3.7A97 97 0 0 0 9 134"/>' +
    '<path class="trazar" pathLength="1" stroke-width="1.1" stroke-linecap="round" d="M88 196.300A97 97 0 0 0 191 66"/>' +
    '<g fill="#b89447" stroke="none"><circle cx="20" cy="42" r="1.7"/><circle cx="11" cy="58" r=".9"/><circle cx="35" cy="22" r="1"/><circle cx="180" cy="158" r="1.7"/><circle cx="189" cy="143" r=".9"/><circle cx="165" cy="178" r="1"/></g>' +
    '<g transform="translate(164 40) rotate(28) scale(.62)" stroke-width="1.5">' + RAMA + "</g></svg></div>";
  var HOJITA = '<svg class="hojita" viewBox="-20 -100 90 105" aria-hidden="true" stroke="currentColor" stroke-width="2.4">' + RAMA + "</svg>";

  /* Carrusel de piezas gráficas: se muestran completas, sin recortar, y se amplían al tocarlas */
  function piezas(c) {
    var lista = (c.piezas || []).filter(function (p) { return p.imagen; }), i = c.inicio;
    if (!lista.length) return "";
    var figuras = lista.map(function (p, k) {
      return '<button type="button" class="pieza" data-i="' + k + '" aria-label="Ampliar: ' + esc(p.nombre) + '"><img src="' + esc(foto(p.imagen)) + '" alt="' + esc(p.alt) + '"' + (k ? ' loading="lazy"' : "") + "></button>";
    }).join("");
    var puntos = lista.map(function (p, k) {
      return '<button type="button" class="punto" data-i="' + k + '" aria-label="Ver ' + esc(p.nombre) + '"></button>';
    }).join("");
    var mandos = lista.length > 1 ? '<div class="mandos"><button type="button" class="flecha" data-d="-1" aria-label="Pieza anterior">‹</button>' + puntos +
      '<button type="button" class="flecha" data-d="1" aria-label="Pieza siguiente">›</button><button type="button" class="pausa"></button></div>' : "";
    return '<section class="piezas" aria-roledescription="carrusel" aria-label="Piezas de tratamientos"><div class="envoltura"><span class="versalitas">' + esc(i.piezasEtiqueta) + "</span><h2>" + esc(i.piezasTitulo) +
      '<span class="firma">' + esc(i.piezasFirma) + '</span></h2></div><div class="escenario">' + figuras + "</div>" + mandos +
      '<div class="pieza-accion"><a class="boton" target="_blank" rel="noopener" href="#">Agendar este tratamiento</a></div>' +
      '<dialog class="visor" aria-label="Pieza ampliada"><button type="button" class="visor-cerrar">Cerrar</button><img alt=""></dialog></section>';
  }
  var relojPiezas = null;
  function activarPiezas(raizEl, c) {
    clearInterval(relojPiezas);
    var s = raizEl.querySelector(".piezas"); if (!s) return;
    var lista = c.piezas.filter(function (p) { return p.imagen; });
    var fs = s.querySelectorAll(".pieza"), ps = s.querySelectorAll(".punto"), bp = s.querySelector(".pausa"), n = fs.length, a = 0;
    var cta = s.querySelector(".pieza-accion a"), visor = s.querySelector(".visor"), vimg = visor.querySelector("img");
    var quieto = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches, parado = quieto, sobre = false;
    function mostrar(k) {
      a = (k + n) % n;
      fs.forEach(function (f, j) {
        var d = (j - a + n) % n; if (d > n / 2) d -= n;
        f.className = "pieza " + (d === 0 ? "centro" : d === 1 ? "derecha" : d === -1 ? "izquierda" : "oculta");
        f.tabIndex = d === 0 ? 0 : -1;
        f.setAttribute("aria-hidden", d === 0 ? "false" : "true");
      });
      ps.forEach(function (b, j) { if (j === a) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current"); });
      cta.href = wa(c, lista[a].nombre);
    }
    function rotulo() { if (!bp) return; bp.textContent = parado ? "Seguir" : "Pausa"; bp.setAttribute("aria-label", parado ? "Reanudar el carrusel" : "Pausar el carrusel"); }
    mostrar(0); rotulo();
    fs.forEach(function (f, j) { f.onclick = function () {
      if (j !== a) return mostrar(j);
      vimg.src = lista[j].imagen ? f.querySelector("img").src : ""; vimg.alt = lista[j].alt;
      visor.showModal();
    }; });
    visor.querySelector(".visor-cerrar").onclick = function () { visor.close(); };
    visor.addEventListener("click", function (e) { if (e.target === visor) visor.close(); });
    s.querySelectorAll(".flecha").forEach(function (b) { b.onclick = function () { mostrar(a + Number(b.dataset.d)); }; });
    ps.forEach(function (b) { b.onclick = function () { mostrar(Number(b.dataset.i)); }; });
    if (bp) bp.onclick = function () { parado = !parado; rotulo(); };
    s.addEventListener("mouseenter", function () { sobre = true; });
    s.addEventListener("mouseleave", function () { sobre = false; });
    s.addEventListener("focusin", function () { sobre = true; });
    s.addEventListener("focusout", function () { sobre = false; });
    var x0 = null, esc2 = s.querySelector(".escenario");
    esc2.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    esc2.addEventListener("touchend", function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 45) mostrar(a + (dx < 0 ? 1 : -1));
    });
    if (n > 1) relojPiezas = setInterval(function () { if (!parado && !sobre && !visor.open && !document.hidden) mostrar(a + 1); }, 7000);
  }

  /* Testimonios reales de Google, copiados a mano desde el panel */
  function testimonios(c) {
    var t = c.testimonios;
    if (!t || !t.activa) return "";
    var lista = (t.lista || []).filter(function (x) { return x.visible && x.texto; });
    if (!lista.length) return "";
    var valor = parseFloat(String(t.calificacion).replace(",", "."));
    var estrellas = isNaN(valor) ? "" : '<span class="estrellas" role="img" aria-label="' + esc(t.calificacion) + ' de 5 estrellas"><span class="estrellas-llenas" style="width:' + Math.max(0, Math.min(100, valor * 20)) + '%">★★★★★</span>★★★★★</span>';
    var tarjetas = lista.map(function (x) {
      return '<figure class="testimonio"><blockquote>«' + esc(x.texto) + '»</blockquote><figcaption>' + esc(x.autora) + "<span>Reseña en Google</span></figcaption></figure>";
    }).join("");
    return '<section class="seccion testimonios aparece"><div class="envoltura"><span class="versalitas">' + esc(t.etiqueta) + "</span><h2>" + esc(t.titulo) + '<span class="firma">' + esc(t.firma) + "</span></h2>" +
      '<p class="resumen-resenas">' + estrellas + " <b>" + esc(t.calificacion) + "</b> · " + esc(t.total) + ' reseñas en Google</p><div class="testimonios-lista">' + tarjetas + "</div>" +
      '<div class="acciones"><a class="boton linea" href="' + esc(enlaceSeguro(t.enlaceVer)) + '" target="_blank" rel="noopener">Ver todas en Google</a><a class="boton linea" href="' + esc(enlaceSeguro(t.enlaceEscribir)) + '" target="_blank" rel="noopener">Escribir una reseña</a></div></div></section>';
  }

  function cabecera(c, actual) {
    var enl = [{ id: "index", nombre: "Inicio" }].concat(c.lineas.filter(function (l) { return l.visible; }))
      .concat([{ id: "contacto", nombre: "Contacto" }]).map(function (l) {
        return '<a href="' + rutaPagina(l.id) + '"' + (l.id === actual ? ' aria-current="page"' : "") + ">" + esc(l.nombre) + "</a>";
      }).join("");
    var promo = c.promocion && c.promocion.activa && c.promocion.texto
      ? '<div class="promo">' + esc(c.promocion.texto) + ' · <a href="' + wa(c, "la promoción") + '" target="_blank" rel="noopener">Quiero saber más</a></div>' : "";
    return DEFS + '<a class="saltar" href="#contenido">Saltar al contenido</a>' + promo +
      '<header class="cabecera"><div class="envoltura"><a class="logo" href="' + rutaPagina("index") + '">' +
      '<img src="' + foto("recursos/fotos/logo-cabecera.jpg") + '" alt="Jency Gómez SPA"></a>' +
      '<button class="boton-menu" type="button" aria-expanded="false">Menú</button>' +
      '<nav class="menu" aria-label="Principal">' + enl + "</nav></div></header>";
  }

  function urlMapa(k) { return enlaceSeguro(k.mapaEnlace); }
  /* Solo acepta el enlace oficial de inserción; admite pegar el código completo del iframe que da Google Maps */
  function mapaIncrustado(k, clase) {
    var m = String(k.mapaInsertar || "").match(/https:\/\/www\.google\.com\/maps\/embed\?[^"'\s<>]+/);
    if (!m) return "";
    return '<iframe class="' + clase + '" title="Ubicación de Jency Gómez SPA en Google Maps" loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade" src="' + esc(m[0]) + '"></iframe>';
  }
  function pie(c, actual) {
    var k = c.contacto;
    var redes = [["Instagram", k.instagram], ["Facebook", k.facebook], ["TikTok", k.tiktok]].filter(function (r) { return r[1]; })
      .map(function (r) { return '<li><a href="' + esc(enlaceSeguro(r[1])) + '" target="_blank" rel="noopener">' + r[0] + "</a></li>"; }).join("");
    return '<footer class="pie"><div class="envoltura"><img src="' + foto("recursos/fotos/logo.jpg") + '" alt="Jency Gómez SPA, cuidado facial y corporal">' +
      "<div><h3>Visítanos</h3><p>" + esc(k.direccion) + "<br>" + esc(k.horario) + '</p><p><a href="' + esc(urlMapa(k)) + '" target="_blank" rel="noopener">Ver en Google Maps</a></p>' + (actual === "contacto" ? "" : mapaIncrustado(k, "mapa-pie")) + "</div>" +
      "<div><h3>Síguenos</h3><ul>" + redes + "</ul></div></div></footer>" +
      '<a class="boton flotante" href="' + wa(c) + '" target="_blank" rel="noopener">WhatsApp</a>';
  }

  function cierre(c, texto, firma) {
    return '<section class="cierre aparece">' + PINCELADA + '<div class="envoltura"><h2>' + esc(texto) +
      '<span class="firma">' + esc(firma) + '</span></h2><a class="boton" href="' + wa(c, "una cita de valoración") +
      '" target="_blank" rel="noopener">Agendar por WhatsApp</a></div></section>';
  }

  function inicio(c) {
    var i = c.inicio;
    var arcos = c.lineas.filter(function (l) { return l.visible; }).map(function (l) {
      return '<a class="arco" href="' + rutaPagina(l.id) + '">' + HOJITA + "<h3>" + esc(l.nombre) + "</h3><p>" + esc(l.resumen) + "</p><span>Ver más</span></a>";
    }).join("");
    return '<section class="portada">' + PINCELADA + '<div class="envoltura"><div>' +
      '<span class="versalitas">Cuidado facial y corporal</span><h1>' + esc(i.titulo) + '<span class="firma">' + esc(i.tituloFirma) + "</span></h1>" +
      '<p class="entrada">' + esc(i.entrada) + '</p><div class="acciones"><a class="boton" href="' + wa(c, "una cita de valoración") +
      '" target="_blank" rel="noopener">Agenda tu valoración</a><a class="boton linea" href="' + rutaPagina(c.lineas[0].id) + '">Ver tratamientos</a></div></div>' +
      '<figure class="medallon">' + AROS + '<img src="' + esc(foto(i.foto)) + '" alt="' + esc(i.fotoAlt) + '"></figure></div></section>' +
      piezas(c) +
      '<section class="seccion centrado aparece"><div class="envoltura"><span class="versalitas">Lo que hacemos</span><div class="arcos">' + arcos + "</div></div></section>" +
      '<section class="valoracion aparece">' + PINCELADA + '<div class="envoltura"><h2>' + esc(i.valoracionTitulo) + '<span class="firma">' + esc(i.valoracionPregunta) +
      "</span></h2><p>" + esc(i.valoracionTexto) + "</p></div></section>" +
      '<section class="seccion historia aparece"><div class="envoltura"><figure class="ventana"><img src="' + esc(foto(i.fotoLocal)) + '" alt="' + esc(i.fotoLocalAlt) + '" loading="lazy"></figure>' +
      "<div><blockquote>«" + esc(i.historia) + '»</blockquote><span class="autora">' + esc(i.historiaFirma) + "</span></div></div></section>" +
      testimonios(c) +
      cierre(c, "Regálate", "un espacio para ti");
  }

  /* Información ampliada de un tratamiento: se despliega al tocar «Ver detalle» */
  function detalleDe(t) {
    var grupos = (t.detalle || []).filter(function (d) { return d.items && d.items.length; });
    if (!t.explicacion && !grupos.length) return "";
    return '<details class="detalle"><summary>Ver detalle</summary>' + (t.explicacion ? "<p>" + esc(t.explicacion) + "</p>" : "") + grupos.map(function (d) {
      return '<h4>' + esc(d.titulo) + "</h4><ul>" + d.items.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>";
    }).join("") + "</details>";
  }

  function linea(c, l) {
    if (!l.visible) {
      return '<section class="titular"><div class="envoltura"><h1>Esta página no está disponible</h1><div class="acciones"><a class="boton" href="' + rutaPagina("index") + '">Volver al inicio</a></div></div></section>';
    }
    var boton = l.grupos.length && !l.bloques ? "" : '<div class="acciones"><a class="boton" href="' + wa(c, l.nombreLargo) + '" target="_blank" rel="noopener">Preguntar por WhatsApp</a></div>';
    var cartas = l.grupos.map(function (g) {
      var filas = g.tratamientos.filter(function (t) { return t.visible; }).map(function (t) {
        return '<li><div class="renglon"><h3>' + esc(t.nombre) + "</h3><i></i>" + (t.precio ? "<b>" + esc(t.precio) + "</b>" : "") +
          '<a href="' + wa(c, (l.prefijoMensaje || "") + t.nombre) + '" target="_blank" rel="noopener" aria-label="Preguntar por WhatsApp sobre ' + esc(t.nombre) + '">Preguntar</a></div>' +
          (t.descripcion ? "<p>" + esc(t.descripcion) + "</p>" : "") + detalleDe(t) + "</li>";
      }).join("");
      return filas ? '<section class="carta aparece">' + HOJITA + "<h2>" + esc(g.nombre) + "</h2><ul>" + filas + "</ul>" + (g.nota ? '<p class="carta-nota">' + esc(g.nota) + "</p>" : "") + "</section>" : "";
    }).join("");
    var bloques = l.bloques ? '<div class="info-bloques aparece">' + l.bloques.map(function (b) {
      return '<section class="info-bloque"><h2>' + esc(b.titulo) + "</h2>" + (b.texto ? "<p>" + esc(b.texto) + "</p>" : "") +
        (b.lista && b.lista.length ? "<ul>" + b.lista.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : "") + "</section>";
    }).join("") + "</div>" : "";
    return '<section class="titular">' + PINCELADA + '<div class="envoltura"><span class="versalitas">' + esc(l.nombreLargo) + "</span><h1>" + esc(l.titulo) +
      '<span class="firma">' + esc(l.tituloFirma) + '</span></h1><p class="entrada">' + esc(l.entrada) + "</p>" + boton + "</div></section>" +
      '<div class="envoltura">' + bloques + cartas + "</div>" + cierre(c, "Cada cuerpo es distinto:", "empecemos por una valoración");
  }

  function contacto(c) {
    var k = c.contacto;
    var opciones = ["una cita de valoración"].concat(c.lineas.filter(function (l) { return l.visible; }).map(function (l) { return l.nombreLargo; }))
      .map(function (o) { return "<option>" + esc(o) + "</option>"; }).join("");
    return '<section class="titular">' + PINCELADA + '<div class="envoltura"><span class="versalitas">Contacto</span><h1>Separa<span class="firma">tu cita</span></h1></div></section>' +
      '<section class="seccion" style="padding-top:1rem"><div class="envoltura contacto"><div><dl class="datos">' +
      '<div><dt>WhatsApp y celular</dt><dd><a href="' + wa(c) + '" target="_blank" rel="noopener">' + esc(k.telefonoVisible) + "</a></dd></div>" +
      "<div><dt>Horario</dt><dd>" + esc(k.horario) + "</dd></div>" +
      "<div><dt>Dirección</dt><dd>" + esc(k.direccion) + "</dd></div>" +
      '<div><dt>Correo</dt><dd><a href="mailto:' + esc(k.correo) + '">' + esc(k.correo) + "</a></dd></div></dl>" +
      mapaIncrustado(k, "mapa") + '<p class="ver-mapa"><a href="' + esc(urlMapa(k)) + '" target="_blank" rel="noopener">Abrir en Google Maps</a></p></div>' +
      '<form class="cita" id="formulario"><h2>Escríbenos</h2><label>Tu nombre <input id="nombre" autocomplete="given-name" required></label>' +
      '<label>¿Qué te interesa? <select id="tema">' + opciones + "</select></label>" +
      '<label>Mensaje (opcional) <textarea id="mensaje"></textarea></label><button class="boton" type="submit">Continuar en WhatsApp</button>' +
      '<p class="nota">Este formulario no guarda tus datos: solo prepara el mensaje para que lo envíes tú desde WhatsApp.</p></form></div></section>';
  }

  function activar(raizEl, c) {
    var b = raizEl.querySelector(".boton-menu"), m = raizEl.querySelector(".menu");
    if (b) b.addEventListener("click", function () { b.setAttribute("aria-expanded", m.classList.toggle("abierto")); });
    var f = raizEl.querySelector("#formulario");
    if (f) f.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = function (id) { return f.querySelector("#" + id).value.trim(); };
      var txt = "Hola💕! Soy " + v("nombre") + ". Quiero más información sobre " + v("tema") + "." + (v("mensaje") ? " " + v("mensaje") : "");
      window.open("https://api.whatsapp.com/send?phone=" + encodeURIComponent(c.contacto.whatsapp) + "&text=" + encodeURIComponent(txt), "_blank", "noopener");
    });
    activarPiezas(raizEl, c);
    var ap = raizEl.querySelectorAll(".aparece");
    if (!("IntersectionObserver" in window)) { ap.forEach(function (e) { e.classList.add("visible"); }); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("visible"); io.unobserve(e.target); } });
    }, { threshold: 0.08 });
    ap.forEach(function (e) { io.observe(e); });
  }

  function dibujar(el, c, id) {
    var l = c.lineas.filter(function (x) { return x.id === id; })[0];
    var cuerpo = id === "contacto" ? contacto(c) : l ? linea(c, l) : inicio(c);
    el.innerHTML = cabecera(c, id) + '<main id="contenido">' + cuerpo + "</main>" + pie(c, id);
    activar(el, c);
  }

  window.Sitio = { dibujar: dibujar };

  if (window.SITIO_MANUAL) return;
  var el = document.getElementById("sitio"), id = document.body.dataset.pagina;
  var borrador = null;
  if (/[?&]borrador=1/.test(location.search)) {
    try { borrador = JSON.parse(localStorage.getItem("jg-borrador")); } catch (e) {}
  }
  if (borrador) { raiz = ""; dibujar(el, borrador, id); return; }
  fetch("datos/contenido.json?v=" + Date.now()).then(function (r) { if (!r.ok) throw 0; return r.json(); })
    .catch(function () { return window.CONTENIDO_RESPALDO; })
    .then(function (c) { dibujar(el, c, id); });
})();
