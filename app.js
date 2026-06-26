const ITEMS_KEY = "gudang-puspa-items";
const TRANSACTIONS_KEY = "gudang-puspa-transactions";

const appHeader = document.querySelector("#appHeader");
const appMain = document.querySelector("#appMain");
const authScreen = document.querySelector("#authScreen");
const authForm = document.querySelector("#authForm");
const authEmailInput = document.querySelector("#authEmail");
const authPasswordInput = document.querySelector("#authPassword");
const authMessage = document.querySelector("#authMessage");
const roleBadge = document.querySelector("#roleBadge");
const logoutButton = document.querySelector("#logoutButton");
const mainTabs = document.querySelectorAll("[data-main-tab]");
const stockForm = document.querySelector("#stockForm");
const transactionForm = document.querySelector("#transactionForm");
const stockNameInput = document.querySelector("#stockName");
const stockNameOptions = document.querySelector("#stockNameOptions");
const stockCategoryInput = document.querySelector("#stockCategory");
const stockUnitInput = document.querySelector("#stockUnit");
const stockMessage = document.querySelector("#stockMessage");
const itemNameInput = document.querySelector("#itemName");
const itemSearchInput = document.querySelector("#itemSearch");
const itemSearchResults = document.querySelector("#itemSearchResults");
const transactionTypeInput = document.querySelector("#transactionType");
const quantityInput = document.querySelector("#quantity");
const quantityUnit = document.querySelector("#quantityUnit");
const dateInput = document.querySelector("#date");
const noteInput = document.querySelector("#note");
const formMessage = document.querySelector("#formMessage");
const searchInput = document.querySelector("#searchInput");
const masterStockFilter = document.querySelector("#masterStockFilter");
const masterSearchInput = document.querySelector("#masterSearchInput");
const stockTableHead = document.querySelector("#stockTableHead");
const stockTable = document.querySelector("#stockTable");
const historyTable = document.querySelector("#historyTable");
const masterTable = document.querySelector("#masterTable");
const stockEmpty = document.querySelector("#stockEmpty");
const historyEmpty = document.querySelector("#historyEmpty");
const masterEmpty = document.querySelector("#masterEmpty");
const exportButton = document.querySelector("#exportButton");

let items = loadItems();
let transactions = loadTransactions();
let supabaseClient = null;
let syncTimer = null;
let currentSession = null;
let currentRole = "admin";
let isSupabaseMode = false;
let realtimeChannel = null;

migrateTransactionsToItems();
dateInput.value = getToday();
render();
registerServiceWorker();
initializeSupabase();

mainTabs.forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.mainTab === "master" && !canManageStock()) {
      showMessage(formMessage, "Role staff tidak bisa membuka Pengaturan Stock.", "error");
      return;
    }

    mainTabs.forEach((tab) => tab.classList.toggle("active", tab === button));
    document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.remove("active"));
    document.querySelector(`#${button.dataset.mainTab}Panel`).classList.add("active");
  });
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!supabaseClient) {
    showMessage(authMessage, "Supabase belum tersambung.", "error");
    return;
  }

  const email = cleanText(authEmailInput.value);
  const password = authPasswordInput.value;
  if (!email || !password) {
    showMessage(authMessage, "Isi email dan password.", "error");
    return;
  }

  const submitButton = authForm.querySelector("button[type='submit']");
  submitButton.disabled = true;
  submitButton.textContent = "Masuk...";

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  submitButton.disabled = false;
  submitButton.innerHTML = '<svg class="icon"><use href="#icon-user"></use></svg>Masuk';

  if (error) {
    showMessage(authMessage, `Login gagal: ${error.message}`, "error");
    return;
  }

  authPasswordInput.value = "";
  await handleAuthenticatedSession(data.session);
});

logoutButton.addEventListener("click", async () => {
  if (!supabaseClient) return;
  await supabaseClient.auth.signOut();
  showLoginScreen();
});

stockForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!canManageStock()) {
    showMessage(stockMessage, "Hanya admin yang bisa menyimpan nama stock.", "error");
    return;
  }

  const name = cleanText(stockNameInput.value);
  const category = cleanText(stockCategoryInput.value);
  const unit = cleanText(stockUnitInput.value);

  if (!name || !category || !unit) {
    showMessage(stockMessage, "Lengkapi nama stock, jenis, dan satuan.", "error");
    return;
  }

  const existingItem = items.find((item) => item.name.toLowerCase() === name.toLowerCase());
  if (existingItem) {
    existingItem.name = name;
    existingItem.category = category;
    existingItem.unit = unit;

    transactions = transactions.map((transaction) => {
      if (transaction.itemId !== existingItem.id) return transaction;
      return {
        ...transaction,
        itemName: name,
        category,
        unit
      };
    });

    try {
      await persistStockItem(existingItem);
      saveTransactions();
    } catch (error) {
      showMessage(stockMessage, `Gagal menyimpan ke Supabase: ${error.message}`, "error");
      return;
    }

    stockForm.reset();
    showMessage(stockMessage, "Nama stock berhasil diperbarui.", "success");
    render();
    return;
  }

  const newItem = {
    id: createId(),
    name,
    category,
    unit,
    createdAt: new Date().toISOString()
  };

  items.push(newItem);
  try {
    await persistStockItem(newItem);
  } catch (error) {
    items = items.filter((item) => item.id !== newItem.id);
    saveItems();
    showMessage(stockMessage, `Gagal menyimpan ke Supabase: ${error.message}`, "error");
    render();
    return;
  }

  stockForm.reset();
  showMessage(stockMessage, "Nama stock berhasil disimpan.", "success");
  render();
});

stockNameInput.addEventListener("change", () => {
  const item = items.find((stockItem) => stockItem.name.toLowerCase() === cleanText(stockNameInput.value).toLowerCase());
  if (!item) return;

  stockCategoryInput.value = item.category;
  stockUnitInput.value = item.unit;
});

transactionForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const itemId = itemNameInput.value;
  const item = getItemById(itemId);
  const type = transactionTypeInput.value;
  const quantity = Number(quantityInput.value);
  const date = dateInput.value;
  const note = cleanText(noteInput.value);

  if (!item || !date || !Number.isInteger(quantity) || quantity <= 0) {
    showMessage(formMessage, "Pilih nama stock, tanggal, dan jumlah dengan benar.", "error");
    return;
  }

  const currentStock = getStockMap().get(item.id)?.stock || 0;
  if (type === "out" && quantity > currentStock) {
    showMessage(formMessage, "Sisa stock tidak cukup untuk keluar gudang.", "error");
    return;
  }

  const newTransaction = {
    id: createId(),
    itemId: item.id,
    itemName: item.name,
    category: item.category,
    type,
    quantity,
    unit: item.unit,
    date,
    note,
    createdAt: new Date().toISOString()
  };

  transactions.unshift(newTransaction);
  try {
    await persistTransaction(newTransaction);
  } catch (error) {
    transactions = transactions.filter((transaction) => transaction.id !== newTransaction.id);
    saveTransactions();
    showMessage(formMessage, `Gagal menyimpan ke Supabase: ${error.message}`, "error");
    render();
    return;
  }

  transactionForm.reset();
  itemSearchInput.value = "";
  dateInput.value = getToday();
  updateQuantityUnit();
  showMessage(formMessage, "Transaksi berhasil disimpan.", "success");
  render();
});

itemSearchInput.addEventListener("input", () => {
  itemNameInput.value = "";
  updateQuantityUnit();
  renderItemSearchResults(itemSearchInput.value);
});

itemSearchInput.addEventListener("focus", () => {
  renderItemSearchResults(itemSearchInput.value);
});

