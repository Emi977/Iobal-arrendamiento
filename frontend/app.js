const API = "/api/v1";
let token = localStorage.getItem("token");
let me = JSON.parse(localStorage.getItem("me") || "null");
let currentSection = "propiedades";

const $ = id => document.getElementById(id);

const api = async (method, path, body) => {
  const res = await fetch(API + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Error");
  return data;
};

const showAlert = (msg, type = "error") => {
  const el = $("alert-global");
  el.textContent = msg;
  el.className = `alert alert-${type}`;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 4000);
};

const badge = (text, color) => `<span class="badge badge-${color}">${text}</span>`;

const statusColor = { activo: "green", finalizado: "gray", cancelado: "red",
                      vacante: "yellow", ocupada: "blue", pagado: "green",
                      pendiente: "yellow", atrasado: "red" };

const statusBadge = s => badge(s, statusColor[s] || "gray");

const openModal = (title, html, onSave) => {
  $("modal-title").textContent = title;
  $("modal-body").innerHTML = html + `
    <div class="modal-actions">
      <button class="btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn-primary" id="modal-save">Guardar</button>
    </div>`;
  if (onSave) $("modal-save").onclick = onSave;
  $("modal").classList.remove("hidden");
};

const closeModal = () => $("modal").classList.add("hidden");
$("modal-close").onclick = closeModal;

$("btn-login").onclick = async () => {
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
    $("login-error").textContent = e.message;
    $("login-error").classList.remove("hidden");
  }
};

$("btn-logout").onclick = () => {
  localStorage.clear();
  token = null; me = null;
  $("app-screen").classList.add("hidden");
  $("login-screen").classList.remove("hidden");
};

document.querySelectorAll(".nav-item").forEach(a => {
  a.onclick = () => {
    document.querySelectorAll(".nav-item").forEach(x => x.classList.remove("active"));
    a.classList.add("active");
    currentSection = a.dataset.section;
    $("section-title").textContent = a.textContent.trim();
    renderSection(currentSection);
  };
});

