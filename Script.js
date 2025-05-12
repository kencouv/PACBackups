// Backup Dashboard - Enhanced script.js with multi-source support
document.addEventListener('DOMContentLoaded', function() {
  const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR7ld_Xk6exjhviNdm30N1MKaa7huWDGjtdR5BvQbG9D_-TCWPTRMRlcDK4Sd58f08KcKYDRWhbTVuM/pub?output=csv";
  const API_BASE_URL = "http://localhost:3000/api"; // Update this with your actual backend URL

  const COLS = {
    status: "Status",
    device: "Computer Name",
    source: "Source",
    start: "Backup Start Time",
    backedUp: "Files backed up now",
    failed: "Files failed to backup",
    considered: "Files considered for backup"
  };

  let rawRows = [];
  let viewRows = [];
  let sortCol = null;
  let sortDir = "asc";

  /* ---- Initialize the app ---- */
  function init() {
    // Verify elements exist before adding event listeners
    const applyFiltersBtn = document.getElementById("apply-filters");
    const refreshBtn = document.getElementById("refresh-btn");
    
    if (!applyFiltersBtn || !refreshBtn) {
      console.error("Critical elements missing from DOM");
      document.getElementById("backups-data").innerHTML = `
        <tr><td colspan="7" style="color:red">
          Error: Page failed to load properly. Please refresh.
        </td></tr>`;
      return;
    }

    applyFiltersBtn.addEventListener("click", applyFilters);
    refreshBtn.addEventListener("click", loadAllBackupData);
    bindHeaderClicks();
    loadAllBackupData();
  }

  /* ---- fetch & parse from multiple sources ---- */
  async function loadAllBackupData() {
    const tbody = document.getElementById("backups-data");
    tbody.innerHTML = `<tr><td colspan="7" class="loading-message">Loading backup data from all sources...</td></tr>`;

    try {
      // Fetch data from all sources in parallel
      const [idriveData, dattoData, acronisData] = await Promise.all([
        fetchIDriveData(),
        fetchDattoData(),
        fetchAcronisData()
      ]);

      // Combine all data
      rawRows = [
        ...idriveData,
        ...dattoData,
        ...acronisData
      ].filter(r => r[COLS.status]); // Keep the existing filter for valid status

      buildDeviceOptions(rawRows);
      buildSourceOptions(rawRows);
      applyFilters();
      
      const updateTime = document.getElementById("update-time");
      if (updateTime) {
        updateTime.textContent = new Date().toLocaleString();
      }
    } catch (error) {
      console.error(error);
      tbody.innerHTML = `<tr><td colspan="7" style="color:red">
        Error loading data. ${error.message || 'Check console for details'}
      </td></tr>`;
    }
  }

  /* ---- Source-specific data fetching functions ---- */
  async function fetchIDriveData() {
    return new Promise((resolve, reject) => {
      Papa.parse(CSV_URL, {
        download: true,
        header: true,
        dynamicTyping: true,
        complete: ({ data, errors }) => {
          if (errors?.length) {
            reject(new Error(`Error parsing IDrive data: ${errors[0].message}`));
            return;
          }
          // Add source information to IDrive data
          const idriveData = data.map(row => ({
            ...row,
            Source: "IDrive"
          }));
          resolve(idriveData);
        },
        error: err => reject(err)
      });
    });
  }

  async function fetchDattoData() {
    try {
      const response = await fetch(`${API_BASE_URL}/datto/backups`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error("Error fetching Datto data:", error);
      return [];
    }
  }

  async function fetchAcronisData() {
    try {
      const response = await fetch(`${API_BASE_URL}/acronis/backups`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error("Error fetching Acronis data:", error);
      return [];
    }
  }

  /* ---- dropdown builders ---- */
  function buildDeviceOptions(rows) {
    const sel = document.getElementById("device-filter");
    const devices = [...new Set(rows.map(r => r[COLS.device]))].filter(Boolean).sort();
    sel.innerHTML = `<option value="All">All Devices</option>` + 
                   devices.map(d => `<option>${d}</option>`).join("");
  }

  function buildSourceOptions(rows) {
    const sel = document.getElementById("source-filter");
    const sources = [...new Set(rows.map(r => r.Source))].filter(Boolean).sort();
    sel.innerHTML = `<option value="All">All Sources</option>` + 
                   sources.map(s => `<option>${s}</option>`).join("");
  }

  /* ---- filter & sort ---- */
  function applyFilters() {
    const status = document.getElementById("status-filter").value;
    const device = document.getElementById("device-filter").value;
    const source = document.getElementById("source-filter").value;
    const range = document.getElementById("date-filter").value;
    const now = Date.now();
    const maxAge = range === "all" ? Infinity : Number(range) * 8640000;

    viewRows = rawRows.filter(r => {
      const okStatus = status === "All Statuses" || r.Status === status;
      const okDevice = device === "All" || r[COLS.device] === device;
      const okSource = source === "All" || r.Source === source;
      let okDate = true;
      
      if (maxAge !== Infinity) {
        const ts = parseDate(r[COLS.start]);
        okDate = ts && (now - ts <= maxAge);
      }
      return okStatus && okDevice && okSource && okDate;
    });

    if (sortCol) sortViewRows();
    renderCards(viewRows);
    renderTable(viewRows);
  }

  function sortViewRows() {
    const dir = sortDir === "asc" ? 1 : -1;
    viewRows.sort((a, b) => {
      let vA, vB;
      if (sortCol === "source") {
        vA = a.Source || "";
        vB = b.Source || "";
      } else if (sortCol === "start") {
        vA = parseDate(a[COLS.start]) || 0;
        vB = parseDate(b[COLS.start]) || 0;
      } else {
        vA = a[COLS[sortCol]];
        vB = b[COLS[sortCol]];
      }
      if (typeof vA === "number" && typeof vB === "number") return (vA - vB) * dir;
      return String(vA).localeCompare(String(vB)) * dir;
    });
  }

  /* ---- date parser ---- */
  function parseDate(str) {
    const m = str && str.match(/(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})/);
    if (!m) return null;
    return new Date(`${m[3]}-${m[1]}-${m[2]}T${m[4]}:${m[5]}:${m[6]}Z`).getTime();
  }

  /* ---- summary cards ---- */
  function renderCards(rows) {
    document.getElementById("total-backups").textContent = rows.length;
    document.getElementById("successful-backups").textContent = rows.filter(r => r.Status === "Successful").length;
    document.getElementById("warning-backups").textContent = rows.filter(r => r.Status === "Warning").length;
    document.getElementById("failed-backups").textContent = rows.filter(r => r.Status === "Failed").length;
  }

  /* ---- table ---- */
  function renderTable(rows) {
    const tbody = document.getElementById("backups-data");
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="7">No backups match the filters.</td></tr>`;
      return;
    }
    
    tbody.innerHTML = rows.map(r => `
      <tr class="${r.Status.toLowerCase()}">
        <td>${r.Status}</td>
        <td>${r[COLS.device] || ""}</td>
        <td>${r.Source}</td>
        <td>${r[COLS.start] || ""}</td>
        <td>${r[COLS.backedUp] || 0}</td>
        <td>${r[COLS.failed] || 0}</td>
        <td>${r[COLS.considered] || 0}</td>
      </tr>`).join("");

    document.querySelectorAll("th[data-col]").forEach(th => {
      th.classList.remove("sort-asc", "sort-desc");
      if (th.dataset.col === sortCol) th.classList.add(`sort-${sortDir}`);
    });
  }

  /* ---- header clicks ---- */
  function bindHeaderClicks() {
    document.querySelectorAll("th[data-col]").forEach(th => {
      th.addEventListener("click", () => {
        const col = th.dataset.col;
        if (sort