itemSearchResults.addEventListener("click", (event) => {
  const button = event.target.closest("[data-select-item-id]");
  if (!button) return;

  selectTransactionItem(button.dataset.selectItemId);
});

document.addEventListener("click", (event) => {
  if (event.target.closest(".combo-field")) return;
  itemSearchResults.classList.remove("active");
});

searchInput.addEventListener("change", renderStockInfoTable);
masterStockFilter.addEventListener("change", renderMasterTable);
masterSearchInput.addEventListener("input", renderMasterTable);

masterTable.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-delete-item-id]");
  if (!button) return;

  if (!canManageStock()) {
    showMessage(stockMessage, "Hanya admin yang bisa menghapus nama stock.", "error");
    return;
  }

  const item = getItemById(button.dataset.deleteItemId);
  if (!item) return;

  const relatedTransactions = transactions.filter((transaction) => transaction.itemId === item.id).length;
  const message = relatedTransactions
    ? `Hapus nama stock ${item.name} beserta ${relatedTransactions} transaksi terkait?`
    : `Hapus nama stock ${item.name}?`;

  if (!confirm(message)) return;

  try {
    await deleteStockItem(item.id);
  } catch (error) {
    showMessage(stockMessage, `Gagal menghapus dari Supabase: ${error.message}`, "error");
    return;
  }

  items = items.filter((stockItem) => stockItem.id !== item.id);
  transactions = transactions.filter((transaction) => transaction.itemId !== item.id);
  saveItems();
  saveTransactions();
  render();
});

historyTable.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-delete-id]");
  if (!button) return;

  if (!canManageStock()) {
    showMessage(formMessage, "Hanya admin yang bisa menghapus transaksi.", "error");
    return;
  }

  const transaction = transactions.find((item) => item.id === button.dataset.deleteId);
  if (!confirm(`Hapus transaksi ${transaction?.itemName || "ini"}?`)) return;

  try {
    await deleteTransaction(button.dataset.deleteId);
  } catch (error) {
    showMessage(formMessage, `Gagal menghapus dari Supabase: ${error.message}`, "error");
    return;
  }

  transactions = transactions.filter((item) => item.id !== button.dataset.deleteId);
  saveTransactions();
  render();
});

