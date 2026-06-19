/* ═══════════════════════════════════════════════════════════════════════════
   IOBAL — app.js
   ═══════════════════════════════════════════════════════════════════════════ */

const API = "/api/v1";
let token = localStorage.getItem("token");
let me = JSON.parse(localStorage.getItem("me") || "null");
let currentSection = "dashboard";
let bsModal;

const $ = id => document.getElementById(id);

// ─── API ─────────────────────────────────────────────────────────────────────
const api = async (method, path, body) => {
  const res = await fetch(API + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Error");
  return data;
};

// ─── ALERTAS ─────────────────────────────────────────────────────────────────
const showAlert = (msg, type = "danger") => {
  const el = $("alert-global");
  el.textContent = msg;
  el.className = `iobal-alert iobal-alert-${type} mb-4`;
  el.classList.remove("d-none");
  setTimeout(() => el.classList.add("d-none"), 4000);
};

// ─── BADGES ──────────────────────────────────────────────────────────────────
const statusBadge = s =>
  `<span class="iobal-badge badge-${s || "secondary"}">${s || "—"}</span>`;

// ─── MODAL ───────────────────────────────────────────────────────────────────
const openModal = (title, html, onSave) => {
  $("modal-title").textContent = title;
  $("modal-body").innerHTML = html + `
    <div class="modal-footer-actions">
      <button class="btn-modal-cancel" onclick="closeModal()">Cancelar</button>
      <button class="btn-modal-save" id="modal-save">Guardar</button>
    </div>`;
  if (onSave) $("modal-save").onclick = onSave;
  bsModal.show();
};
const closeModal = () => bsModal.hide();
$("modal-close").onclick = closeModal;

// ─── SIDEBAR / HAMBURGER ──────────────────────────────────────────────────────
const sidebar = $("sidebar");
const overlay = $("sidebar-overlay");
const openSidebar  = () => { sidebar.classList.add("open"); overlay.classList.remove("d-none"); };
const closeSidebar = () => { sidebar.classList.remove("open"); overlay.classList.add("d-none"); };

$("btn-hamburger").onclick    = openSidebar;
$("btn-close-sidebar").onclick = closeSidebar;
overlay.onclick               = closeSidebar;

// ─── NAVEGACIÓN ──────────────────────────────────────────────────────────────
const sectionMeta = {
  dashboard:   { title: "Resumen",     sub: "Vista general del sistema",          nuevo: false },
  propiedades: { title: "Propiedades", sub: "Gestión de inmuebles",               nuevo: true  },
  inquilinos:  { title: "Inquilinos",  sub: "Registro de inquilinos",             nuevo: true  },
  contratos:   { title: "Contratos",   sub: "Contratos activos y finalizados",    nuevo: true  },
  pagos:       { title: "Pagos",       sub: "Control de pagos mensuales",         nuevo: true  },
  mensajes:    { title: "Mensajes",    sub: "Avisos y observaciones",             nuevo: true  },
  cuidados:    { title: "Avisos",      sub: "Posts para inquilinos",              nuevo: true  },
  usuarios:    { title: "Usuarios",    sub: "Administración de cuentas",          nuevo: true  },
};

document.querySelectorAll(".nav-item").forEach(a => {
  a.onclick = () => {
    document.querySelectorAll(".nav-item").forEach(x => x.classList.remove("active"));
    a.classList.add("active");
    currentSection = a.dataset.section;
    const meta = sectionMeta[currentSection] || {};
    $("section-title").textContent = meta.title || currentSection;
    $("section-sub").textContent   = meta.sub   || "";
    const btnNew = $("btn-new");
    btnNew.classList.toggle("d-none", !meta.nuevo);
    closeSidebar();
    renderSection(currentSection);
  };
});

// ─── LOGIN / LOGOUT ───────────────────────────────────────────────────────────
$("btn-login").onclick = async () => {
  const btn = $("btn-login");
  btn.textContent = "Ingresando...";
  btn.disabled = true;
  try {
    const data = await api("POST", "/auth/login", {
      email: $("email").value,
      password: $("password").value,
    });
    token = data.access_token;
    me = { id: data.usuario_id, nombre: data.nombre, rol: data.rol };
    localStorage.setItem("token", token);
    localStorage.setItem("me", JSON.stringify(me));
    initApp();
  } catch (e) {
    const el = $("login-error");
    el.textContent = typeof e.message === "string" ? e.message : "Error al iniciar sesión";
    el.classList.remove("d-none");
  } finally {
    btn.textContent = "Iniciar sesión";
    btn.disabled = false;
  }
};

$("btn-logout").onclick = () => {
  localStorage.clear();
  token = null; me = null;
  $("app-screen").classList.add("d-none");
  $("login-screen").classList.remove("d-none");
};

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
async function renderDashboard() {
  $("section-content").innerHTML = `<div class="text-muted small">Cargando...</div>`;
  try {
    const [propiedades, contratos, pagos, mensajes] = await Promise.all([
      api("GET", "/propiedades"),
      api("GET", "/contratos"),
      api("GET", "/pagos"),
      api("GET", "/mensajes"),
    ]);

    const propOcupadas  = propiedades.filter(p => p.status === "ocupada").length;
    const propVacantes  = propiedades.filter(p => p.status === "vacante").length;
    const contActivos   = contratos.filter(c => c.status === "activo").length;
    const pagosPend     = pagos.filter(p => p.status === "pendiente" || p.status === "atrasado").length;
    const msgNoLeidos   = mensajes.filter(m => !m.leido).length;
    const totalRenta    = contratos
      .filter(c => c.status === "activo")
      .reduce((s, c) => s + c.monto_mensual, 0);

    $("section-content").innerHTML = `
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-icon blue"><i class="bi bi-building"></i></div>
          <div>
            <div class="stat-value">${propiedades.length}</div>
            <div class="stat-label">Propiedades</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green"><i class="bi bi-house-check"></i></div>
          <div>
            <div class="stat-value">${propOcupadas}</div>
            <div class="stat-label">Ocupadas</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon yellow"><i class="bi bi-house"></i></div>
          <div>
            <div class="stat-value">${propVacantes}</div>
            <div class="stat-label">Vacantes</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon indigo"><i class="bi bi-file-earmark-text"></i></div>
          <div>
            <div class="stat-value">${contActivos}</div>
            <div class="stat-label">Contratos activos</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon red"><i class="bi bi-credit-card"></i></div>
          <div>
            <div class="stat-value">${pagosPend}</div>
            <div class="stat-label">Pagos pendientes</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green"><i class="bi bi-envelope-open"></i></div>
          <div>
            <div class="stat-value">${msgNoLeidos}</div>
            <div class="stat-label">Mensajes sin leer</div>
          </div>
        </div>
      </div>

      <div class="iobal-table-wrap">
        <div style="padding: 1rem 1.25rem 0.75rem; border-bottom: 1px solid var(--c-border);">
          <span style="font-size:13px; font-weight:700; color:var(--c-text);">Propiedades recientes</span>
        </div>
        <div class="table-responsive">
          <table class="iobal-table">
            <thead>
              <tr><th>Nombre</th><th>Dirección</th><th>Tipo</th><th>Renta</th><th>Estado</th></tr>
            </thead>
            <tbody>
              ${propiedades.slice(0, 5).map(p => `
                <tr>
                  <td class="td-strong">${p.nombre}</td>
                  <td class="td-muted">${p.direccion}</td>
                  <td>${p.tipo}</td>
                  <td class="td-strong">$${p.precio_renta.toLocaleString()}</td>
                  <td>${statusBadge(p.status)}</td>
                </tr>`).join("") || `<tr><td colspan="5"><div class="empty-state"><i class="bi bi-building"></i><p>Sin propiedades registradas</p></div></td></tr>`}
            </tbody>
          </table>
        </div>
      </div>`;
  } catch (e) {
    $("section-content").innerHTML = `<div class="iobal-alert iobal-alert-danger">${e.message}</div>`;
  }
}

// ─── PROPIEDADES ──────────────────────────────────────────────────────────────
async function renderPropiedades() {
  const data = await api("GET", "/propiedades");
  $("section-content").innerHTML = `
    <div class="iobal-table-wrap">
      <div class="table-responsive">
        <table class="iobal-table">
          <thead>
            <tr><th>Nombre</th><th>Dirección</th><th>Tipo</th><th>Renta mensual</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            ${data.length ? data.map(p => `
              <tr>
                <td class="td-strong">${p.nombre}</td>
                <td class="td-muted">${p.direccion}</td>
                <td>${p.tipo}</td>
                <td class="td-strong">$${p.precio_renta.toLocaleString()}</td>
                <td>${statusBadge(p.status)}</td>
                <td>
                  <div style="display:flex;gap:6px">
                    <button class="action-btn action-btn-edit" onclick="editPropiedad(${p.id})">Editar</button>
                    ${me.rol === "admin" ? `<button class="action-btn action-btn-danger" onclick="deletePropiedad(${p.id})">Eliminar</button>` : ""}
                  </div>
                </td>
              </tr>`).join("")
            : `<tr><td colspan="6"><div class="empty-state"><i class="bi bi-building"></i><p>Sin propiedades registradas</p></div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
}

function formPropiedad(p = {}) {
  openModal(p.id ? "Editar propiedad" : "Nueva propiedad", `
    <div class="mb-3"><label class="form-label">Nombre</label><input id="f-nombre" class="form-control" value="${p.nombre || ""}"/></div>
    <div class="mb-3"><label class="form-label">Dirección</label><input id="f-dir" class="form-control" value="${p.direccion || ""}"/></div>
    <div class="mb-3"><label class="form-label">Tipo</label>
      <select id="f-tipo" class="form-select">
        ${["casa","departamento","local"].map(t => `<option ${p.tipo===t?"selected":""}>${t}</option>`).join("")}
      </select>
    </div>
    <div class="mb-3"><label class="form-label">Precio renta mensual</label><input type="number" id="f-precio" class="form-control" value="${p.precio_renta||""}"/></div>
  `, async () => {
    try {
      const body = { nombre: $("f-nombre").value, direccion: $("f-dir").value,
                     tipo: $("f-tipo").value, precio_renta: parseFloat($("f-precio").value) };
      p.id ? await api("PATCH",`/propiedades/${p.id}`,body) : await api("POST","/propiedades",body);
      closeModal(); renderPropiedades(); showAlert("Guardado correctamente","success");
    } catch(e) { showAlert(e.message); }
  });
}
async function editPropiedad(id) { formPropiedad(await api("GET",`/propiedades/${id}`)); }
async function deletePropiedad(id) {
  if (!confirm("¿Eliminar esta propiedad?")) return;
  try { await api("DELETE",`/propiedades/${id}`); renderPropiedades(); showAlert("Eliminada","success"); }
  catch(e) { showAlert(e.message); }
}

// ─── INQUILINOS ───────────────────────────────────────────────────────────────
async function renderInquilinos() {
  const data = await api("GET", "/inquilinos");
  $("section-content").innerHTML = `
    <div class="iobal-table-wrap">
      <div class="table-responsive">
        <table class="iobal-table">
          <thead>
            <tr><th>ID</th><th>Usuario ID</th><th>Teléfono</th><th>Referencias</th><th></th></tr>
          </thead>
          <tbody>
            ${data.length ? data.map(i => `
              <tr>
                <td>${i.id}</td><td>${i.usuario_id}</td>
                <td>${i.telefono || "—"}</td>
                <td class="td-muted">${i.referencias ? i.referencias.slice(0,60)+"…" : "—"}</td>
                <td><button class="action-btn action-btn-edit" onclick="editInquilino(${i.id})">Editar</button></td>
              </tr>`).join("")
            : `<tr><td colspan="5"><div class="empty-state"><i class="bi bi-people"></i><p>Sin inquilinos registrados</p></div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
}

function formInquilino(i = {}) {
  openModal(i.id ? "Editar inquilino" : "Nuevo inquilino", `
    ${!i.id ? `<div class="mb-3"><label class="form-label">Usuario ID</label><input type="number" id="f-uid" class="form-control"/></div>` : ""}
    <div class="mb-3"><label class="form-label">Teléfono</label><input id="f-tel" class="form-control" value="${i.telefono||""}"/></div>
    <div class="mb-3"><label class="form-label">Referencias</label><textarea id="f-ref" class="form-control" rows="3">${i.referencias||""}</textarea></div>
  `, async () => {
    const body = { telefono: $("f-tel").value, referencias: $("f-ref").value,
                   ...(!i.id ? { usuario_id: parseInt($("f-uid").value) } : {}) };
    try {
      i.id ? await api("PATCH",`/inquilinos/${i.id}`,body) : await api("POST","/inquilinos",body);
      closeModal(); renderInquilinos(); showAlert("Guardado","success");
    } catch(e) { showAlert(e.message); }
  });
}
async function editInquilino(id) { formInquilino(await api("GET",`/inquilinos/${id}`)); }

// ─── CONTRATOS ────────────────────────────────────────────────────────────────
async function renderContratos() {
  const data = await api("GET", "/contratos");
  $("section-content").innerHTML = `
    <div class="iobal-table-wrap">
      <div class="table-responsive">
        <table class="iobal-table">
          <thead>
            <tr><th>ID</th><th>Propiedad</th><th>Inquilino</th><th>Inicio</th><th>Fin</th><th>Monto</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            ${data.length ? data.map(c => `
              <tr>
                <td>${c.id}</td><td>${c.propiedad_id}</td><td>${c.inquilino_id}</td>
                <td class="td-muted">${c.fecha_inicio}</td><td class="td-muted">${c.fecha_fin}</td>
                <td class="td-strong">$${c.monto_mensual.toLocaleString()}</td>
                <td>${statusBadge(c.status)}</td>
                <td><button class="action-btn action-btn-edit" onclick="editContrato(${c.id})">Editar</button></td>
              </tr>`).join("")
            : `<tr><td colspan="8"><div class="empty-state"><i class="bi bi-file-earmark-text"></i><p>Sin contratos registrados</p></div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
}

function formContrato(c = {}) {
  openModal(c.id ? "Editar contrato" : "Nuevo contrato", `
    ${!c.id ? `
      <div class="mb-3"><label class="form-label">Propiedad ID</label><input type="number" id="f-pid" class="form-control"/></div>
      <div class="mb-3"><label class="form-label">Inquilino ID</label><input type="number" id="f-iid" class="form-control"/></div>
      <div class="row g-2">
        <div class="col-12 col-sm-6 mb-3"><label class="form-label">Fecha inicio</label><input type="date" id="f-fi" class="form-control"/></div>
        <div class="col-12 col-sm-6 mb-3"><label class="form-label">Fecha fin</label><input type="date" id="f-ff" class="form-control"/></div>
      </div>
      <div class="mb-3"><label class="form-label">Monto mensual</label><input type="number" id="f-monto" class="form-control"/></div>
    ` : `
      <div class="mb-3"><label class="form-label">Fecha fin</label><input type="date" id="f-ff" class="form-control" value="${c.fecha_fin}"/></div>
      <div class="mb-3"><label class="form-label">Monto mensual</label><input type="number" id="f-monto" class="form-control" value="${c.monto_mensual}"/></div>
      <div class="mb-3"><label class="form-label">Estado</label>
        <select id="f-status" class="form-select">
          ${["activo","finalizado","cancelado"].map(s=>`<option ${c.status===s?"selected":""}>${s}</option>`).join("")}
        </select>
      </div>
    `}
  `, async () => {
    try {
      c.id
        ? await api("PATCH",`/contratos/${c.id}`,{ fecha_fin:$("f-ff").value, monto_mensual:parseFloat($("f-monto").value), status:$("f-status").value })
        : await api("POST","/contratos",{ propiedad_id:parseInt($("f-pid").value), inquilino_id:parseInt($("f-iid").value), fecha_inicio:$("f-fi").value, fecha_fin:$("f-ff").value, monto_mensual:parseFloat($("f-monto").value) });
      closeModal(); renderContratos(); showAlert("Guardado","success");
    } catch(e) { showAlert(e.message); }
  });
}
async function editContrato(id) { formContrato(await api("GET",`/contratos/${id}`)); }

// ─── PAGOS ────────────────────────────────────────────────────────────────────
async function renderPagos() {
  const data = await api("GET", "/pagos");
  $("section-content").innerHTML = `
    <div class="iobal-table-wrap">
      <div class="table-responsive">
        <table class="iobal-table">
          <thead>
            <tr><th>ID</th><th>Contrato</th><th>Mes / Año</th><th>Total</th><th>Estado</th><th>Conceptos</th><th></th></tr>
          </thead>
          <tbody>
            ${data.length ? data.map(p => `
              <tr>
                <td>${p.id}</td><td>${p.contrato_id}</td>
                <td>${p.mes}/${p.anio}</td>
                <td class="td-strong">$${p.total.toLocaleString()}</td>
                <td>${statusBadge(p.status)}</td>
                <td class="td-muted" style="font-size:12px">${p.conceptos.map(c=>`${c.tipo}: $${c.monto}`).join(", ")}</td>
                <td><button class="action-btn action-btn-success" onclick="marcarPagado(${p.id})">Pagado</button></td>
              </tr>`).join("")
            : `<tr><td colspan="7"><div class="empty-state"><i class="bi bi-credit-card"></i><p>Sin pagos registrados</p></div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
}

async function marcarPagado(id) {
  try { await api("PATCH",`/pagos/${id}`,{status:"pagado"}); renderPagos(); showAlert("Marcado como pagado","success"); }
  catch(e) { showAlert(e.message); }
}

function formPago() {
  window._conceptos = [{ tipo:"renta", monto:"" }];
  window.renderConceptos = () => {
    const el = document.getElementById("conceptos-list");
    if (!el) return;
    el.innerHTML = window._conceptos.map((c,i) => `
      <div class="d-flex gap-2 mb-2 align-items-center">
        <select class="form-select form-select-sm" onchange="window._conceptos[${i}].tipo=this.value">
          ${["renta","agua","luz","internet","mantenimiento"].map(t=>`<option ${c.tipo===t?"selected":""}>${t}</option>`).join("")}
        </select>
        <input type="number" class="form-control form-control-sm" placeholder="Monto" value="${c.monto}"
          oninput="window._conceptos[${i}].monto=this.value" style="max-width:110px"/>
        <button class="action-btn action-btn-danger" onclick="window._conceptos.splice(${i},1);window.renderConceptos()">
          <i class="bi bi-x"></i>
        </button>
      </div>`).join("");
  };

  openModal("Nuevo pago", `
    <div class="mb-3"><label class="form-label">Contrato ID</label><input type="number" id="f-cid" class="form-control"/></div>
    <div class="row g-2">
      <div class="col-6 mb-3"><label class="form-label">Mes</label><input type="number" id="f-mes" class="form-control" min="1" max="12"/></div>
      <div class="col-6 mb-3"><label class="form-label">Año</label><input type="number" id="f-anio" class="form-control" value="${new Date().getFullYear()}"/></div>
    </div>
    <label class="form-label">Conceptos</label>
    <div id="conceptos-list" class="mb-2"></div>
    <button class="action-btn action-btn-edit mb-3"
      onclick="window._conceptos.push({tipo:'renta',monto:''});window.renderConceptos()">
      + Agregar concepto
    </button>
  `, async () => {
    try {
      await api("POST","/pagos",{
        contrato_id: parseInt($("f-cid").value),
        mes: parseInt($("f-mes").value),
        anio: parseInt($("f-anio").value),
        conceptos: window._conceptos.map(c=>({tipo:c.tipo,monto:parseFloat(c.monto)})),
      });
      closeModal(); renderPagos(); showAlert("Pago registrado","success");
    } catch(e) { showAlert(e.message); }
  });
  setTimeout(window.renderConceptos, 50);
}

// ─── MENSAJES ─────────────────────────────────────────────────────────────────
async function renderMensajes() {
  const data = await api("GET", "/mensajes");
  $("section-content").innerHTML = data.length
    ? `<div class="d-flex flex-column gap-3">${data.map(m => `
        <div class="msg-card ${!m.leido?"unread":""}">
          <div class="msg-meta">
            <span class="msg-tipo">${m.tipo}${m.propiedad_id?` · Prop. ${m.propiedad_id}`:""}</span>
            <span class="msg-date">${new Date(m.created_at).toLocaleDateString()}</span>
          </div>
          <div class="msg-body">${m.contenido}</div>
          <div class="msg-actions">
            ${!m.leido?`<button class="action-btn action-btn-edit" onclick="leerMensaje(${m.id})">Marcar leído</button>`:""}
            <button class="action-btn action-btn-danger" onclick="deleteMensaje(${m.id})">Eliminar</button>
          </div>
        </div>`).join("")}</div>`
    : `<div class="empty-state"><i class="bi bi-envelope"></i><p>No hay mensajes</p></div>`;
}

async function leerMensaje(id) { await api("PATCH",`/mensajes/${id}/leer`); renderMensajes(); }
async function deleteMensaje(id) {
  if (!confirm("¿Eliminar este mensaje?")) return;
  await api("DELETE",`/mensajes/${id}`); renderMensajes();
}

function formMensaje() {
  openModal("Nuevo mensaje", `
    <div class="mb-3"><label class="form-label">Propiedad ID (opcional)</label><input type="number" id="f-pid" class="form-control"/></div>
    <div class="mb-3"><label class="form-label">Tipo</label>
      <select id="f-tipo" class="form-select"><option>aviso</option><option>observacion</option></select>
    </div>
    <div class="mb-3"><label class="form-label">Contenido</label><textarea id="f-contenido" class="form-control" rows="4"></textarea></div>
  `, async () => {
    try {
      const pid = $("f-pid").value;
      await api("POST","/mensajes",{ propiedad_id:pid?parseInt(pid):null, tipo:$("f-tipo").value, contenido:$("f-contenido").value });
      closeModal(); renderMensajes(); showAlert("Enviado","success");
    } catch(e) { showAlert(e.message); }
  });
}

// ─── CUIDADOS / AVISOS ────────────────────────────────────────────────────────
async function renderCuidados() {
  const data = await api("GET", "/cuidados");
  $("section-content").innerHTML = data.length
    ? `<div class="row g-3">${data.map(c => `
        <div class="col-12 col-sm-6 col-md-4">
          <div class="aviso-card">
            <div class="aviso-title">${c.titulo}</div>
            <div class="aviso-body">${c.contenido}</div>
            <div class="aviso-footer">
              <span class="aviso-date">${new Date(c.created_at).toLocaleDateString()}</span>
              ${me.rol==="admin"?`
                <div style="display:flex;gap:6px">
                  <button class="action-btn action-btn-edit" onclick="editCuidado(${c.id})">Editar</button>
                  <button class="action-btn action-btn-danger" onclick="deleteCuidado(${c.id})">Eliminar</button>
                </div>`:""}
            </div>
          </div>
        </div>`).join("")}</div>`
    : `<div class="empty-state"><i class="bi bi-card-text"></i><p>Sin avisos publicados</p></div>`;
}

function formCuidado(c = {}) {
  openModal(c.id?"Editar aviso":"Nuevo aviso", `
    <div class="mb-3"><label class="form-label">Título</label><input id="f-titulo" class="form-control" value="${c.titulo||""}"/></div>
    <div class="mb-3"><label class="form-label">Contenido</label><textarea id="f-contenido" class="form-control" rows="4">${c.contenido||""}</textarea></div>
  `, async () => {
    const body = { titulo:$("f-titulo").value, contenido:$("f-contenido").value };
    try {
      c.id ? await api("PATCH",`/cuidados/${c.id}`,body) : await api("POST","/cuidados",body);
      closeModal(); renderCuidados(); showAlert("Guardado","success");
    } catch(e) { showAlert(e.message); }
  });
}
async function editCuidado(id) { formCuidado(await api("GET",`/cuidados/${id}`)); }
async function deleteCuidado(id) {
  if (!confirm("¿Eliminar este aviso?")) return;
  try { await api("DELETE",`/cuidados/${id}`); renderCuidados(); }
  catch(e) { showAlert(e.message); }
}

// ─── USUARIOS ─────────────────────────────────────────────────────────────────
async function renderUsuarios() {
  const data = await api("GET", "/usuarios");
  $("section-content").innerHTML = `
    <div class="iobal-table-wrap">
      <div class="table-responsive">
        <table class="iobal-table">
          <thead>
            <tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            ${data.length ? data.map(u => `
              <tr>
                <td class="td-strong">${u.nombre}</td>
                <td class="td-muted">${u.email}</td>
                <td>${statusBadge(u.rol)}</td>
                <td>${u.activo
                  ? `<span class="iobal-badge badge-activo">activo</span>`
                  : `<span class="iobal-badge badge-cancelado">inactivo</span>`}</td>
                <td>
                  <div style="display:flex;gap:6px">
                    <button class="action-btn action-btn-edit" onclick="editUsuario(${u.id})">Editar</button>
                    <button class="action-btn action-btn-danger" onclick="deleteUsuario(${u.id})">Desactivar</button>
                  </div>
                </td>
              </tr>`).join("")
            : `<tr><td colspan="5"><div class="empty-state"><i class="bi bi-people"></i><p>Sin usuarios</p></div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
}

function formUsuario(u = {}) {
  openModal(u.id?"Editar usuario":"Nuevo usuario", `
    <div class="mb-3"><label class="form-label">Nombre</label><input id="f-nombre" class="form-control" value="${u.nombre||""}"/></div>
    <div class="mb-3"><label class="form-label">Correo</label><input type="email" id="f-email" class="form-control" value="${u.email||""}"/></div>
    ${!u.id?`<div class="mb-3"><label class="form-label">Contraseña</label><input type="password" id="f-pass" class="form-control"/></div>`:""}
    <div class="mb-3"><label class="form-label">Rol</label>
      <select id="f-rol" class="form-select">
        ${["inquilino","propietario","admin"].map(r=>`<option ${u.rol===r?"selected":""}>${r}</option>`).join("")}
      </select>
    </div>
  `, async () => {
    const body = { nombre:$("f-nombre").value, email:$("f-email").value, rol:$("f-rol").value,
                   ...(!u.id?{password:$("f-pass").value}:{}) };
    try {
      u.id ? await api("PATCH",`/usuarios/${u.id}`,body) : await api("POST","/usuarios",body);
      closeModal(); renderUsuarios(); showAlert("Guardado","success");
    } catch(e) { showAlert(e.message); }
  });
}
async function editUsuario(id) { formUsuario(await api("GET",`/usuarios/${id}`)); }
async function deleteUsuario(id) {
  if (!confirm("¿Desactivar este usuario?")) return;
  try { await api("DELETE",`/usuarios/${id}`); renderUsuarios(); showAlert("Desactivado","success"); }
  catch(e) { showAlert(e.message); }
}


async function renderTi() {
  const data = await api("GET", "/ti/admins");
  $("section-content").innerHTML = `
    <div class="card border-0 shadow-sm">
      <div class="table-responsive">
        <table class="table table-hover mb-0">
          <thead class="table-light">
            <tr><th>Nombre</th><th>Email</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>${data.map(u => `
            <tr>
              <td class="fw-medium">${u.nombre}</td>
              <td class="text-muted">${u.email}</td>
              <td>${u.activo ? '<span class="badge bg-success">activo</span>' : '<span class="badge bg-secondary">inactivo</span>'}</td>
              <td>
                <button class="btn btn-sm btn-outline-secondary me-1" onclick="editAdminTi(${u.id})">Editar</button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteAdminTi(${u.id})">Desactivar</button>
              </td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>`;
}

function formAdminTi(u = {}) {
  openModal(u.id ? "Editar admin" : "Nuevo admin", `
    <div class="mb-3"><label class="form-label">Nombre</label><input id="f-nombre" class="form-control" value="${u.nombre || ""}"/></div>
    <div class="mb-3"><label class="form-label">Email</label><input type="email" id="f-email" class="form-control" value="${u.email || ""}"/></div>
    ${!u.id ? `<div class="mb-3"><label class="form-label">Contraseña</label><input type="password" id="f-pass" class="form-control"/></div>` : ""}
  `, async () => {
    const body = { nombre: $("f-nombre").value, email: $("f-email").value,
                   ...(!u.id ? { password: $("f-pass").value } : {}) };
    try {
      u.id ? await api("PATCH", `/ti/admins/${u.id}`, body) : await api("POST", "/ti/admins", body);
      closeModal(); renderTi(); showAlert("Guardado", "success");
    } catch(e) { showAlert(e.message); }
  });
}

async function editAdminTi(id) {
  const u = await api("GET", `/usuarios/${id}`);
  formAdminTi(u);
}

async function deleteAdminTi(id) {
  if (!confirm("¿Desactivar admin?")) return;
  try { await api("DELETE", `/ti/admins/${id}`); renderTi(); showAlert("Desactivado", "success"); }
  catch(e) { showAlert(e.message); }
}

const sections = {
  dashboard:   renderDashboard,
  propiedades: renderPropiedades,
  inquilinos:  renderInquilinos,
  contratos:   renderContratos,
  pagos:       renderPagos,
  mensajes:    renderMensajes,
  cuidados:    renderCuidados,
  usuarios:    renderUsuarios,
  ti:          renderTi,
};
const renderSection = s => sections[s]?.();

$("btn-new").onclick = () => {
  const forms = {
    propiedades: formPropiedad,
    inquilinos:  formInquilino,
    contratos:   formContrato,
    pagos:       formPago,
    mensajes:    formMensaje,
    cuidados:    formCuidado,
    usuarios:    formUsuario,
    ti:          formAdminTi,
  };
  forms[currentSection]?.();
};

// ─── INIT ─────────────────────────────────────────────────────────────────────
function initApp() {
  $("login-screen").classList.add("d-none");
  $("app-screen").classList.remove("d-none");
  bsModal = new bootstrap.Modal($("modal"));

  document.querySelectorAll(".admin-only").forEach(el => {
    el.style.display = ["admin","ti"].includes(me.rol) ? "" : "none";
  });
  document.querySelectorAll(".ti-only").forEach(el => {
    el.style.display = me.rol === "ti" ? "" : "none";
  });

  // Datos del usuario en sidebar
  if ($("user-name"))   $("user-name").textContent   = me.nombre;
  if ($("user-role"))   $("user-role").textContent   = me.rol;
  if ($("user-avatar")) $("user-avatar").textContent = me.nombre.charAt(0).toUpperCase();

  // Activar sección inicial
  const firstNav = document.querySelector('.nav-item[data-section="dashboard"]');
  if (firstNav) firstNav.classList.add("active");
  $("btn-new").classList.add("d-none");
  renderSection("dashboard");
}

if (token && me) initApp();