async function renderPropiedades() {
  const data = await api("GET", "/propiedades");
  $("section-content").innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Nombre</th><th>Dirección</th><th>Tipo</th><th>Renta</th><th>Estado</th><th></th></tr></thead>
        <tbody>${data.map(p => `
          <tr>
            <td>${p.nombre}</td>
            <td>${p.direccion}</td>
            <td>${p.tipo}</td>
            <td>$${p.precio_renta.toLocaleString()}</td>
            <td>${statusBadge(p.status)}</td>
            <td>
              <button class="btn-secondary" onclick="editPropiedad(${p.id})">Editar</button>
              ${me.rol === "admin" ? `<button class="btn-danger" onclick="deletePropiedad(${p.id})">Eliminar</button>` : ""}
            </td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

function formPropiedad(p = {}) {
  openModal(p.id ? "Editar propiedad" : "Nueva propiedad", `
    <div class="field"><label>Nombre</label><input id="f-nombre" value="${p.nombre || ""}"/></div>
    <div class="field"><label>Dirección</label><input id="f-dir" value="${p.direccion || ""}"/></div>
    <div class="field"><label>Tipo</label>
      <select id="f-tipo">
        ${["casa","departamento","local"].map(t => `<option ${p.tipo===t?"selected":""}>${t}</option>`).join("")}
      </select>
    </div>
    <div class="field"><label>Precio renta</label><input type="number" id="f-precio" value="${p.precio_renta || ""}"/></div>
  `, async () => {
    const body = { nombre: $("f-nombre").value, direccion: $("f-dir").value,
                   tipo: $("f-tipo").value, precio_renta: parseFloat($("f-precio").value) };
    try {
      p.id ? await api("PATCH", `/propiedades/${p.id}`, body) : await api("POST", "/propiedades", body);
      closeModal(); renderPropiedades(); showAlert("Guardado", "success");
    } catch(e) { showAlert(e.message); }
  });
}

async function editPropiedad(id) {
  const p = await api("GET", `/propiedades/${id}`);
  formPropiedad(p);
}

async function deletePropiedad(id) {
  if (!confirm("¿Eliminar propiedad?")) return;
  try { await api("DELETE", `/propiedades/${id}`); renderPropiedades(); showAlert("Eliminada", "success"); }
  catch(e) { showAlert(e.message); }
}

async function renderInquilinos() {
  const data = await api("GET", "/inquilinos");
  $("section-content").innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>ID</th><th>Usuario ID</th><th>Teléfono</th><th>Referencias</th><th></th></tr></thead>
        <tbody>${data.map(i => `
          <tr>
            <td>${i.id}</td><td>${i.usuario_id}</td>
            <td>${i.telefono || "—"}</td>
            <td>${i.referencias ? i.referencias.slice(0,40)+"..." : "—"}</td>
            <td><button class="btn-secondary" onclick="editInquilino(${i.id})">Editar</button></td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

function formInquilino(i = {}) {
  openModal(i.id ? "Editar inquilino" : "Nuevo inquilino", `
    ${!i.id ? `<div class="field"><label>Usuario ID</label><input type="number" id="f-uid"/></div>` : ""}
    <div class="field"><label>Teléfono</label><input id="f-tel" value="${i.telefono || ""}"/></div>
    <div class="field"><label>Referencias</label><textarea id="f-ref">${i.referencias || ""}</textarea></div>
  `, async () => {
    const body = { telefono: $("f-tel").value, referencias: $("f-ref").value,
                   ...(!i.id ? { usuario_id: parseInt($("f-uid").value) } : {}) };
    try {
      i.id ? await api("PATCH", `/inquilinos/${i.id}`, body) : await api("POST", "/inquilinos", body);
      closeModal(); renderInquilinos(); showAlert("Guardado", "success");
    } catch(e) { showAlert(e.message); }
  });
}

async function editInquilino(id) {
  const i = await api("GET", `/inquilinos/${id}`);
  formInquilino(i);
}

async function renderContratos() {
  const data = await api("GET", "/contratos");
  $("section-content").innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>ID</th><th>Propiedad</th><th>Inquilino</th><th>Inicio</th><th>Fin</th><th>Monto</th><th>Estado</th><th></th></tr></thead>
        <tbody>${data.map(c => `
          <tr>
            <td>${c.id}</td><td>${c.propiedad_id}</td><td>${c.inquilino_id}</td>
            <td>${c.fecha_inicio}</td><td>${c.fecha_fin}</td>
            <td>$${c.monto_mensual.toLocaleString()}</td>
            <td>${statusBadge(c.status)}</td>
            <td><button class="btn-secondary" onclick="editContrato(${c.id})">Editar</button></td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

function formContrato(c = {}) {
  openModal(c.id ? "Editar contrato" : "Nuevo contrato", `
    ${!c.id ? `
      <div class="field"><label>Propiedad ID</label><input type="number" id="f-pid"/></div>
      <div class="field"><label>Inquilino ID</label><input type="number" id="f-iid"/></div>
      <div class="field"><label>Fecha inicio</label><input type="date" id="f-fi"/></div>
      <div class="field"><label>Fecha fin</label><input type="date" id="f-ff"/></div>
      <div class="field"><label>Monto mensual</label><input type="number" id="f-monto"/></div>
    ` : `
      <div class="field"><label>Fecha fin</label><input type="date" id="f-ff" value="${c.fecha_fin}"/></div>
      <div class="field"><label>Monto mensual</label><input type="number" id="f-monto" value="${c.monto_mensual}"/></div>
      <div class="field"><label>Estado</label>
        <select id="f-status">
          ${["activo","finalizado","cancelado"].map(s => `<option ${c.status===s?"selected":""}>${s}</option>`).join("")}
        </select>
      </div>
    `}
  `, async () => {
    try {
      if (c.id) {
        await api("PATCH", `/contratos/${c.id}`, {
          fecha_fin: $("f-ff").value,
          monto_mensual: parseFloat($("f-monto").value),
          status: $("f-status").value,
        });
      } else {
        await api("POST", "/contratos", {
          propiedad_id: parseInt($("f-pid").value),
          inquilino_id: parseInt($("f-iid").value),
          fecha_inicio: $("f-fi").value,
          fecha_fin: $("f-ff").value,
          monto_mensual: parseFloat($("f-monto").value),
        });
      }
      closeModal(); renderContratos(); showAlert("Guardado", "success");
    } catch(e) { showAlert(e.message); }
  });
}

async function editContrato(id) {
  const c = await api("GET", `/contratos/${id}`);
  formContrato(c);
}

async function renderPagos() {
  const data = await api("GET", "/pagos");
  $("section-content").innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>ID</th><th>Contrato</th><th>Mes/Año</th><th>Total</th><th>Estado</th><th>Conceptos</th><th></th></tr></thead>
        <tbody>${data.map(p => `
          <tr>
            <td>${p.id}</td><td>${p.contrato_id}</td>
            <td>${p.mes}/${p.anio}</td>
            <td>$${p.total.toLocaleString()}</td>
            <td>${statusBadge(p.status)}</td>
            <td>${p.conceptos.map(c => `${c.tipo}: $${c.monto}`).join(", ")}</td>
            <td><button class="btn-secondary" onclick="marcarPagado(${p.id})">✓ Pagado</button></td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

async function marcarPagado(id) {
  try { await api("PATCH", `/pagos/${id}`, { status: "pagado" }); renderPagos(); showAlert("Marcado como pagado", "success"); }
  catch(e) { showAlert(e.message); }
}

function formPago() {
  window._conceptos = [{ tipo: "renta", monto: "" }];

  window.renderConceptos = () => {
    const el = document.getElementById("conceptos-list");
    if (!el) return;
    el.innerHTML = window._conceptos.map((c, i) => `
      <div style="display:flex;gap:8px;margin-bottom:8px">
        <select onchange="window._conceptos[${i}].tipo=this.value" style="flex:1;padding:8px;border:1px solid #d1d5db;border-radius:8px">
          ${["renta","agua","luz","internet","mantenimiento"].map(t => `<option ${c.tipo===t?"selected":""}>${t}</option>`).join("")}
        </select>
        <input type="number" placeholder="Monto" value="${c.monto}" onchange="window._conceptos[${i}].monto=this.value" style="width:100px;padding:8px;border:1px solid #d1d5db;border-radius:8px"/>
        <button onclick="window._conceptos.splice(${i},1);window.renderConceptos()" style="background:none;border:none;cursor:pointer;color:#ef4444">✕</button>
      </div>`).join("");
  };

  openModal("Nuevo pago", `
    <div class="field"><label>Contrato ID</label><input type="number" id="f-cid"/></div>
    <div style="display:flex;gap:8px">
      <div class="field" style="flex:1"><label>Mes</label><input type="number" id="f-mes" min="1" max="12"/></div>
      <div class="field" style="flex:1"><label>Año</label><input type="number" id="f-anio" value="${new Date().getFullYear()}"/></div>
    </div>
    <label style="font-size:13px;font-weight:500;color:#374151;display:block;margin-bottom:6px">Conceptos</label>
    <div id="conceptos-list"></div>
    <button class="btn-secondary" onclick="window._conceptos.push({tipo:'renta',monto:''});window.renderConceptos()" style="margin-bottom:1rem">+ Agregar concepto</button>
  `, async () => {
    try {
      await api("POST", "/pagos", {
        contrato_id: parseInt($("f-cid").value),
        mes: parseInt($("f-mes").value),
        anio: parseInt($("f-anio").value),
        conceptos: window._conceptos.map(c => ({ tipo: c.tipo, monto: parseFloat(c.monto) })),
      });
      closeModal(); renderPagos(); showAlert("Pago registrado", "success");
    } catch(e) { showAlert(e.message); }
  });

  setTimeout(window.renderConceptos, 50);
}

async function renderMensajes() {
  const data = await api("GET", "/mensajes");
  $("section-content").innerHTML = `
    <div class="msg-list">${data.map(m => `
      <div class="msg-item ${!m.leido ? "unread" : ""}">
        <div class="msg-header">
          <span class="msg-tipo">${m.tipo}${m.propiedad_id ? ` · Prop. ${m.propiedad_id}` : ""}</span>
          <span class="msg-date">${new Date(m.created_at).toLocaleDateString()}</span>
        </div>
        <p class="msg-content">${m.contenido}</p>
        <div style="display:flex;gap:8px;margin-top:8px">
          ${!m.leido ? `<button class="btn-secondary" onclick="leerMensaje(${m.id})">Marcar leído</button>` : ""}
          <button class="btn-danger" onclick="deleteMensaje(${m.id})">Eliminar</button>
        </div>
      </div>`).join("")}
    </div>`;
}

async function leerMensaje(id) {
  await api("PATCH", `/mensajes/${id}/leer`); renderMensajes();
}

async function deleteMensaje(id) {
  if (!confirm("¿Eliminar mensaje?")) return;
  await api("DELETE", `/mensajes/${id}`); renderMensajes();
}

function formMensaje() {
  openModal("Nuevo mensaje", `
    <div class="field"><label>Propiedad ID (opcional)</label><input type="number" id="f-pid"/></div>
    <div class="field"><label>Tipo</label>
      <select id="f-tipo"><option>aviso</option><option>observacion</option></select>
    </div>
    <div class="field"><label>Contenido</label><textarea id="f-contenido"></textarea></div>
  `, async () => {
    try {
      const pid = $("f-pid").value;
      await api("POST", "/mensajes", {
        propiedad_id: pid ? parseInt(pid) : null,
        tipo: $("f-tipo").value,
        contenido: $("f-contenido").value,
      });
      closeModal(); renderMensajes(); showAlert("Enviado", "success");
    } catch(e) { showAlert(e.message); }
  });
}

async function renderCuidados() {
  const data = await api("GET", "/cuidados");
  $("section-content").innerHTML = `
    <div class="cards-grid">${data.map(c => `
      <div class="card">
        <h3>${c.titulo}</h3>
        <p>${c.contenido}</p>
        <div class="card-footer">
          <span class="card-date">${new Date(c.created_at).toLocaleDateString()}</span>
          ${me.rol === "admin" ? `
            <div style="display:flex;gap:6px">
              <button class="btn-secondary" onclick="editCuidado(${c.id})">Editar</button>
              <button class="btn-danger" onclick="deleteCuidado(${c.id})">Eliminar</button>
            </div>` : ""}
        </div>
      </div>`).join("")}
    </div>`;
}

function formCuidado(c = {}) {
  openModal(c.id ? "Editar cuidado" : "Nuevo cuidado", `
    <div class="field"><label>Título</label><input id="f-titulo" value="${c.titulo || ""}"/></div>
    <div class="field"><label>Contenido</label><textarea id="f-contenido">${c.contenido || ""}</textarea></div>
  `, async () => {
    const body = { titulo: $("f-titulo").value, contenido: $("f-contenido").value };
    try {
      c.id ? await api("PATCH", `/cuidados/${c.id}`, body) : await api("POST", "/cuidados", body);
      closeModal(); renderCuidados(); showAlert("Guardado", "success");
    } catch(e) { showAlert(e.message); }
  });
}

async function editCuidado(id) {
  const c = await api("GET", `/cuidados/${id}`);
  formCuidado(c);
}

async function deleteCuidado(id) {
  if (!confirm("¿Eliminar?")) return;
  try { await api("DELETE", `/cuidados/${id}`); renderCuidados(); }
  catch(e) { showAlert(e.message); }
}

async function renderUsuarios() {
  const data = await api("GET", "/usuarios");
  $("section-content").innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th><th></th></tr></thead>
        <tbody>${data.map(u => `
          <tr>
            <td>${u.nombre}</td><td>${u.email}</td>
            <td>${badge(u.rol, "blue")}</td>
            <td>${u.activo ? badge("activo","green") : badge("inactivo","red")}</td>
            <td>
              <button class="btn-secondary" onclick="editUsuario(${u.id})">Editar</button>
              <button class="btn-danger" onclick="deleteUsuario(${u.id})">Desactivar</button>
            </td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

function formUsuario(u = {}) {
  openModal(u.id ? "Editar usuario" : "Nuevo usuario", `
    <div class="field"><label>Nombre</label><input id="f-nombre" value="${u.nombre || ""}"/></div>
    <div class="field"><label>Email</label><input type="email" id="f-email" value="${u.email || ""}"/></div>
    ${!u.id ? `<div class="field"><label>Contraseña</label><input type="password" id="f-pass"/></div>` : ""}
    <div class="field"><label>Rol</label>
      <select id="f-rol">
        ${["inquilino","propietario","admin"].map(r => `<option ${u.rol===r?"selected":""}>${r}</option>`).join("")}
      </select>
    </div>
  `, async () => {
    const body = { nombre: $("f-nombre").value, email: $("f-email").value, rol: $("f-rol").value,
                   ...(!u.id ? { password: $("f-pass").value } : {}) };
    try {
      u.id ? await api("PATCH", `/usuarios/${u.id}`, body) : await api("POST", "/usuarios", body);
      closeModal(); renderUsuarios(); showAlert("Guardado", "success");
    } catch(e) { showAlert(e.message); }
  });
}

async function editUsuario(id) {
  const u = await api("GET", `/usuarios/${id}`);
  formUsuario(u);
}

async function deleteUsuario(id) {
  if (!confirm("¿Desactivar usuario?")) return;
  try { await api("DELETE", `/usuarios/${id}`); renderUsuarios(); showAlert("Desactivado", "success"); }
  catch(e) { showAlert(e.message); }
}

const sections = { propiedades: renderPropiedades, inquilinos: renderInquilinos,
                   contratos: renderContratos, pagos: renderPagos, mensajes: renderMensajes,
                   cuidados: renderCuidados, usuarios: renderUsuarios };

const renderSection = s => sections[s]?.();

$("btn-new").onclick = () => {
  const forms = { propiedades: formPropiedad, inquilinos: formInquilino,
                  contratos: formContrato, pagos: formPago, mensajes: formMensaje,
                  cuidados: formCuidado, usuarios: formUsuario };
  forms[currentSection]?.();
};

function initApp() {
  $("login-screen").classList.add("hidden");
  $("app-screen").classList.remove("hidden");
  document.querySelectorAll(".admin-only").forEach(el => {
    el.style.display = me.rol === "admin" ? "block" : "none";
  });
  renderSection("propiedades");
}

if (token && me) initApp();