exportButton.addEventListener("click", () => {
  if (!canManageStock()) {
    showMessage(formMessage, "Hanya admin yang bisa export CSV.", "error");
    return;
  }

  if (transactions.length === 0) {
    showMessage(formMessage, "Belum ada data untuk diexport.", "error");
    return;
  }

  const rows = [
    ["Tanggal", "Nama Stock", "Jenis", "Qty Masuk", "Qty Keluar", "Satuan", "Catatan"],
    ...transactions.map((item) => {
      const masterItem = getItemById(item.itemId);
      return [
        formatDateForCsv(item.date),
        masterItem?.name || item.itemName,
        masterItem?.category || item.category,
        item.type === "in" ? item.quantity : "",
        item.type === "out" ? item.quantity : "",
        masterItem?.unit || item.unit,
        item.note
      ];
    })
  ];

  const csv = rows.map((row) => row.map(formatCsvCell).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `transaksi-gudang-${getToday()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
});

function loadItems() {
  try {
    return JSON.parse(localStorage.getItem(ITEMS_KEY)) || [];
  } catch {
    return [];
  }
}

function loadTransactions() {
  try {
    return JSON.parse(localStorage.getItem(TRANSACTIONS_KEY)) || [];
  } catch {
    return [];
  }
}

function saveItems() {
  localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
}

function saveTransactions() {
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
}

async function initializeSupabase() {
  const config = await loadSupabaseConfig();
  if (!config) {
    applyRoleAccess();
    return;
  }

  isSupabaseMode = true;
  supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  logoutButton.classList.remove("app-hidden");

  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT" || !session) {
      showLoginScreen();
      return;
    }

    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
      handleAuthenticatedSession(session).catch((error) => {
        showMessage(authMessage, `Gagal memuat akun: ${error.message}`, "error");
      });
    }
  });

  const { data, error } = await supabaseClient.auth.getSession();
  if (error || !data.session) {
    showLoginScreen();
    return;
  }

  await handleAuthenticatedSession(data.session);
}

async function handleAuthenticatedSession(session) {
  if (!session) {
    showLoginScreen();
    return;
  }

  currentSession = session;
  currentRole = await loadUserRole(session.user.id);
  showAppScreen();
  await startSupabaseSync();
}

async function loadUserRole(userId) {
  if (!supabaseClient || !userId) return "staff";

  const { data, error } = await supabaseClient
    .from("user_profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("Role profile unavailable, using staff role.", error);
    return "staff";
  }

  return data?.role === "admin" ? "admin" : "staff";
}

async function startSupabaseSync() {
  if (!supabaseClient || !currentSession) return;

  const localItems = [...items];
  const localTransactions = [...transactions];

  try {
    await syncFromSupabase();
    if (!items.length && localItems.length && canManageStock()) {
      items = localItems;
      transactions = localTransactions;
      await pushLocalDataToSupabase();
      await syncFromSupabase();
    }
    subscribeToSupabaseChanges();
  } catch (error) {
    console.warn("Supabase sync failed, using local data.", error);
  }
}

function showLoginScreen() {
  currentSession = null;
  currentRole = "staff";
  appHeader.classList.add("app-hidden");
  appMain.classList.add("app-hidden");
  authScreen.classList.remove("app-hidden");
  applyRoleAccess();
}

function showAppScreen() {
  authScreen.classList.add("app-hidden");
  appHeader.classList.remove("app-hidden");
  appMain.classList.remove("app-hidden");
  applyRoleAccess();
}

function applyRoleAccess() {
  const isAdmin = canManageStock();
  roleBadge.textContent = isSupabaseMode ? (isAdmin ? "Admin" : "Staff") : "Lokal";
  roleBadge.title = isAdmin ? "Akses penuh" : "Input transaksi dan lihat data";

  document.querySelectorAll("[data-main-tab='master']").forEach((button) => {
    button.classList.toggle("role-locked", !isAdmin);
    button.disabled = !isAdmin;
  });

  exportButton.classList.toggle("role-locked", !isAdmin);

  if (!isAdmin && document.querySelector("#masterPanel").classList.contains("active")) {
    const dashboardButton = document.querySelector("[data-main-tab='dashboard']");
    dashboardButton?.click();
  }
}

function canManageStock() {
  return currentRole === "admin";
}

async function loadSupabaseConfig() {
  const localConfig = window.PUSPA_CONFIG || {};
  if (hasSupabaseConfig(localConfig)) return localConfig;

  try {
    const response = await fetch("/api/supabase-config", { cache: "no-store" });
    if (!response.ok) return null;

    const remoteConfig = await response.json();
    if (hasSupabaseConfig(remoteConfig)) return remoteConfig;
  } catch {
    return null;
  }

  return null;
}

function hasSupabaseConfig(config) {
  return Boolean(
    window.supabase &&
    config?.supabaseUrl &&
    config?.supabaseAnonKey &&
    !config.supabaseUrl.includes("YOUR_PROJECT_ID") &&
    !config.supabaseAnonKey.includes("YOUR_SUPABASE")
  );
}

async function syncFromSupabase() {
  if (!supabaseClient) return;

  const { data: itemRows, error: itemError } = await supabaseClient
    .from("stock_items")
    .select("id,name,jenis,unit,created_at")
    .order("name", { ascending: true });

  if (itemError) throw itemError;

  const { data: transactionRows, error: transactionError } = await supabaseClient
    .from("stock_transactions")
    .select("id,item_id,type,quantity,note,transaction_date,created_at")
    .order("created_at", { ascending: false });

  if (transactionError) throw transactionError;

  items = (itemRows || []).map(mapStockItemFromDb);
  transactions = (transactionRows || []).map(mapTransactionFromDb);
  saveItems();
  saveTransactions();
  render();
}

function subscribeToSupabaseChanges() {
  if (!supabaseClient) return;

  if (realtimeChannel) {
    supabaseClient.removeChannel(realtimeChannel);
  }

  realtimeChannel = supabaseClient
    .channel("puspa-stock-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "stock_items" }, scheduleSupabaseSync)
    .on("postgres_changes", { event: "*", schema: "public", table: "stock_transactions" }, scheduleSupabaseSync)
    .subscribe();
}

function scheduleSupabaseSync() {
  window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => {
    syncFromSupabase().catch((error) => console.warn("Supabase realtime sync failed.", error));
  }, 250);
}

async function persistStockItem(item) {
  saveItems();
  if (!supabaseClient) return;

  const { error } = await supabaseClient.from("stock_items").upsert(mapStockItemToDb(item));
  if (error) throw error;
}

async function persistTransaction(transaction) {
  saveTransactions();
  if (!supabaseClient) return;

  const { error } = await supabaseClient.from("stock_transactions").upsert(mapTransactionToDb(transaction));
  if (error) throw error;
}

async function deleteStockItem(itemId) {
  if (!supabaseClient) return;

  const { error } = await supabaseClient.from("stock_items").delete().eq("id", itemId);
  if (error) throw error;
}

async function deleteTransaction(transactionId) {
  if (!supabaseClient) return;

  const { error } = await supabaseClient.from("stock_transactions").delete().eq("id", transactionId);
  if (error) throw error;
}

async function pushLocalDataToSupabase() {
  if (!supabaseClient) return;

  if (items.length) {
    const { error } = await supabaseClient
      .from("stock_items")
      .upsert(items.map(mapStockItemToDb));
    if (error) throw error;
  }

  if (transactions.length) {
    const { error } = await supabaseClient
      .from("stock_transactions")
      .upsert(transactions.map(mapTransactionToDb));
    if (error) throw error;
  }
}

function mapStockItemToDb(item) {
  return {
    id: item.id,
    name: item.name,
    jenis: item.category,
    unit: item.unit,
    created_at: item.createdAt || new Date().toISOString()
  };
}

function mapStockItemFromDb(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.jenis,
    unit: row.unit,
    createdAt: row.created_at
  };
}

function mapTransactionToDb(transaction) {
  return {
    id: transaction.id,
    item_id: transaction.itemId,
    type: transaction.type,
    quantity: transaction.quantity,
    note: transaction.note || "",
    transaction_date: transaction.date,
    created_at: transaction.createdAt || new Date().toISOString()
  };
}

function mapTransactionFromDb(row) {
  const item = getItemById(row.item_id);
  return {
    id: row.id,
    itemId: row.item_id,
    itemName: item?.name || "",
    category: item?.category || "",
    type: row.type,
    quantity: row.quantity,
    unit: item?.unit || "",
    date: row.transaction_date,
    note: row.note || "",
    createdAt: row.created_at
  };
}

function migrateTransactionsToItems() {
  let changed = false;

  transactions = transactions.map((transaction) => {
    if (transaction.itemId) return transaction;

    const name = transaction.itemName || "Stock Lama";
    let item = items.find((stockItem) => stockItem.name.toLowerCase() === name.toLowerCase());
    if (!item) {
      item = {
        id: createId(),
        name,
        category: transaction.category || "Umum",
        unit: transaction.unit || "pcs",
        createdAt: transaction.createdAt || new Date().toISOString()
      };
      items.push(item);
      changed = true;
    }

    changed = true;
    return {
      ...transaction,
      itemId: item.id,
      category: transaction.category || item.category,
      unit: transaction.unit || item.unit
    };
  });

  if (changed) {
    saveItems();
    saveTransactions();
  }
}

function render() {
  renderItemSearchResults(itemSearchInput.value);
  renderStockNameOptions();
  renderMasterStockFilter();
  renderSearchSelect();
  updateQuantityUnit();
  renderMasterTable();
  renderStockInfoTable();
  renderHistoryTable();
  applyRoleAccess();
}

function renderStockNameOptions() {
  const names = [...new Set(items.map((item) => item.name))]
    .sort((a, b) => a.localeCompare(b));
  stockNameOptions.innerHTML = names.map((name) => `<option value="${escapeHtml(name)}"></option>`).join("");
}

function renderMasterStockFilter() {
  const currentValue = masterStockFilter.value;
  const sortedItems = [...items].sort((a, b) => a.name.localeCompare(b.name));

  masterStockFilter.innerHTML = [
    '<option value="">Semua stock</option>',
    ...sortedItems.map((item) => `<option value="${item.id}">${escapeHtml(item.name)} - ${escapeHtml(item.category)}</option>`)
  ].join("");

  if (currentValue && sortedItems.some((item) => item.id === currentValue)) {
    masterStockFilter.value = currentValue;
  }
}

function renderSearchSelect() {
  const sortedItems = [...items].sort((a, b) => a.name.localeCompare(b.name));
  const currentValue = searchInput.value;

  searchInput.innerHTML = [
    '<option value="">Semua Nama Stock</option>',
    ...sortedItems.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`)
  ].join("");

  if (currentValue && sortedItems.some((item) => item.id === currentValue)) {
    searchInput.value = currentValue;
  }
}

