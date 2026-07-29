(function () {
  "use strict";

  const STORAGE_KEY = "resourceDashboard.contacts.v1";
  const SHEETS_URL_KEY = "resourceDashboard.sheetsApiUrl";
  const PASSCODE_KEY = "resourceDashboard.passcode";
  const DATA_URL = "data/contacts.json";
  const API_CONTACTS_URL = "/api/contacts";
  const API_AUTH_URL = "/api/settings-auth";

  const CATEGORIES = [
    { id: "banker", label: "Banker", hasBankerType: true },
    { id: "law_firm", label: "Law Firm" },
    { id: "corporate_secretary", label: "Corporate Secretary" },
    { id: "accounting", label: "Accounting Services" },
    { id: "property_partner", label: "Property Agent / Partner" },
    { id: "interior_designer", label: "Interior Designer (ID)" },
    { id: "mortgage_broker", label: "Mortgage Broker" },
  ];

  const categoryLabel = (id) => {
    const cat = CATEGORIES.find((c) => c.id === id);
    return cat ? cat.label : id;
  };

  const categoryHasBankerType = (id) => {
    const cat = CATEGORIES.find((c) => c.id === id);
    return !!(cat && cat.hasBankerType);
  };

  let contacts = [];
  let dataSourceMode = "local"; // "server" | "sheet-direct" | "local"
  let passcodeResolve = null;

  const state = {
    category: "",
    company: "",
    bankerType: "",
    search: "",
    sortBy: "rating",
  };

  const els = {
    categorySelect: document.getElementById("categorySelect"),
    dynamicFields: document.getElementById("dynamicFields"),
    sortSelect: document.getElementById("sortSelect"),
    searchInput: document.getElementById("searchInput"),
    clearFiltersBtn: document.getElementById("clearFiltersBtn"),
    resultsTitle: document.getElementById("resultsTitle"),
    resultsCount: document.getElementById("resultsCount"),
    contactList: document.getElementById("contactList"),
    addContactBtn: document.getElementById("addContactBtn"),
    modalOverlay: document.getElementById("modalOverlay"),
    modalTitle: document.getElementById("modalTitle"),
    closeModalBtn: document.getElementById("closeModalBtn"),
    contactForm: document.getElementById("contactForm"),
    contactId: document.getElementById("contactId"),
    formCategory: document.getElementById("formCategory"),
    formBankerTypeGroup: document.getElementById("formBankerTypeGroup"),
    formBankerType: document.getElementById("formBankerType"),
    formCompany: document.getElementById("formCompany"),
    companyOptions: document.getElementById("companyOptions"),
    formName: document.getElementById("formName"),
    formRole: document.getElementById("formRole"),
    formLogoUrl: document.getElementById("formLogoUrl"),
    formRating: document.getElementById("formRating"),
    formReview: document.getElementById("formReview"),
    formPhone: document.getElementById("formPhone"),
    formNotes: document.getElementById("formNotes"),
    deleteContactBtn: document.getElementById("deleteContactBtn"),
    dataSourceBadge: document.getElementById("dataSourceBadge"),
    settingsBtn: document.getElementById("settingsBtn"),
    settingsOverlay: document.getElementById("settingsOverlay"),
    closeSettingsBtn: document.getElementById("closeSettingsBtn"),
    settingsForm: document.getElementById("settingsForm"),
    sheetsUrlInput: document.getElementById("sheetsUrlInput"),
    disconnectSheetBtn: document.getElementById("disconnectSheetBtn"),
    settingsStatus: document.getElementById("settingsStatus"),
    passcodeOverlay: document.getElementById("passcodeOverlay"),
    passcodeForm: document.getElementById("passcodeForm"),
    passcodeInput: document.getElementById("passcodeInput"),
    passcodeStatus: document.getElementById("passcodeStatus"),
    closePasscodeBtn: document.getElementById("closePasscodeBtn"),
    cancelPasscodeBtn: document.getElementById("cancelPasscodeBtn"),
  };

  // ---------- Passcode gate (protects Settings + add/edit/delete) ----------

  function getPasscode() {
    return sessionStorage.getItem(PASSCODE_KEY) || "";
  }

  function ensureUnlocked() {
    if (getPasscode()) return Promise.resolve(true);
    return new Promise((resolve) => {
      passcodeResolve = resolve;
      els.passcodeInput.value = "";
      els.passcodeStatus.textContent = "";
      els.passcodeStatus.className = "settings-status";
      els.passcodeOverlay.classList.remove("hidden");
      els.passcodeInput.focus();
    });
  }

  function resolvePasscode(result) {
    els.passcodeOverlay.classList.add("hidden");
    if (passcodeResolve) {
      passcodeResolve(result);
      passcodeResolve = null;
    }
  }

  function handlePasscodeSubmit(e) {
    e.preventDefault();
    const value = els.passcodeInput.value;
    els.passcodeStatus.textContent = "Checking…";
    els.passcodeStatus.className = "settings-status";

    fetch(API_AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode: value }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.ok !== "boolean") throw new Error("unexpected response shape");
        if (data.ok) {
          sessionStorage.setItem(PASSCODE_KEY, value);
          resolvePasscode(true);
        } else {
          els.passcodeStatus.textContent = "Incorrect passcode.";
          els.passcodeStatus.className = "settings-status error";
        }
      })
      .catch(() => {
        // No serverless function reachable / didn't return a real auth
        // response (e.g. plain static hosting, local dev) — there's no
        // server to check against, so allow through locally.
        sessionStorage.setItem(PASSCODE_KEY, value || "local");
        resolvePasscode(true);
      });
  }

  function handlePasscodeCancel() {
    resolvePasscode(false);
  }

  // ---------- Data source (server proxy > direct Sheet > local storage) ----------

  function getSheetsUrl() {
    return localStorage.getItem(SHEETS_URL_KEY) || "";
  }

  function isSheetsConnected() {
    return !!getSheetsUrl();
  }

  function setDataSourceBadge(mode) {
    const badge = els.dataSourceBadge;
    badge.classList.remove("connected", "error");
    if (mode === "server") {
      badge.textContent = "Shared Google Sheet (live for everyone)";
      badge.classList.add("connected");
    } else if (mode === "sheet-direct") {
      badge.textContent = "Google Sheet connected (this browser)";
      badge.classList.add("connected");
    } else if (mode === "error") {
      badge.textContent = "Google Sheet unreachable — showing local data";
      badge.classList.add("error");
    } else {
      badge.textContent = "Local storage only";
    }
  }

  function normalizeSheetContact(row) {
    const rating = parseInt(row.rating, 10);
    return {
      id: String(row.id),
      category: row.category || "",
      company: row.company || "",
      logoUrl: row.logoUrl || undefined,
      bankerType: row.bankerType || undefined,
      name: row.name || "",
      role: row.role || "",
      rating: Number.isFinite(rating) && rating > 0 ? rating : undefined,
      review: row.review || "",
      phone: String(row.phone || ""),
      notes: row.notes || "",
    };
  }

  function loadContacts() {
    return fetch(API_CONTACTS_URL)
      .then((res) => {
        if (!res.ok) throw new Error("no server proxy");
        return res.json();
      })
      .then((data) => {
        if (data.error || !("contacts" in data)) throw new Error(data.error || "bad response");
        contacts = data.contacts.map(normalizeSheetContact);
        dataSourceMode = "server";
        setDataSourceBadge("server");
      })
      .catch(() => loadContactsWithoutServer());
  }

  function loadContactsWithoutServer() {
    if (isSheetsConnected()) {
      return fetch(`${getSheetsUrl()}?action=list`)
        .then((res) => res.json())
        .then((data) => {
          contacts = (data.contacts || []).map(normalizeSheetContact);
          dataSourceMode = "sheet-direct";
          setDataSourceBadge("sheet-direct");
        })
        .catch(() => {
          contacts = [];
          dataSourceMode = "sheet-direct";
          setDataSourceBadge("error");
        });
    }

    dataSourceMode = "local";
    setDataSourceBadge("local");
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        contacts = JSON.parse(stored);
        return Promise.resolve();
      } catch (e) {
        /* fall through to fetch seed data */
      }
    }
    return fetch(DATA_URL)
      .then((res) => res.json())
      .then((seed) => {
        contacts = seed;
        saveContacts();
      })
      .catch(() => {
        contacts = [];
      });
  }

  function saveContacts() {
    if (dataSourceMode !== "local") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
  }

  function persistChange(action, contactOrId) {
    if (dataSourceMode === "server") {
      const body = { action, passcode: getPasscode() };
      if (action === "delete") body.id = contactOrId;
      else body.contact = contactOrId;

      return fetch(API_CONTACTS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.error) throw new Error(data.error);
          contacts = (data.contacts || []).map(normalizeSheetContact);
        });
    }

    if (dataSourceMode === "sheet-direct") {
      const body = { action };
      if (action === "delete") body.id = contactOrId;
      else body.contact = contactOrId;

      return fetch(getSheetsUrl(), { method: "POST", body: JSON.stringify(body) })
        .then((res) => res.json())
        .then((data) => {
          contacts = (data.contacts || []).map(normalizeSheetContact);
        });
    }

    if (action === "delete") {
      contacts = contacts.filter((c) => c.id !== contactOrId);
    } else {
      const idx = contacts.findIndex((c) => c.id === contactOrId.id);
      if (idx >= 0) contacts[idx] = contactOrId;
      else contacts.push(contactOrId);
    }
    saveContacts();
    return Promise.resolve();
  }

  // Rating is intentionally not passcode-gated: anyone viewing the
  // dashboard can rate a contact. Only the rating itself is writable this
  // way — every other field still requires the passcode-gated edit form.
  function submitRating(contactId, rating) {
    if (dataSourceMode === "server") {
      return fetch(API_CONTACTS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rate", id: contactId, rating }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.error) throw new Error(data.error);
          contacts = (data.contacts || []).map(normalizeSheetContact);
        });
    }

    if (dataSourceMode === "sheet-direct") {
      return fetch(getSheetsUrl(), {
        method: "POST",
        body: JSON.stringify({ action: "rate", id: contactId, rating }),
      })
        .then((res) => res.json())
        .then((data) => {
          contacts = (data.contacts || []).map(normalizeSheetContact);
        });
    }

    const idx = contacts.findIndex((c) => c.id === contactId);
    if (idx >= 0) contacts[idx] = { ...contacts[idx], rating };
    saveContacts();
    return Promise.resolve();
  }

  function uniqueSorted(values) {
    return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    );
  }

  function companiesForCategory(categoryId) {
    return uniqueSorted(
      contacts.filter((c) => c.category === categoryId).map((c) => c.company)
    );
  }

  function populateCategorySelect() {
    els.categorySelect.innerHTML =
      '<option value="">Select a resource type…</option>' +
      CATEGORIES.map((c) => `<option value="${c.id}">${c.label}</option>`).join("");

    els.formCategory.innerHTML = CATEGORIES.map(
      (c) => `<option value="${c.id}">${c.label}</option>`
    ).join("");
  }

  function renderDynamicFields() {
    els.dynamicFields.innerHTML = "";
    if (!state.category) return;

    const companies = companiesForCategory(state.category);

    const companyGroup = document.createElement("div");
    companyGroup.className = "field-group";
    companyGroup.innerHTML = `
      <label for="companySelect">Bank / Company / Firm Name</label>
      <select id="companySelect">
        <option value="">All</option>
        ${companies.map((co) => `<option value="${co}">${co}</option>`).join("")}
      </select>
    `;
    els.dynamicFields.appendChild(companyGroup);

    document.getElementById("companySelect").value = state.company;
    document.getElementById("companySelect").addEventListener("change", (e) => {
      state.company = e.target.value;
      renderResults();
    });

    if (categoryHasBankerType(state.category)) {
      const typeGroup = document.createElement("div");
      typeGroup.className = "field-group";
      typeGroup.innerHTML = `
        <label for="bankerTypeSelect">Banker Type</label>
        <select id="bankerTypeSelect">
          <option value="">All</option>
          <option value="Residential">Residential</option>
          <option value="Commercial">Commercial</option>
        </select>
      `;
      els.dynamicFields.appendChild(typeGroup);

      document.getElementById("bankerTypeSelect").value = state.bankerType;
      document.getElementById("bankerTypeSelect").addEventListener("change", (e) => {
        state.bankerType = e.target.value;
        renderResults();
      });
    }
  }

  function initialsFor(company) {
    if (!company) return "?";
    const words = company.replace(/&/g, " ").split(/\s+/).filter(Boolean);
    if (words.length === 0) return "?";
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  function colorFor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 55%, 42%)`;
  }

  window.handleLogoError = function (imgEl) {
    const div = document.createElement("div");
    div.className = "company-logo initials";
    div.style.background = imgEl.dataset.color;
    div.textContent = imgEl.dataset.initials;
    imgEl.replaceWith(div);
  };

  function logoHtml(contact) {
    const initials = initialsFor(contact.company);
    const color = colorFor(contact.company || contact.name || "?");
    if (contact.logoUrl) {
      return `<img class="company-logo" src="${escapeHtml(contact.logoUrl)}" alt="${escapeHtml(contact.company)} logo" data-initials="${escapeHtml(initials)}" data-color="${escapeHtml(color)}" onerror="handleLogoError(this)">`;
    }
    return `<div class="company-logo initials" style="background:${color}">${escapeHtml(initials)}</div>`;
  }

  function starsInputHtml(rating) {
    const stars = [1, 2, 3, 4, 5]
      .map((n) => `<span class="star${n <= rating ? " filled" : ""}" data-value="${n}">★</span>`)
      .join("");
    const label = rating ? "" : `<span class="stars-hint">Rate this contact</span>`;
    return `<div class="stars-input">${stars}${label}</div>`;
  }

  function whatsappLink(phone, name) {
    const digits = phone.replace(/[^\d]/g, "");
    const text = encodeURIComponent(`Hi ${name}, `);
    return `https://wa.me/${digits}?text=${text}`;
  }

  function formatPhoneDisplay(phone) {
    const digits = (phone || "").replace(/\D/g, "");
    const local = digits.slice(-8);
    if (local.length === 8) {
      return `${local.slice(0, 4)} ${local.slice(4)}`;
    }
    return phone;
  }

  function filteredContacts() {
    return contacts
      .filter((c) => {
        if (state.category && c.category !== state.category) return false;
        if (state.company && c.company !== state.company) return false;
        if (state.bankerType && c.bankerType !== state.bankerType) return false;
        if (state.search) {
          const haystack = `${c.name} ${c.company} ${c.role || ""}`.toLowerCase();
          if (!haystack.includes(state.search.toLowerCase())) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (state.sortBy === "name") return a.name.localeCompare(b.name);
        if (state.sortBy === "company") return a.company.localeCompare(b.company) || a.name.localeCompare(b.name);
        return (b.rating || 0) - (a.rating || 0) || a.name.localeCompare(b.name);
      });
  }

  function renderResults() {
    const list = filteredContacts();

    if (!state.category) {
      els.resultsTitle.textContent = "Select a resource type to see contacts";
    } else {
      els.resultsTitle.textContent = categoryLabel(state.category);
    }
    els.resultsCount.textContent = state.category
      ? `${list.length} contact${list.length === 1 ? "" : "s"}`
      : "";

    els.contactList.innerHTML = "";

    if (!state.category) {
      return;
    }

    if (list.length === 0) {
      els.contactList.innerHTML = `<div class="empty-state">No contacts match these filters yet. Use "+ Add Contact" to create one.</div>`;
      return;
    }

    list.forEach((c) => {
      const card = document.createElement("div");
      card.className = "contact-card";
      card.innerHTML = `
        ${c.bankerType ? `<span class="badge badge-corner">${c.bankerType}</span>` : ""}
        <div class="card-top">
          ${logoHtml(c)}
          <div class="card-top-text">
            <div class="name">${escapeHtml(c.name)}</div>
            <div class="phone">${escapeHtml(formatPhoneDisplay(c.phone))}</div>
          </div>
        </div>
        ${c.role ? `<div class="role">${escapeHtml(c.role)}</div>` : ""}
        <div class="company">${escapeHtml(c.company)}</div>
        ${starsInputHtml(c.rating)}
        ${c.rating >= 4 ? `<span class="badge-recommended">Recommended</span>` : ""}
        ${c.review ? `<div class="review">"${escapeHtml(c.review)}"</div>` : ""}
        ${c.notes ? `<div class="notes">${escapeHtml(c.notes)}</div>` : ""}
        <div class="card-actions">
          <a class="btn-whatsapp" target="_blank" rel="noopener" href="${whatsappLink(c.phone, c.name)}">WhatsApp</a>
          <button class="btn-edit" data-id="${c.id}">Edit</button>
        </div>
      `;
      card.querySelector(".btn-edit").addEventListener("click", () => {
        ensureUnlocked().then((ok) => {
          if (ok) openModal(c);
        });
      });
      card.querySelectorAll(".stars-input .star").forEach((star) => {
        star.addEventListener("click", () => {
          const value = parseInt(star.dataset.value, 10);
          submitRating(c.id, value)
            .then(renderResults)
            .catch(() => alert("Could not save the rating. Check your connection and try again."));
        });
      });
      els.contactList.appendChild(card);
    });
  }

  function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[m]));
  }

  function updateFormCompanyOptions() {
    const category = els.formCategory.value;
    const companies = companiesForCategory(category);
    els.companyOptions.innerHTML = companies
      .map((co) => `<option value="${co}"></option>`)
      .join("");
    els.formBankerTypeGroup.style.display = categoryHasBankerType(category)
      ? "flex"
      : "none";
  }

  function openModal(contact) {
    els.contactForm.reset();
    if (contact) {
      els.modalTitle.textContent = "Edit Contact";
      els.contactId.value = contact.id;
      els.formCategory.value = contact.category;
      updateFormCompanyOptions();
      els.formBankerType.value = contact.bankerType || "Residential";
      els.formCompany.value = contact.company;
      els.formLogoUrl.value = contact.logoUrl || "";
      els.formName.value = contact.name;
      els.formRole.value = contact.role || "";
      els.formRating.value = contact.rating || "";
      els.formReview.value = contact.review || "";
      els.formPhone.value = contact.phone;
      els.formNotes.value = contact.notes || "";
      els.deleteContactBtn.classList.remove("hidden");
    } else {
      els.modalTitle.textContent = "Add Contact";
      els.contactId.value = "";
      els.formCategory.value = state.category || CATEGORIES[0].id;
      updateFormCompanyOptions();
      if (state.company) els.formCompany.value = state.company;
      els.deleteContactBtn.classList.add("hidden");
    }
    els.modalOverlay.classList.remove("hidden");
  }

  function closeModal() {
    els.modalOverlay.classList.add("hidden");
  }

  function refreshAfterChange() {
    closeModal();
    populateCategorySelect();
    els.categorySelect.value = state.category;
    renderDynamicFields();
    renderResults();
  }

  function handleFormSubmit(e) {
    e.preventDefault();
    const isNew = !els.contactId.value;
    const id = els.contactId.value || `c-${Date.now()}`;
    const category = els.formCategory.value;
    const ratingValue = parseInt(els.formRating.value, 10);
    const record = {
      id,
      category,
      company: els.formCompany.value.trim(),
      logoUrl: els.formLogoUrl.value.trim() || undefined,
      bankerType: categoryHasBankerType(category) ? els.formBankerType.value : undefined,
      name: els.formName.value.trim(),
      role: els.formRole.value.trim(),
      rating: Number.isFinite(ratingValue) && ratingValue > 0 ? ratingValue : undefined,
      review: els.formReview.value.trim(),
      phone: els.formPhone.value.trim(),
      notes: els.formNotes.value.trim(),
    };

    const submitBtn = els.contactForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "Saving…";

    persistChange(isNew ? "create" : "update", record)
      .then(refreshAfterChange)
      .catch(() => {
        alert("Could not save this contact. Check your connection/passcode and try again.");
      })
      .finally(() => {
        submitBtn.disabled = false;
        submitBtn.textContent = "Save Contact";
      });
  }

  function handleDelete() {
    const id = els.contactId.value;
    if (!id) return;
    if (!confirm("Delete this contact?")) return;

    persistChange("delete", id)
      .then(refreshAfterChange)
      .catch(() => {
        alert("Could not delete this contact. Check your connection/passcode and try again.");
      });
  }

  function bindEvents() {
    els.categorySelect.addEventListener("change", (e) => {
      state.category = e.target.value;
      state.company = "";
      state.bankerType = "";
      renderDynamicFields();
      renderResults();
    });

    els.searchInput.addEventListener("input", (e) => {
      state.search = e.target.value;
      renderResults();
    });

    els.sortSelect.addEventListener("change", (e) => {
      state.sortBy = e.target.value;
      renderResults();
    });

    els.clearFiltersBtn.addEventListener("click", () => {
      state.category = "";
      state.company = "";
      state.bankerType = "";
      state.search = "";
      state.sortBy = "rating";
      els.categorySelect.value = "";
      els.searchInput.value = "";
      els.sortSelect.value = "rating";
      renderDynamicFields();
      renderResults();
    });

    els.addContactBtn.addEventListener("click", () => {
      ensureUnlocked().then((ok) => {
        if (ok) openModal(null);
      });
    });
    els.closeModalBtn.addEventListener("click", closeModal);
    els.modalOverlay.addEventListener("click", (e) => {
      if (e.target === els.modalOverlay) closeModal();
    });
    els.formCategory.addEventListener("change", updateFormCompanyOptions);
    els.contactForm.addEventListener("submit", handleFormSubmit);
    els.deleteContactBtn.addEventListener("click", handleDelete);

    els.settingsBtn.addEventListener("click", () => {
      ensureUnlocked().then((ok) => {
        if (ok) openSettings();
      });
    });
    els.closeSettingsBtn.addEventListener("click", closeSettings);
    els.settingsOverlay.addEventListener("click", (e) => {
      if (e.target === els.settingsOverlay) closeSettings();
    });
    els.settingsForm.addEventListener("submit", handleSettingsSubmit);
    els.disconnectSheetBtn.addEventListener("click", handleDisconnectSheet);

    els.passcodeForm.addEventListener("submit", handlePasscodeSubmit);
    els.closePasscodeBtn.addEventListener("click", handlePasscodeCancel);
    els.cancelPasscodeBtn.addEventListener("click", handlePasscodeCancel);
    els.passcodeOverlay.addEventListener("click", (e) => {
      if (e.target === els.passcodeOverlay) handlePasscodeCancel();
    });
  }

  function openSettings() {
    els.sheetsUrlInput.value = getSheetsUrl();
    els.settingsStatus.textContent = "";
    els.settingsStatus.className = "settings-status";
    els.settingsOverlay.classList.remove("hidden");
  }

  function closeSettings() {
    els.settingsOverlay.classList.add("hidden");
  }

  function handleSettingsSubmit(e) {
    e.preventDefault();
    const url = els.sheetsUrlInput.value.trim();
    if (!url) {
      els.settingsStatus.textContent = "Enter a Web App URL, or use Disconnect to go back to local storage.";
      els.settingsStatus.className = "settings-status error";
      return;
    }

    els.settingsStatus.textContent = "Connecting…";
    els.settingsStatus.className = "settings-status";

    fetch(`${url}?action=list`)
      .then((res) => res.json())
      .then((data) => {
        if (!("contacts" in data)) throw new Error("Unexpected response");
        localStorage.setItem(SHEETS_URL_KEY, url);
        contacts = data.contacts.map(normalizeSheetContact);
        dataSourceMode = "sheet-direct";
        setDataSourceBadge("sheet-direct");
        els.settingsStatus.textContent = "Connected!";
        els.settingsStatus.className = "settings-status success";
        state.category = "";
        state.company = "";
        state.bankerType = "";
        els.categorySelect.value = "";
        renderDynamicFields();
        renderResults();
        setTimeout(closeSettings, 700);
      })
      .catch(() => {
        els.settingsStatus.textContent = "Could not connect. Double-check the deployed Web App URL and its access setting.";
        els.settingsStatus.className = "settings-status error";
      });
  }

  function handleDisconnectSheet() {
    localStorage.removeItem(SHEETS_URL_KEY);
    closeSettings();
    loadContacts().then(() => {
      populateCategorySelect();
      renderDynamicFields();
      renderResults();
    });
  }

  loadContacts().then(() => {
    populateCategorySelect();
    bindEvents();
    renderDynamicFields();
    renderResults();
  });
})();
