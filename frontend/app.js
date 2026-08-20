const API = "/api/v1";
let token = localStorage.getItem("token");
let me = JSON.parse(localStorage.getItem("me") || "null");
let currentSection = "dashboard";
let bsModal;

const $ = id => document.getElementById(id);

const api = async (method, path, body) => {
  const res = await fetch(API + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const raw = await res.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { /* respuesta no-JSON, ver abajo */ }
  if (!res.ok) {
    throw new Error(detailToString(data) || `Error del servidor (${res.status}). Verifica que el backend y la base de datos estén actualizados.`);
  }
  return data;
};

// Convierte el "detail" de un error de FastAPI a texto legible, sea un string
// (HTTPException normal) o una lista de errores de validación de Pydantic (422).
const detailToString = data => {
  const d = data?.detail;
  if (!d) return null;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) {
    return d.map(e => {
      if (typeof e === "string") return e;
      const campo = Array.isArray(e.loc) ? e.loc.filter(x => x !== "body").join(".") : "";
      return campo ? `${campo}: ${e.msg}` : e.msg;
    }).filter(Boolean).join(" · ");
  }
  return typeof d === "object" ? JSON.stringify(d) : String(d);
};

const showAlert = (msg, type = "danger") => {
  const el = $("alert-global");
  el.textContent = msg;
  el.className = `iobal-alert iobal-alert-${type} mb-4`;
  el.classList.remove("d-none");
  setTimeout(() => el.classList.add("d-none"), 4000);
};

const statusBadge = s =>
  `<span class="iobal-badge badge-${s || "secondary"}">${s || "—"}</span>`;