function renderItemSearchResults(query = "") {
  const cleanQuery = query.trim().toLowerCase();
  const filteredItems = [...items]
    .filter((item) => `${item.name} ${item.category}`.toLowerCase().includes(cleanQuery))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 8);

  if (!filteredItems.length) {
    itemSearchResults.innerHTML = '<span class="combo-empty">Belum ada stock yang cocok</span>';
    itemSearchResults.classList.toggle("active", document.activeElement === itemSearchInput);
    return;
  }

  itemSearchResults.innerHTML = filteredItems.map((item) => `
    <button class="combo-option" type="button" data-select-item-id="${item.id}">
      <strong>${escapeHtml(item.name)}</strong>
      <span>${escapeHtml(item.category)} - ${escapeHtml(item.unit)}</span>
    </button>
  `).join("");

  itemSearchResults.classList.toggle("active", document.activeElement === itemSearchInput);
}

function selectTransactionItem(itemId) {
  const item = getItemById(itemId);
  if (!item) return;

  itemNameInput.value = item.id;
  itemSearchInput.value = `${item.name} - ${item.category}`;
  itemSearchResults.classList.remove("active");
  updateQuantityUnit();
}

function updateQuantityUnit() {
  const item = getItemById(itemNameInput.value);
  quantityUnit.textContent = item?.unit || "satuan";
}

