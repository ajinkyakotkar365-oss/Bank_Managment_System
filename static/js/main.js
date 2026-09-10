// Ajinkya Bank Enterprise Core JS System
// Client-side State Machine and Customer Lifecycle Simulator

// ----------------------------------------------------
// 1. MOCK DATABASE (Shared State)
// ----------------------------------------------------
let state = {
    banks: [
        { id: 1, name: "Ajinkya Bank", code: "ANPA", status: "Active" }
    ],
    branches: [
        { id: 1, bankId: 1, code: "ANP01", name: "Akole Branch", address: "Main Road, Akole, Ahmednagar", ifsc: "ANPA0000001", balance: 0.00 }
    ],
    employees: [
        { id: 1, branchId: 1, empId: "EMP01", name: "Akole Cashier", role: "Teller", mobile: "9876543210", email: "cashier@ajinkyanagari.com", status: "Active" }
    ],
    customers: [
        { id: 1, custId: "CUST101", name: "Rahul Sharma", dob: "1995-08-15", gender: "Male", mobile: "9836543210", email: "rahul@gmail.com", aadhaar: "1234-5678-9012", pan: "ABCDE1234F", address: "Akole, Ahmednagar", occupation: "Business", nominee: "Geeta Sharma (Mother)", status: "Active", kycStatus: "Verified" }
    ],
    accounts: [
        { id: 1, customerId: 1, accNum: "100000007890", type: "Savings", branchId: 1, balance: 0.00, status: "Active", createdAt: "2026-08-19" }
    ],
    transactions: [],
    loans: [],
    cards: [
        { id: 1, customerId: 1, cardNum: "4532 •••• •••• 5678", expiry: "12/28", status: "Active" }
    ],
    cheques: [
        { id: 1, customerId: 1, leaves: 25, status: "Delivered", date: "2026-08-19" }
    ],
    serviceRequests: [
        { id: 1, customerId: 1, type: "Address Update", details: "Change to Sector 62, Noida", status: "Pending", date: "2026-08-19" }
    ],
    accountClosures: [],
    auditLogs: [
        { id: 1, timestamp: "2026-08-19 10:00", actor: "System", action: "Seeded initial bank databases." }
    ],
    notifications: [
        { id: 1, title: "New KYC Pending", desc: "Customer Rahul Sharma uploaded documents.", read: false }
    ]
};

// ----------------------------------------------------
// 2. ACTIVE VIEW STATE
// ----------------------------------------------------
let activeRole = "customer"; // Default
let activeTab = "dashboard";
let chartsInstances = {};

// Role Definitions & Sidemenu Structures
const roleConfig = {
    super_admin: {
        title: "Super Admin",
        menu: [
            { id: "dashboard", label: "Dashboard", icon: "fa-chart-line" },
            { id: "sa_customers", label: "Customers", icon: "fa-users" },
            { id: "sa_accounts", label: "Accounts", icon: "fa-wallet" },
            { id: "sa_employees", label: "Employees", icon: "fa-user-tie" },
            { id: "sa_transactions", label: "Transactions", icon: "fa-money-bill-transfer" },
            { id: "sa_audit", label: "Audit Logs", icon: "fa-clipboard-list" }
        ],
        defaultUser: "Ajinkya Admin"
    },
    bank_admin: {
        title: "Bank Admin",
        menu: [],
        defaultUser: "BankAdmin"
    },
    branch_manager: {
        title: "Branch Manager",
        menu: [],
        defaultUser: "Branch Manager"
    },
    customer_service_executive: {
        title: "Customer Service Executive",
        menu: [],
        defaultUser: "Executive Neha"
    },
    kyc_officer: {
        title: "KYC Officer",
        menu: [],
        defaultUser: "Officer Sanjay"
    },
    account_officer: {
        title: "Account Officer",
        menu: [],
        defaultUser: "Account Officer Amit"
    },
    cashier_teller: {
        title: "Cashier / Teller",
        menu: [
            { id: "dashboard", label: "Dashboard", icon: "fa-chart-line" },
            { id: "cashier_deposit", label: "Cash Deposit", icon: "fa-money-bill-transfer" },
            { id: "cashier_withdraw", label: "Cash Withdrawal", icon: "fa-money-bill-wave" },
            { id: "cashier_transfer", label: "Fund Transfer", icon: "fa-share-nodes" },
            { id: "cashier_txns", label: "Today's Transactions", icon: "fa-list-check" },
            { id: "cashier_report", label: "Daily Cash Report", icon: "fa-receipt" }
        ],
        defaultUser: "Akole Cashier"
    },
    loan_officer: {
        title: "Loan Officer",
        menu: [],
        defaultUser: "Loan Officer"
    },
    accountant_finance: {
        title: "Accountant / Finance Officer",
        menu: [],
        defaultUser: "Finance Officer"
    },
    customer: {
        title: "Customer Dashboard",
        menu: [
            { id: "dashboard", label: "My Dashboard", icon: "fa-table-columns" },
            { id: "cust_accounts", label: "My Accounts", icon: "fa-wallet" },
            { id: "cust_statement", label: "Bank Statement", icon: "fa-file-waveform" },
            { id: "cust_transfer", label: "Fund Transfer", icon: "fa-share-nodes" }
        ],
        defaultUser: "Customer"
    }
};

// ----------------------------------------------------
// 3. CORE DOM & BOOTSTRAP
// ----------------------------------------------------
document.addEventListener("DOMContentLoaded", function () {
    // Only run mock portal logic if portal UI is present
    if (!document.getElementById("sidebar-menu") && !document.getElementById("bc-role")) {
        return;
    }

    // Read session default variables if set
    if (window.flaskSession && window.flaskSession.role) {
        activeRole = window.flaskSession.role;
        // Map default users
        if (activeRole === "customer") {
            roleConfig.customer.defaultUser = window.flaskSession.customerName;
        } else if (activeRole === "cashier_teller") {
            roleConfig.cashier_teller.defaultUser = window.flaskSession.employeeName;
        } else if (activeRole === "branch_manager") {
            roleConfig.branch_manager.defaultUser = window.flaskSession.employeeName;
        } else if (activeRole === "loan_officer") {
            roleConfig.loan_officer.defaultUser = window.flaskSession.employeeName;
        }
    }
    
    // Set switcher dropdown to correct role initially
    const switcher = document.getElementById("demo-role-switcher");
    if (switcher) {
        switcher.value = activeRole;
        switcher.addEventListener("change", function (e) {
            switchRole(e.target.value);
        });
    }

    // Bind Alerts close buttons
    document.addEventListener("click", function(e) {
        if (e.target.closest(".alert-close")) {
            e.target.closest(".alert").remove();
        }
    });

    // Initialize the View
    initView();
});

// Switch Workspace Role
function switchRole(role) {
    activeRole = role;
    activeTab = "dashboard";
    
    // Notify
    showToast("Workspace Switched", `Now viewing as ${roleConfig[role].title}`, "info");
    
    // Update Dropdown UI
    const switcher = document.getElementById("demo-role-switcher");
    if (switcher) switcher.value = role;

    // Reset breadcrumb & profile widgets
    initView();
}

function initView() {
    // 1. Update Breadcrumb
    document.getElementById("bc-role").innerText = roleConfig[activeRole].title;
    document.getElementById("bc-page").innerText = activeTab.replace(/_/g, " ").toUpperCase();

    // 2. Update Profile Headers
    document.getElementById("navbar-profile-name").innerText = roleConfig[activeRole].defaultUser;
    document.getElementById("navbar-role-badge").innerText = roleConfig[activeRole].title;
    document.getElementById("user-snippet-username").innerText = roleConfig[activeRole].defaultUser.split(" ")[0];
    document.getElementById("user-snippet-role").innerText = roleConfig[activeRole].title;

    // 3. Render Sidebar Menu
    const sidebarMenu = document.getElementById("sidebar-menu");
    sidebarMenu.innerHTML = "";
    roleConfig[activeRole].menu.forEach(item => {
        const li = document.createElement("li");
        li.className = `menu-item ${item.id === activeTab ? "active" : ""}`;
        li.innerHTML = `
            <a class="menu-link" onclick="navigateTab('${item.id}')">
                <i class="fa-solid ${item.icon}"></i> ${item.label}
            </a>
        `;
        sidebarMenu.appendChild(li);
    });

    // 4. Render Active View Pane
    renderViewPane();
}

function navigateTab(tabId) {
    activeTab = tabId;
    
    // Update breadcrumb
    const label = roleConfig[activeRole].menu.find(m => m.id === tabId)?.label || tabId;
    document.getElementById("bc-page").innerText = label.toUpperCase();

    // Update active class in sidebar items
    const items = document.querySelectorAll("#sidebar-menu .menu-item");
    items.forEach((item, index) => {
        const configItem = roleConfig[activeRole].menu[index];
        if (configItem && configItem.id === tabId) {
            item.classList.add("active");
        } else {
            item.classList.remove("active");
        }
    });

    renderViewPane();
}

// ----------------------------------------------------
// 4. VIEWS DISPATCHER
// ----------------------------------------------------
function renderViewPane() {
    const workspace = document.getElementById("portal-workspace");
    // Clear previous charts to prevent memory leaks
    Object.values(chartsInstances).forEach(c => c.destroy());
    chartsInstances = {};

    // Generate Layout html dynamically
    let html = "";
    
    // Check role and render correct tab
    if (activeTab === "dashboard") {
        html = getDashboardHtml();
    } else {
        html = getSubpageHtml(activeTab);
    }
    
    workspace.innerHTML = html;

    // Trigger Chart.js initializations if on dashboard
    if (activeTab === "dashboard") {
        initDashboardCharts();
    }
    
    // Additional initializations (like Cashier deposits autocomplete, card styles, nominee events)
    bindDynamicEvents();
}

// ----------------------------------------------------
// 5. TOAST NOTIFICATION SYSTEM
// ----------------------------------------------------
function showToast(title, message, type = "success") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    
    let icon = "fa-circle-check";
    if (type === "danger") icon = "fa-circle-exclamation";
    else if (type === "warning") icon = "fa-triangle-exclamation";
    else if (type === "info") icon = "fa-circle-info";

    toast.innerHTML = `
        <div class="toast-icon"><i class="fa-solid ${icon}"></i></div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()"><i class="fa-solid fa-xmark"></i></button>
    `;
    
    container.appendChild(toast);
    
    // Auto remove
    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(20px) scale(0.9)";
        setTimeout(() => toast.remove(), 250);
    }, 4000);
}

// ----------------------------------------------------
// 6. DASHBOARDS DISPATCHER
// ----------------------------------------------------
function getDashboardHtml() {
    // Generate dashboard view HTML depending on role
    switch (activeRole) {
        case "super_admin":
            return getSuperAdminDashboard();
        case "bank_admin":
            return getBankAdminDashboard();
        case "branch_manager":
            return getBranchManagerDashboard();
        case "customer_service_executive":
            return getCSDashboard();
        case "kyc_officer":
            return getKYCDashboard();
        case "account_officer":
            return getAccountOfficerDashboard();
        case "cashier_teller":
            return getCashierDashboard();
        case "loan_officer":
            return getLoanOfficerDashboard();
        case "accountant_finance":
            return getAccountantDashboard();
        case "customer":
            return getCustomerDashboard();
    }
}

