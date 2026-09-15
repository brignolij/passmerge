// PassMerge — shared app logic (used by every language page).
// Everything runs client-side: nothing is ever uploaded anywhere.
(() => {
  "use strict";

  const LANG = (document.documentElement.lang || "en").slice(0, 2);
  const T = (window.I18N && window.I18N[LANG]) || window.I18N.en;

  // ------------------------------------------------------------------
  // Domain / brand extraction
  // ------------------------------------------------------------------

  const MULTI_PART_SUFFIXES = new Set(`
    co.uk org.uk ac.uk gov.uk net.uk sch.uk nhs.uk police.uk
    com.au net.au org.au edu.au gov.au id.au asn.au
    co.nz net.nz org.nz govt.nz ac.nz school.nz
    co.za org.za net.za gov.za ac.za web.za
    co.jp ne.jp or.jp ac.jp go.jp ad.jp gr.jp ed.jp
    co.kr or.kr ne.kr go.kr ac.kr re.kr
    com.cn net.cn org.cn gov.cn edu.cn ac.cn
    com.hk org.hk net.hk edu.hk gov.hk idv.hk
    com.tw org.tw net.tw edu.tw gov.tw idv.tw
    com.sg org.sg net.sg edu.sg gov.sg
    co.in org.in net.in gen.in firm.in ind.in res.in
    co.id or.id net.id web.id sch.id go.id ac.id
    com.my net.my org.my edu.my gov.my
    co.th or.th net.th in.th ac.th go.th
    com.ph net.ph org.ph edu.ph gov.ph
    com.vn net.vn org.vn edu.vn gov.vn
    com.br net.br org.br gov.br edu.br
    com.mx org.mx net.mx edu.mx gob.mx
    com.ar org.ar net.ar edu.ar gob.ar
    co.cl gob.cl
    com.co org.co net.co edu.co gov.co
    com.pe org.pe net.pe edu.pe gob.pe
    com.ve org.ve net.ve edu.ve gob.ve
    co.il org.il net.il gov.il ac.il k12.il
    com.tr org.tr net.tr edu.tr gov.tr
    com.ua org.ua net.ua gov.ua edu.ua
    com.gr org.gr net.gr gov.gr edu.gr
    com.es org.es nom.es
    com.pt org.pt edu.pt gov.pt
    com.ec org.ec
    com.uy org.uy net.uy edu.uy gub.uy
    com.bo org.bo net.bo edu.bo gob.bo
    com.py org.py net.py edu.py gov.py
    com.eg org.eg net.eg edu.eg gov.eg
    com.sa net.sa org.sa edu.sa gov.sa
    co.ae net.ae org.ae gov.ae ac.ae
    com.pk org.pk net.pk edu.pk gov.pk
    com.bd org.bd net.bd edu.bd gov.bd
    com.lk org.lk net.lk edu.lk gov.lk
    com.np org.np net.np edu.np gov.np
  `.split(/\s+/).filter(Boolean));

  function getHostname(uri) {
    uri = (uri || "").trim();
    if (!uri) return null;
    const candidate = uri.includes("//") ? uri : "//" + uri;
    try {
      const url = new URL(candidate, "http://base.invalid/");
      return url.hostname ? url.hostname.toLowerCase() : null;
    } catch (e) {
      return null;
    }
  }

  function isIPv4(host) {
    if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) return false;
    return host.split(".").every(o => Number(o) >= 0 && Number(o) <= 255);
  }
  function isIPv6(host) {
    return host.includes(":") && /^[0-9a-f:]+$/i.test(host);
  }
  function isIpOrLocal(host) {
    if (!host) return true;
    if (host === "localhost" || host.endsWith(".local")) return true;
    return isIPv4(host) || isIPv6(host);
  }

  function getBrand(host) {
    if (isIpOrLocal(host)) return null;
    const labels = host.split(".");
    if (labels.length < 2) return null;
    const lastTwo = labels.slice(-2).join(".");
    if (MULTI_PART_SUFFIXES.has(lastTwo) && labels.length >= 3) {
      return labels[labels.length - 3];
    }
    return labels[labels.length - 2];
  }

  function splitUris(field) {
    field = (field || "").trim();
    if (!field) return [];
    if (!field.includes(",")) return [field];
    const parts = field.split(",").map(p => p.trim()).filter(Boolean);
    if (parts.length > 1 && parts.every(p => getHostname(p))) return parts;
    return [field];
  }

  // ------------------------------------------------------------------
  // CSV parsing / writing
  // ------------------------------------------------------------------

  function parseCSV(text) {
    text = text.replace(/^﻿/, "");
    const rows = [];
    let row = [], field = "", inQuotes = false;
    let sawAny = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
        } else field += c;
        continue;
      }
      if (c === '"') { inQuotes = true; sawAny = true; continue; }
      if (c === ",") { row.push(field); field = ""; sawAny = true; continue; }
      if (c === "\r") continue;
      if (c === "\n") {
        row.push(field); rows.push(row); row = []; field = ""; sawAny = false;
        continue;
      }
      field += c; sawAny = true;
    }
    if (sawAny || row.length || field) { row.push(field); rows.push(row); }
    return rows;
  }

  function rowsToObjects(rows) {
    if (!rows.length) return { header: [], data: [] };
    const header = rows[0];
    const data = [];
    for (let r = 1; r < rows.length; r++) {
      const raw = rows[r];
      if (raw.length === 1 && raw[0].trim() === "") continue;
      const obj = {};
      header.forEach((h, idx) => { obj[h] = raw[idx] !== undefined ? raw[idx] : ""; });
      data.push(obj);
    }
    return { header, data };
  }

  function csvField(v) {
    v = v == null ? "" : String(v);
    if (/[",\r\n]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
    return v;
  }
  function toCSV(fieldnames, rows) {
    const lines = [fieldnames.map(csvField).join(",")];
    for (const row of rows) lines.push(fieldnames.map(fn => csvField(row[fn] ?? "")).join(","));
    return lines.join("\r\n") + "\r\n";
  }

  // ------------------------------------------------------------------
  // Multi-format CSV support
  // ------------------------------------------------------------------
  // Bitwarden's own CSV is passed through unchanged (it already has the
  // canonical columns). Every other password manager's export gets its
  // columns fuzzy-matched to the same canonical shape — url/username/
  // password are required; everything else is best-effort.

  const BITWARDEN_FIELDNAMES = [
    "folder", "favorite", "type", "name", "notes", "fields", "reprompt",
    "archivedDate", "login_uri", "login_username", "login_password", "login_totp",
  ];

  const COLUMN_SYNONYMS = {
    name: ["name", "title", "account", "account name", "item name", "label"],
    uri: ["url", "login_uri", "website", "site", "domain", "hostname", "uri", "web site", "weburl", "loginurl"],
    username: ["username", "login_username", "login", "user", "email", "e-mail", "account username"],
    password: ["password", "login_password", "pwd", "pass"],
    notes: ["notes", "note", "extra", "comment", "comments", "memo"],
    totp: ["totp", "login_totp", "otpauth", "otp_secret", "otpsecret", "otp secret", "otp", "2fa", "mfa secret"],
    folder: ["folder", "grouping", "category", "group", "vault", "collection"],
    favorite: ["favorite", "favourite", "fav", "starred"],
  };

  function normHeader(h) { return (h || "").trim().toLowerCase(); }

  // `exclude` keeps a column already claimed by one role (e.g. "username")
  // from also being fuzzy-matched into another (e.g. "name" — "username"
  // contains the substring "name", so without this a login's own username
  // column would wrongly get reused as its display name).
  function findColumn(header, keys, exclude) {
    exclude = exclude || new Set();
    const lower = header.map(normHeader);
    for (const key of keys) {
      const idx = lower.indexOf(key);
      if (idx !== -1 && !exclude.has(header[idx])) return header[idx];
    }
    for (const key of keys) {
      const idx = lower.findIndex((h, i) => h.includes(key) && !exclude.has(header[i]));
      if (idx !== -1) return header[idx];
    }
    return null;
  }

  function detectFormat(header) {
    const lower = header.map(normHeader);
    const has = names => names.every(n => lower.includes(n));

    if (has(["login_uri", "login_username", "login_password"])) return { id: "bitwarden" };

    const uri = findColumn(header, COLUMN_SYNONYMS.uri);
    const username = findColumn(header, COLUMN_SYNONYMS.username);
    const password = findColumn(header, COLUMN_SYNONYMS.password);
    if (!(uri && username && password)) return { id: "unknown" };

    let id = "generic";
    if (has(["url", "username", "password", "httprealm"])) id = "firefox";
    else if (has(["url", "username", "password", "extra", "grouping"])) id = "lastpass";
    else if (has(["type", "name", "url", "username", "password", "totp", "vault"])) id = "protonpass";
    else if (lower.some(h => h.includes("otp")) && has(["username", "password"]) && lower.some(h => h.includes("title") || h.includes("url"))) id = "dashlane";
    else if (has(["name", "url", "username", "password"]) && lower.length <= 5) id = "chromium";
    else if (has(["name", "url", "username", "password", "note", "folder"])) id = "nordpass";

    const claimed = new Set([uri, username, password]);
    const name = findColumn(header, COLUMN_SYNONYMS.name, claimed); if (name) claimed.add(name);
    const notes = findColumn(header, COLUMN_SYNONYMS.notes, claimed); if (notes) claimed.add(notes);
    const totp = findColumn(header, COLUMN_SYNONYMS.totp, claimed); if (totp) claimed.add(totp);
    const folder = findColumn(header, COLUMN_SYNONYMS.folder, claimed); if (folder) claimed.add(folder);
    const favorite = findColumn(header, COLUMN_SYNONYMS.favorite, claimed);

    return { id, map: { name, uri, username, password, notes, totp, folder, favorite } };
  }

  // Returns { format, rows } where rows are already in the canonical shape
  // (folder/favorite/type/name/notes/fields/reprompt/archivedDate/
  // login_uri/login_username/login_password/login_totp) regardless of the
  // source format.
  function toCanonicalRows(header, rawRows) {
    const format = detectFormat(header);
    if (format.id === "unknown") return { format, rows: [] };
    if (format.id === "bitwarden") return { format, rows: rawRows };

    const m = format.map;
    const rows = rawRows.map(r => {
      const uri = m.uri ? (r[m.uri] || "") : "";
      const username = m.username ? (r[m.username] || "") : "";
      let name = m.name ? (r[m.name] || "") : "";
      if (!name) {
        const host = getHostname(uri) || uri || "item";
        name = username ? `${host} (${username})` : host;
      }
      return {
        folder: m.folder ? (r[m.folder] || "") : "",
        favorite: m.favorite && /^(1|true|yes)$/i.test((r[m.favorite] || "").trim()) ? "1" : "0",
        type: "login",
        name,
        notes: m.notes ? (r[m.notes] || "") : "",
        fields: "",
        reprompt: "0",
        archivedDate: "",
        login_uri: uri,
        login_username: username,
        login_password: m.password ? (r[m.password] || "") : "",
        login_totp: m.totp ? (r[m.totp] || "") : "",
      };
    }).filter(r => r.login_uri || r.login_username || r.login_password);

    return { format, rows };
  }

  // ------------------------------------------------------------------
  // Grouping
  // ------------------------------------------------------------------

  function buildGroups(rows, ignoreUsername) {
    const groups = [];
    const keyToIndex = new Map();
    for (const row of rows) {
      const rowType = (row.type || "").trim().toLowerCase();
      const uris = rowType === "login" ? splitUris(row.login_uri) : [];
      let brand = null;
      if (uris.length) brand = getBrand(getHostname(uris[0]));

      if (rowType !== "login" || brand === null) {
        groups.push({ brand, rows: [row] });
        continue;
      }
      const usernameKey = ignoreUsername ? "" : (row.login_username || "").trim().toLowerCase();
      const key = brand + "" + usernameKey;
      if (keyToIndex.has(key)) groups[keyToIndex.get(key)].rows.push(row);
      else { keyToIndex.set(key, groups.length); groups.push({ brand, rows: [row] }); }
    }
    return groups;
  }

  function pickShortest(variants) {
    return variants.reduce((best, v) => (v.length < best.length ? v : best), variants[0]);
  }

  function uniqueValuesForField(rows, getValue, getSource, mode) {
    const clusters = new Map();
    const order = [];
    for (const r of rows) {
      const raw = (getValue(r) || "").trim();
      if (!raw) continue;
      const key = mode === "ci" ? raw.toLowerCase() : raw;
      if (!clusters.has(key)) { clusters.set(key, { variants: [], sources: [] }); order.push(key); }
      const c = clusters.get(key);
      if (!c.variants.includes(raw)) c.variants.push(raw);
      c.sources.push(getSource(r) || "?");
    }
    return order.map(key => {
      const c = clusters.get(key);
      return { value: pickShortest(c.variants), variants: c.variants, sources: c.sources };
    });
  }

  const CONFLICT_FIELDS = [
    ["login_username", "usernames", "ci"],
    ["login_password", "passwords", "exact"],
    ["folder", "folders", "exact"],
    ["fields", "customfields", "exact"],
  ];

  function fieldValues(rows, key, mode) {
    return uniqueValuesForField(rows, r => r[key], r => r.name, mode);
  }

  function groupHasConflict(rows) {
    return CONFLICT_FIELDS.some(([key, , mode]) => fieldValues(rows, key, mode).length > 1);
  }

  function rowToItem(r) {
    const uris = (r.type || "").toLowerCase() === "login"
      ? splitUris(r.login_uri)
      : (r.login_uri ? [r.login_uri] : []);
    return {
      folder: r.folder || "", favorite: r.favorite || "0", type: r.type || "",
      name: r.name || "", notes: r.notes || "", fields: r.fields || "",
      reprompt: r.reprompt || "0", archivedDate: r.archivedDate || "",
      uris, username: r.login_username || "", password: r.login_password || "",
      totp: r.login_totp || "", merged_from: [r.name || ""],
    };
  }

  function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }

  function buildMergedItem(rows, brand, resolved) {
    const groupNames = rows.map(r => r.name || "");
    const allUris = [];
    for (const r of rows) for (const u of splitUris(r.login_uri)) if (!allUris.includes(u)) allUris.push(u);

    const modeOf = key => CONFLICT_FIELDS.find(f => f[0] === key)?.[2] || "exact";
    const pick = (key) => {
      if (resolved && key in resolved) return resolved[key];
      const opts = fieldValues(rows, key, modeOf(key));
      return opts.length ? opts[0].value : "";
    };
    const username = pick("login_username");
    const password = pick("login_password");
    const folder = pick("folder");
    const fields = pick("fields");

    const usernameCluster = fieldValues(rows, "login_username", "ci").find(o => o.value === username);
    const usernameSilentNote = usernameCluster && usernameCluster.variants.length > 1
      ? T.report.usernameSilent(usernameCluster.variants.join(" / "), username)
      : null;

    const totp = rows.map(r => r.login_totp).find(Boolean) || "";
    const favorite = rows.some(r => (r.favorite || "0").trim() === "1") ? "1" : "0";
    const reprompt = rows.some(r => (r.reprompt || "0").trim() === "1") ? "1" : "0";

    const notesParts = [...new Set(rows.map(r => (r.notes || "").trim()).filter(Boolean))];
    let notes = notesParts.join("\n---\n");

    const pwOptions = fieldValues(rows, "login_password", "exact");
    if (pwOptions.length > 1) {
      const others = pwOptions.map(o => o.value).filter(v => v !== password).join(", ");
      const note = T.report.pwConflict(pwOptions.length, password, others);
      notes = (notes ? notes + "\n---\n" : "") + `[passmerge] ${note}`;
    }

    let displayName = capitalize((brand || groupNames[0] || "item").trim());
    if (username) displayName = `${displayName} (${username})`;

    return {
      folder, favorite, type: "login", name: displayName, notes, fields, reprompt,
      archivedDate: "", uris: allUris, username, password, totp, merged_from: groupNames,
      silentNotes: usernameSilentNote ? [usernameSilentNote] : [],
    };
  }

  // ------------------------------------------------------------------
  // Output writers
  // ------------------------------------------------------------------

  const TYPE_MAP = { login: 1, note: 2, card: 3, identity: 4 };

  function buildCleanedCSV(items) {
    const rows = items.map(item => {
      let notes = item.notes;
      if (item.uris.length > 1) {
        const extra = item.uris.slice(1).join("\n");
        const add = `[passmerge] ${T.report.otherUris}\n${extra}`;
        notes = notes ? `${notes}\n---\n${add}` : add;
      }
      return {
        folder: item.folder, favorite: item.favorite, type: item.type, name: item.name,
        notes, fields: item.fields, reprompt: item.reprompt, archivedDate: item.archivedDate,
        login_uri: item.uris[0] || "", login_username: item.username,
        login_password: item.password, login_totp: item.totp,
      };
    });
    return toCSV(BITWARDEN_FIELDNAMES, rows);
  }

  function buildCleanedJSON(items) {
    const outItems = items.map(item => {
      const base = {
        id: null, organizationId: null, folderId: null,
        type: TYPE_MAP[(item.type || "login").toLowerCase()] || 1,
        name: item.name, notes: item.notes || null, favorite: item.favorite === "1",
        reprompt: item.reprompt === "1" ? 1 : 0, collectionIds: null,
      };
      if ((item.type || "login").toLowerCase() === "login") {
        base.login = {
          uris: item.uris.map(u => ({ match: null, uri: u })),
          username: item.username || null, password: item.password || null, totp: item.totp || null,
        };
      }
      return base;
    });
    return JSON.stringify({ encrypted: false, folders: [], items: outItems }, null, 2);
  }

  function buildReport(results, ignoreUsername) {
    const R = T.report;
    const lines = [];
    lines.push(R.title);
    lines.push("=".repeat(40));
    lines.push(R.engine);
    lines.push(R.key(ignoreUsername));
    lines.push("");
    const merged = results.filter(r => r.action === "merged");
    const kept = results.filter(r => r.action === "kept_separate");
    const deleted = results.filter(r => r.action === "deleted");
    const singlesWithNotes = results.filter(r => r.action === "single" && r.resolutions.length);

    lines.push(`${R.mergedHeader(merged.length)}\n`);
    for (const res of merged) {
      const item = res.items[0];
      lines.push(`- ${item.name}  ->  ${item.uris.length} URL(s)`);
      for (const u of item.uris) lines.push(`    · ${u}`);
      lines.push(`    ${R.mergedFrom} ${res.groupNames.join(", ")}`);
      for (const r of res.resolutions) lines.push(`    ✅ ${r}`);
      for (const w of res.warnings) lines.push(`    ⚠️  ${w}`);
      lines.push("");
    }
    if (kept.length) {
      lines.push(`${R.keptHeader(kept.length)}\n`);
      for (const res of kept) {
        lines.push(`- ${res.groupNames.join(", ")}`);
        for (const r of res.resolutions) lines.push(`    ✅ ${r}`);
      }
      lines.push("");
    }
    if (deleted.length) {
      const n = deleted.reduce((a, r) => a + r.groupNames.length, 0);
      lines.push(`${R.deletedHeader(deleted.length, n)}\n`);
      for (const res of deleted) {
        lines.push(`- ${res.groupNames.join(", ")}`);
        for (const r of res.resolutions) lines.push(`    ✅ ${r}`);
      }
      lines.push("");
    }
    if (singlesWithNotes.length) {
      lines.push(`${R.singlesHeader(singlesWithNotes.length)}\n`);
      for (const res of singlesWithNotes) {
        lines.push(`- ${res.groupNames.join(", ")}`);
        for (const r of res.resolutions) lines.push(`    ✅ ${r}`);
      }
      lines.push("");
    }
    return lines.join("\n");
  }

  // ------------------------------------------------------------------
  // UI state
  // ------------------------------------------------------------------

  const el = id => document.getElementById(id);
  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  let allRows = [];
  let groups = [];
  let conflictIdx = [];
  let deletedRows = new Map();
  let groupDecisions = new Map();
  let currentStep = 0;
  let wizardDone = false;

  function readFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = rowsToObjects(parseCSV(reader.result));
      const { format, rows } = toCanonicalRows(parsed.header, parsed.data);
      if (format.id === "unknown") {
        el("fileName").textContent = "";
        el("btnAnalyze").disabled = true;
        alert(T.upload.unsupportedFormat);
        return;
      }
      allRows = rows;
      const formatLabel = T.formats[format.id] || format.id;
      el("fileName").innerHTML = `📄 ${escapeHtml(file.name)} (${(file.size / 1024).toFixed(1)} KB)` +
        `<div class="formatnote">${escapeHtml(T.formatDetected(formatLabel))}</div>`;
      el("btnAnalyze").disabled = allRows.length === 0;
      if (!allRows.length) alert(T.upload.readError);
    };
    reader.onerror = () => alert(T.upload.fileError);
    reader.readAsText(file, "utf-8");
  }

  el("fileInput").addEventListener("change", e => { if (e.target.files[0]) readFile(e.target.files[0]); });
  const dz = el("dropzone");
  ["dragenter", "dragover"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add("drag"); }));
  ["dragleave", "drop"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove("drag"); }));
  dz.addEventListener("drop", e => { const f = e.dataTransfer.files[0]; if (f) readFile(f); });

  el("btnAnalyze").addEventListener("click", analyze);
  el("btnReset").addEventListener("click", () => location.reload());

  function analyze() {
    const ignoreUsername = el("optIgnoreUsername").checked;
    groups = buildGroups(allRows, ignoreUsername);
    conflictIdx = [];
    groups.forEach((g, i) => { if (g.rows.length > 1 && groupHasConflict(g.rows)) conflictIdx.push(i); });
    deletedRows = new Map();
    groupDecisions = new Map();
    currentStep = 0;
    wizardDone = false;

    const autoMergeCount = groups.filter(g => g.rows.length > 1 && !groupHasConflict(g.rows)).length;
    const passthroughCount = groups.filter(g => g.rows.length === 1).length;

    el("summary").innerHTML = T.review.summary(allRows.length, groups.length, autoMergeCount, conflictIdx.length, passthroughCount);

    renderAutoList(autoMergeCount);
    renderWizard();
    el("step-review").hidden = false;
    el("step-download").hidden = false;
    updateDownloads();
    el("step-review").scrollIntoView({ behavior: "smooth" });
  }

  function renderAutoList(autoMergeCount) {
    const auto = groups.filter(g => g.rows.length > 1 && !groupHasConflict(g.rows));
    let html = "";
    if (auto.length) {
      html += `<details><summary>${escapeHtml(T.review.autoList(autoMergeCount))}</summary><ul>`;
      for (const g of auto) {
        const item = buildMergedItem(g.rows, g.brand, null);
        html += `<li><b>${escapeHtml(item.name)}</b> ← ${escapeHtml(g.rows.map(r => r.name).join(", "))}</li>`;
      }
      html += "</ul></details>";
    }
    el("autoList").innerHTML = html;
  }

  // ------------------------------------------------------------------
  // Wizard: one conflicting group at a time
  // ------------------------------------------------------------------

  function getActiveRows(gi) {
    const g = groups[gi];
    const removed = deletedRows.get(gi) || new Set();
    return g.rows.filter((_, idx) => !removed.has(idx));
  }

  function fieldConflictsHtml(gi, rows, resolved) {
    resolved = resolved || {};
    let html = "";
    for (const [key, slug, mode] of CONFLICT_FIELDS) {
      const opts = fieldValues(rows, key, mode);
      if (opts.length <= 1) continue;
      const name = `g${gi}-${slug}`;
      const fieldLabel = T.fieldLabels[key] || key;
      const savedVal = key in resolved ? resolved[key] : null;
      const savedIsCustom = savedVal !== null && !opts.some(o => o.value === savedVal);
      let optsHtml = opts.map((o, idx) => {
        const checked = savedVal !== null ? o.value === savedVal : idx === 0;
        const variantNote = o.variants.length > 1 ? ` <span class="src">(${escapeHtml(o.variants.join(" / "))})</span>` : "";
        return `<label class="radio-option"><input type="radio" name="${name}" value="${escapeHtml(o.value)}" ${checked ? "checked" : ""}> ` +
          `<code>${escapeHtml(o.value)}</code>${variantNote} <span class="src">${escapeHtml(T.review.from)} ${escapeHtml(o.sources.join(", "))}</span></label>`;
      }).join("");
      optsHtml += `<label class="radio-option"><input type="radio" name="${name}" value="__custom__" ${savedIsCustom ? "checked" : ""}> ${escapeHtml(T.review.custom)} ` +
        `<input type="text" class="custom-value" data-field="${key}" placeholder="${escapeHtml(T.review.customPlaceholder)}" value="${savedIsCustom ? escapeHtml(savedVal) : ""}"></label>`;
      html += `<fieldset class="field-conflict" data-field="${key}"><legend>⚠️ ${escapeHtml(fieldLabel)}: ${opts.length}</legend>${optsHtml}</fieldset>`;
    }
    return html;
  }

  function renderWizard() {
    const wizard = el("wizard");
    if (!conflictIdx.length) {
      wizard.innerHTML = `<p class="done-msg">${escapeHtml(T.review.noConflicts)}</p>`;
      return;
    }
    if (wizardDone) {
      wizard.innerHTML = `
        <p class="done-msg">${escapeHtml(T.review.wizardDone(conflictIdx.length))}</p>
        <div class="nav-row"><button id="btnPrev" class="btn">${escapeHtml(T.review.prev)}</button><span></span></div>
      `;
      el("btnPrev").addEventListener("click", goPrev);
      return;
    }
    renderStep();
  }

  function renderStep() {
    const wizard = el("wizard");
    const gi = conflictIdx[currentStep];
    const g = groups[gi];
    const label = capitalize(g.brand || g.rows[0].name);
    const removedSet = deletedRows.get(gi) || new Set();
    const activeRows = getActiveRows(gi);
    const saved = groupDecisions.get(gi) || null;
    const H = T.review.tableHeaders;

    const rowsHtml = g.rows.map((r, ri) => {
      const uris = splitUris(r.login_uri);
      const isRemoved = removedSet.has(ri);
      return `<tr data-row-index="${ri}" class="${isRemoved ? "row-removed" : ""}">` +
        `<td>${escapeHtml(r.name)}</td><td>${escapeHtml(uris[0] || "")}</td>` +
        `<td>${escapeHtml(r.login_username || "")}</td><td><code>${escapeHtml(r.login_password || "")}</code></td>` +
        `<td>${escapeHtml(r.folder || "")}</td>` +
        `<td><button type="button" class="row-delete-btn" data-ri="${ri}" title="${isRemoved ? escapeHtml(T.review.undoRowTitle) : escapeHtml(T.review.removeRowTitle)}">${isRemoved ? "↺" : "🗑️"}</button></td></tr>`;
    }).join("");

    let bodyHtml;
    if (activeRows.length === 0) {
      bodyHtml = `<p class="delete-warning">${escapeHtml(T.review.allRemoved)}</p>`;
    } else if (activeRows.length === 1) {
      bodyHtml = `<p class="keep-note">${T.review.singleRemaining(escapeHtml(activeRows[0].name))}</p>`;
    } else if (!groupHasConflict(activeRows)) {
      bodyHtml = `<p class="keep-note">${escapeHtml(T.review.noMoreConflict(activeRows.length))}</p>`;
    } else {
      const action = (saved && saved.action) || "merge";
      bodyHtml = `
        <div class="choice-row">
          <label>${escapeHtml(T.review.whatToDo)}</label>
          <div class="choice-buttons">
            <button type="button" class="choice-btn${action === "merge" ? " active" : ""}" data-action="merge">${escapeHtml(T.review.mergeBtn)}</button>
            <button type="button" class="choice-btn${action === "keep" ? " active" : ""}" data-action="keep">${escapeHtml(T.review.keepBtn)}</button>
            <button type="button" class="choice-btn${action === "delete" ? " active" : ""}" data-action="delete">${escapeHtml(T.review.deleteBtn)}</button>
          </div>
        </div>
        <p class="keep-note" data-note="keep" ${action !== "keep" ? "hidden" : ""}>${escapeHtml(T.review.keepNote(activeRows.length))}</p>
        <p class="delete-warning" data-note="delete" ${action !== "delete" ? "hidden" : ""}>${escapeHtml(T.review.deleteNote(activeRows.length))}</p>
        <div class="field-conflicts-wrap" ${action !== "merge" ? "hidden" : ""}>${fieldConflictsHtml(gi, activeRows, saved && saved.resolved)}</div>
      `;
    }

    const badgeText = activeRows.length > 1 && groupHasConflict(activeRows) ? T.review.conflictBadge(activeRows.length) : T.review.itemsBadge(activeRows.length);

    wizard.innerHTML = `
      <div class="progress">${escapeHtml(T.review.progress(currentStep + 1, conflictIdx.length))}</div>
      <div class="group-card" data-group-index="${gi}">
        <h3>${escapeHtml(label)} <span class="badge warn">${escapeHtml(badgeText)}</span></h3>
        <p class="row-hint">${escapeHtml(T.review.rowHint)}</p>
        <table><thead><tr><th>${H.map(escapeHtml).join("</th><th>")}</th><th></th></tr></thead>
        <tbody>${rowsHtml}</tbody></table>
        ${bodyHtml}
      </div>
      <div class="nav-row">
        <button id="btnPrev" class="btn" ${currentStep === 0 ? "disabled" : ""}>${escapeHtml(T.review.prev)}</button>
        <button id="btnNext" class="btn primary">${currentStep === conflictIdx.length - 1 ? escapeHtml(T.review.finish) : escapeHtml(T.review.next)}</button>
      </div>
    `;

    wizard.querySelectorAll(".row-delete-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const ri = Number(btn.dataset.ri);
        if (!deletedRows.has(gi)) deletedRows.set(gi, new Set());
        const set = deletedRows.get(gi);
        if (set.has(ri)) set.delete(ri); else set.add(ri);
        groupDecisions.delete(gi);
        renderStep();
        updateDownloads();
      });
    });

    const choiceBtns = wizard.querySelectorAll(".choice-btn");
    choiceBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        choiceBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const action = btn.dataset.action;
        const wrap = wizard.querySelector(".field-conflicts-wrap");
        wizard.querySelector('[data-note="keep"]').hidden = action !== "keep";
        wizard.querySelector('[data-note="delete"]').hidden = action !== "delete";
        if (wrap) wrap.hidden = action !== "merge";
      });
    });

    el("btnPrev").addEventListener("click", goPrev);
    el("btnNext").addEventListener("click", goNext);
  }

  function readStepChoice(gi) {
    const card = document.querySelector(`.group-card[data-group-index="${gi}"]`);
    if (!card) return null;
    const activeBtn = card.querySelector(".choice-btn.active");
    if (!activeBtn) return null;
    const action = activeBtn.dataset.action;
    const resolved = {};
    if (action === "merge") {
      card.querySelectorAll(".field-conflict").forEach(fs => {
        const key = fs.dataset.field;
        const checked = fs.querySelector('input[type="radio"]:checked');
        if (!checked) return;
        resolved[key] = checked.value === "__custom__"
          ? (fs.querySelector(".custom-value").value || "").trim()
          : checked.value;
      });
    }
    return { action, resolved };
  }

  function commitCurrentStep() {
    if (wizardDone || !conflictIdx.length) return;
    const gi = conflictIdx[currentStep];
    const choice = readStepChoice(gi);
    if (choice) groupDecisions.set(gi, choice);
  }

  function goNext() {
    commitCurrentStep();
    if (currentStep < conflictIdx.length - 1) {
      currentStep++;
      renderStep();
    } else {
      wizardDone = true;
      renderWizard();
    }
    updateDownloads();
  }

  function goPrev() {
    if (wizardDone) {
      wizardDone = false;
      renderStep();
    } else {
      commitCurrentStep();
      if (currentStep > 0) { currentStep--; renderStep(); }
    }
    updateDownloads();
  }

  // ------------------------------------------------------------------
  // Compute results + refresh downloads (always reflects current state)
  // ------------------------------------------------------------------

  function computeResults() {
    const results = [];
    groups.forEach((g, gi) => {
      if (g.rows.length === 1) {
        results.push({ action: "single", items: [rowToItem(g.rows[0])], warnings: [], resolutions: [], groupNames: [g.rows[0].name || ""] });
        return;
      }

      const isConflictGroup = conflictIdx.includes(gi);
      const removedSet = deletedRows.get(gi) || new Set();
      const rowLevelNotes = isConflictGroup
        ? g.rows.map((r, ri) => (removedSet.has(ri) ? T.report.removedIndividually(r.name || "?") : null)).filter(Boolean)
        : [];
      const activeRows = isConflictGroup ? getActiveRows(gi) : g.rows;
      const activeNames = activeRows.map(r => r.name || "");

      if (activeRows.length === 0) {
        results.push({ action: "deleted", items: [], warnings: [], resolutions: [...rowLevelNotes, T.report.allRemovedNote], groupNames: g.rows.map(r => r.name || "") });
        return;
      }
      if (activeRows.length === 1) {
        results.push({ action: "single", items: [rowToItem(activeRows[0])], warnings: [], resolutions: rowLevelNotes, groupNames: activeNames });
        return;
      }
      if (!groupHasConflict(activeRows)) {
        const item = buildMergedItem(activeRows, g.brand, null);
        results.push({ action: "merged", items: [item], warnings: [], resolutions: [...rowLevelNotes, ...item.silentNotes], groupNames: activeNames });
        return;
      }

      const saved = groupDecisions.get(gi);
      const action = saved ? saved.action : "merge";
      const resolved = saved ? saved.resolved : {};

      if (action === "delete") {
        results.push({ action: "deleted", items: [], warnings: [], resolutions: [...rowLevelNotes, T.report.deletedRemaining(activeRows.length)], groupNames: activeNames });
      } else if (action === "keep") {
        results.push({ action: "kept_separate", items: activeRows.map(rowToItem), warnings: [], resolutions: [...rowLevelNotes, T.report.keptRemaining(activeRows.length)], groupNames: activeNames });
      } else {
        const item = buildMergedItem(activeRows, g.brand, resolved);
        const resolutions = [...rowLevelNotes, ...item.silentNotes, ...Object.entries(resolved).map(([k, v]) =>
          T.report.manualChoice(T.fieldLabels[k] || k, v)
        )];
        results.push({ action: "merged", items: [item], warnings: [], resolutions, groupNames: activeNames });
      }
    });
    return results;
  }

  function updateDownloads() {
    const ignoreUsername = el("optIgnoreUsername").checked;
    const results = computeResults();
    const finalItems = results.flatMap(r => r.items);
    const csv = buildCleanedCSV(finalItems);
    const json = buildCleanedJSON(finalItems);
    const report = buildReport(results, ignoreUsername);

    setDownload("dlCsv", csv, "text/csv");
    setDownload("dlJson", json, "application/json");
    setDownload("dlReport", report, "text/plain");

    const nDeletedItems = results.filter(r => r.action === "deleted").reduce((a, r) => a + r.groupNames.length, 0);
    const nKeptGroups = results.filter(r => r.action === "kept_separate").length;
    const reviewed = groupDecisions.size;
    el("dlStatus").textContent = T.download.status(
      allRows.length, finalItems.length,
      nDeletedItems ? T.download.deletedSuffix(nDeletedItems) : "",
      nKeptGroups ? T.download.keptSuffix(nKeptGroups) : "",
      reviewed, conflictIdx.length
    );
  }

  function setDownload(anchorId, content, mime) {
    const a = el(anchorId);
    const blob = new Blob([content], { type: mime + ";charset=utf-8" });
    if (a.dataset.url) URL.revokeObjectURL(a.dataset.url);
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.dataset.url = url;
  }
})();