function renderMasterTable() {
  const selectedItemId = masterStockFilter.value;
  const query = masterSearchInput.value.trim().toLowerCase();
  const stockMap = getStockMap();
  const actionHeading = canManageStock() ? "Aksi" : "";
  const rows = [...items]
    .filter((item) => !selectedItemId || item.id === selectedItemId)
    .filter((item) => `${item.name} ${item.category}`.toLowerCase().includes(query))
    .sort((a, b) => a.name.localeCompare(b.name));

  masterTable.innerHTML = rows.map((item) => {
    const stock = stockMap.get(item.id)?.stock || 0;
    const actionCell = canManageStock()
      ? `<button class="danger-button" type="button" data-delete-item-id="${item.id}">${trashIcon()}Hapus</button>`
      : "";

    return `
      <tr>
        <td data-label="Nama Stock"><strong>${escapeHtml(item.name)}</strong></td>
        <td data-label="Jenis">${escapeHtml(item.category)}</td>
        <td data-label="Sisa" class="stock-number">${stock} ${escapeHtml(item.unit)}</td>
        <td data-label="${actionHeading}">${actionCell}</td>
      </tr>
    `;
  }).join("");

  masterEmpty.style.display = rows.length ? "none" : "block";
}

function renderStockInfoTable() {
  const selectedItemId = searchInput.value;
  const rows = getSortedStockItems()
    .filter((item) => !selectedItemId || item.id === selectedItemId);

  const head = ["Nama Stock", "Jenis", "Masuk", "Keluar", "Sisa", "Satuan"];

  stockTableHead.innerHTML = `<tr>${head.map((heading) => `<th>${heading}</th>`).join("")}</tr>`;
  stockTable.innerHTML = rows.map((item) => {
    const cells = [
      strong(item.name),
      item.category,
      item.inQty,
      item.outQty,
      `<span class="stock-number">${item.stock}</span>`,
      item.unit
    ];
    return `
      <tr>${cells.map((cell, index) => `<td data-label="${escapeHtml(head[index])}">${typeof cell === "number" ? cell : escapeHtmlAllowMarkup(cell)}</td>`).join("")}</tr>
    `;
  }).join("");

  stockEmpty.style.display = rows.length ? "none" : "block";
}

