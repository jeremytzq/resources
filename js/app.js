(function () {
  "use strict";

  const STORAGE_KEY = "resourceDashboard.contacts.v1";
  const DATA_URL = "data/contacts.json";

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

  const state = {
    category: "",
    company: "",
    bankerType: "",
    search: "",
  };

  const els = {
    categorySelect: document.getElementById("categorySelect"),
    dynamicFields: document.getElementById("dynamicFields"),
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
    formPhone: document.getElementById("formPhone"),
    formNotes: document.getElementById("formNotes"),
    deleteContactBtn: document.getElementById("deleteContactBtn"),
  };

  function loadContacts() {
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
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

  function whatsappLink(phone, name) {
    const digits = phone.replace(/[^\d]/g, "");
    const text = encodeURIComponent(`Hi ${name}, `);
    return `https://wa.me/${digits}?text=${text}`;
  }

  function filteredContacts() {
    return contacts.filter((c) => {
      if (state.category && c.category !== state.category) return false;
      if (state.company && c.company !== state.company) return false;
      if (state.bankerType && c.bankerType !== state.bankerType) return false;
      if (state.search) {
        const haystack = `${c.name} ${c.company} ${c.role || ""}`.toLowerCase();
        if (!haystack.includes(state.search.toLowerCase())) return false;
      }
      return true;
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
        <div class="card-top">
          ${logoHtml(c)}
          <div class="card-top-text">
            ${c.bankerType ? `<span class="badge">${c.bankerType}</span>` : ""}
            <div class="name">${escapeHtml(c.name)}</div>
            ${c.role ? `<div class="role">${escapeHtml(c.role)}</div>` : ""}
          </div>
        </div>
        <div class="company">${escapeHtml(c.company)}</div>
        <div class="phone">${escapeHtml(c.phone)}</div>
        ${c.notes ? `<div class="notes">${escapeHtml(c.notes)}</div>` : ""}
        <div class="card-actions">
          <a class="btn-whatsapp" target="_blank" rel="noopener" href="${whatsappLink(c.phone, c.name)}">WhatsApp</a>
          <button class="btn-edit" data-id="${c.id}">Edit</button>
        </div>
      `;
      card.querySelector(".btn-edit").addEventListener("click", () => openModal(c));
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

  function handleFormSubmit(e) {
    e.preventDefault();
    const id = els.contactId.value || `c-${Date.now()}`;
    const category = els.formCategory.value;
    const record = {
      id,
      category,
      company: els.formCompany.value.trim(),
      logoUrl: els.formLogoUrl.value.trim() || undefined,
      bankerType: categoryHasBankerType(category) ? els.formBankerType.value : undefined,
      name: els.formName.value.trim(),
      role: els.formRole.value.trim(),
      phone: els.formPhone.value.trim(),
      notes: els.formNotes.value.trim(),
    };

    const existingIndex = contacts.findIndex((c) => c.id === id);
    if (existingIndex >= 0) {
      contacts[existingIndex] = record;
    } else {
      contacts.push(record);
    }
    saveContacts();
    closeModal();
    populateCategorySelect();
    els.categorySelect.value = state.category;
    renderDynamicFields();
    renderResults();
  }

  function handleDelete() {
    const id = els.contactId.value;
    if (!id) return;
    if (!confirm("Delete this contact?")) return;
    contacts = contacts.filter((c) => c.id !== id);
    saveContacts();
    closeModal();
    renderDynamicFields();
    renderResults();
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

    els.clearFiltersBtn.addEventListener("click", () => {
      state.category = "";
      state.company = "";
      state.bankerType = "";
      state.search = "";
      els.categorySelect.value = "";
      els.searchInput.value = "";
      renderDynamicFields();
      renderResults();
    });

    els.addContactBtn.addEventListener("click", () => openModal(null));
    els.closeModalBtn.addEventListener("click", closeModal);
    els.modalOverlay.addEventListener("click", (e) => {
      if (e.target === els.modalOverlay) closeModal();
    });
    els.formCategory.addEventListener("change", updateFormCompanyOptions);
    els.contactForm.addEventListener("submit", handleFormSubmit);
    els.deleteContactBtn.addEventListener("click", handleDelete);
  }

  loadContacts().then(() => {
    populateCategorySelect();
    bindEvents();
    renderDynamicFields();
    renderResults();
  });
})();