// ----------------------------------------------------
// 6.1 SUPER ADMIN DASHBOARD
// ----------------------------------------------------
function getSuperAdminDashboard() {
    let depositSum = state.accounts.reduce((a, b) => a + Number(b.balance), 0);
    let loanSum = state.loans.filter(l => l.status === "Approved").reduce((a, b) => a + Number(b.amount), 0);
    
    return `
        <div class="kpi-grid">
            <div class="kpi-card">
                <div class="kpi-card-details">
                    <span class="kpi-card-title">Total Banks</span>
                    <span class="kpi-card-value">${state.banks.length}</span>
                </div>
                <div class="kpi-card-icon primary"><i class="fa-solid fa-building"></i></div>
            </div>
            <div class="kpi-card">
                <div class="kpi-card-details">
                    <span class="kpi-card-title">Branches</span>
                    <span class="kpi-card-value">${state.branches.length}</span>
                </div>
                <div class="kpi-card-icon success"><i class="fa-solid fa-code-branch"></i></div>
            </div>
            <div class="kpi-card">
                <div class="kpi-card-details">
                    <span class="kpi-card-title">Employees</span>
                    <span class="kpi-card-value">${state.employees.length}</span>
                </div>
                <div class="kpi-card-icon info"><i class="fa-solid fa-user-tie"></i></div>
            </div>
            <div class="kpi-card">
                <div class="kpi-card-details">
                    <span class="kpi-card-title">Customers</span>
                    <span class="kpi-card-value">${state.customers.length}</span>
                </div>
                <div class="kpi-card-icon warning"><i class="fa-solid fa-users"></i></div>
            </div>
            <div class="kpi-card">
                <div class="kpi-card-details">
                    <span class="kpi-card-title">Deposits</span>
                    <span class="kpi-card-value">₹${formatINR(depositSum)}</span>
                </div>
                <div class="kpi-card-icon success"><i class="fa-solid fa-wallet"></i></div>
            </div>
            <div class="kpi-card">
                <div class="kpi-card-details">
                    <span class="kpi-card-title">Active Loans</span>
                    <span class="kpi-card-value">₹${formatINR(loanSum)}</span>
                </div>
                <div class="kpi-card-icon danger"><i class="fa-solid fa-hand-holding-dollar"></i></div>
            </div>
        </div>

        <div class="charts-grid">
            <div class="chart-card">
                <span class="chart-card-title">Transaction Trends (Deposits vs Withdrawals)</span>
                <div class="chart-container">
                    <canvas id="sa-txn-chart"></canvas>
                </div>
            </div>
            <div class="chart-card">
                <span class="chart-card-title">Customer Growth Rate</span>
                <div class="chart-container">
                    <canvas id="sa-growth-chart"></canvas>
                </div>
            </div>
        </div>

        <div class="table-card">
            <div class="table-header">
                <span class="table-title">Recent System Activity Logs</span>
                <span class="badge badge-info">System Live</span>
            </div>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Timestamp</th>
                            <th>User/Actor</th>
                            <th>Action Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${state.auditLogs.slice(-4).reverse().map(l => `
                            <tr>
                                <td>${l.timestamp}</td>
                                <td><strong>${l.actor}</strong></td>
                                <td>${l.action}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// ----------------------------------------------------
// 6.2 BANK ADMIN DASHBOARD
// ----------------------------------------------------
function getBankAdminDashboard() {
    let pendingKyc = state.customers.filter(c => c.kycStatus === "Pending").length;
    let pendingApps = state.accounts.filter(a => a.status === "Inactive").length;
    let pendingLoans = state.loans.filter(l => l.status === "Pending").length;
    
    return `
        <div class="kpi-grid">
            <div class="kpi-card">
                <div class="kpi-card-details">
                    <span class="kpi-card-title">Bank Customers</span>
                    <span class="kpi-card-value">${state.customers.length}</span>
                </div>
                <div class="kpi-card-icon primary"><i class="fa-solid fa-users"></i></div>
            </div>
            <div class="kpi-card">
                <div class="kpi-card-details">
                    <span class="kpi-card-title">Pending KYC Verification</span>
                    <span class="kpi-card-value">${pendingKyc}</span>
                </div>
                <div class="kpi-card-icon warning"><i class="fa-solid fa-id-card"></i></div>
            </div>
            <div class="kpi-card">
                <div class="kpi-card-details">
                    <span class="kpi-card-title">Pending Account Apps</span>
                    <span class="kpi-card-value">${pendingApps}</span>
                </div>
                <div class="kpi-card-icon info"><i class="fa-solid fa-file-invoice"></i></div>
            </div>
            <div class="kpi-card">
                <div class="kpi-card-details">
                    <span class="kpi-card-title">Pending Loans Review</span>
                    <span class="kpi-card-value">${pendingLoans}</span>
                </div>
                <div class="kpi-card-icon danger"><i class="fa-solid fa-hand-holding-dollar"></i></div>
            </div>
        </div>

        <div class="table-card">
            <div class="table-header">
                <span class="table-title">Recent Accounts Added (Pending Verification)</span>
                <button class="btn btn-primary btn-sm" onclick="navigateTab('ba_accounts_app')">View Applications</button>
            </div>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Account No</th>
                            <th>Customer Name</th>
                            <th>Type</th>
                            <th>Created Date</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${state.accounts.map(acc => {
                            let cust = state.customers.find(c => c.id === acc.customerId);
                            return `
                                <tr>
                                    <td><code>${acc.accNum}</code></td>
                                    <td><strong>${cust ? cust.name : "Unknown"}</strong></td>
                                    <td>${acc.type}</td>
                                    <td>${acc.createdAt}</td>
                                    <td><span class="badge ${acc.status === 'Active' ? 'badge-success' : 'badge-warning'}">${acc.status}</span></td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// ----------------------------------------------------
// 6.3 BRANCH MANAGER DASHBOARD
// ----------------------------------------------------
function getBranchManagerDashboard() {
    let pendingLoans = state.loans.filter(l => l.status === "Pending").length;
    let pendingKyc = state.customers.filter(c => c.kycStatus === "Pending").length;
    
    return `
        <div class="kpi-grid">
            <div class="kpi-card">
                <div class="kpi-card-details">
                    <span class="kpi-card-title">Branch Vault Balance</span>
                    <span class="kpi-card-value">₹${formatINR(64289000.00)}</span>
                </div>
                <div class="kpi-card-icon success"><i class="fa-solid fa-building-columns"></i></div>
            </div>
            <div class="kpi-card">
                <div class="kpi-card-details">
                    <span class="kpi-card-title">Branch Customers</span>
                    <span class="kpi-card-value">${state.customers.length}</span>
                </div>
                <div class="kpi-card-icon primary"><i class="fa-solid fa-users"></i></div>
            </div>
            <div class="kpi-card">
                <div class="kpi-card-details">
                    <span class="kpi-card-title">KYC Review Pending</span>
                    <span class="kpi-card-value">${pendingKyc}</span>
                </div>
                <div class="kpi-card-icon warning"><i class="fa-solid fa-user-shield"></i></div>
            </div>
            <div class="kpi-card">
                <div class="kpi-card-details">
                    <span class="kpi-card-title">Loan Approvals Queue</span>
                    <span class="kpi-card-value">${pendingLoans}</span>
                </div>
                <div class="kpi-card-icon danger"><i class="fa-solid fa-envelope-open-text"></i></div>
            </div>
        </div>

        <div class="table-card">
            <div class="table-header">
                <span class="table-title">Branch Staff Deployment</span>
                <span class="badge badge-success">All Active</span>
            </div>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Staff ID</th>
                            <th>Staff Name</th>
                            <th>Assigned Role</th>
                            <th>Contact</th>
                            <th>Branch</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${state.employees.map(emp => `
                            <tr>
                                <td><code>${emp.empId}</code></td>
                                <td><strong>${emp.name}</strong></td>
                                <td>${emp.role}</td>
                                <td>${emp.mobile}</td>
                                <td>Main Branch</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// ----------------------------------------------------
// 6.4 CUSTOMER SERVICE EXECUTIVE DASHBOARD
// ----------------------------------------------------
function getCSDashboard() {
    let cardReq = state.cards.length;
    let chequeReq = state.cheques.length;
    
    return `
        <div class="kpi-grid">
            <div class="kpi-card">
                <div class="kpi-card-details">
                    <span class="kpi-card-title">New Registrations Today</span>
                    <span class="kpi-card-value">1</span>
                </div>
                <div class="kpi-card-icon primary"><i class="fa-solid fa-user-plus"></i></div>
            </div>
            <div class="kpi-card">
                <div class="kpi-card-details">
                    <span class="kpi-card-title">KYC Document Uploads</span>
                    <span class="kpi-card-value">2</span>
                </div>
                <div class="kpi-card-icon info"><i class="fa-solid fa-file-arrow-up"></i></div>
            </div>
            <div class="kpi-card">
                <div class="kpi-card-details">
                    <span class="kpi-card-title">Debit Card Orders</span>
                    <span class="kpi-card-value">${cardReq}</span>
                </div>
                <div class="kpi-card-icon warning"><i class="fa-solid fa-credit-card"></i></div>
            </div>
            <div class="kpi-card">
                <div class="kpi-card-details">
                    <span class="kpi-card-title">Cheque Requests processed</span>
                    <span class="kpi-card-value">${chequeReq}</span>
                </div>
                <div class="kpi-card-icon success"><i class="fa-solid fa-money-check"></i></div>
            </div>
        </div>

        <div class="form-card">
            <h3 class="chart-card-title">Quick Customer Lifecycle Simulator Navigation</h3>
            <p style="color: var(--text-secondary); font-size:14px;">Use the menu bar on the left to Register Customers, verify KYC documents, and issue cards/cheque books. Once registered, click the **Demo Switcher** at the top right to act as another role in the bank workflow!</p>
            <div class="form-buttons" style="justify-content: flex-start;">
                <button class="btn btn-primary" onclick="navigateTab('cse_register')"><i class="fa-solid fa-user-plus"></i> Register a New Customer</button>
            </div>
        </div>
    `;
}

// ----------------------------------------------------
// 6.5 KYC OFFICER DASHBOARD
// ----------------------------------------------------
function getKYCDashboard() {
    let pendingKyc = state.customers.filter(c => c.kycStatus === "Pending").length;
    let verifiedKyc = state.customers.filter(c => c.kycStatus === "Verified").length;
    
    return `
        <div class="kpi-grid">
            <div class="kpi-card">
                <div class="kpi-card-details">
                    <span class="kpi-card-title">Pending KYC Verification</span>
                    <span class="kpi-card-value">${pendingKyc}</span>
                </div>
                <div class="kpi-card-icon danger"><i class="fa-solid fa-id-card-clip"></i></div>
            </div>
            <div class="kpi-card">
                <div class="kpi-card-details">
                    <span class="kpi-card-title">Verified KYC Records</span>
                    <span class="kpi-card-value">${verifiedKyc}</span>
                </div>
                <div class="kpi-card-icon success"><i class="fa-solid fa-clipboard-check"></i></div>
            </div>
            <div class="kpi-card">
                <div class="kpi-card-details">
                    <span class="kpi-card-title">Rejected Documents</span>
                    <span class="kpi-card-value">0</span>
                </div>
                <div class="kpi-card-icon warning"><i class="fa-solid fa-user-slash"></i></div>
            </div>
        </div>

        <div class="table-card">
            <div class="table-header">
                <span class="table-title">KYC Validation Pipeline</span>
                <button class="btn btn-primary btn-sm" onclick="navigateTab('kyc_verify')">Open Verification Queue</button>
            </div>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Customer Name</th>
                            <th>Aadhaar Number</th>
                            <th>PAN Number</th>
                            <th>KYC Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${state.customers.map(c => `
                            <tr>
                                <td><strong>${c.name}</strong></td>
                                <td><code>${c.aadhaar}</code></td>
                                <td><code>${c.pan}</code></td>
                                <td><span class="badge ${c.kycStatus === 'Verified' ? 'badge-success' : 'badge-warning'}">${c.kycStatus}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// ----------------------------------------------------
// 6.6 ACCOUNT OFFICER DASHBOARD
// ----------------------------------------------------
function getAccountOfficerDashboard() {
    let totalAccs = state.accounts.length;
    let activeAccs = state.accounts.filter(a => a.status === "Active").length;
    let inactiveAccs = state.accounts.filter(a => a.status === "Inactive").length;
    
    return `
        <div class="kpi-grid">
            <div class="kpi-card">
                <div class="kpi-card-details">
                    <span class="kpi-card-title">Managed Bank Accounts</span>
                    <span class="kpi-card-value">${totalAccs}</span>
                </div>
                <div class="kpi-card-icon primary"><i class="fa-solid fa-wallet"></i></div>
            </div>
            <div class="kpi-card">
                <div class="kpi-card-details">
                    <span class="kpi-card-title">Active Accounts</span>
                    <span class="kpi-card-value">${activeAccs}</span>
                </div>
                <div class="kpi-card-icon success"><i class="fa-solid fa-circle-check"></i></div>
            </div>
            <div class="kpi-card">
                <div class="kpi-card-details">
                    <span class="kpi-card-title">Frozen / Inactive Accounts</span>
                    <span class="kpi-card-value">${inactiveAccs}</span>
                </div>
                <div class="kpi-card-icon warning"><i class="fa-solid fa-snowflake"></i></div>
            </div>
        </div>

        <div class="table-card">
            <div class="table-header">
                <span class="table-title">Full Accounts Registry</span>
            </div>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Account No</th>
                            <th>Customer</th>
                            <th>Type</th>
                            <th>Balance</th>
                            <th>Activation Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${state.accounts.map(acc => {
                            let cust = state.customers.find(c => c.id === acc.customerId);
                            return `
                                <tr>
                                    <td><code>${acc.accNum}</code></td>
                                    <td><strong>${cust ? cust.name : "Unknown"}</strong></td>
                                    <td>${acc.type}</td>
                                    <td>₹${formatINR(acc.balance)}</td>
                                    <td><span class="badge ${acc.status === 'Active' ? 'badge-success' : 'badge-danger'}">${acc.status}</span></td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// ----------------------------------------------------
// 6.7 CASHIER / TELLER DASHBOARD
// ----------------------------------------------------
function getCashierDashboard() {
    let txnToday = state.transactions.length;
    let totalDeposits = state.transactions.filter(t => t.type === 'Deposit').reduce((sum, item) => sum + Number(item.amount), 0);
    let totalWithdraws = state.transactions.filter(t => t.type === 'Withdrawal').reduce((sum, item) => sum + Number(item.amount), 0);
    let netCash = totalDeposits - totalWithdraws;

    return `
        <div class="kpi-grid">
            <div class="kpi-card">
                <div class="kpi-card-details">
                    <span class="kpi-card-title">Daily Deposits Vault</span>
                    <span class="kpi-card-value">₹${formatINR(totalDeposits)}</span>
                </div>
                <div class="kpi-card-icon success"><i class="fa-solid fa-square-plus"></i></div>
            </div>
            <div class="kpi-card">
                <div class="kpi-card-details">
                    <span class="kpi-card-title">Daily Withdrawals</span>
                    <span class="kpi-card-value">₹${formatINR(totalWithdraws)}</span>
                </div>
                <div class="kpi-card-icon danger"><i class="fa-solid fa-square-minus"></i></div>
            </div>
            <div class="kpi-card">
                <div class="kpi-card-details">
                    <span class="kpi-card-title">Net Handled Cash</span>
                    <span class="kpi-card-value">₹${formatINR(netCash)}</span>
                </div>
                <div class="kpi-card-icon primary"><i class="fa-solid fa-vault"></i></div>
            </div>
            <div class="kpi-card">
                <div class="kpi-card-details">
                    <span class="kpi-card-title">Transactions Count</span>
                    <span class="kpi-card-value">${txnToday}</span>
                </div>
                <div class="kpi-card-icon info"><i class="fa-solid fa-list-ol"></i></div>
            </div>
        </div>

        <div class="charts-grid">
            <div class="chart-card">
                <span class="chart-card-title">Quick Action Panel</span>
                <div class="form-buttons" style="justify-content: flex-start; gap: 16px;">
                    <button class="btn btn-success" onclick="navigateTab('cashier_deposit')"><i class="fa-solid fa-money-bill-transfer"></i> Deposit Cash</button>
                    <button class="btn btn-danger" onclick="navigateTab('cashier_withdraw')"><i class="fa-solid fa-money-bill-wave"></i> Withdraw Cash</button>
                    <button class="btn btn-primary" onclick="navigateTab('cashier_transfer')"><i class="fa-solid fa-share-nodes"></i> Local Fund Transfer</button>
                </div>
            </div>
        </div>
    `;
}

// ----------------------------------------------------
// 6.8 LOAN OFFICER DASHBOARD
// ----------------------------------------------------
function getLoanOfficerDashboard() {
    let pendingLoans = state.loans.filter(l => l.status === "Pending").length;
    let approvedLoans = state.loans.filter(l => l.status === "Approved").length;
    
    return `
        <div class="kpi-grid">
            <div class="kpi-card">
                <div class="kpi-card-details">
                    <span class="kpi-card-title">Pending Loans Queue</span>
                    <span class="kpi-card-value">${pendingLoans}</span>
                </div>
                <div class="kpi-card-icon warning"><i class="fa-solid fa-file-invoice-dollar"></i></div>
            </div>
            <div class="kpi-card">
                <div class="kpi-card-details">
                    <span class="kpi-card-title">Approved Loan Applications</span>
                    <span class="kpi-card-value">${approvedLoans}</span>
                </div>
                <div class="kpi-card-icon success"><i class="fa-solid fa-circle-check"></i></div>
            </div>
            <div class="kpi-card">
                <div class="kpi-card-details">
                    <span class="kpi-card-title">Disbursed Amount</span>
                    <span class="kpi-card-value">₹${formatINR(1000000.00)}</span>
                </div>
                <div class="kpi-card-icon primary"><i class="fa-solid fa-hand-holding-dollar"></i></div>
            </div>
        </div>

        <div class="table-card">
            <div class="table-header">
                <span class="table-title">Loan Applications Overview</span>
                <button class="btn btn-primary btn-sm" onclick="navigateTab('lo_applications')">Manage Applications</button>
            </div>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Application ID</th>
                            <th>Borrower</th>
                            <th>Loan Type</th>
                            <th>Amount</th>
                            <th>EMI Amount</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${state.loans.map(loan => {
                            let cust = state.customers.find(c => c.id === loan.customerId);
                            return `
                                <tr>
                                    <td><code>${loan.loanId}</code></td>
                                    <td><strong>${cust ? cust.name : "Unknown"}</strong></td>
                                    <td>${loan.type}</td>
                                    <td>₹${formatINR(loan.amount)}</td>
                                    <td>₹${formatINR(loan.emi)}/mo</td>
                                    <td><span class="badge ${loan.status === 'Approved' ? 'badge-success' : 'badge-warning'}">${loan.status}</span></td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// ----------------------------------------------------
// 6.9 ACCOUNTANT / FINANCE OFFICER DASHBOARD
// ----------------------------------------------------
function getAccountantDashboard() {
    let depositSum = state.accounts.reduce((a, b) => a + Number(b.balance), 0);
    
    return `
        <div class="kpi-grid">
            <div class="kpi-card">
                <div class="kpi-card-details">
                    <span class="kpi-card-title">Fiscal Reserves</span>
                    <span class="kpi-card-value">₹${formatINR(depositSum)}</span>
                </div>
                <div class="kpi-card-icon success"><i class="fa-solid fa-wallet"></i></div>
            </div>
            <div class="kpi-card">
                <div class="kpi-card-details">
                    <span class="kpi-card-title">Reconciled Ledger Streams</span>
                    <span class="kpi-card-value">₹${formatINR(57250.00)}</span>
                </div>
                <div class="kpi-card-icon primary"><i class="fa-solid fa-scale-balanced"></i></div>
            </div>
            <div class="kpi-card">
                <div class="kpi-card-details">
                    <span class="kpi-card-title">Branch Audit Status</span>
                    <span class="kpi-card-value">Balanced</span>
                </div>
                <div class="kpi-card-icon info"><i class="fa-solid fa-check-double"></i></div>
            </div>
        </div>

        <div class="charts-grid">
            <div class="chart-card">
                <span class="chart-card-title">Branch Financial Flows</span>
                <div class="chart-container">
                    <canvas id="acc-flows-chart"></canvas>
                </div>
            </div>
        </div>
    `;
}

// ----------------------------------------------------
// 6.10 CUSTOMER DASHBOARD (Rahul Sharma View)
// ----------------------------------------------------
function getCustomerDashboard() {
    // We bind this view to the Rahul Sharma customer account (customerId: 1)
    let myCust = state.customers.find(c => c.id === 1);
    let myAcc = state.accounts.find(a => a.customerId === 1);
    let myTxns = state.transactions.filter(t => t.accNum === myAcc.accNum);

    return `
        <div class="form-card" style="padding: 20px 24px; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-color: #bfdbfe;">
            <h3 style="color: #1e3a8a;"><i class="fa-solid fa-hands-clapping"></i> Welcome back, ${myCust.name}!</h3>
            <p style="color: #1e40af; font-size: 13px;">Your primary account has been validated and the visual dashboard is loaded with real-time assets.</p>
        </div>

        <div class="kpi-grid">
            <div class="kpi-card">
                <div class="kpi-card-details">
                    <span class="kpi-card-title">Savings Account Balance</span>
                    <span class="kpi-card-value">₹${formatINR(myAcc.balance)}</span>
                    <span class="kpi-card-title" style="margin-top: 4px; text-transform:none;">No. ${myAcc.accNum}</span>
                </div>
                <div class="kpi-card-icon success"><i class="fa-solid fa-wallet"></i></div>
            </div>
            <div class="kpi-card">
                <div class="kpi-card-details">
                    <span class="kpi-card-title">Available Ledger Balance</span>
                    <span class="kpi-card-value">₹${formatINR(myAcc.balance)}</span>
                </div>
                <div class="kpi-card-icon info"><i class="fa-solid fa-circle-check"></i></div>
            </div>
            <div class="kpi-card">
                <div class="kpi-card-details">
                    <span class="kpi-card-title">KYC Document Status</span>
                    <span class="kpi-card-value" style="font-size: 18px; color: var(--success-color);"><i class="fa-solid fa-shield-check"></i> Verified</span>
                </div>
                <div class="kpi-card-icon success"><i class="fa-solid fa-id-card"></i></div>
            </div>
        </div>

        <div class="charts-grid">
            <div class="chart-card">
                <span class="chart-card-title">Monthly Spending Pattern</span>
                <div class="chart-container">
                    <canvas id="cust-spend-chart"></canvas>
                </div>
            </div>
            
            <div class="chart-card">
                <span class="chart-card-title">Quick Actions</span>
                <div class="form-buttons" style="justify-content: flex-start; flex-direction: column; gap: 12px; align-items: stretch;">
                    <button class="btn btn-primary" onclick="navigateTab('cust_transfer')"><i class="fa-solid fa-share-nodes"></i> Local Beneficiary Transfer</button>
                    <button class="btn btn-outline" onclick="navigateTab('cust_statement')"><i class="fa-solid fa-file-waveform"></i> Generate Bank Statement</button>
                    <button class="btn btn-outline" onclick="navigateTab('cust_debit_card')"><i class="fa-solid fa-credit-card"></i> Block/Configure Debit Card</button>
                </div>
            </div>
        </div>

        <div class="table-card">
            <div class="table-header">
                <span class="table-title">Recent Transactions Ledger</span>
                <button class="btn btn-outline btn-sm" onclick="navigateTab('cust_statement')">View Statement</button>
            </div>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Transaction ID</th>
                            <th>Date</th>
                            <th>Description</th>
                            <th>Mode</th>
                            <th>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${myTxns.slice(-4).reverse().map(t => `
                            <tr>
                                <td><code>${t.txnId}</code></td>
                                <td>${t.date}</td>
                                <td>${t.desc}</td>
                                <td><span class="badge badge-muted">${t.mode}</span></td>
                                <td><strong style="color: ${t.type === 'Deposit' ? 'var(--success-color)' : 'var(--danger-color)'}">
                                    ${t.type === 'Deposit' ? '+' : '-'} ₹${formatINR(t.amount)}
                                </strong></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// ----------------------------------------------------
// 7. CHART.JS INITIALIZER SYSTEM
// ----------------------------------------------------
function initDashboardCharts() {
    if (activeRole === "super_admin") {
        // SA Transaction Trend Chart
        const ctxTxn = document.getElementById("sa-txn-chart")?.getContext("2d");
        if (ctxTxn) {
            chartsInstances.saTxn = new Chart(ctxTxn, {
                type: 'bar',
                data: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
                    datasets: [
                        { label: 'Deposits', data: [150000, 200000, 180000, 250000, 315430], backgroundColor: '#10b981' },
                        { label: 'Withdrawals', data: [80000, 120000, 95000, 140000, 15000], backgroundColor: '#ef4444' }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }

        // SA Growth Line Chart
        const ctxGrowth = document.getElementById("sa-growth-chart")?.getContext("2d");
        if (ctxGrowth) {
            chartsInstances.saGrowth = new Chart(ctxGrowth, {
                type: 'line',
                data: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
                    datasets: [{
                        label: 'Customers count',
                        data: [1, 2, 2, 3, 4],
                        borderColor: '#2563eb',
                        tension: 0.3,
                        fill: false
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }
    } else if (activeRole === "accountant_finance") {
        const ctxFlows = document.getElementById("acc-flows-chart")?.getContext("2d");
        if (ctxFlows) {
            chartsInstances.accFlows = new Chart(ctxFlows, {
                type: 'doughnut',
                data: {
                    labels: ['Operating Income', 'Operating Expenses', 'Net Reserve Fund'],
                    datasets: [{
                        data: [57250, 12000, 45250],
                        backgroundColor: ['#10b981', '#ef4444', '#2563eb']
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }
    } else if (activeRole === "customer") {
        const ctxSpend = document.getElementById("cust-spend-chart")?.getContext("2d");
        if (ctxSpend) {
            chartsInstances.custSpend = new Chart(ctxSpend, {
                type: 'line',
                data: {
                    labels: ['May 15', 'May 18', 'May 20'],
                    datasets: [{
                        label: 'Expense Flow (₹)',
                        data: [0, 5000, 5000],
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        tension: 0.2,
                        fill: true
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }
    }
}

// ----------------------------------------------------
// 8. SUBPAGES GENERATOR DISPATCHER
// ----------------------------------------------------
function getSubpageHtml(tabId) {
    switch (tabId) {
        // --- SUPER ADMIN SUBPAGES ---
        case "sa_banks":
            return getSABanksSubpage();
        case "sa_branches":
            return getSABranchesSubpage();
        case "sa_admins":
            return getSABankAdminsSubpage();
        case "sa_employees":
            return getSAEmployeesSubpage();
        case "sa_customers":
            return getSACustomersSubpage();
        case "sa_accounts":
            return getSAAccountsSubpage();
        case "sa_transactions":
            return getSATransactionsSubpage();
        case "sa_loans":
            return getSALoansSubpage();
        case "sa_audit":
            return getSAAuditSubpage();
        case "sa_settings":
            return getSASettingsSubpage();

        // --- BANK ADMIN SUBPAGES ---
        case "ba_customers":
            return getBACustomersSubpage();
        case "ba_accounts_app":
            return getBAAccountsAppSubpage();
        case "ba_accounts":
            return getBAAccountsSubpage();
        case "ba_kyc":
            return getBAKycSubpage();
        case "ba_employees":
            return getBAEmployeesSubpage();
        case "ba_branches":
            return getBABranchesSubpage();

        // --- BRANCH MANAGER SUBPAGES ---
        case "bm_approvals":
            return getBMApprovalsSubpage();
        case "bm_kyc":
            return getBMKycSubpage();
        case "bm_accounts":
            return getBMAccountsSubpage();
        case "bm_loans":
            return getBMLoansSubpage();
        case "bm_employees":
            return getBMEmployeesSubpage();
        case "bm_closures":
            return getBMClosuresSubpage();

        // --- CUSTOMER SERVICE EXECUTIVE SUBPAGES ---
        case "cse_register":
            return getCSERegisterSubpage();
        case "cse_customers":
            return getCSECustomersSubpage();
        case "cse_open_account":
            return getCSEOpenAccountSubpage();
        case "cse_kyc_docs":
            return getCSEKycDocsSubpage();
        case "cse_requests":
            return getCSERequestsSubpage();
        case "cse_cheques":
            return getCSEChequesSubpage();
        case "cse_cards":
            return getCSECardsSubpage();

        // --- KYC OFFICER SUBPAGES ---
        case "kyc_verify":
            return getKycVerifySubpage();
        case "kyc_verified":
            return getKycVerifiedSubpage();
        case "kyc_rejected":
            return getKycRejectedSubpage();
        case "kyc_history":
            return getKycHistorySubpage();

        // --- ACCOUNT OFFICER SUBPAGES ---
        case "ao_accounts":
            return getAoAccountsSubpage();
        case "ao_activation":
            return getAoActivationSubpage();
        case "ao_freeze":
            return getAoFreezeSubpage();
        case "ao_nominee":
            return getAoNomineeSubpage();
        case "ao_statements":
            return getAoStatementsSubpage();

        // --- CASHIER / TELLER SUBPAGES ---
        case "cashier_deposit":
            return getCashierDepositSubpage();
        case "cashier_withdraw":
            return getCashierWithdrawSubpage();
        case "cashier_transfer":
            return getCashierTransferSubpage();
        case "cashier_txns":
            return getCashierTxnsSubpage();
        case "cashier_report":
            return getCashierReportSubpage();

        // --- LOAN OFFICER SUBPAGES ---
        case "lo_applications":
            return getLoApplicationsSubpage();
        case "lo_approved":
            return getLoApprovedSubpage();
        case "lo_emi":
            return getLoEmiSubpage();
        case "lo_repayment":
            return getLoRepaymentsSubpage();

        // --- ACCOUNTANT SUBPAGES ---
        case "acc_ledger":
            return getAccLedgerSubpage();
        case "acc_income":
            return getAccIncomeSubpage();
        case "acc_expenses":
            return getAccExpensesSubpage();
        case "acc_reports":
            return getAccReportsSubpage();

        // --- CUSTOMER SUBPAGES ---
        case "cust_accounts":
            return getCustAccountsSubpage();
        case "cust_transfer":
            return getCustTransferSubpage();
        case "cust_statement":
            return getCustStatementSubpage();
        case "cust_debit_card":
            return getCustDebitCardSubpage();
        case "cust_cheque":
            return getCustChequeSubpage();
        case "cust_loans":
            return getCustLoansSubpage();
        case "cust_closure":
            return getCustClosureSubpage();
    }
    return `
        <div class="empty-state">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <span class="empty-state-title">View Not Implemented</span>
            <span class="empty-state-desc">The requested sub-pane is under configuration.</span>
        </div>
    `;
}

// ----------------------------------------------------
// 8.1 SUPER ADMIN PAGES
// ----------------------------------------------------
function getSABanksSubpage() {
    return `
        <div class="table-card">
            <div class="table-header">
                <span class="table-title">System Banks Registry</span>
                <button class="btn btn-primary btn-sm" onclick="showToast('Action Simulated', 'Bank creation modal launched.')"><i class="fa-solid fa-plus"></i> Add Partner Bank</button>
            </div>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Bank ID</th>
                            <th>Bank Name</th>
                            <th>Bank Code</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${state.banks.map(b => `
                            <tr>
                                <td>${b.id}</td>
                                <td><strong>${b.name}</strong></td>
                                <td><code>${b.code}</code></td>
                                <td><span class="badge badge-success">${b.status}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function getSABranchesSubpage() {
    return `
        <div class="table-card">
            <div class="table-header">
                <span class="table-title">Ajinkya Bank Branches</span>
                <button class="btn btn-primary btn-sm" onclick="showToast('Action Simulated', 'Branch creation form active.')"><i class="fa-solid fa-plus"></i> Create Branch</button>
            </div>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Branch Code</th>
                            <th>Branch Name</th>
                            <th>IFSC Code</th>
                            <th>Reserves Fund</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${state.branches.map(br => `
                            <tr>
                                <td><code>${br.code}</code></td>
                                <td><strong>${br.name}</strong></td>
                                <td><code>${br.ifsc}</code></td>
                                <td>₹${formatINR(br.balance)}</td>
                                <td><span class="badge badge-success">Active</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function getSABankAdminsSubpage() {
    return `
        <div class="table-card">
            <div class="table-header">
                <span class="table-title">Central Bank Administrators</span>
                <button class="btn btn-primary btn-sm" onclick="showToast('Action Simulated', 'New admin creation modal active.')"><i class="fa-solid fa-plus"></i> Create Bank Admin</button>
            </div>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Username</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>1</td>
                            <td><strong>System Admin</strong></td>
                            <td><code>admin</code></td>
                            <td><span class="badge badge-success">Active</span></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function getSAEmployeesSubpage() {
    return `
        <div class="table-card">
            <div class="table-header">
                <span class="table-title">Central Staff Registry</span>
            </div>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Role</th>
                            <th>Email</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${state.employees.map(e => `
                            <tr>
                                <td><code>${e.empId}</code></td>
                                <td><strong>${e.name}</strong></td>
                                <td>${e.role}</td>
                                <td>${e.email}</td>
                                <td><span class="badge badge-success">${e.status}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function getSACustomersSubpage() {
    return `
        <div class="table-card">
            <div class="table-header">
                <span class="table-title">System-wide Registered Customers</span>
            </div>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Customer ID</th>
                            <th>Name</th>
                            <th>Mobile</th>
                            <th>Email</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${state.customers.map(c => `
                            <tr>
                                <td><code>${c.custId}</code></td>
                                <td><strong>${c.name}</strong></td>
                                <td>${c.mobile}</td>
                                <td>${c.email}</td>
                                <td><span class="badge ${c.status === 'Active' ? 'badge-success' : 'badge-danger'}">${c.status}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function getSAAccountsSubpage() {
    return `
        <div class="table-card">
            <div class="table-header">
                <span class="table-title">Central Accounts Directory</span>
            </div>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Account No</th>
                            <th>Customer ID</th>
                            <th>Type</th>
                            <th>Balance</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${state.accounts.map(a => `
                            <tr>
                                <td><code>${a.accNum}</code></td>
                                <td>CUST${100 + a.customerId}</td>
                                <td>${a.type}</td>
                                <td>₹${formatINR(a.balance)}</td>
                                <td><span class="badge ${a.status === 'Active' ? 'badge-success' : 'badge-danger'}">${a.status}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function getSATransactionsSubpage() {
    return `
        <div class="table-card">
            <div class="table-header">
                <span class="table-title">All System Transactions Audit</span>
            </div>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Txn ID</th>
                            <th>Account No</th>
                            <th>Type</th>
                            <th>Amount</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${state.transactions.map(t => `
                            <tr>
                                <td><code>${t.txnId}</code></td>
                                <td><code>${t.accNum}</code></td>
                                <td>${t.type}</td>
                                <td>₹${formatINR(t.amount)}</td>
                                <td>${t.date}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function getSALoansSubpage() {
    return `
        <div class="table-card">
            <div class="table-header">
                <span class="table-title">Loan Portfolios Audit</span>
            </div>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Loan ID</th>
                            <th>Type</th>
                            <th>Amount</th>
                            <th>Tenure</th>
                            <th>EMI</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${state.loans.map(l => `
                            <tr>
                                <td><code>${l.loanId}</code></td>
                                <td>${l.type}</td>
                                <td>₹${formatINR(l.amount)}</td>
                                <td>${l.tenure} mo</td>
                                <td>₹${formatINR(l.emi)}/mo</td>
                                <td><span class="badge ${l.status === 'Approved' ? 'badge-success' : 'badge-warning'}">${l.status}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function getSAAuditSubpage() {
    return `
        <div class="table-card">
            <div class="table-header">
                <span class="table-title">Enterprise System Audit Logs</span>
            </div>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Timestamp</th>
                            <th>Actor</th>
                            <th>Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${state.auditLogs.map(l => `
                            <tr>
                                <td>${l.timestamp}</td>
                                <td><strong>${l.actor}</strong></td>
                                <td>${l.action}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function getSASettingsSubpage() {
    return `
        <div class="form-card">
            <span class="form-section-title">System Settings Configuration</span>
            <div class="form-grid">
                <div class="form-group">
                    <label>Interest Rate (Savings)</label>
                    <input type="text" class="form-control" value="3.5%">
                </div>
                <div class="form-group">
                    <label>Interest Rate (Fixed Deposit)</label>
                    <input type="text" class="form-control" value="6.5%">
                </div>
                <div class="form-group">
                    <label>Maximum Daily Transfer Limit</label>
                    <input type="text" class="form-control" value="₹500,000">
                </div>
                <div class="form-group">
                    <label>Multi-Factor Authentication (MFA)</label>
                    <select class="form-control">
                        <option>Enabled</option>
                        <option>Disabled</option>
                    </select>
                </div>
            </div>
            <div class="form-buttons">
                <button class="btn btn-primary" onclick="showToast('Success', 'Configuration saved successfully.')">Save Configurations</button>
            </div>
        </div>
    `;
}


// ----------------------------------------------------
// 8.2 BANK ADMIN PAGES
// ----------------------------------------------------
function getBACustomersSubpage() {
    return getSACustomersSubpage(); // Same view
}

function getBAAccountsAppSubpage() {
    let inactiveAccs = state.accounts.filter(a => a.status === "Inactive");
    
    return `
        <div class="table-card">
            <div class="table-header">
                <span class="table-title">New Account Applications</span>
            </div>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Application No</th>
                            <th>Applicant</th>
                            <th>Account Type</th>
                            <th>Branch</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${inactiveAccs.length === 0 ? `
                            <tr>
                                <td colspan="6" style="text-align: center; color: var(--text-muted);">No pending applications.</td>
                            </tr>
                        ` : inactiveAccs.map(acc => {
                            let cust = state.customers.find(c => c.id === acc.customerId);
                            return `
                                <tr>
                                    <td><code>${acc.accNum}</code></td>
                                    <td><strong>${cust ? cust.name : "Unknown"}</strong></td>
                                    <td>${acc.type}</td>
                                    <td>Main Branch</td>
                                    <td><span class="badge badge-warning">${acc.status}</span></td>
                                    <td>
                                        <button class="btn btn-success btn-sm" onclick="approveAccount('${acc.accNum}')">Approve & Open</button>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function getBAAccountsSubpage() {
    return getSAAccountsSubpage(); // Same view
}

function getBAKycSubpage() {
    return getKYCDashboard(); // Renders kyc tables
}

function getBAEmployeesSubpage() {
    return getSAEmployeesSubpage(); // Same view
}

function getBABranchesSubpage() {
    return getSABranchesSubpage(); // Same view
}


// ----------------------------------------------------
// 8.3 BRANCH MANAGER PAGES
// ----------------------------------------------------
function getBMApprovalsSubpage() {
    return getBAAccountsAppSubpage(); // Reuse applications list
}

function getBMKycSubpage() {
    return getKycVerifySubpage(); // KYC lists
}

function getBMAccountsSubpage() {
    return getSAAccountsSubpage(); // Same view
}

function getBMLoansSubpage() {
    return getLoApplicationsSubpage(); // Same view
}

function getBMEmployeesSubpage() {
    return getSAEmployeesSubpage(); // Same view
}

function getBMClosuresSubpage() {
    return `
        <div class="table-card">
            <div class="table-header">
                <span class="table-title">Branch Account Closure Requests</span>
            </div>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Account Number</th>
                            <th>Customer</th>
                            <th>Reason</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${state.accountClosures.length === 0 ? `
                            <tr>
                                <td colspan="5" style="text-align: center; color: var(--text-muted);">No pending closure requests.</td>
                            </tr>
                        ` : state.accountClosures.map(c => {
                            let acc = state.accounts.find(a => a.accNum === c.accNum);
                            let cust = state.customers.find(cu => cu.id === acc.customerId);
                            return `
                                <tr>
                                    <td><code>${c.accNum}</code></td>
                                    <td><strong>${cust ? cust.name : "Unknown"}</strong></td>
                                    <td>${c.reason}</td>
                                    <td><span class="badge badge-danger">${c.status}</span></td>
                                    <td>
                                        <button class="btn btn-danger btn-sm" onclick="approveAccountClosure('${c.accNum}')">Approve Closure</button>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}


// ----------------------------------------------------
// 8.4 CUSTOMER SERVICE EXECUTIVE PAGES
// ----------------------------------------------------
function getCSERegisterSubpage() {
    return `
        <div class="form-card">
            <span class="form-section-title">New Customer Registration Form</span>
            <form id="cse-register-form" onsubmit="handleCseRegister(event)">
                <div class="form-grid">
                    <div class="form-group">
                        <label for="reg-name">Full Name</label>
                        <input type="text" id="reg-name" class="form-control" placeholder="Enter Full Name" required>
                    </div>
                    <div class="form-group">
                        <label for="reg-dob">Date of Birth</label>
                        <input type="date" id="reg-dob" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label for="reg-gender">Gender</label>
                        <select id="reg-gender" class="form-control" required>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="reg-mobile">Mobile Number</label>
                        <input type="text" id="reg-mobile" class="form-control" placeholder="10-digit number" required>
                    </div>
                    <div class="form-group">
                        <label for="reg-email">Email Address</label>
                        <input type="email" id="reg-email" class="form-control" placeholder="name@domain.com" required>
                    </div>
                    <div class="form-group">
                        <label for="reg-aadhaar">Aadhaar/ID Number</label>
                        <input type="text" id="reg-aadhaar" class="form-control" placeholder="xxxx-xxxx-xxxx" required>
                    </div>
                    <div class="form-group">
                        <label for="reg-pan">PAN Card Number</label>
                        <input type="text" id="reg-pan" class="form-control" placeholder="ABCDE1234F" required>
                    </div>
                    <div class="form-group">
                        <label for="reg-occupation">Occupation</label>
                        <input type="text" id="reg-occupation" class="form-control" placeholder="Engineer, Doctor, etc." required>
                    </div>
                    <div class="form-group" style="grid-column: 1 / -1;">
                        <label for="reg-address">Address Details</label>
                        <input type="text" id="reg-address" class="form-control" placeholder="Flat, Street, Area" required>
                    </div>
                    
                    <span class="form-section-title" style="margin-top: 15px;">Nominee Details</span>
                    <div class="form-group">
                        <label for="reg-nominee">Nominee Full Name</label>
                        <input type="text" id="reg-nominee" class="form-control" placeholder="Nominee Name" required>
                    </div>
                    <div class="form-group">
                        <label for="reg-relation">Relationship to Customer</label>
                        <input type="text" id="reg-relation" class="form-control" placeholder="Mother, Wife, Spouse, etc." required>
                    </div>
                </div>
                <div class="form-buttons">
                    <button type="reset" class="btn btn-outline">Reset Form</button>
                    <button type="submit" class="btn btn-primary">Register Customer & Start KYC</button>
                </div>
            </form>
        </div>
    `;
}

function getCSECustomersSubpage() {
    return getSACustomersSubpage(); // Same view
}

function getCSEOpenAccountSubpage() {
    return `
        <div class="form-card">
            <span class="form-section-title">Open Account Application</span>
            <form id="cse-open-account-form" onsubmit="handleCseOpenAccount(event)">
                <div class="form-grid">
                    <div class="form-group">
                        <label for="acc-cust-id">Select Customer</label>
                        <select id="acc-cust-id" class="form-control" required>
                            ${state.customers.map(c => `<option value="${c.id}">${c.name} (${c.custId})</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="acc-type">Account Type</label>
                        <select id="acc-type" class="form-control" required>
                            <option value="Savings">Savings Account</option>
                            <option value="Current">Current Account</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="acc-branch">Assigned Branch</label>
                        <select id="acc-branch" class="form-control" required>
                            ${state.branches.map(b => `<option value="${b.id}">${b.name}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-buttons">
                    <button type="submit" class="btn btn-primary">Submit Account Opening Request</button>
                </div>
            </form>
        </div>
    `;
}

function getCSEKycDocsSubpage() {
    return getKycVerifySubpage(); // Same view
}

function getCSERequestsSubpage() {
    return `
        <div class="table-card">
            <div class="table-header">
                <span class="table-title">Customer Service Requests Ledger</span>
            </div>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Customer ID</th>
                            <th>Request Type</th>
                            <th>Details</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${state.serviceRequests.map(r => `
                            <tr>
                                <td>${r.date}</td>
                                <td>CUST${100 + r.customerId}</td>
                                <td>${r.type}</td>
                                <td>${r.details}</td>
                                <td><span class="badge badge-warning">${r.status}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function getCSEChequesSubpage() {
    return `
        <div class="table-card">
            <div class="table-header">
                <span class="table-title">Cheque Book Requests Queue</span>
            </div>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Customer Name</th>
                            <th>Leaves Required</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${state.cheques.map(c => {
                            let cust = state.customers.find(cu => cu.id === c.customerId);
                            return `
                                <tr>
                                    <td>${c.date}</td>
                                    <td><strong>${cust ? cust.name : "Unknown"}</strong></td>
                                    <td>${c.leaves} Leaves</td>
                                    <td><span class="badge badge-success">${c.status}</span></td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function getCSECardsSubpage() {
    return `
        <div class="table-card">
            <div class="table-header">
                <span class="table-title">Issued Debit Cards Orders</span>
            </div>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Customer</th>
                            <th>Card Number</th>
                            <th>Expiry</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${state.cards.map(c => {
                            let cust = state.customers.find(cu => cu.id === c.customerId);
                            return `
                                <tr>
                                    <td><strong>${cust ? cust.name : "Unknown"}</strong></td>
                                    <td><code>${c.cardNum}</code></td>
                                    <td>${c.expiry}</td>
                                    <td><span class="badge badge-success">${c.status}</span></td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}


// ----------------------------------------------------
// 8.5 KYC OFFICER VERIFICATION PAGES
// ----------------------------------------------------
function getKycVerifySubpage() {
    let pendingCustomers = state.customers.filter(c => c.kycStatus === "Pending");
    
    return `
        <div class="table-card">
            <div class="table-header">
                <span class="table-title">KYC Document Verification Pipeline</span>
            </div>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Customer ID</th>
                            <th>Name</th>
                            <th>Aadhaar</th>
                            <th>PAN</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pendingCustomers.length === 0 ? `
                            <tr>
                                <td colspan="6" style="text-align: center; color: var(--text-muted);">No pending KYC validations found.</td>
                            </tr>
                        ` : pendingCustomers.map(c => `
                            <tr>
                                <td><code>${c.custId}</code></td>
                                <td><strong>${c.name}</strong></td>
                                <td><code>${c.aadhaar}</code></td>
                                <td><code>${c.pan}</code></td>
                                <td><span class="badge badge-warning">${c.kycStatus}</span></td>
                                <td>
                                    <button class="btn btn-primary btn-sm" onclick="openKycModal('${c.custId}')"><i class="fa-solid fa-file-signature"></i> Verify Documents</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function getKycVerifiedSubpage() {
    let verified = state.customers.filter(c => c.kycStatus === "Verified");
    return `
        <div class="table-card">
            <div class="table-header">
                <span class="table-title">Verified Customer Profiles</span>
            </div>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Aadhaar</th>
                            <th>PAN</th>
                            <th>Verification status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${verified.map(v => `
                            <tr>
                                <td><strong>${v.name}</strong></td>
                                <td><code>${v.aadhaar}</code></td>
                                <td><code>${v.pan}</code></td>
                                <td><span class="badge badge-success">${v.kycStatus}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function getKycRejectedSubpage() {
    return `
        <div class="empty-state">
            <i class="fa-solid fa-circle-xmark"></i>
            <span class="empty-state-title">No Rejected Applications</span>
            <span class="empty-state-desc">All KYC profiles are currently validated or pending.</span>
        </div>
    `;
}

function getKycHistorySubpage() {
    return getKycVerifiedSubpage();
}


// ----------------------------------------------------
// 8.6 ACCOUNT OFFICER PAGES
// ----------------------------------------------------
function getAoAccountsSubpage() {
    return getSAAccountsSubpage(); // Same view
}

function getAoActivationSubpage() {
    return `
        <div class="table-card">
            <div class="table-header">
                <span class="table-title">Pending Account Activations</span>
            </div>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Account No</th>
                            <th>Type</th>
                            <th>Balance</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${state.accounts.map(acc => `
                            <tr>
                                <td><code>${acc.accNum}</code></td>
                                <td>${acc.type}</td>
                                <td>₹${formatINR(acc.balance)}</td>
                                <td><span class="badge ${acc.status === 'Active' ? 'badge-success' : 'badge-danger'}">${acc.status}</span></td>
                                <td>
                                    <button class="btn btn-outline btn-sm" onclick="toggleAccountStatus('${acc.accNum}')">
                                        ${acc.status === 'Active' ? 'Deactivate' : 'Activate'}
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function getAoFreezeSubpage() {
    return getAoActivationSubpage(); // Same view
}

function getAoNomineeSubpage() {
    return `
        <div class="table-card">
            <div class="table-header">
                <span class="table-title">Nominee Declarations Audit</span>
            </div>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Customer Name</th>
                            <th>Nominee Declaration</th>
                            <th>Aadhaar verified</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${state.customers.map(c => `
                            <tr>
                                <td><strong>${c.name}</strong></td>
                                <td>${c.nominee || "None"}</td>
                                <td><span class="badge badge-success">Verified</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function getAoStatementsSubpage() {
    return getSATransactionsSubpage(); // Same view
}


// ----------------------------------------------------
// 8.7 CASHIER / TELLER PAGES (Interactive Transactions)
// ----------------------------------------------------
function getCashierDepositSubpage() {
    return `
        <div class="form-card">
            <span class="form-section-title">Cash Deposit Entry Portal</span>
            <div class="form-grid" style="grid-template-columns: 1fr auto;">
                <div class="form-group">
                    <label for="dep-acc-search">Account Number Search</label>
                    <input type="text" id="dep-acc-search" class="form-control" placeholder="Type 100000007890 and press search...">
                </div>
                <div class="form-group" style="justify-content: flex-end;">
                    <button class="btn btn-primary" onclick="searchDepositAccount()"><i class="fa-solid fa-magnifying-glass"></i> Search</button>
                </div>
            </div>

            <!-- Pre-fetched customer details -->
            <div id="dep-fetched-card" style="display:none; padding:20px; background-color:#f8fafc; border-radius:8px; border: 1px solid var(--border-color);">
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="detail-label">Account Holder</span>
                        <span class="detail-value" id="dep-fetched-name">Rahul Sharma</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Current Balance</span>
                        <span class="detail-value" style="color:var(--success-color);" id="dep-fetched-bal">₹185,430.50</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">KYC Status</span>
                        <span class="detail-value" id="dep-fetched-kyc"><span class="badge badge-success">Verified</span></span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Account Status</span>
                        <span class="detail-value" id="dep-fetched-status"><span class="badge badge-success">Active</span></span>
                    </div>
                </div>
            </div>

            <form id="cash-deposit-form" onsubmit="handleCashierDepositSubmit(event)" style="display:none;">
                <input type="hidden" id="dep-acc-num">
                <div class="form-grid">
                    <div class="form-group">
                        <label for="dep-amount">Deposit Cash Amount (₹)</label>
                        <input type="number" id="dep-amount" class="form-control" placeholder="Enter amount to deposit" required>
                    </div>
                    <div class="form-group">
                        <label for="dep-mode">Payment Mode</label>
                        <select id="dep-mode" class="form-control">
                            <option value="Cash">Physical Cash</option>
                            <option value="Cheque">Local Clearing Cheque</option>
                        </select>
                    </div>
                    <div class="form-group" style="grid-column: 1 / -1;">
                        <label for="dep-remarks">Remarks/Memo</label>
                        <input type="text" id="dep-remarks" class="form-control" placeholder="Deposited by self, family, etc.">
                    </div>
                </div>
                <div class="form-buttons">
                    <button type="submit" class="btn btn-success"><i class="fa-solid fa-square-plus"></i> Process Deposit & Print Receipt</button>
                </div>
            </form>
        </div>
    `;
}

function getCashierWithdrawSubpage() {
    return `
        <div class="form-card">
            <span class="form-section-title">Cash Withdrawal Entry Portal</span>
            <div class="form-grid" style="grid-template-columns: 1fr auto;">
                <div class="form-group">
                    <label for="with-acc-search">Account Number Search</label>
                    <input type="text" id="with-acc-search" class="form-control" placeholder="Type 100000007890 and press search...">
                </div>
                <div class="form-group" style="justify-content: flex-end;">
                    <button class="btn btn-primary" onclick="searchWithdrawAccount()"><i class="fa-solid fa-magnifying-glass"></i> Search</button>
                </div>
            </div>

            <!-- Pre-fetched customer details -->
            <div id="with-fetched-card" style="display:none; padding:20px; background-color:#f8fafc; border-radius:8px; border: 1px solid var(--border-color);">
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="detail-label">Account Holder</span>
                        <span class="detail-value" id="with-fetched-name">Rahul Sharma</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Available Ledger Balance</span>
                        <span class="detail-value" style="color:var(--primary-color);" id="with-fetched-bal">₹185,430.50</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">KYC Status</span>
                        <span class="detail-value" id="with-fetched-kyc"><span class="badge badge-success">Verified</span></span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Account Status</span>
                        <span class="detail-value" id="with-fetched-status"><span class="badge badge-success">Active</span></span>
                    </div>
                </div>
            </div>

            <form id="cash-withdrawal-form" onsubmit="handleCashierWithdrawSubmit(event)" style="display:none;">
                <input type="hidden" id="with-acc-num">
                <div class="form-grid">
                    <div class="form-group">
                        <label for="with-amount">Withdrawal Cash Amount (₹)</label>
                        <input type="number" id="with-amount" class="form-control" placeholder="Enter amount to withdraw" required>
                    </div>
                    <div class="form-group">
                        <label for="with-mode">Mode of Withdrawal</label>
                        <select id="with-mode" class="form-control">
                            <option value="Cash">Cash at Counter</option>
                            <option value="Slip">Withdrawal Slip/Passbook</option>
                        </select>
                    </div>
                    <div class="form-group" style="grid-column: 1 / -1;">
                        <label for="with-remarks">Remarks/Memo</label>
                        <input type="text" id="with-remarks" class="form-control" placeholder="Self withdrawal, token, etc.">
                    </div>
                </div>
                <div class="form-buttons">
                    <button type="submit" class="btn btn-danger"><i class="fa-solid fa-square-minus"></i> Process Withdrawal & Print Receipt</button>
                </div>
            </form>
        </div>
    `;
}

function getCashierTransferSubpage() {
    return `
        <div class="form-card">
            <span class="form-section-title">Local Fund Transfer Portal (Counter)</span>
            <form id="cashier-transfer-form" onsubmit="handleCashierTransferSubmit(event)">
                <div class="form-grid">
                    <div class="form-group">
                        <label for="ct-source">Source Account Number</label>
                        <input type="text" id="ct-source" class="form-control" placeholder="Debit from account..." required>
                    </div>
                    <div class="form-group">
                        <label for="ct-dest">Destination Account Number</label>
                        <input type="text" id="ct-dest" class="form-control" placeholder="Credit to account..." required>
                    </div>
                    <div class="form-group">
                        <label for="ct-amount">Transfer Amount (₹)</label>
                        <input type="number" id="ct-amount" class="form-control" required>
                    </div>
                    <div class="form-group" style="grid-column: 1 / -1;">
                        <label for="ct-remarks">Remarks</label>
                        <input type="text" id="ct-remarks" class="form-control" placeholder="Account transfer, billing, etc.">
                    </div>
                </div>
                <div class="form-buttons">
                    <button type="submit" class="btn btn-primary">Process Transfer Order</button>
                </div>
            </form>
        </div>
    `;
}

function getCashierTxnsSubpage() {
    return getSATransactionsSubpage(); // Same view
}

function getCashierReportSubpage() {
    return getAccountantDashboard(); // Visual summaries
}


// ----------------------------------------------------
// 8.8 LOAN OFFICER APPLICATIONS & APPROVALS
// ----------------------------------------------------
function getLoApplicationsSubpage() {
    let pendingLoans = state.loans.filter(l => l.status === "Pending");
    
    return `
        <div class="table-card">
            <div class="table-header">
                <span class="table-title">Loan Approvals Pipeline</span>
            </div>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Loan ID</th>
                            <th>Customer Name</th>
                            <th>Loan Type</th>
                            <th>Amount Request</th>
                            <th>Tenure</th>
                            <th>Monthly EMI</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pendingLoans.length === 0 ? `
                            <tr>
                                <td colspan="7" style="text-align: center; color: var(--text-muted);">No pending loan approvals.</td>
                            </tr>
                        ` : pendingLoans.map(l => {
                            let cust = state.customers.find(cu => cu.id === l.customerId);
                            return `
                                <tr>
                                    <td><code>${l.loanId}</code></td>
                                    <td><strong>${cust ? cust.name : "Unknown"}</strong></td>
                                    <td>${l.type}</td>
                                    <td>₹${formatINR(l.amount)}</td>
                                    <td>${l.tenure} mo</td>
                                    <td>₹${formatINR(l.emi)}/mo</td>
                                    <td>
                                        <div class="btn-group-row">
                                            <button class="btn btn-success btn-sm" onclick="approveLoan(${l.id})">Approve</button>
                                            <button class="btn btn-danger btn-sm" onclick="rejectLoan(${l.id})">Reject</button>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function getLoApprovedSubpage() {
    let approved = state.loans.filter(l => l.status === "Approved");
    return `
        <div class="table-card">
            <div class="table-header">
                <span class="table-title">Approved Loan Disbursals</span>
            </div>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Loan ID</th>
                            <th>Type</th>
                            <th>Amount</th>
                            <th>Monthly EMI</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${approved.map(l => `
                            <tr>
                                <td><code>${l.loanId}</code></td>
                                <td>${l.type}</td>
                                <td>₹${formatINR(l.amount)}</td>
                                <td>₹${formatINR(l.emi)}/mo</td>
                                <td><span class="badge badge-success">${l.status}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function getLoEmiSubpage() {
    return getLoApprovedSubpage();
}

function getLoRepaymentsSubpage() {
    return getLoApprovedSubpage();
}


// ----------------------------------------------------
// 8.9 ACCOUNTANT & LEDGERS
// ----------------------------------------------------
function getAccLedgerSubpage() {
    return getSAAuditSubpage(); // Reuse audit logs as Ledger audit trail
}

function getAccIncomeSubpage() {
    return `
        <div class="table-card">
            <div class="table-header">
                <span class="table-title">Income / Interest Yield Tracker</span>
            </div>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Source</th>
                            <th>Accrued Yield</th>
                            <th>Category</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Loan EMI Interest collection</td>
                            <td style="color:var(--success-color);">+ ₹42,500.00</td>
                            <td>Interest Yield</td>
                        </tr>
                        <tr>
                            <td>ATM Operations Processing Fees</td>
                            <td style="color:var(--success-color);">+ ₹14,750.00</td>
                            <td>Service Charges</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function getAccExpensesSubpage() {
    return `
        <div class="table-card">
            <div class="table-header">
                <span class="table-title">Operating Expenses Tracker</span>
            </div>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Expense Title</th>
                            <th>Accrued Outflow</th>
                            <th>Category</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Savings Accounts Quarterly Interest Outflow</td>
                            <td style="color:var(--danger-color);">- ₹12,000.00</td>
                            <td>Quarterly Interest Outflow</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function getAccReportsSubpage() {
    return `
        <div class="form-card">
            <span class="form-section-title">Reconciliation & Financial Statements</span>
            <div class="form-grid">
                <div class="form-group">
                    <label>Generate Balance Sheet</label>
                    <button class="btn btn-outline" onclick="showToast('Download Processed', 'Quarterly Financial statement generated successfully.', 'success')"><i class="fa-solid fa-file-arrow-down"></i> Download statement PDF</button>
                </div>
                <div class="form-group">
                    <label>Generate Profit & Loss Summary</label>
                    <button class="btn btn-outline" onclick="showToast('Download Processed', 'Profit & Loss statement generated successfully.', 'success')"><i class="fa-solid fa-file-arrow-down"></i> Download P&L Excel</button>
                </div>
            </div>
        </div>
    `;
}


// ----------------------------------------------------
// 8.10 CUSTOMER SUBPAGES (Active simulators)
// ----------------------------------------------------
function getCustAccountsSubpage() {
    let myAcc = state.accounts.find(a => a.customerId === 1);
    
    return `
        <div class="form-card">
            <span class="form-section-title">My Primary Bank Account</span>
            <div class="detail-grid">
                <div class="detail-item">
                    <span class="detail-label">Account Number</span>
                    <span class="detail-value"><code>${myAcc.accNum}</code></span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Account Type</span>
                    <span class="detail-value">${myAcc.type}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">IFSC Code</span>
                    <span class="detail-value"><code>SBIN0001234</code></span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Assigned Branch</span>
                    <span class="detail-value">Main Branch</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Nominee Registered</span>
                    <span class="detail-value">Geeta Sharma (Mother)</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Ledger Balance</span>
                    <span class="detail-value" style="color:var(--success-color); font-size:18px;">₹${formatINR(myAcc.balance)}</span>
                </div>
            </div>
        </div>
    `;
}

function getCustTransferSubpage() {
    return `
        <div class="form-card">
            <span class="form-section-title">Local Beneficiary Fund Transfer Portal</span>
            <form id="customer-transfer-form" onsubmit="handleCustomerTransferSubmit(event)">
                <div class="form-grid">
                    <div class="form-group">
                        <label for="trans-dest">Beneficiary Account Number</label>
                        <input type="text" id="trans-dest" class="form-control" placeholder="Enter 12-digit account number (e.g. 100000007891)" required>
                    </div>
                    <div class="form-group">
                        <label for="trans-ifsc">IFSC Code</label>
                        <input type="text" id="trans-ifsc" class="form-control" placeholder="SBIN0001234" required>
                    </div>
                    <div class="form-group">
                        <label for="trans-amount">Transfer Amount (₹)</label>
                        <input type="number" id="trans-amount" class="form-control" placeholder="Enter amount to transfer" required>
                    </div>
                    <div class="form-group" style="grid-column: 1 / -1;">
                        <label for="trans-remarks">Remarks/Memo</label>
                        <input type="text" id="trans-remarks" class="form-control" placeholder="Billing payment, family transfer, etc.">
                    </div>
                </div>
                <div class="form-buttons">
                    <button type="submit" class="btn btn-primary"><i class="fa-solid fa-paper-plane"></i> Confirm Beneficiary Transfer</button>
                </div>
            </form>
        </div>
    `;
}

function getCustStatementSubpage() {
    let myAcc = state.accounts.find(a => a.customerId === 1);
    let myTxns = state.transactions.filter(t => t.accNum === myAcc.accNum);

    return `
        <div class="table-card">
            <div class="table-header">
                <span class="table-title">Savings Account Ledger Statement</span>
                <div class="table-filters">
                    <button class="btn btn-outline btn-sm" onclick="window.print()"><i class="fa-solid fa-print"></i> Print Statement</button>
                </div>
            </div>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Txn ID</th>
                            <th>Timestamp</th>
                            <th>Description</th>
                            <th>Payment Mode</th>
                            <th>Flow</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${myTxns.reverse().map(t => `
                            <tr>
                                <td><code>${t.txnId}</code></td>
                                <td>${t.date}</td>
                                <td>${t.desc}</td>
                                <td><span class="badge badge-muted">${t.mode}</span></td>
                                <td><strong style="color: ${t.type === 'Deposit' ? 'var(--success-color)' : 'var(--danger-color)'}">
                                    ${t.type === 'Deposit' ? '+' : '-'} ₹${formatINR(t.amount)}
                                </strong></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function getCustDebitCardSubpage() {
    let myCard = state.cards.find(c => c.customerId === 1);
    let isBlocked = myCard.status === "Blocked";

    return `
        <div class="card-manager-grid">
            <!-- ATM Visual Card -->
            <div class="atm-card-wrapper">
                <div class="atm-card ${isBlocked ? 'blocked' : ''}" id="visual-atm-card">
                    ${isBlocked ? `<div class="atm-card-overlay-blocked" id="visual-atm-overlay"><i class="fa-solid fa-lock"></i> CARD LOCKED</div>` : ''}
                    <div class="atm-card-header">
                        <div class="atm-card-chip"></div>
                        <span class="atm-card-brand">Ajinkya Bank</span>
                    </div>
                    <div class="atm-card-number">${myCard.cardNum}</div>
                    <div class="atm-card-footer">
                        <div class="atm-card-holder">
                            <span class="atm-card-label">Card Holder</span>
                            <span class="atm-card-value">RAHUL SHARMA</span>
                        </div>
                        <div class="atm-card-holder">
                            <span class="atm-card-label">Expiry</span>
                            <span class="atm-card-value">${myCard.expiry}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ATM Configurations Panel -->
            <div class="form-card">
                <span class="form-section-title">ATM Security Center</span>
                <p style="color:var(--text-secondary); font-size:13px;">Manage transaction capabilities, unlock status or order replacements directly below.</p>
                <div class="form-grid">
                    <div class="form-group" style="grid-column: 1 / -1;">
                        <label>Security Lock status</label>
                        <div style="display:flex; align-items:center; gap:12px; margin-top:6px;">
                            <button class="btn ${isBlocked ? 'btn-success' : 'btn-danger'}" onclick="toggleDebitCardLock()">
                                <i class="fa-solid ${isBlocked ? 'fa-unlock' : 'fa-lock'}"></i> 
                                ${isBlocked ? 'Unlock Debit Card' : 'Temporary Block Card'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function getCustChequeSubpage() {
    return `
        <div class="form-card">
            <span class="form-section-title">Order Cheque Book</span>
            <form id="customer-cheque-form" onsubmit="handleCustomerChequeSubmit(event)">
                <div class="form-grid">
                    <div class="form-group">
                        <label for="ch-leaves">Number of Leaves</label>
                        <select id="ch-leaves" class="form-control">
                            <option value="25">25 Leaves Booklet</option>
                            <option value="50">50 Leaves Booklet</option>
                            <option value="100">100 Leaves Booklet</option>
                        </select>
                    </div>
                </div>
                <div class="form-buttons" style="justify-content: flex-start;">
                    <button type="submit" class="btn btn-primary">Submit Cheque Order</button>
                </div>
            </form>
        </div>
    `;
}

function getCustLoansSubpage() {
    let myLoans = state.loans.filter(l => l.customerId === 1);
    
    return `
        <div class="form-card">
            <span class="form-section-title">Apply for Loan Account</span>
            <form id="customer-loan-form" onsubmit="handleCustomerLoanSubmit(event)">
                <div class="form-grid">
                    <div class="form-group">
                        <label for="ln-type">Loan Category</label>
                        <select id="ln-type" class="form-control" onchange="calculateLoanEmiSim()">
                            <option value="Personal Loan" data-rate="10.5">Personal Loan (10.5% p.a.)</option>
                            <option value="Home Loan" data-rate="8.5">Home Loan (8.5% p.a.)</option>
                            <option value="Vehicle Loan" data-rate="9.0">Vehicle Loan (9.0% p.a.)</option>
                            <option value="Education Loan" data-rate="7.5">Education Loan (7.5% p.a.)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="ln-amount">Required Principal Amount (₹)</label>
                        <input type="number" id="ln-amount" class="form-control" placeholder="100000" value="200000" oninput="calculateLoanEmiSim()" required>
                    </div>
                    <div class="form-group">
                        <label for="ln-tenure">Tenure Duration (Months)</label>
                        <input type="number" id="ln-tenure" class="form-control" placeholder="24" value="24" oninput="calculateLoanEmiSim()" required>
                    </div>
                    <div class="form-group">
                        <label>Calculated Monthly EMI</label>
                        <div style="font-size:18px; font-weight:700; color:var(--primary-color); padding: 10px 0;" id="ln-emi-calc">₹9,278.00</div>
                    </div>
                    <div class="form-group">
                        <label for="ln-income">Monthly Household Income (₹)</label>
                        <input type="number" id="ln-income" class="form-control" placeholder="75000" required>
                    </div>
                    <div class="form-group">
                        <label for="ln-employment">Employment Type</label>
                        <select id="ln-employment" class="form-control">
                            <option value="Salaried">Salaried Employee</option>
                            <option value="Self Employed">Self Employed / Business</option>
                        </select>
                    </div>
                </div>
                <div class="form-buttons">
                    <button type="submit" class="btn btn-primary">Submit Loan Application</button>
                </div>
            </form>
        </div>

        <div class="table-card" style="margin-top:24px;">
            <div class="table-header">
                <span class="table-title">My Loans Applications Status</span>
            </div>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Application ID</th>
                            <th>Loan Type</th>
                            <th>Principal</th>
                            <th>EMI Outflow</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${myLoans.map(l => `
                            <tr>
                                <td><code>${l.loanId}</code></td>
                                <td>${l.type}</td>
                                <td>₹${formatINR(l.amount)}</td>
                                <td>₹${formatINR(l.emi)}/mo</td>
                                <td><span class="badge ${l.status === 'Approved' ? 'badge-success' : 'badge-warning'}">${l.status}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function getCustClosureSubpage() {
    return `
        <div class="form-card">
            <span class="form-section-title">Request Savings Account Closure</span>
            <p style="color:var(--text-secondary); font-size:13px; margin-bottom:12px;">Initiate this request if you intend to deactivate your accounts permanently. All balances must be withdrawn prior to approval.</p>
            <form id="customer-closure-form" onsubmit="handleCustomerClosureSubmit(event)">
                <div class="form-grid">
                    <div class="form-group" style="grid-column: 1 / -1;">
                        <label for="cl-reason">Reason for Closure Request</label>
                        <textarea id="cl-reason" class="form-control" placeholder="State reasons for closure..." required></textarea>
                    </div>
                </div>
                <div class="form-buttons" style="justify-content: flex-start; margin-top:12px;">
                    <button type="submit" class="btn btn-danger">Confirm Closure Request Submission</button>
                </div>
            </form>
        </div>
    `;
}


// ----------------------------------------------------
// 9. SIMULATED EVENT HANDLERS (Interactivity Systems)
// ----------------------------------------------------
function bindDynamicEvents() {
    // Perform calculate on load for loans if present
    calculateLoanEmiSim();
}

// Format Currency
function formatINR(value) {
    let val = parseFloat(value).toFixed(2);
    let parts = val.split(".");
    let num = parts[0];
    let dec = parts[1];
    
    let lastThree = num.substring(num.length - 3);
    let otherParts = num.substring(0, num.length - 3);
    if (otherParts !== '') {
        lastThree = ',' + lastThree;
    }
    let res = otherParts.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree;
    return res + "." + dec;
}

// ----------------------------------------
// CUST REGISTER (CSE WORKFLOW)
// ----------------------------------------
function handleCseRegister(event) {
    event.preventDefault();
    
    let name = document.getElementById("reg-name").value;
    let dob = document.getElementById("reg-dob").value;
    let gender = document.getElementById("reg-gender").value;
    let mobile = document.getElementById("reg-mobile").value;
    let email = document.getElementById("reg-email").value;
    let aadhaar = document.getElementById("reg-aadhaar").value;
    let pan = document.getElementById("reg-pan").value;
    let occupation = document.getElementById("reg-occupation").value;
    let nomineeName = document.getElementById("reg-nominee").value;
    let nomineeRel = document.getElementById("reg-relation").value;
    
    let id = state.customers.length + 1;
    let custId = `CUST${100 + id}`;
    
    let newCust = {
        id,
        custId,
        name,
        dob,
        gender,
        mobile,
        email,
        aadhaar,
        pan,
        address: document.getElementById("reg-address").value,
        occupation,
        nominee: `${nomineeName} (${nomineeRel})`,
        status: "Active",
        kycStatus: "Pending" // Triggering lifecycle
    };
    
    state.customers.push(newCust);
    
    // Add to Audit logs
    addAuditLog("Customer Service Executive", `Registered new Customer ${name} (${custId}). KYC Pending.`);
    
    showToast("Customer Registered", `Profile created for ${name}. Documents queued for KYC.`, "success");
    
    navigateTab("cse_customers");
}

// ----------------------------------------
// CSE OPEN ACCOUNT APP
// ----------------------------------------
function handleCseOpenAccount(event) {
    event.preventDefault();
    let custId = Number(document.getElementById("acc-cust-id").value);
    let type = document.getElementById("acc-type").value;
    let branchId = Number(document.getElementById("acc-branch").value);
    
    let id = state.accounts.length + 1;
    let accNum = `10000000${7890 + id}`;
    
    let newAcc = {
        id,
        customerId: custId,
        accNum,
        type,
        branchId,
        balance: 0.00,
        status: "Inactive", // Branch Manager has to Approve
        createdAt: new Date().toISOString().split('T')[0]
    };
    
    state.accounts.push(newAcc);
    
    let cust = state.customers.find(c => c.id === custId);
    addAuditLog("Customer Service Executive", `Initiated Account opening application (${accNum}) for ${cust.name}.`);
    
    showToast("Application Submitted", `Account application ${accNum} sent to Branch Manager approvals queue.`, "success");
    
    navigateTab("cse_customers");
}

// ----------------------------------------
// KYC VERIFICATION (KYC OFFICER)
// ----------------------------------------
function openKycModal(custId) {
    let cust = state.customers.find(c => c.custId === custId);
    if (!cust) return;
    
    const body = document.getElementById("kyc-modal-body");
    body.innerHTML = `
        <div class="detail-grid">
            <div class="detail-item">
                <span class="detail-label">Full Name</span>
                <span class="detail-value">${cust.name}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Customer ID</span>
                <span class="detail-value">${cust.custId}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Aadhaar Card ID</span>
                <span class="detail-value">${cust.aadhaar}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">PAN Number</span>
                <span class="detail-value">${cust.pan}</span>
            </div>
            <div class="detail-item full-width">
                <span class="detail-label">Document Preview (Scanned Uploads)</span>
                <div class="doc-preview-container">
                    <i class="fa-solid fa-address-card"></i>
                    <span><strong>Aadhaar_PAN_Combined_Scan.pdf</strong></span>
                    <span style="font-size:11px; color:var(--text-muted);">Size: 1.4 MB | Uploaded: 2 hours ago</span>
                </div>
            </div>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:20px;">
            <button class="btn btn-outline" onclick="closeKycModal()">Close</button>
            <button class="btn btn-danger" onclick="actKyc('${cust.custId}', 'Rejected')">Reject</button>
            <button class="btn btn-success" onclick="actKyc('${cust.custId}', 'Verified')">Approve KYC</button>
        </div>
    `;
    
    document.getElementById("kyc-modal").classList.add("active");
}

function closeKycModal() {
    document.getElementById("kyc-modal").classList.remove("active");
}

function actKyc(custId, status) {
    let cust = state.customers.find(c => c.custId === custId);
    if (cust) {
        cust.kycStatus = status;
        addAuditLog("KYC Officer", `KYC Validation status for Customer ${cust.name} updated to ${status}.`);
        showToast("KYC Processed", `Customer profile updated to ${status}.`, "success");
    }
    closeKycModal();
    renderViewPane();
}

// ----------------------------------------
// BM APPROVE NEW ACCOUNTS (BRANCH MANAGER)
// ----------------------------------------
function approveAccount(accNum) {
    let acc = state.accounts.find(a => a.accNum === accNum);
    if (acc) {
        acc.status = "Active";
        let cust = state.customers.find(c => c.id === acc.customerId);
        addAuditLog("Branch Manager", `Approved Account Opening Application for ${cust.name} (Acc: ${accNum}).`);
        showToast("Account Approved", `Account number ${accNum} is now Active!`, "success");
    }
    renderViewPane();
}

// ----------------------------------------
// ACCOUNT ACTIVATION TOGGLE (ACCOUNT OFFICER)
// ----------------------------------------
function toggleAccountStatus(accNum) {
    let acc = state.accounts.find(a => a.accNum === accNum);
    if (acc) {
        acc.status = (acc.status === "Active") ? "Inactive" : "Active";
        addAuditLog("Account Officer", `Toggled status for account ${accNum} to ${acc.status}.`);
        showToast("Status Updated", `Account ${accNum} status changed to ${acc.status}`, "success");
    }
    renderViewPane();
}

// ----------------------------------------
// CASH DEPOSIT & RECEIPT (CASHIER / TELLER)
// ----------------------------------------
function searchDepositAccount() {
    let val = document.getElementById("dep-acc-search").value;
    let acc = state.accounts.find(a => a.accNum === val);
    
    if (acc) {
        let cust = state.customers.find(c => c.id === acc.customerId);
        document.getElementById("dep-fetched-name").innerText = cust.name;
        document.getElementById("dep-fetched-bal").innerText = `₹${formatINR(acc.balance)}`;
        document.getElementById("dep-fetched-kyc").innerHTML = `<span class="badge badge-success">${cust.kycStatus}</span>`;
        document.getElementById("dep-fetched-status").innerHTML = `<span class="badge badge-success">${acc.status}</span>`;
        
        document.getElementById("dep-fetched-card").style.display = "block";
        document.getElementById("dep-acc-num").value = acc.accNum;
        document.getElementById("cash-deposit-form").style.display = "block";
    } else {
        showToast("Error", "Account Number not found in branch system.", "danger");
        document.getElementById("dep-fetched-card").style.display = "none";
        document.getElementById("cash-deposit-form").style.display = "none";
    }
}

function handleCashierDepositSubmit(event) {
    event.preventDefault();
    let accNum = document.getElementById("dep-acc-num").value;
    let amount = Number(document.getElementById("dep-amount").value);
    let mode = document.getElementById("dep-mode").value;
    let remarks = document.getElementById("dep-remarks").value || "Cash Deposit Counter";
    
    let acc = state.accounts.find(a => a.accNum === accNum);
    if (acc) {
        acc.balance += amount;
        
        let id = state.transactions.length + 1;
        let txnId = `TXN${10000 + id}`;
        let dateStr = new Date().toISOString().slice(0, 19).replace('T', ' ').substring(0, 16);
        
        let newTxn = {
            id,
            txnId,
            accNum,
            type: "Deposit",
            amount,
            desc: remarks,
            mode,
            date: dateStr
        };
        state.transactions.push(newTxn);
        
        addAuditLog("Cashier Teller", `Processed cash deposit of ₹${formatINR(amount)} to Acc ${accNum}.`);
        
        // Print Receipt Modal trigger
        triggerReceiptModal(newTxn, acc);
        
        // Reset Cashier screen
        document.getElementById("dep-fetched-card").style.display = "none";
        document.getElementById("cash-deposit-form").style.display = "none";
        document.getElementById("dep-acc-search").value = "";
    }
}

// ----------------------------------------
// CASH WITHDRAWAL (CASHIER / TELLER)
// ----------------------------------------
function searchWithdrawAccount() {
    let val = document.getElementById("with-acc-search").value;
    let acc = state.accounts.find(a => a.accNum === val);
    
    if (acc) {
        let cust = state.customers.find(c => c.id === acc.customerId);
        document.getElementById("with-fetched-name").innerText = cust.name;
        document.getElementById("with-fetched-bal").innerText = `₹${formatINR(acc.balance)}`;
        document.getElementById("with-fetched-kyc").innerHTML = `<span class="badge badge-success">${cust.kycStatus}</span>`;
        document.getElementById("with-fetched-status").innerHTML = `<span class="badge badge-success">${acc.status}</span>`;
        
        document.getElementById("with-fetched-card").style.display = "block";
        document.getElementById("with-acc-num").value = acc.accNum;
        document.getElementById("cash-withdrawal-form").style.display = "block";
    } else {
        showToast("Error", "Account Number not found in branch system.", "danger");
        document.getElementById("with-fetched-card").style.display = "none";
        document.getElementById("cash-withdrawal-form").style.display = "none";
    }
}

function handleCashierWithdrawSubmit(event) {
    event.preventDefault();
    let accNum = document.getElementById("with-acc-num").value;
    let amount = Number(document.getElementById("with-amount").value);
    let mode = document.getElementById("with-mode").value;
    let remarks = document.getElementById("with-remarks").value || "Cash Withdrawal Counter";
    
    let acc = state.accounts.find(a => a.accNum === accNum);
    if (acc) {
        if (acc.balance < amount) {
            showToast("Insufficient Balance", `Available balance is ₹${formatINR(acc.balance)}`, "danger");
            return;
        }
        
        acc.balance -= amount;
        
        let id = state.transactions.length + 1;
        let txnId = `TXN${10000 + id}`;
        let dateStr = new Date().toISOString().slice(0, 19).replace('T', ' ').substring(0, 16);
        
        let newTxn = {
            id,
            txnId,
            accNum,
            type: "Withdrawal",
            amount,
            desc: remarks,
            mode,
            date: dateStr
        };
        state.transactions.push(newTxn);
        
        addAuditLog("Cashier Teller", `Processed withdrawal of ₹${formatINR(amount)} from Acc ${accNum}.`);
        
        // Print Receipt Modal trigger
        triggerReceiptModal(newTxn, acc);
        
        // Reset Withdraw screen
        document.getElementById("with-fetched-card").style.display = "none";
        document.getElementById("cash-withdrawal-form").style.display = "none";
        document.getElementById("with-acc-search").value = "";
    }
}

// ----------------------------------------
// LOCAL FUND TRANSFER (CASHIER COUNTER)
// ----------------------------------------
function handleCashierTransferSubmit(event) {
    event.preventDefault();
    let src = document.getElementById("ct-source").value;
    let dest = document.getElementById("ct-dest").value;
    let amount = Number(document.getElementById("ct-amount").value);
    let remarks = document.getElementById("ct-remarks").value || "Funds Transfer (Counter)";

    let srcAcc = state.accounts.find(a => a.accNum === src);
    let destAcc = state.accounts.find(a => a.accNum === dest);

    if (!srcAcc) {
        showToast("Error", "Source Account not found.", "danger");
        return;
    }
    if (!destAcc) {
        showToast("Error", "Destination Account not found.", "danger");
        return;
    }
    if (srcAcc.balance < amount) {
        showToast("Insufficient Funds", `Source Account only has ₹${formatINR(srcAcc.balance)}`, "danger");
        return;
    }

    // Process
    srcAcc.balance -= amount;
    destAcc.balance += amount;

    let dateStr = new Date().toISOString().slice(0, 19).replace('T', ' ').substring(0, 16);
    let id1 = state.transactions.length + 1;
    let id2 = id1 + 1;

    state.transactions.push({
        id: id1,
        txnId: `TXN${10000 + id1}`,
        accNum: src,
        type: "Withdrawal",
        amount,
        desc: `Transfer to Acc ${dest}: ${remarks}`,
        mode: "Online",
        date: dateStr
    });

    state.transactions.push({
        id: id2,
        txnId: `TXN${10000 + id2}`,
        accNum: dest,
        type: "Deposit",
        amount,
        desc: `Transfer from Acc ${src}: ${remarks}`,
        mode: "Online",
        date: dateStr
    });

    addAuditLog("Teller Desk", `Processed local account transfer of ₹${formatINR(amount)} from ${src} to ${dest}.`);
    showToast("Transfer Successful", `Transferred ₹${formatINR(amount)} to Account ${dest}`, "success");

    document.getElementById("ct-source").value = "";
    document.getElementById("ct-dest").value = "";
    document.getElementById("ct-amount").value = "";
    document.getElementById("ct-remarks").value = "";
}

// ----------------------------------------
// TRANSACTION RECEIPT DIALOG PRINT
// ----------------------------------------
function triggerReceiptModal(txn, acc) {
    let cust = state.customers.find(c => c.id === acc.customerId);
    const body = document.getElementById("receipt-modal-body");
    body.innerHTML = `
        <div class="receipt-layout">
            <div class="receipt-header">
                <h2>Ajinkya Bank</h2>
                <span>Teller Cash Transaction Voucher</span>
            </div>
            <div class="receipt-body">
                <div class="receipt-row">
                    <span>Transaction ID:</span>
                    <span><strong>${txn.txnId}</strong></span>
                </div>
                <div class="receipt-row">
                    <span>Date & Time:</span>
                    <span>${txn.date}</span>
                </div>
                <div class="receipt-row">
                    <span>Account Number:</span>
                    <span><code>${acc.accNum}</code></span>
                </div>
                <div class="receipt-row">
                    <span>Account Holder:</span>
                    <span>${cust.name}</span>
                </div>
                <div class="receipt-row">
                    <span>Transaction Type:</span>
                    <span><strong>${txn.type.toUpperCase()}</strong></span>
                </div>
                <div class="receipt-row">
                    <span>Amount Transacted:</span>
                    <span><strong>₹${formatINR(txn.amount)}</strong></span>
                </div>
                <div class="receipt-row" style="margin-top:10px; border-top:1px dashed #000; padding-top:10px;">
                    <span>Available Balance:</span>
                    <span><strong>₹${formatINR(acc.balance)}</strong></span>
                </div>
            </div>
            <div class="receipt-footer">
                <span>Thank you for banking with Ajinkya Bank.</span><br>
                <span>For support, contact support@ajinkyanagari.com</span>
            </div>
        </div>
    `;
    
    document.getElementById("receipt-modal").classList.add("active");
}

function closeReceiptModal() {
    document.getElementById("receipt-modal").classList.remove("active");
}

// ----------------------------------------
// LOAN APPLICATION SUBMIT (CUSTOMER SIDE)
// ----------------------------------------
function calculateLoanEmiSim() {
    let type = document.getElementById("ln-type");
    let amountEl = document.getElementById("ln-amount");
    let tenureEl = document.getElementById("ln-tenure");
    let display = document.getElementById("ln-emi-calc");
    
    if (!type || !amountEl || !tenureEl || !display) return;
    
    let rate = parseFloat(type.options[type.selectedIndex].getAttribute("data-rate"));
    let p = parseFloat(amountEl.value) || 0;
    let n = parseInt(tenureEl.value) || 0;
    
    if (p <= 0 || n <= 0) {
        display.innerText = "₹0.00";
        return;
    }
    
    // Monthly interest rate formula
    let r = (rate / 12) / 100;
    let emi = (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    
    display.innerText = `₹${formatINR(emi)}`;
}

function handleCustomerLoanSubmit(event) {
    event.preventDefault();
    let type = document.getElementById("ln-type").value;
    let amount = Number(document.getElementById("ln-amount").value);
    let tenure = Number(document.getElementById("ln-tenure").value);
    let income = Number(document.getElementById("ln-income").value);
    let employment = document.getElementById("ln-employment").value;
    
    let id = state.loans.length + 1;
    let loanId = `LOAN${1000 + id}`;
    
    let typeEl = document.getElementById("ln-type");
    let rate = parseFloat(typeEl.options[typeEl.selectedIndex].getAttribute("data-rate"));
    
    let r = (rate / 12) / 100;
    let emi = (amount * r * Math.pow(1 + r, tenure)) / (Math.pow(1 + r, tenure) - 1);
    
    let newLoan = {
        id,
        loanId,
        customerId: 1, // Rahul
        type,
        amount,
        rate,
        tenure,
        emi,
        income,
        employment,
        status: "Pending",
        date: new Date().toISOString().split('T')[0]
    };
    
    state.loans.push(newLoan);
    
    addAuditLog("Customer Rahul", `Submitted loan application for ${type} of ₹${formatINR(amount)}.`);
    showToast("Application Submitted", `Loan application ${loanId} queued for Loan Officer approval.`, "success");
    
    navigateTab("cust_loans");
}

// ----------------------------------------
// LOAN APPROVE / REJECT (LOAN OFFICER)
// ----------------------------------------
function approveLoan(id) {
    let loan = state.loans.find(l => l.id === id);
    if (loan) {
        loan.status = "Approved";
        
        // Deposit the loan amount into the borrower's account immediately!
        let acc = state.accounts.find(a => a.customerId === loan.customerId && a.status === "Active");
        if (acc) {
            acc.balance += loan.amount;
            
            // Add transaction log
            let idTxn = state.transactions.length + 1;
            state.transactions.push({
                id: idTxn,
                txnId: `TXN${10000 + idTxn}`,
                accNum: acc.accNum,
                type: "Deposit",
                amount: loan.amount,
                desc: `Approved Loan Disbursal (${loan.loanId})`,
                mode: "Online",
                date: new Date().toISOString().slice(0, 19).replace('T', ' ').substring(0, 16)
            });
        }
        
        let cust = state.customers.find(c => c.id === loan.customerId);
        addAuditLog("Loan Officer", `Approved loan disbursement (${loan.loanId}) of ₹${formatINR(loan.amount)} to ${cust.name}.`);
        showToast("Loan Disbursed", `Loan approved. Funds transferred to primary account.`, "success");
    }
    renderViewPane();
}

function rejectLoan(id) {
    let loan = state.loans.find(l => l.id === id);
    if (loan) {
        loan.status = "Rejected";
        addAuditLog("Loan Officer", `Rejected loan application (${loan.loanId}).`);
        showToast("Loan Rejected", `Loan application ${loan.loanId} updated to Rejected.`, "danger");
    }
    renderViewPane();
}

// ----------------------------------------
// DEBIT CARD BLOCK/UNLOCK TOGGLE (CUSTOMER)
// ----------------------------------------
function toggleDebitCardLock() {
    let card = state.cards.find(c => c.customerId === 1);
    if (card) {
        card.status = (card.status === "Active") ? "Blocked" : "Active";
        addAuditLog("Customer Rahul", `Updated Debit Card security status to ${card.status}.`);
        
        // Re-render
        renderViewPane();
        
        showToast(
            card.status === "Blocked" ? "Card Blocked" : "Card Activated", 
            card.status === "Blocked" ? "All transaction modes on ATM Card are now locked." : "Your card is fully active.", 
            card.status === "Blocked" ? "danger" : "success"
        );
    }
}

// ----------------------------------------
// CHEQUE BOOK ORDER (CUSTOMER)
// ----------------------------------------
function handleCustomerChequeSubmit(event) {
    event.preventDefault();
    let leaves = parseInt(document.getElementById("ch-leaves").value);
    
    let id = state.cheques.length + 1;
    state.cheques.push({
        id,
        customerId: 1,
        leaves,
        status: "Pending Approval",
        date: new Date().toISOString().split('T')[0]
    });
    
    addAuditLog("Customer Rahul", `Submitted cheque booklet request (${leaves} leaves).`);
    showToast("Order Placed", "Your cheque book request is submitted to the Customer Service Desk.", "success");
    navigateTab("dashboard");
}

// ----------------------------------------
// FUND TRANSFER (CUSTOMER INSIDE PORTAL)
// ----------------------------------------
function handleCustomerTransferSubmit(event) {
    event.preventDefault();
    let dest = document.getElementById("trans-dest").value;
    let amount = Number(document.getElementById("trans-amount").value);
    let remarks = document.getElementById("trans-remarks").value || "Fund Transfer (Online)";
    
    let myAcc = state.accounts.find(a => a.customerId === 1);
    let destAcc = state.accounts.find(a => a.accNum === dest);
    
    if (!destAcc) {
        showToast("Error", "Beneficiary Account Number not found in system.", "danger");
        return;
    }
    if (myAcc.balance < amount) {
        showToast("Insufficient Balance", `Available balance is ₹${formatINR(myAcc.balance)}`, "danger");
        return;
    }
    if (myAcc.id === destAcc.id) {
        showToast("Transaction Error", "Source and Destination account numbers cannot be identical.", "danger");
        return;
    }
    
    // Transfer funds
    myAcc.balance -= amount;
    destAcc.balance += amount;
    
    let dateStr = new Date().toISOString().slice(0, 19).replace('T', ' ').substring(0, 16);
    
    // Debits Rahul
    let id1 = state.transactions.length + 1;
    state.transactions.push({
        id: id1,
        txnId: `TXN${10000 + id1}`,
        accNum: myAcc.accNum,
        type: "Withdrawal",
        amount,
        desc: `Transfer to Acc ${dest}: ${remarks}`,
        mode: "Online",
        date: dateStr
    });
    
    // Credits Beneficiary
    let id2 = id1 + 1;
    state.transactions.push({
        id: id2,
        txnId: `TXN${10000 + id2}`,
        accNum: dest,
        type: "Deposit",
        amount,
        desc: `Transfer from Acc ${myAcc.accNum}: ${remarks}`,
        mode: "Online",
        date: dateStr
    });
    
    addAuditLog("Customer Rahul", `Transferred ₹${formatINR(amount)} online to Account ${dest}.`);
    
    showToast("Transfer Successful", `Transferred ₹${formatINR(amount)} to Acc ${dest} successfully.`, "success");
    
    navigateTab("dashboard");
}

// ----------------------------------------
// CUSTOMER SUBMIT ACCOUNT CLOSURE REQUEST
// ----------------------------------------
function handleCustomerClosureSubmit(event) {
    event.preventDefault();
    let reason = document.getElementById("cl-reason").value;
    let myAcc = state.accounts.find(a => a.customerId === 1);
    
    // Avoid double submission
    let exists = state.accountClosures.find(c => c.accNum === myAcc.accNum);
    if (exists) {
        showToast("Already Requested", "Your account closure request is already under manager review.", "warning");
        return;
    }
    
    state.accountClosures.push({
        accNum: myAcc.accNum,
        reason,
        status: "Pending Review"
    });
    
    addAuditLog("Customer Rahul", `Submitted Account Closure Request for account ${myAcc.accNum}.`);
    showToast("Closure Requested", "Your request is submitted to the Branch Manager reviews queue.", "success");
    navigateTab("dashboard");
}

// ----------------------------------------
// BM APPROVE CLOSURE REQUEST
// ----------------------------------------
function approveAccountClosure(accNum) {
    let acc = state.accounts.find(a => a.accNum === accNum);
    if (acc) {
        acc.status = "Closed";
        acc.balance = 0.00;
        
        // Remove from list
        state.accountClosures = state.accountClosures.filter(c => c.accNum !== accNum);
        
        let cust = state.customers.find(c => c.id === acc.customerId);
        addAuditLog("Branch Manager", `Approved Permanent Account Closure for ${cust.name} (Acc: ${accNum}).`);
        showToast("Account Closed", `Account number ${accNum} has been permanently closed.`, "success");
    }
    renderViewPane();
}

// Helper to write audit logs
function addAuditLog(actor, action) {
    let id = state.auditLogs.length + 1;
    let timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ').substring(0, 16);
    state.auditLogs.push({
        id,
        timestamp,
        actor,
        action
    });
}