function renderHistoryTable() {
  historyTable.innerHTML = transactions.map((item) => {
    const masterItem = getItemById(item.itemId);
    const actionCell = canManageStock()
      ? `<button class="danger-button" type="button" data-delete-id="${item.id}">${trashIcon()}Hapus</button>`
      : "";

    return `
      <tr>
        <td data-label="Tanggal">${formatDate(item.date)}</td>
        <td data-label="Nama Stock"><strong>${escapeHtml(masterItem?.name || item.itemName)}</strong></td>
        <td data-label="Jenis">${escapeHtml(masterItem?.category || item.category || "-")}</td>
        <td data-label="Qty Masuk">${item.type === "in" ? item.quantity : "-"}</td>
        <td data-label="Qty Keluar">${item.type === "out" ? item.quantity : "-"}</td>
        <td data-label="Satuan">${escapeHtml(masterItem?.unit || item.unit)}</td>
        <td data-label="Catatan">${escapeHtml(item.note || "-")}</td>
        <td data-label="Aksi">${actionCell}</td>
      </tr>
    `;
  }).join("");

  historyEmpty.style.display = transactions.length ? "none" : "block";
}

function getStockMap() {
  const map = new Map(items.map((item) => [item.id, {
    ...item,
    inQty: 0,
    outQty: 0,
    stock: 0
  }]));

  transactions.forEach((transaction) => {
    const item = map.get(transaction.itemId);
    if (!item) return;

    if (transaction.type === "in") {
      item.inQty += transaction.quantity;
      item.stock += transaction.quantity;
    } else {
      item.outQty += transaction.quantity;
      item.stock -= transaction.quantity;
    }
  });

  return map;
}

function getSortedStockItems() {
  return [...getStockMap().values()].sort((a, b) => a.name.localeCompare(b.name));
}

function getItemById(id) {
  return items.find((item) => item.id === id);
}

function showMessage(element, message, type) {
  element.textContent = message;
  element.className = `form-message ${type}`;

  window.clearTimeout(element.timeoutId);
  element.timeoutId = window.setTimeout(() => {
    element.textContent = "";
    element.className = "form-message";
  }, 3200);
}

function cleanText(value) {
  return value.trim().replace(/\s+/g, " ");
}

function getToday() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(`${value}T00:00:00`));
}

function formatDateForCsv(value) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatCsvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function strong(value) {
  return `<strong>${escapeHtml(value)}</strong>`;
}

function trashIcon() {
  return '<svg class="icon" aria-hidden="true"><use href="#icon-trash"></use></svg>';
}

function escapeHtmlAllowMarkup(value) {
  const text = String(value);
  if (text.startsWith("<strong>") || text.startsWith("<span")) return text;
  return escapeHtml(text);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
      // PWA registration only works from localhost or HTTPS.
    });
  });
}