const MESES = ["","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const mesNombre = m => MESES[m] || m;

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

const sidebar = $("sidebar");
const overlay = $("sidebar-overlay");
const openSidebar  = () => { sidebar.classList.add("open"); overlay.classList.remove("d-none"); };
const closeSidebar = () => { sidebar.classList.remove("open"); overlay.classList.add("d-none"); };

$("btn-hamburger").onclick    = openSidebar;
$("btn-close-sidebar").onclick = closeSidebar;
overlay.onclick               = closeSidebar;

const sectionMeta = {
  dashboard:   { title: "Resumen",     sub: "Vista general del sistema",          nuevo: false },
  propiedades: { title: "Propiedades", sub: "Gestión de inmuebles",               nuevo: true  },
  inquilinos:  { title: "Inquilinos",  sub: "Registro de inquilinos",             nuevo: true  },
  "resumen-inquilinos": { title: "Resumen inquilinos", sub: "Panorama por inquilino: propiedades, adeudos y servicios", nuevo: false },
  contratos:   { title: "Contratos",   sub: "Contratos activos y finalizados",    nuevo: true  },
  pagos:       { title: "Pagos",       sub: "Control de pagos mensuales",         nuevo: true  },
  mensajes:    { title: "Mensajes",    sub: "Avisos y observaciones",             nuevo: true  },
  cuidados:    { title: "Avisos",      sub: "Posts para inquilinos",              nuevo: true  },
  usuarios:    { title: "Usuarios",    sub: "Administración de cuentas",          nuevo: true  },
  adeudos:     { title: "Mi panel",    sub: "Tu contrato, propiedades, pagos y adeudos", nuevo: false },
  ti:          { title: "TI — Admins", sub: "Gestión de cuentas administradoras", nuevo: true  },
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
    const msgNoLeidos   = mensajes.filter(m => !m.leido).length;
    const totalRenta    = contratos
      .filter(c => c.status === "activo")
      .reduce((s, c) => s + c.monto_mensual, 0);

    const pagosPendientes = pagos.filter(p => p.status === "pendiente");
    const pagosAtrasados  = pagos.filter(p => p.status === "atrasado");
    const pagosParciales  = pagos.filter(p => p.status === "parcial");
    const pagosCumplidos  = pagos.filter(p => p.status === "pagado");
    const montoAdeudado = [...pagosPendientes, ...pagosAtrasados, ...pagosParciales]
      .reduce((s, p) => s + p.total, 0);
    const montoCobrado  = pagosCumplidos.reduce((s, p) => s + p.total, 0);

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
          <div class="stat-icon green"><i class="bi bi-envelope-open"></i></div>
          <div>
            <div class="stat-value">${msgNoLeidos}</div>
            <div class="stat-label">Mensajes sin leer</div>
          </div>
        </div>
      </div>

      <div class="dashboard-section-label"><i class="bi bi-credit-card"></i> Estado de pagos</div>
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-icon green"><i class="bi bi-check-circle"></i></div>
          <div>
            <div class="stat-value">${pagosCumplidos.length}</div>
            <div class="stat-label">Cumplidos</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon yellow"><i class="bi bi-hourglass-split"></i></div>
          <div>
            <div class="stat-value">${pagosPendientes.length}</div>
            <div class="stat-label">Pendientes</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon red"><i class="bi bi-exclamation-circle"></i></div>
          <div>
            <div class="stat-value">${pagosAtrasados.length}</div>
            <div class="stat-label">Atrasados</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon indigo"><i class="bi bi-slash-circle"></i></div>
          <div>
            <div class="stat-value">${pagosParciales.length}</div>
            <div class="stat-label">Parciales</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon red"><i class="bi bi-cash-stack"></i></div>
          <div>
            <div class="stat-value">$${montoAdeudado.toLocaleString()}</div>
            <div class="stat-label">Total adeudado</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green"><i class="bi bi-cash-coin"></i></div>
          <div>
            <div class="stat-value">$${montoCobrado.toLocaleString()}</div>
            <div class="stat-label">Total cobrado</div>
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

async function renderInquilinos() {
  const data = await api("GET", "/inquilinos");
  $("section-content").innerHTML = `
    <div class="iobal-table-wrap">
      <div class="table-responsive">
        <table class="iobal-table">
          <thead>
            <tr><th>ID</th><th>Nombre</th><th>Correo</th><th>Teléfono</th><th>Referencias</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            ${data.length ? data.map(i => `
              <tr>
                <td>${i.id}</td>
                <td class="td-strong">${i.nombre || "—"}</td>
                <td class="td-muted">${i.email || "—"}</td>
                <td>${i.telefono || "—"}</td>
                <td class="td-muted">${i.referencias ? i.referencias.slice(0,60)+"…" : "—"}</td>
                <td>${i.estado === "vigente"
                  ? `<span class="iobal-badge badge-activo">Vigente</span>`
                  : `<span class="iobal-badge badge-cancelado">Baja</span>`}</td>
                <td><button class="action-btn action-btn-edit" onclick="editInquilino(${i.id})">Editar</button></td>
              </tr>`).join("")
            : `<tr><td colspan="7"><div class="empty-state"><i class="bi bi-people"></i><p>Sin inquilinos registrados</p></div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
}

function formInquilino(i = {}) {
  const isEdit = !!i.id;
  openModal(isEdit ? "Editar inquilino" : "Nuevo inquilino", `
    <div class="mb-3"><label class="form-label">Nombre</label><input id="f-nombre" class="form-control" value="${i.nombre||""}"/></div>
    <div class="mb-3"><label class="form-label">Correo</label><input type="email" id="f-email" class="form-control" value="${i.email||""}"/></div>
    <div class="mb-3">
      <label class="form-label">${isEdit ? "Nueva contraseña (déjalo vacío para no cambiarla)" : "Contraseña"}</label>
      <input type="password" id="f-pass" class="form-control"/>
    </div>
    <div class="mb-3"><label class="form-label">Teléfono</label><input id="f-tel" class="form-control" value="${i.telefono||""}"/></div>
    <div class="mb-3"><label class="form-label">Referencias</label><textarea id="f-ref" class="form-control" rows="3">${i.referencias||""}</textarea></div>
    <div class="mb-3"><label class="form-label">Estado</label>
      <select id="f-estado" class="form-select">
        <option value="vigente" ${i.estado!=="baja"?"selected":""}>Vigente</option>
        <option value="baja" ${i.estado==="baja"?"selected":""}>Baja</option>
      </select>
    </div>
  `, async () => {
    const pass = $("f-pass").value;
    const body = {
      nombre: $("f-nombre").value,
      email: $("f-email").value,
      telefono: $("f-tel").value,
      referencias: $("f-ref").value,
      estado: $("f-estado").value,
      ...(pass ? { password: pass } : {}),
    };
    try {
      isEdit ? await api("PATCH",`/inquilinos/${i.id}`,body) : await api("POST","/inquilinos",body);
      closeModal(); renderInquilinos(); showAlert("Guardado","success");
    } catch(e) { showAlert(e.message); }
  });
}
async function editInquilino(id) { formInquilino(await api("GET",`/inquilinos/${id}`)); }

async function renderResumenInquilinos() {
  const [inquilinos, contratos, propiedades, pagos] = await Promise.all([
    api("GET", "/inquilinos"),
    api("GET", "/contratos"),
    api("GET", "/propiedades"),
    api("GET", "/pagos"),
  ]);
  const propMap = Object.fromEntries(propiedades.map(p => [p.id, p]));

  const cards = inquilinos.map(inq => {
    const suyoContratos = contratos.filter(c => c.inquilino_id === inq.id);
    const idsContratos  = suyoContratos.map(c => c.id);
    const pagosInq      = pagos.filter(p => idsContratos.includes(p.contrato_id));
    const noPagados     = pagosInq
      .filter(p => p.status !== "pagado")
      .sort((a,b) => (a.anio - b.anio) || (a.mes - b.mes));
    const totalAdeudado = noPagados.reduce((s,p) => s + p.total, 0);
    const servicios = [...new Set(noPagados.flatMap(p => p.conceptos.map(c => c.tipo)))];
    return { inq, suyoContratos, noPagados, totalAdeudado, servicios };
  });

  $("section-content").innerHTML = `
    <div class="tenant-summary-grid">
      ${cards.length ? cards.map(({ inq, suyoContratos, noPagados, totalAdeudado, servicios }) => `
        <div class="tenant-card">
          <div class="tenant-card-header">
            <div class="tenant-avatar">${(inq.nombre || "?").charAt(0).toUpperCase()}</div>
            <div class="tenant-id-block">
              <div class="tenant-name">${inq.nombre || `Inquilino #${inq.id}`}</div>
              <div class="tenant-email">${inq.email || "—"}</div>
            </div>
            <span class="iobal-badge ${inq.estado === "vigente" ? "badge-activo" : "badge-cancelado"}">
              ${inq.estado === "vigente" ? "Vigente" : "Baja"}
            </span>
          </div>

          <div class="tenant-card-body">
            <div class="tenant-row"><i class="bi bi-telephone"></i> ${inq.telefono || "Sin teléfono"}</div>

            <div class="tenant-section-title">Propiedades</div>
            ${suyoContratos.length ? suyoContratos.map(c => {
              const prop = propMap[c.propiedad_id];
              return `
                <div class="tenant-row">
                  <i class="bi bi-building"></i>
                  ${prop ? `${prop.nombre} — ${prop.direccion}` : `Propiedad #${c.propiedad_id}`}
                  <div class="tenant-row-sub">
                    $${c.monto_mensual.toLocaleString()}/mes
                    ${c.cobro_recurrente ? ` · cobro recurrente día ${c.dia_cobro}` : " · cobro puntual"}
                    · ${statusBadge(c.status)}
                  </div>
                </div>`;
            }).join("") : `<div class="tenant-row td-muted">Sin contrato registrado</div>`}

            <div class="tenant-section-title">Meses / pagos no cubiertos</div>
            ${noPagados.length ? `
              <div class="tenant-chip-list">
                ${noPagados.map(p => `
                  <span class="iobal-badge badge-${p.status}" title="$${p.total.toLocaleString()}">
                    ${mesNombre(p.mes)} ${p.anio}
                  </span>`).join("")}
              </div>
            ` : `<div class="tenant-row tenant-ok"><i class="bi bi-check-circle"></i> Al corriente</div>`}

            ${servicios.length ? `
              <div class="tenant-section-title">Servicios pendientes</div>
              <div class="tenant-chip-list">
                ${servicios.map(s => `<span class="iobal-badge badge-pendiente">${s}</span>`).join("")}
              </div>
            ` : ""}
          </div>

          <div class="tenant-card-footer">
            <span>Total adeudado</span>
            <span class="tenant-total ${totalAdeudado > 0 ? "tenant-total-danger" : "tenant-total-ok"}">
              $${totalAdeudado.toLocaleString()}
            </span>
          </div>
        </div>
      `).join("") : `<div class="empty-state"><i class="bi bi-people"></i><p>Sin inquilinos registrados</p></div>`}
    </div>`;
}

async function renderContratos() {
  const [data, inquilinos] = await Promise.all([
    api("GET", "/contratos"),
    api("GET", "/inquilinos").catch(() => []),
  ]);
  const inqMap = Object.fromEntries(inquilinos.map(i => [i.id, i.nombre || `Inquilino #${i.id}`]));
  $("section-content").innerHTML = `
    <div class="iobal-table-wrap">
      <div class="table-responsive">
        <table class="iobal-table">
          <thead>
            <tr><th>ID</th><th>Propiedad</th><th>Inquilino</th><th>Inicio</th><th>Fin</th><th>Monto</th><th>Cobro</th><th>Aval</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            ${data.length ? data.map(c => `
              <tr>
                <td>${c.id}</td><td>${c.propiedad_id}</td><td>${inqMap[c.inquilino_id] || `#${c.inquilino_id}`}</td>
                <td class="td-muted">${c.fecha_inicio}</td><td class="td-muted">${c.fecha_fin}</td>
                <td class="td-strong">$${c.monto_mensual.toLocaleString()}</td>
                <td>${c.cobro_recurrente
                  ? `<span class="iobal-badge badge-activo"><i class="bi bi-arrow-repeat"></i> Recurrente · día ${c.dia_cobro}</span>`
                  : `<span class="iobal-badge badge-pendiente">Puntual</span>`}</td>
                <td class="td-muted">${c.aval_nombre || "—"}</td>
                <td>${statusBadge(c.status)}</td>
                <td><button class="action-btn action-btn-edit" onclick="editContrato(${c.id})">Editar</button></td>
              </tr>`).join("")
            : `<tr><td colspan="10"><div class="empty-state"><i class="bi bi-file-earmark-text"></i><p>Sin contratos registrados</p></div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
}

async function formContrato(c = {}) {
  const isEdit = !!c.id;
  openModal(isEdit ? "Editar contrato" : "Nuevo contrato", `
    <div class="form-section">
      <div class="form-section-title"><i class="bi bi-file-earmark-text"></i> Datos del contrato</div>
      ${!isEdit ? `
        <div class="row g-2">
          <div class="col-12 col-sm-6 mb-3"><label class="form-label">Propiedad ID</label><input type="number" id="f-pid" class="form-control"/></div>
          <div class="col-12 col-sm-6 mb-3">
            <label class="form-label">Inquilino</label>
            <select id="f-iid" class="form-select"><option>Cargando inquilinos activos…</option></select>
          </div>
        </div>
        <div class="row g-2">
          <div class="col-12 col-sm-6 mb-3"><label class="form-label">Fecha inicio</label><input type="date" id="f-fi" class="form-control"/></div>
          <div class="col-12 col-sm-6 mb-3"><label class="form-label">Fecha fin</label><input type="date" id="f-ff" class="form-control"/></div>
        </div>
      ` : `
        <div class="row g-2">
          <div class="col-12 col-sm-6 mb-3"><label class="form-label">Fecha fin</label><input type="date" id="f-ff" class="form-control" value="${c.fecha_fin || ""}"/></div>
          <div class="col-12 col-sm-6 mb-3"><label class="form-label">Estado</label>
            <select id="f-status" class="form-select">
              ${["activo","finalizado","cancelado"].map(s=>`<option ${c.status===s?"selected":""}>${s}</option>`).join("")}
            </select>
          </div>
        </div>
      `}
      <div class="mb-3">
        <label class="form-label">Descripción</label>
        <textarea id="f-desc" class="form-control" rows="3" placeholder="Condiciones particulares, observaciones u otros detalles del contrato...">${c.descripcion || ""}</textarea>
      </div>
    </div>

    <div class="form-section">
      <div class="form-section-title"><i class="bi bi-credit-card"></i> Cobro</div>
      <div class="mb-3"><label class="form-label">Monto mensual</label><input type="number" id="f-monto" class="form-control" value="${c.monto_mensual ?? ""}"/></div>
      <div class="form-check form-switch mb-3">
        <input class="form-check-input" type="checkbox" id="f-recurrente" ${c.cobro_recurrente !== false ? "checked" : ""}/>
        <label class="form-check-label" for="f-recurrente">Cobro recurrente (genera el pago automáticamente cada mes)</label>
      </div>
      <div class="mb-3">
        <label class="form-label">Día de cobro</label>
        <input type="number" min="1" max="28" id="f-dia-cobro" class="form-control" value="${c.dia_cobro || 1}"/>
      </div>
    </div>

    <div class="form-section">
      <div class="form-section-title"><i class="bi bi-person-badge"></i> Datos del aval</div>
      <div class="mb-3"><label class="form-label">Nombre</label><input id="f-aval-nombre" class="form-control" value="${c.aval_nombre || ""}"/></div>

      <div class="row g-2">
        <div class="col-12 col-sm-8 mb-3"><label class="form-label">Calle</label><input id="f-aval-calle" class="form-control" value="${c.aval_calle || ""}"/></div>
        <div class="col-12 col-sm-4 mb-3"><label class="form-label">Número</label><input id="f-aval-numero" class="form-control" value="${c.aval_numero || ""}"/></div>
      </div>
      <div class="row g-2">
        <div class="col-12 col-sm-6 mb-3"><label class="form-label">Colonia</label><input id="f-aval-colonia" class="form-control" value="${c.aval_colonia || ""}"/></div>
        <div class="col-12 col-sm-6 mb-3"><label class="form-label">Ciudad</label><input id="f-aval-ciudad" class="form-control" value="${c.aval_ciudad || ""}"/></div>
      </div>
      <div class="row g-2">
        <div class="col-12 col-sm-6 mb-3"><label class="form-label">Estado</label><input id="f-aval-estado" class="form-control" value="${c.aval_estado || ""}"/></div>
        <div class="col-12 col-sm-6 mb-3"><label class="form-label">Código postal</label><input id="f-aval-cp" class="form-control" value="${c.aval_cp || ""}"/></div>
      </div>

      <div class="mb-3"><label class="form-label">No. de predial</label><input id="f-aval-predial" class="form-control" value="${c.aval_no_predial || ""}"/></div>
      <div class="mb-3"><label class="form-label">Email</label><input type="email" id="f-aval-email" class="form-control" value="${c.aval_email || ""}"/></div>

      <div class="row g-2">
        <div class="col-12 col-sm-6 mb-3"><label class="form-label">Teléfono casa</label><input id="f-aval-tel-casa" class="form-control" value="${c.aval_telefono_casa || ""}"/></div>
        <div class="col-12 col-sm-6 mb-3"><label class="form-label">Teléfono celular</label><input id="f-aval-tel-cel" class="form-control" value="${c.aval_telefono_celular || ""}"/></div>
      </div>
    </div>
  `, async () => {
    const orNull = v => (v && v.trim() !== "" ? v.trim() : null);
    const body = {
      descripcion: orNull($("f-desc").value),
      cobro_recurrente: $("f-recurrente").checked,
      dia_cobro: parseInt($("f-dia-cobro").value) || 1,
      monto_mensual: parseFloat($("f-monto").value),
      aval_nombre: orNull($("f-aval-nombre").value),
      aval_calle: orNull($("f-aval-calle").value),
      aval_numero: orNull($("f-aval-numero").value),
      aval_colonia: orNull($("f-aval-colonia").value),
      aval_ciudad: orNull($("f-aval-ciudad").value),
      aval_estado: orNull($("f-aval-estado").value),
      aval_cp: orNull($("f-aval-cp").value),
      aval_no_predial: orNull($("f-aval-predial").value),
      aval_email: orNull($("f-aval-email").value),
      aval_telefono_casa: orNull($("f-aval-tel-casa").value),
      aval_telefono_celular: orNull($("f-aval-tel-cel").value),
      ...(isEdit
        ? { fecha_fin: $("f-ff").value, status: $("f-status").value }
        : { propiedad_id: parseInt($("f-pid").value), inquilino_id: parseInt($("f-iid").value),
            fecha_inicio: $("f-fi").value, fecha_fin: $("f-ff").value }),
    };
    try {
      isEdit ? await api("PATCH",`/contratos/${c.id}`, body) : await api("POST","/contratos", body);
      closeModal(); renderContratos(); showAlert("Guardado","success");
    } catch(e) { showAlert(e.message); }
  });

  if (!isEdit) {
    try {
      const inquilinos = await api("GET", "/inquilinos?estado=vigente");
      $("f-iid").innerHTML = inquilinos.length
        ? inquilinos.map(i => `<option value="${i.id}">${i.nombre || `Inquilino #${i.id}`}</option>`).join("")
        : `<option value="">No hay inquilinos vigentes disponibles</option>`;
    } catch(e) { $("f-iid").innerHTML = `<option value="">Error al cargar inquilinos</option>`; }
  }
}
async function editContrato(id) { formContrato(await api("GET",`/contratos/${id}`)); }

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
    <div class="mb-3"><label class="form-label">Tipo de pago</label>
      <select id="f-tipo-pago" class="form-select">
        <option value="puntual">Puntual</option>
        <option value="recurrente">Recurrente</option>
      </select>
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

async function renderMensajes() {
  const data = await api("GET", "/mensajes");
  const estadoOpts = ["pendiente","visto","parcial","resuelto"];
  $("section-content").innerHTML = `
    <div class="msg-list">${data.length ? data.map(m => `
      <div class="iobal-msg-item ${!m.leido ? "unread" : ""}">
        <div class="msg-header">
          <div class="d-flex align-items-center gap-2">
            <span class="iobal-badge badge-${m.tipo === "aviso" ? "activo" : "pendiente"}">${m.tipo}</span>
            ${statusBadge(m.estado || "pendiente")}
            ${m.propiedad_id ? `<span class="td-muted small">Prop. ${m.propiedad_id}</span>` : ""}
          </div>
          <span class="td-muted small">${new Date(m.created_at).toLocaleDateString()}</span>
        </div>
        <p class="msg-content">${m.contenido}</p>
        <div class="d-flex gap-2 align-items-center flex-wrap mt-2">
          <select class="form-select form-select-sm" style="width:auto" onchange="cambiarEstadoMsg(${m.id}, this.value)">
            ${estadoOpts.map(e => `<option ${m.estado===e?"selected":""}>${e}</option>`).join("")}
          </select>
          <button class="action-btn action-btn-danger" onclick="deleteMensaje(${m.id})">Eliminar</button>
        </div>
      </div>`).join("")
    : "<div class=\"empty-state\"><i class=\"bi bi-chat\"></i><p>Sin mensajes</p></div>"}
    </div>`;
}

async function cambiarEstadoMsg(id, estado) {
  try { await api("PATCH", `/mensajes/${id}/estado?estado=${estado}`); renderMensajes(); }
  catch(e) { showAlert(e.message); }
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
        ${["propietario","admin"].map(r=>`<option ${u.rol===r?"selected":""}>${r}</option>`).join("")}
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

async function renderMiPanel() {
  const [inq, contratos, pagos] = await Promise.all([
    api("GET", "/inquilinos/me"),
    api("GET", "/contratos/mis-contratos"),
    api("GET", "/pagos/mis-pagos"),
  ]);

  const propiedades = await Promise.all(
    contratos.map(c => api("GET", `/propiedades/${c.propiedad_id}`).catch(() => null))
  );
  const propMap = Object.fromEntries(contratos.map((c, idx) => [c.id, propiedades[idx]]));

  let mensajes = [];
  const contratoActivo = contratos.find(c => c.status === "activo");
  if (contratoActivo) {
    const prop = propMap[contratoActivo.id];
    if (prop) mensajes = await api("GET", `/mensajes?propiedad_id=${prop.id}`).catch(() => []);
  }

  const noPagados     = pagos.filter(p => p.status !== "pagado");
  const pagosPagados  = pagos.filter(p => p.status === "pagado");
  const totalAdeudado = noPagados.reduce((s, p) => s + p.total, 0);
  const totalPagado   = pagosPagados.reduce((s, p) => s + p.total, 0);
  const servicios     = [...new Set(noPagados.flatMap(p => p.conceptos.map(c => c.tipo)))];

  $("section-content").innerHTML = `
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-icon ${totalAdeudado > 0 ? "red" : "green"}"><i class="bi bi-cash-stack"></i></div>
        <div><div class="stat-value">$${totalAdeudado.toLocaleString()}</div><div class="stat-label">Total adeudado</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green"><i class="bi bi-cash-coin"></i></div>
        <div><div class="stat-value">$${totalPagado.toLocaleString()}</div><div class="stat-label">Total pagado</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon yellow"><i class="bi bi-hourglass-split"></i></div>
        <div><div class="stat-value">${noPagados.length}</div><div class="stat-label">Meses/pagos pendientes</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon indigo"><i class="bi bi-file-earmark-text"></i></div>
        <div><div class="stat-value">${contratos.filter(c => c.status === "activo").length}</div><div class="stat-label">Contratos activos</div></div>
      </div>
    </div>

    <div class="tenant-summary-grid tenant-summary-grid-single">
      <div class="tenant-card">
        <div class="tenant-card-header">
          <div class="tenant-avatar">${(inq.nombre || "?").charAt(0).toUpperCase()}</div>
          <div class="tenant-id-block">
            <div class="tenant-name">${inq.nombre || "—"}</div>
            <div class="tenant-email">${inq.email || "—"}</div>
          </div>
          <span class="iobal-badge ${inq.estado === "vigente" ? "badge-activo" : "badge-cancelado"}">
            ${inq.estado === "vigente" ? "Vigente" : "Baja"}
          </span>
        </div>

        <div class="tenant-card-body">
          <div class="tenant-row"><i class="bi bi-telephone"></i> ${inq.telefono || "Sin teléfono"}</div>
          ${inq.referencias ? `<div class="tenant-row"><i class="bi bi-card-text"></i> ${inq.referencias}</div>` : ""}

          <div class="tenant-section-title">Mis propiedades y contratos</div>
          ${contratos.length ? contratos.map(c => {
            const prop = propMap[c.id];
            return `
              <div class="tenant-row">
                <i class="bi bi-building"></i>
                ${prop ? `${prop.nombre} — ${prop.direccion}` : `Propiedad #${c.propiedad_id}`}
                <div class="tenant-row-sub">
                  ${c.fecha_inicio} → ${c.fecha_fin} · $${c.monto_mensual.toLocaleString()}/mes
                  ${c.cobro_recurrente ? ` · cobro recurrente día ${c.dia_cobro}` : " · cobro puntual"}
                  · ${statusBadge(c.status)}
                </div>
              </div>`;
          }).join("") : `<div class="tenant-row td-muted">No tienes contratos registrados</div>`}

          ${servicios.length ? `
            <div class="tenant-section-title">Servicios pendientes</div>
            <div class="tenant-chip-list">
              ${servicios.map(s => `<span class="iobal-badge badge-pendiente">${s}</span>`).join("")}
            </div>
          ` : ""}

          ${mensajes.length ? `
            <div class="tenant-section-title">Avisos recientes</div>
            ${mensajes.slice(0, 3).map(m => `
              <div class="tenant-row"><i class="bi bi-megaphone"></i> ${m.contenido}</div>
            `).join("")}
          ` : ""}
        </div>

        <div class="tenant-card-footer">
          <span>Total adeudado</span>
          <span class="tenant-total ${totalAdeudado > 0 ? "tenant-total-danger" : "tenant-total-ok"}">
            $${totalAdeudado.toLocaleString()}
          </span>
        </div>
      </div>
    </div>

    <div class="dashboard-section-label"><i class="bi bi-receipt"></i> Historial de pagos</div>
    <div class="iobal-table-wrap">
      <div class="table-responsive">
        <table class="iobal-table">
          <thead><tr><th>Mes/Año</th><th>Tipo</th><th>Conceptos</th><th>Total</th><th>Estado</th></tr></thead>
          <tbody>${pagos.length ? pagos.map(p => `
            <tr>
              <td>${mesNombre(p.mes)} ${p.anio}</td>
              <td>${p.tipo === "recurrente" ? '<span class="iobal-badge badge-activo">recurrente</span>' : '<span class="iobal-badge badge-pendiente">puntual</span>'}</td>
              <td class="td-muted small">${p.conceptos.map(c => `${c.tipo}: $${c.monto}`).join(", ")}</td>
              <td class="td-strong">$${p.total.toLocaleString()}</td>
              <td>${statusBadge(p.status)}</td>
            </tr>`).join("")
          : `<tr><td colspan="5"><div class="empty-state"><i class="bi bi-check-circle"></i><p>Sin pagos registrados todavía</p></div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
}

const sections = {
  dashboard:   renderDashboard,
  propiedades: renderPropiedades,
  inquilinos:  renderInquilinos,
  "resumen-inquilinos": renderResumenInquilinos,
  contratos:   renderContratos,
  pagos:       renderPagos,
  mensajes:    renderMensajes,
  cuidados:    renderCuidados,
  usuarios:    renderUsuarios,
  adeudos:     renderMiPanel,
  ti:          renderTi,
};
const renderSection = async s => {
  try {
    await sections[s]?.();
  } catch (e) {
    $("section-content").innerHTML = `
      <div class="empty-state">
        <i class="bi bi-exclamation-triangle text-danger"></i>
        <p>No se pudo cargar esta sección.</p>
        <p class="td-muted small">${e.message || "Error desconocido"}</p>
      </div>`;
    showAlert(e.message || "Error al cargar la sección");
  }
};

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

function initApp() {
  $("login-screen").classList.add("d-none");
  $("app-screen").classList.remove("d-none");
  bsModal = new bootstrap.Modal($("modal"));

  document.querySelectorAll(".admin-only").forEach(el => {
    el.style.display = ["admin","ti"].includes(me.rol) ? "" : "none";
  });
  document.querySelectorAll(".staff-only").forEach(el => {
    el.style.display = ["admin","propietario","ti"].includes(me.rol) ? "" : "none";
  });
  document.querySelectorAll(".ti-only").forEach(el => {
    el.style.display = me.rol === "ti" ? "" : "none";
  });
  document.querySelectorAll(".inquilino-only").forEach(el => {
    el.style.display = me.rol === "inquilino" ? "" : "none";
  });

  // Datos del usuario en sidebar
  if ($("user-name"))   $("user-name").textContent   = me.nombre;
  if ($("user-role"))   $("user-role").textContent   = me.rol;
  if ($("user-avatar")) $("user-avatar").textContent = me.nombre.charAt(0).toUpperCase();

  // Sección inicial según el rol: el panel administrativo (Resumen) no aplica a inquilinos
  const inicio = me.rol === "inquilino" ? "adeudos" : "dashboard";
  document.querySelectorAll(".nav-item").forEach(x => x.classList.remove("active"));
  const navInicio = document.querySelector(`.nav-item[data-section="${inicio}"]`);
  if (navInicio) navInicio.classList.add("active");
  currentSection = inicio;
  const meta = sectionMeta[inicio] || {};
  $("section-title").textContent = meta.title || inicio;
  $("section-sub").textContent   = meta.sub   || "";
  $("btn-new").classList.toggle("d-none", !meta.nuevo);
  renderSection(inicio);
}

if (token && me) initApp();
