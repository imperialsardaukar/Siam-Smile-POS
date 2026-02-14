import React, { useMemo, useState, useCallback } from "react";
import Topbar from "../components/Topbar.jsx";
import { Card, CardBody, CardHeader } from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import Input from "../components/Input.jsx";
import Select from "../components/Select.jsx";
import Badge from "../components/Badge.jsx";
import Modal from "../components/Modal.jsx";
import { printReceipt } from "../components/Receipt.jsx";
import { useStore } from "../state/StoreContext.jsx";
import { fmtAED } from "../lib/money.js";
import { calcSubtotal, orderPrepSeconds } from "../lib/calc.js";

function TabButton({ active, children, ...props }) {
  return (
    <button
      className={`px-4 py-2 rounded-xl border transition ${active ? "bg-white text-neutral-900 border-white" : "bg-neutral-950 border-neutral-800 text-neutral-200 hover:bg-neutral-900"}`}
      {...props}
    >
      {children}
    </button>
  );
}

export default function Admin() {
  const { snapshot, emit, connected } = useStore();
  const [tab, setTab] = useState("dashboard");

  const staff = snapshot?.staff || [];
  const categories = (snapshot?.categories || []).slice().sort((a,b) => (a.sortOrder||0)-(b.sortOrder||0));
  const menu = snapshot?.menu || [];
  const orders = snapshot?.orders || [];
  const settings = snapshot?.settings || { taxPercent: 0, serviceChargePercent: 0 };
  const promos = snapshot?.promos || [];

  return (
    <div className="min-h-screen">
      <Topbar right={null} />
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-wrap gap-2">
          <TabButton active={tab==="dashboard"} onClick={() => setTab("dashboard")}>Dashboard</TabButton>
          <TabButton active={tab==="menu"} onClick={() => setTab("menu")}>Menu</TabButton>
          <TabButton active={tab==="inventory"} onClick={() => setTab("inventory")}>Inventory</TabButton>
          <TabButton active={tab==="staff"} onClick={() => setTab("staff")}>Staff</TabButton>
          <TabButton active={tab==="customers"} onClick={() => setTab("customers")}>Customers</TabButton>
          <TabButton active={tab==="promos"} onClick={() => setTab("promos")}>Promos</TabButton>
          <TabButton active={tab==="metrics"} onClick={() => setTab("metrics")}>Metrics</TabButton>
          <TabButton active={tab==="orders"} onClick={() => setTab("orders")}>Orders</TabButton>
          <TabButton active={tab==="settings"} onClick={() => setTab("settings")}>Settings</TabButton>
          <TabButton active={tab==="logs"} onClick={() => setTab("logs")}>Audit Log</TabButton>
        </div>

        {tab === "dashboard" && <DashboardPanel settings={settings} snapshot={snapshot} emit={emit} />}
        {tab === "orders" && <OrdersPanel orders={orders} emit={emit} settings={settings} />}
        {tab === "menu" && <MenuPanel menu={menu} categories={categories} emit={emit} />}
        {tab === "inventory" && <InventoryPanel snapshot={snapshot} emit={emit} />}
        {tab === "staff" && <StaffPanel staff={staff} emit={emit} />}
        {tab === "customers" && <CustomersPanel snapshot={snapshot} emit={emit} />}
        {tab === "promos" && <PromosPanel promos={promos} emit={emit} />}
        {tab === "settings" && <SettingsPanel settings={settings} emit={emit} />}
        {tab === "metrics" && <MetricsPanel snapshot={snapshot} emit={emit} />}
        {tab === "logs" && <LogsPanel logs={snapshot?.logs || []} />}
      </div>
    </div>
  );
}

function DashboardPanel({ snapshot, settings, emit }) {
  const revenue = snapshot?.revenue?.total || 0;
  const orders = snapshot?.orders || [];
  const counts = {
    new: orders.filter(o => o.status === "new").length,
    preparing: orders.filter(o => o.status === "preparing").length,
    done: orders.filter(o => o.status === "done").length,
  };
  
  const promos = snapshot?.promos || [];
  const activePromos = promos.filter(p => p.isActive).length;

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2">
        <CardHeader title="Overview" subtitle="Live status + performance snapshot" right={<Badge variant="yellow">{settings.currency || "AED"}</Badge>} />
        <CardBody className="grid sm:grid-cols-3 gap-4">
          <Stat label="Total Revenue" value={fmtAED(revenue)} />
          <Stat label="Total Orders" value={orders.length} />
          <Stat label="Active Promos" value={activePromos} />
          <Stat label="New" value={counts.new} />
          <Stat label="Preparing" value={counts.preparing} />
          <Stat label="Done" value={counts.done} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Quick Actions" subtitle="Common admin tasks" />
        <CardBody className="space-y-2">
          <div className="text-sm text-neutral-400">System Status</div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <span className="text-sm">Database: OK</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <span className="text-sm">Backups: Auto</span>
          </div>
          <div className="border-t border-neutral-800 my-2"></div>
          <div className="text-xs text-neutral-500">
            Last backup: {new Date().toLocaleDateString()}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-4">
      <div className="text-xs text-neutral-400">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function OrdersPanel({ orders, emit, settings }) {
  const [editOrder, setEditOrder] = useState(null);
  const [editNote, setEditNote] = useState("");
  const [filter, setFilter] = useState("all");
  const [receiptOrder, setReceiptOrder] = useState(null);
  const [receiptData, setReceiptData] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState("");

  function openEdit(o) {
    setEditOrder(o);
    setEditNote(o.note || "");
  }

  async function saveOrder() {
    if (!editOrder) return;
    await emit("order:update", { id: editOrder.id, note: editNote });
    setEditOrder(null);
  }

  async function deleteOrder(id) {
    await emit("order:delete", { id });
    setEditOrder(null);
  }

  async function viewReceipt(order) {
    const resp = await emit("receipt:preview", { orderId: order.id });
    if (resp.ok) {
      setReceiptOrder(resp.order);
      setReceiptData(resp.receipt);
      setReceiptPreview(resp.preview);
    }
  }

  function closeReceipt() {
    setReceiptOrder(null);
    setReceiptData(null);
    setReceiptPreview("");
  }

  function handlePrintReceipt() {
    if (receiptOrder) {
      printReceipt(receiptOrder, receiptData, settings);
    }
  }

  const filteredOrders = orders.filter(o => {
    if (filter === "all") return true;
    return o.status === filter;
  });

  return (
    <Card>
      <CardHeader 
        title="Orders" 
        subtitle="Manage all orders and view receipts"
        right={
          <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-32">
            <option value="all">All</option>
            <option value="new">New</option>
            <option value="preparing">Preparing</option>
            <option value="done">Done</option>
          </Select>
        }
      />
      <CardBody className="space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="text-neutral-400">No orders found.</div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredOrders.slice(0, 50).map(o => (
              <div key={o.id} className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">#{o.id.slice(0, 8).toUpperCase()}</div>
                  <div className="text-xs text-neutral-500">
                    <Badge variant={o.status === "new" ? "yellow" : o.status === "preparing" ? "blue" : "green"} className="mr-2">
                      {o.status}
                    </Badge>
                    {o.createdByUsername} • {fmtAED(o.total || calcSubtotal(o.items || []))}
                    {o.promo && <span className="text-emerald-400 ml-2">Promo: {o.promo.code}</span>}
                  </div>
                  {(o.customerName || o.tableNumber) && (
                    <div className="text-xs text-neutral-400 mt-1">
                      {o.customerName && `Customer: ${o.customerName}`}
                      {o.customerName && o.tableNumber && " • "}
                      {o.tableNumber && `Table: ${o.tableNumber}`}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button variant="subtle" onClick={() => viewReceipt(o)}>View Receipt</Button>
                  {o.status !== "done" && (
                    <Button variant="subtle" onClick={() => openEdit(o)}>Edit</Button>
                  )}
                  {o.status !== "done" && (
                    <Button variant="danger" onClick={() => deleteOrder(o.id)}>Delete</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardBody>
      
      {editOrder && (
        <Modal
          open={!!editOrder}
          title={`Edit Order #${editOrder?.id?.slice(0, 8)?.toUpperCase()}`}
          onClose={() => setEditOrder(null)}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditOrder(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => deleteOrder(editOrder.id)}>Delete Order</Button>
              <Button onClick={saveOrder}>Save</Button>
            </div>
          }
        >
          <div className="space-y-3">
            <div>
              <div className="text-sm text-neutral-300 mb-1">Note to kitchen</div>
              <Input value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="Optional note" />
            </div>
            <div className="text-sm text-neutral-400">
              Items: {editOrder.items.map(i => `${i.qty}× ${i.name}`).join(", ")}
            </div>
            <div className="text-sm text-neutral-400">
              Total: {fmtAED(editOrder.total || calcSubtotal(editOrder.items))}
            </div>
          </div>
        </Modal>
      )}

      {/* Receipt Modal */}
      <Modal
        open={!!receiptOrder}
        title={`Receipt - Order #${receiptOrder?.id?.slice(0, 8)?.toUpperCase()}`}
        onClose={closeReceipt}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={closeReceipt}>Close</Button>
            <Button onClick={handlePrintReceipt}>Print Receipt</Button>
          </div>
        }
      >
        {receiptOrder && (
          <div className="space-y-4">
            {/* Print-friendly receipt */}
            <div className="print-only">
              <pre className="whitespace-pre-wrap font-mono text-sm">
                {receiptPreview}
              </pre>
            </div>
            
            {/* On-screen receipt view */}
            <div className="no-print">
              <div className="text-center mb-4">
                <div className="text-2xl font-bold text-emerald-400">{fmtAED(receiptOrder.total)}</div>
                <div className="text-sm text-neutral-400">
                  {new Date(receiptOrder.createdAt).toLocaleString()}
                </div>
                {receiptData && (
                  <div className="text-sm text-neutral-400">
                    Payment: {receiptData.paymentMethod?.toUpperCase()}
                  </div>
                )}
              </div>
              
              <div className="border-t border-neutral-800 pt-3 mb-3">
                <div className="text-sm font-medium text-neutral-300 mb-2">Items</div>
                <div className="space-y-1">
                  {receiptOrder.items?.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-neutral-300">{item.qty} × {item.name}</span>
                      <span className="text-neutral-200">{fmtAED(item.price * item.qty)}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="border-t border-neutral-800 pt-3 space-y-1 text-sm">
                <div className="flex justify-between text-neutral-400">
                  <span>Subtotal</span>
                  <span>{fmtAED(receiptOrder.subtotal)}</span>
                </div>
                {receiptOrder.discount > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Discount {receiptOrder.promo?.code && `(${receiptOrder.promo.code})`}</span>
                    <span>-{fmtAED(receiptOrder.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-lg pt-2 border-t border-neutral-800">
                  <span>TOTAL</span>
                  <span className="text-emerald-400">{fmtAED(receiptOrder.total)}</span>
                </div>
              </div>
              
              {(receiptOrder.customerName || receiptOrder.tableNumber) && (
                <div className="border-t border-neutral-800 pt-3 mt-3">
                  <div className="text-sm font-medium text-neutral-300 mb-2">Customer Info</div>
                  {receiptOrder.customerName && (
                    <div className="text-sm text-neutral-400">{receiptOrder.customerName}</div>
                  )}
                  {receiptOrder.tableNumber && (
                    <div className="text-sm text-neutral-400">Table {receiptOrder.tableNumber}</div>
                  )}
                </div>
              )}
              
              <div className="border-t border-neutral-800 pt-3 mt-3">
                <div className="text-sm text-neutral-400">
                  Cashier: {receiptOrder.createdByUsername || "Staff"}
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
}

function MenuPanel({ menu, categories, emit }) {
  const [itemModal, setItemModal] = useState(false);
  const [catModal, setCatModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [backupModal, setBackupModal] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [importData, setImportData] = useState("");
  const [importMode, setImportMode] = useState("merge");
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState("");

  const [name, setName] = useState("");
  const [price, setPrice] = useState("0");
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [imageUrl, setImageUrl] = useState("");
  const [description, setDescription] = useState("");

  function openCreateItem() {
    setEditItem(null);
    setName("");
    setPrice("0");
    setCategoryId(categories[0]?.id || "");
    setImageUrl("");
    setDescription("");
    setItemModal(true);
  }

  function openEditItem(it) {
    setEditItem(it);
    setName(it.name);
    setPrice(String(it.price));
    setCategoryId(it.categoryId || "");
    setImageUrl(it.imageUrl || "");
    setDescription(it.description || "");
    setItemModal(true);
  }

  async function saveItem() {
    const p = Number(price);
    if (Number.isNaN(p)) return;
    if (editItem) {
      await emit("menu:update", { id: editItem.id, name, price: p, categoryId, imageUrl, description });
    } else {
      await emit("menu:create", { name, price: p, categoryId, imageUrl, description });
    }
    setItemModal(false);
  }

  async function deleteItem(id) {
    await emit("menu:delete", { id });
  }

  async function toggleAvailability(id, currentUnavailable) {
    await emit("menu:setAvailability", { id, unavailable: !currentUnavailable });
  }

  const [catName, setCatName] = useState("");
  const [editCat, setEditCat] = useState(null);

  async function createCategory() {
    await emit("category:create", { name: catName });
    setCatName("");
    setCatModal(false);
  }

  function editCategory(c) {
    setEditCat(c);
    setCatName(c.name);
    setCatModal(true);
  }

  async function saveCategory() {
    if (editCat) {
      await emit("category:update", { id: editCat.id, name: catName, sortOrder: editCat.sortOrder });
    } else {
      await emit("category:create", { name: catName });
    }
    setCatName("");
    setEditCat(null);
    setCatModal(false);
  }

  async function deleteCategory(id) {
    await emit("category:delete", { id });
  }

  async function exportBackup() {
    const resp = await emit("menu:export", {});
    if (resp.ok) {
      const blob = new Blob([JSON.stringify(resp.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `siam-smile-menu-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setBackupModal(false);
    }
  }

  async function importBackup() {
    setImportError("");
    setImportSuccess("");
    
    try {
      const data = JSON.parse(importData);
      if (!data.menu || !Array.isArray(data.menu)) {
        setImportError("Invalid backup file: menu array not found");
        return;
      }
      
      if (importMode === "replace") {
        if (!confirm("WARNING: Replace mode will DELETE all existing menu items and categories. This cannot be undone. Continue?")) {
          return;
        }
      }
      
      const resp = await emit("menu:import", { data, mode: importMode });
      if (resp.ok) {
        setImportSuccess(`Import successful! Imported ${resp.imported.categories} categories and ${resp.imported.items} items.`);
        setImportData("");
        setTimeout(() => {
          setImportModal(false);
          setImportSuccess("");
        }, 2000);
      } else {
        setImportError(resp.error || "Import failed");
      }
    } catch (e) {
      setImportError("Invalid JSON file: " + e.message);
    }
  }

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setImportData(event.target.result);
    };
    reader.readAsText(file);
  }

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <Card>
          <CardHeader
            title="Menu Items"
            subtitle="Create, edit, delete, and manage availability."
            right={
              <div className="flex gap-2">
                <Button variant="subtle" onClick={() => setBackupModal(true)}>Backup</Button>
                <Button variant="subtle" onClick={() => setImportModal(true)}>Import</Button>
                <Button onClick={openCreateItem}>Add Item</Button>
              </div>
            }
          />
          <CardBody className="space-y-3">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {menu.map(it => (
                <div key={it.id} className={`rounded-2xl border border-neutral-800 bg-neutral-900/30 overflow-hidden ${it.unavailable ? 'opacity-60' : ''}`}>
                  <div className="aspect-[4/3] bg-neutral-950/50 relative">
                    {it.imageUrl ? <img src={it.imageUrl} alt={it.name} className="w-full h-full object-cover" /> : <div className="h-full grid place-items-center text-neutral-500 text-sm">No image</div>}
                    {it.unavailable && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Badge variant="red">UNAVAILABLE</Badge>
                      </div>
                    )}
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold">{it.name}</div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant={it.isActive ? "green" : "red"}>{it.isActive ? "Active" : "Hidden"}</Badge>
                      </div>
                    </div>
                    <div className="text-sm text-neutral-300">{fmtAED(it.price)}</div>
                    <div className="flex gap-2 flex-wrap">
                      <Button variant="subtle" onClick={() => openEditItem(it)} className="flex-1">Edit</Button>
                      <Button 
                        variant={it.unavailable ? "ghost" : "subtle"} 
                        onClick={() => toggleAvailability(it.id, it.unavailable)}
                        className="text-xs"
                        title={it.unavailable ? "Mark as available" : "Mark as unavailable"}
                      >
                        {it.unavailable ? "Enable" : "Disable"}
                      </Button>
                      <Button variant="danger" onClick={() => deleteItem(it.id)} className="text-xs">Delete</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Categories"
            subtitle="Groups used in Cashier menu."
            right={<Button variant="subtle" onClick={() => { setEditCat(null); setCatName(""); setCatModal(true); }}>Add</Button>}
          />
          <CardBody className="space-y-3">
            {categories.map(c => (
              <div key={c.id} className="rounded-2xl border border-neutral-800 bg-neutral-900/20 p-3 flex items-center justify-between gap-2">
                <div className="font-medium">{c.name}</div>
                <div className="flex items-center gap-2">
                  <Badge variant="neutral">#{c.sortOrder}</Badge>
                  <Button variant="subtle" onClick={() => editCategory(c)} className="text-xs">Edit</Button>
                  <Button variant="danger" onClick={() => deleteCategory(c.id)} className="text-xs">Delete</Button>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      {/* Backup/Export Modal */}
      <Modal
        open={backupModal}
        title="Export Menu Backup"
        onClose={() => setBackupModal(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setBackupModal(false)}>Cancel</Button>
            <Button onClick={exportBackup}>Download Backup</Button>
          </div>
        }
      >
        <div className="space-y-3 text-neutral-300">
          <p>This will download a JSON file containing all your categories and menu items.</p>
          <div className="text-sm text-neutral-400">
            <div>• All categories (ID, name, sort order)</div>
            <div>• All menu items (ID, name, price, description, availability, etc.)</div>
            <div>• Image URLs are included (images themselves are not downloaded)</div>
          </div>
        </div>
      </Modal>

      {/* Import Modal */}
      <Modal
        open={importModal}
        title="Import Menu Backup"
        onClose={() => { setImportModal(false); setImportData(""); setImportError(""); setImportSuccess(""); }}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setImportModal(false); setImportData(""); setImportError(""); setImportSuccess(""); }}>Cancel</Button>
            <Button onClick={importBackup} disabled={!importData.trim()}>Import</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <div className="text-sm text-neutral-300 mb-2">Import Mode</div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  value="merge" 
                  checked={importMode === "merge"}
                  onChange={(e) => setImportMode(e.target.value)}
                  className="rounded border-neutral-600 bg-neutral-800"
                />
                <span className="text-sm text-neutral-300">
                  <strong>Merge</strong> (Safe) - Add new items, update existing ones. Keeps current items.
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  value="replace" 
                  checked={importMode === "replace"}
                  onChange={(e) => setImportMode(e.target.value)}
                  className="rounded border-neutral-600 bg-neutral-800"
                />
                <span className="text-sm text-red-300">
                  <strong>Replace</strong> (Dangerous) - Delete everything and restore from backup.
                </span>
              </label>
            </div>
          </div>
          
          <div>
            <div className="text-sm text-neutral-300 mb-2">Backup File</div>
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="w-full text-sm text-neutral-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-neutral-800 file:text-neutral-300 hover:file:bg-neutral-700"
            />
            <div className="text-xs text-neutral-500 mt-2">
              Or paste the JSON content below:
            </div>
          </div>
          
          <textarea
            value={importData}
            onChange={(e) => setImportData(e.target.value)}
            placeholder="Paste backup JSON here..."
            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm min-h-[120px] resize-y text-neutral-300 font-mono"
          />
          
          {importError && <div className="text-sm text-red-400">{importError}</div>}
          {importSuccess && <div className="text-sm text-emerald-400">{importSuccess}</div>}
        </div>
      </Modal>

      <Modal
        open={itemModal}
        title={editItem ? "Edit Menu Item" : "Add Menu Item"}
        onClose={() => setItemModal(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setItemModal(false)}>Cancel</Button>
            <Button onClick={saveItem}>Save</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <div className="text-sm text-neutral-300 mb-1">Name</div>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <div className="text-sm text-neutral-300 mb-1">Description</div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description for the menu item"
              className="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-white/20 min-h-[80px] resize-y"
            />
          </div>
          <div>
            <div className="text-sm text-neutral-300 mb-1">Price (AED)</div>
            <Input value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div>
            <div className="text-sm text-neutral-300 mb-1">Category</div>
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Unassigned</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <div>
            <div className="text-sm text-neutral-300 mb-1">Image URL</div>
            <Input placeholder="https://…" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
            <div className="text-xs text-neutral-500 mt-1">
              Tip: host images on Imgur/GitHub/Replit or serve from your own server.
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={catModal}
        title={editCat ? "Edit Category" : "Add Category"}
        onClose={() => { setCatModal(false); setEditCat(null); setCatName(""); }}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setCatModal(false); setEditCat(null); setCatName(""); }}>Cancel</Button>
            <Button onClick={saveCategory}>{editCat ? "Save" : "Create"}</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <div className="text-sm text-neutral-300 mb-1">Category name</div>
            <Input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="e.g. Soft Drinks" />
          </div>
        </div>
      </Modal>
    </div>
  );
}

const STAFF_ROLES = [
  { value: "cashier", label: "Cashier" },
  { value: "kitchen", label: "Kitchen" },
  { value: "manager", label: "Manager" },
];

function StaffPanel({ staff, emit }) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [staffRole, setStaffRole] = useState("cashier");
  const [err, setErr] = useState("");

  async function create() {
    setErr("");
    const resp = await emit("staff:create", { username, password, role: staffRole });
    if (!resp.ok) { setErr(resp.error || "Failed"); return; }
    setUsername(""); setPassword(""); setStaffRole("cashier");
    setOpen(false);
  }

  async function setStatus(id, status) {
    await emit("staff:setStatus", { id, status });
  }

  async function setRole(id, role) {
    await emit("staff:setRole", { id, role });
  }

  async function del(id) {
    await emit("staff:delete", { id });
  }

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-6">
      <Card>
        <CardHeader title="Staff Accounts" subtitle="Create, pause, activate, delete. Roles control Cashier/Kitchen access." right={<Button onClick={() => setOpen(true)}>Add Staff</Button>} />
        <CardBody className="space-y-3">
          {staff.length === 0 ? (
            <div className="text-neutral-400">No staff yet. Create one to use Cashier/Kitchen.</div>
          ) : (
            staff.map(s => (
              <div key={s.id} className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-4 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-semibold">{s.username}</div>
                  <div className="text-xs text-neutral-500">ID: {s.id}</div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={s.status === "active" ? "green" : "red"}>{s.status === "active" ? "Active" : "Paused"}</Badge>
                  <Badge variant="neutral">{(s.role || "cashier").charAt(0).toUpperCase() + (s.role || "cashier").slice(1)}</Badge>
                  <Select value={s.role || "cashier"} onChange={(e) => setRole(s.id, e.target.value)} className="w-28">
                    {STAFF_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </Select>
                  {s.status !== "active" ? (
                    <Button variant="subtle" onClick={() => setStatus(s.id, "active")}>Activate</Button>
                  ) : (
                    <Button variant="ghost" onClick={() => setStatus(s.id, "paused")}>Pause</Button>
                  )}
                  <Button variant="danger" onClick={() => del(s.id)}>Delete</Button>
                </div>
              </div>
            ))
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Create Staff" subtitle="Credentials are stored securely (hashed)." />
        <CardBody className="space-y-3">
          <Button onClick={() => setOpen(true)} className="w-full">Add Staff Account</Button>
          <div className="text-xs text-neutral-500">
            Tip: keep usernames simple. Staff only log in once per session.
          </div>
        </CardBody>
      </Card>

      <Modal
        open={open}
        title="Add Staff Account"
        onClose={() => setOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create}>Create</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <div className="text-sm text-neutral-300 mb-1">Username</div>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div>
            <div className="text-sm text-neutral-300 mb-1">Password</div>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div>
            <div className="text-sm text-neutral-300 mb-1">Role</div>
            <Select value={staffRole} onChange={(e) => setStaffRole(e.target.value)}>
              {STAFF_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </Select>
          </div>
          {err && <div className="text-sm text-red-300">{err}</div>}
        </div>
      </Modal>
    </div>
  );
}

function InventoryPanel({ snapshot, emit }) {
  const inventory = snapshot?.inventory || [];
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [quantity, setQuantity] = useState("0");
  const [unit, setUnit] = useState("pcs");
  const [minThreshold, setMinThreshold] = useState("10");
  const [costPrice, setCostPrice] = useState("");
  const [supplier, setSupplier] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState("");

  const lowStock = inventory.filter(i => i.quantity <= i.minThreshold && i.quantity > 0);
  const outOfStock = inventory.filter(i => i.quantity === 0);
  const totalValue = inventory.reduce((sum, i) => sum + (i.quantity * (i.costPrice || 0)), 0);

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = !search || 
      item.name?.toLowerCase().includes(search.toLowerCase()) ||
      item.sku?.toLowerCase().includes(search.toLowerCase());
    
    if (filterStatus === "all") return matchesSearch;
    if (filterStatus === "low") return matchesSearch && item.quantity <= item.minThreshold && item.quantity > 0;
    if (filterStatus === "out") return matchesSearch && item.quantity === 0;
    if (filterStatus === "ok") return matchesSearch && item.quantity > item.minThreshold;
    return matchesSearch;
  });

  function openCreateItem() {
    setEditItem(null);
    setName("");
    setSku("");
    setQuantity("0");
    setUnit("pcs");
    setMinThreshold("10");
    setCostPrice("");
    setSupplier("");
    setLocation("");
    setNotes("");
    setErr("");
    setModalOpen(true);
  }

  function openEditItem(item) {
    setEditItem(item);
    setName(item.name);
    setSku(item.sku || "");
    setQuantity(String(item.quantity));
    setUnit(item.unit || "pcs");
    setMinThreshold(String(item.minThreshold || 10));
    setCostPrice(item.costPrice ? String(item.costPrice) : "");
    setSupplier(item.supplier || "");
    setLocation(item.location || "");
    setNotes(item.notes || "");
    setErr("");
    setModalOpen(true);
  }

  async function createItem() {
    setErr("");
    const q = Number(quantity);
    const min = Number(minThreshold);
    const costPriceNum = costPrice ? Number(costPrice) : 0;
    
    if (!name.trim()) { setErr("Name is required"); return; }
    if (isNaN(q) || q < 0) { setErr("Quantity must be a positive number"); return; }
    if (isNaN(min) || min < 0) { setErr("Min threshold must be a positive number"); return; }
    
    const resp = await emit("inventory:create", {
      name: name.trim(),
      sku: sku.trim() || null,
      quantity: q,
      unit: unit.trim() || "pcs",
      minThreshold: min,
      costPrice: costPriceNum,
      supplier: supplier.trim() || null,
      location: location.trim() || null,
      notes: notes.trim() || null
    });
    
    if (!resp.ok) { setErr(resp.error || "Failed"); return; }
    setModalOpen(false);
  }

  async function updateItem() {
    setErr("");
    const q = Number(quantity);
    const min = Number(minThreshold);
    const costPriceNum = costPrice ? Number(costPrice) : 0;
    
    if (!name.trim()) { setErr("Name is required"); return; }
    if (isNaN(q) || q < 0) { setErr("Quantity must be a positive number"); return; }
    if (isNaN(min) || min < 0) { setErr("Min threshold must be a positive number"); return; }
    
    const resp = await emit("inventory:update", {
      id: editItem.id,
      name: name.trim(),
      sku: sku.trim() || null,
      quantity: q,
      unit: unit.trim() || "pcs",
      minThreshold: min,
      costPrice: costPriceNum,
      supplier: supplier.trim() || null,
      location: location.trim() || null,
      notes: notes.trim() || null
    });
    
    if (!resp.ok) { setErr(resp.error || "Failed"); return; }
    setModalOpen(false);
  }

  async function deleteItem(id) {
    if (!confirm("Delete this inventory item?")) return;
    await emit("inventory:delete", { id });
  }

  async function archiveItem(id) {
    await emit("inventory:archive", { id });
  }

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-4 gap-4">
        <Card>
          <CardBody className="p-4">
            <div className="text-xs text-neutral-400">Total Items</div>
            <div className="text-2xl font-semibold">{inventory.length}</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <div className="text-xs text-neutral-400">Low Stock</div>
            <div className="text-2xl font-semibold text-yellow-400">{lowStock.length}</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <div className="text-xs text-neutral-400">Out of Stock</div>
            <div className="text-2xl font-semibold text-red-400">{outOfStock.length}</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <div className="text-xs text-neutral-400">Total Value</div>
            <div className="text-2xl font-semibold">{fmtAED(totalValue)}</div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader 
          title="Inventory Items" 
          subtitle="Manage stock levels and suppliers"
          right={
            <div className="flex gap-2">
              <Input 
                placeholder="Search..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                className="w-40"
              />
              <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-32">
                <option value="all">All</option>
                <option value="ok">OK</option>
                <option value="low">Low Stock</option>
                <option value="out">Out of Stock</option>
              </Select>
              <Button onClick={openCreateItem}>Add Item</Button>
            </div>
          }
        />
        <CardBody>
          {filteredInventory.length === 0 ? (
            <div className="text-neutral-400">No inventory items found.</div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredInventory.map(item => {
                const isLow = item.quantity <= item.minThreshold && item.quantity > 0;
                const isOut = item.quantity === 0;
                return (
                  <div key={item.id} className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-4 flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{item.name}</span>
                        {item.sku && <span className="text-xs text-neutral-500">({item.sku})</span>}
                        {isOut ? (
                          <Badge variant="red">Out of Stock</Badge>
                        ) : isLow ? (
                          <Badge variant="yellow">Low Stock</Badge>
                        ) : (
                          <Badge variant="green">OK</Badge>
                        )}
                      </div>
                      <div className="text-xs text-neutral-500 mt-1">
                        Qty: {item.quantity} {item.unit} • Min: {item.minThreshold} • 
                        Cost: {item.costPrice ? fmtAED(item.costPrice) : "—"} • 
                        Total: {item.costPrice ? fmtAED(item.quantity * item.costPrice) : "—"}
                        {item.supplier && ` • ${item.supplier}`}
                        {item.location && ` • ${item.location}`}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="subtle" onClick={() => openEditItem(item)}>Edit</Button>
                      <Button variant="ghost" onClick={() => archiveItem(item.id)}>Archive</Button>
                      <Button variant="danger" onClick={() => deleteItem(item.id)}>Delete</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      <Modal
        open={modalOpen}
        title={editItem ? "Edit Inventory Item" : "Add Inventory Item"}
        onClose={() => setModalOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={editItem ? updateItem : createItem}>{editItem ? "Save" : "Create"}</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <div className="text-sm text-neutral-300 mb-1">Name *</div>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Coffee Beans" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-sm text-neutral-300 mb-1">SKU</div>
              <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Optional code" />
            </div>
            <div>
              <div className="text-sm text-neutral-300 mb-1">Unit</div>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="pcs, kg, L" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-sm text-neutral-300 mb-1">Quantity *</div>
              <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div>
              <div className="text-sm text-neutral-300 mb-1">Min Threshold *</div>
              <Input type="number" value={minThreshold} onChange={(e) => setMinThreshold(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-sm text-neutral-300 mb-1">Cost per Unit</div>
              <Input type="number" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <div className="text-sm text-neutral-300 mb-1">Location</div>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Storage area" />
            </div>
          </div>
          <div>
            <div className="text-sm text-neutral-300 mb-1">Supplier</div>
            <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Supplier name" />
          </div>
          <div>
            <div className="text-sm text-neutral-300 mb-1">Notes</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
              className="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-white/20 min-h-[60px] resize-y"
            />
          </div>
          {err && <div className="text-sm text-red-300">{err}</div>}
        </div>
      </Modal>
    </div>
  );
}

function CustomersPanel({ snapshot, emit }) {
  const customers = snapshot?.customers || [];
  const [search, setSearch] = useState("");
  const [filterOptIn, setFilterOptIn] = useState(false);

  const filtered = customers.filter(c => {
    const matchesSearch = !search || 
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search) ||
      c.email?.toLowerCase().includes(search.toLowerCase());
    const matchesOptIn = !filterOptIn || c.marketingOptIn;
    return matchesSearch && matchesOptIn;
  });

  async function exportCustomers() {
    const headers = ["Name", "Phone", "Email", "Marketing Opt-In", "Orders", "Total Spent", "Created"];
    const rows = customers.map(c => [
      c.name || "",
      c.phone || "",
      c.email || "",
      c.marketingOptIn ? "Yes" : "No",
      c.orderCount || 0,
      c.totalSpent || 0,
      c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ""
    ]);
    
    const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n");
    
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customers-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardHeader 
        title="Customers" 
        subtitle={`${customers.length} total customers`}
        right={
          <div className="flex gap-2">
            <Input 
              placeholder="Search..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              className="w-48"
            />
            <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
              <input 
                type="checkbox" 
                checked={filterOptIn} 
                onChange={(e) => setFilterOptIn(e.target.checked)}
                className="rounded border-neutral-700 bg-neutral-900"
              />
              Opt-in only
            </label>
            <Button variant="subtle" onClick={exportCustomers}>Export CSV</Button>
          </div>
        }
      />
      <CardBody>
        {filtered.length === 0 ? (
          <div className="text-neutral-400">No customers found.</div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filtered.map(c => (
              <div key={c.id} className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-4 flex items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{c.name || "Unnamed"}</span>
                    {c.marketingOptIn && <Badge variant="blue">Marketing</Badge>}
                    {c.loyaltyPoints > 0 && <Badge variant="green">{c.loyaltyPoints} pts</Badge>}
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">
                    {c.phone && `📞 ${c.phone}`}
                    {c.email && ` ✉️ ${c.email}`}
                    {c.orderCount > 0 && ` • ${c.orderCount} orders`}
                    {c.totalSpent > 0 && ` • ${fmtAED(c.totalSpent)} spent`}
                  </div>
                </div>
                <div className="text-xs text-neutral-500">
                  {c.createdAt && new Date(c.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function PromosPanel({ promos, emit }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [code, setCode] = useState("");
  const [type, setType] = useState("percentage");
  const [value, setValue] = useState("10");
  const [maxDiscount, setMaxDiscount] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [err, setErr] = useState("");

  async function create() {
    setErr("");
    const val = Number(value);
    const maxDisc = maxDiscount ? Number(maxDiscount) : null;
    if (!code.trim()) { setErr("Code is required"); return; }
    if (isNaN(val) || val <= 0) { setErr("Value must be positive"); return; }
    if (maxDisc !== null && (isNaN(maxDisc) || maxDisc <= 0)) { setErr("Max discount must be positive"); return; }
    
    const resp = await emit("promo:create", {
      code: code.trim().toUpperCase(),
      type,
      value: val,
      maxDiscount: maxDisc,
      expiryDate: expiryDate || null,
      maxUses: maxUses ? Number(maxUses) : null
    });
    
    if (!resp.ok) { setErr(resp.error || "Failed"); return; }
    
    setCode("");
    setType("percentage");
    setValue("10");
    setMaxDiscount("");
    setExpiryDate("");
    setMaxUses("");
    setModalOpen(false);
  }

  async function togglePromo(id, isActive) {
    await emit("promo:update", { id, isActive: !isActive });
  }

  async function deletePromo(id) {
    await emit("promo:delete", { id });
  }

  const activePromos = promos.filter(p => p.isActive);
  const inactivePromos = promos.filter(p => !p.isActive);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader 
          title="Promo Codes" 
          subtitle="Create discount codes for customers"
          right={<Button onClick={() => setModalOpen(true)}>Add Promo</Button>}
        />
        <CardBody className="space-y-4">
          {promos.length === 0 ? (
            <div className="text-neutral-400">No promo codes yet.</div>
          ) : (
            <>
              {activePromos.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-neutral-300 mb-2">Active Promos</div>
                  <div className="space-y-2">
                    {activePromos.map(p => (
                      <PromoRow 
                        key={p.id} 
                        promo={p} 
                        onToggle={() => togglePromo(p.id, p.isActive)}
                        onDelete={() => deletePromo(p.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
              
              {inactivePromos.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-neutral-500 mb-2">Inactive Promos</div>
                  <div className="space-y-2 opacity-60">
                    {inactivePromos.map(p => (
                      <PromoRow 
                        key={p.id} 
                        promo={p} 
                        onToggle={() => togglePromo(p.id, p.isActive)}
                        onDelete={() => deletePromo(p.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </CardBody>
      </Card>

      <Modal
        open={modalOpen}
        title="Add Promo Code"
        onClose={() => setModalOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={create}>Create</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <div className="text-sm text-neutral-300 mb-1">Code</div>
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="SUMMER20" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-sm text-neutral-300 mb-1">Type</div>
              <Select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount</option>
              </Select>
            </div>
            <div>
              <div className="text-sm text-neutral-300 mb-1">Value</div>
              <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={type === "percentage" ? "20" : "50"} />
            </div>
          </div>
          <div>
            <div className="text-sm text-neutral-300 mb-1">Max Discount (optional)</div>
            <Input type="number" value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value)} placeholder="e.g. 100 for percentage cap" />
            <div className="text-xs text-neutral-500 mt-1">
              Maximum discount amount for percentage promos
            </div>
          </div>
          <div>
            <div className="text-sm text-neutral-300 mb-1">Expiry Date (optional)</div>
            <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
          </div>
          <div>
            <div className="text-sm text-neutral-300 mb-1">Max Uses (optional)</div>
            <Input type="number" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="Unlimited" />
          </div>
          {err && <div className="text-sm text-red-300">{err}</div>}
        </div>
      </Modal>
    </div>
  );
}

function PromoRow({ promo, onToggle, onDelete }) {
  const isExpired = promo.expiryDate && new Date(promo.expiryDate) < new Date();
  const isMaxed = promo.maxUses && promo.uses >= promo.maxUses;
  
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-4 flex items-center justify-between gap-3">
      <div>
        <div className="font-semibold flex items-center gap-2">
          {promo.code}
          {promo.type === "percentage" ? (
            <Badge variant="blue">{promo.value}% OFF</Badge>
          ) : (
            <Badge variant="green">{fmtAED(promo.value)} OFF</Badge>
          )}
          {promo.maxDiscount && <Badge variant="yellow">Max {fmtAED(promo.maxDiscount)}</Badge>}
        </div>
        <div className="text-xs text-neutral-500">
          Used: {promo.uses}{promo.maxUses ? ` / ${promo.maxUses}` : ""}
          {promo.expiryDate && ` • Expires: ${new Date(promo.expiryDate).toLocaleDateString()}`}
          {isExpired && <span className="text-red-400 ml-2">EXPIRED</span>}
          {isMaxed && <span className="text-red-400 ml-2">MAXED</span>}
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="subtle" onClick={onToggle}>{promo.isActive ? "Disable" : "Enable"}</Button>
        <Button variant="danger" onClick={onDelete}>Delete</Button>
      </div>
    </div>
  );
}

function SettingsPanel({ settings, emit }) {
  const [tax, setTax] = useState(String(settings.taxPercent || 0));
  const [svc, setSvc] = useState(String(settings.serviceChargePercent || 0));
  const [currency, setCurrency] = useState(settings.currency || "AED");
  const [msg, setMsg] = useState("");

  async function save() {
    setMsg("");
    const taxPercent = Number(tax);
    const serviceChargePercent = Number(svc);
    const resp = await emit("settings:update", { taxPercent, serviceChargePercent, currency });
    setMsg(resp.ok ? "Saved. All devices updated in real time." : (resp.error || "Failed"));
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader title="Pricing Settings" subtitle="Applies instantly across all devices." right={<Badge variant="yellow">{currency || "AED"}</Badge>} />
        <CardBody className="space-y-3">
          <div>
            <div className="text-sm text-neutral-300 mb-1">Tax %</div>
            <Input value={tax} onChange={(e) => setTax(e.target.value)} />
          </div>
          <div>
            <div className="text-sm text-neutral-300 mb-1">Service charge %</div>
            <Input value={svc} onChange={(e) => setSvc(e.target.value)} />
          </div>
          <div>
            <div className="text-sm text-neutral-300 mb-1">Currency</div>
            <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option value="AED">AED - UAE Dirham</option>
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
              <option value="THB">THB - Thai Baht</option>
              <option value="SGD">SGD - Singapore Dollar</option>
            </Select>
          </div>
          <Button onClick={save}>Save</Button>
          {msg && <div className={`text-sm ${msg.startsWith("Saved") ? "text-emerald-300" : "text-red-300"}`}>{msg}</div>}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Notes" subtitle="How totals are calculated." />
        <CardBody className="text-sm text-neutral-300 space-y-2">
          <div>• Subtotal = sum(item price × qty)</div>
          <div>• Discount applied before tax</div>
          <div>• Tax = (subtotal - discount) × tax%</div>
          <div>• Service charge = (subtotal - discount) × service%</div>
          <div>• Total = subtotal - discount + tax + service</div>
          <div className="text-xs text-neutral-500 mt-4">A single canonical calculation function is used across the app to avoid mismatches.</div>
        </CardBody>
      </Card>
    </div>
  );
}

function MetricsPanel({ snapshot, emit }) {
  const revenue = snapshot?.revenue?.total || 0;
  const adjustments = snapshot?.revenue?.adjustments || [];
  const orders = snapshot?.orders || [];
  const [reportData, setReportData] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  const [resetOpen, setResetOpen] = useState(false);
  const [adjOpen, setAdjOpen] = useState(false);
  const [amount, setAmount] = useState("0");
  const [reason, setReason] = useState("");
  const [csvMsg, setCsvMsg] = useState("");

  // Load detailed metrics
  React.useEffect(() => {
    emit("report:metrics", dateRange).then(resp => {
      if (resp.ok) setReportData(resp.metrics);
    });
  }, [emit, dateRange, snapshot]);

  async function resetRevenue() {
    await emit("revenue:reset", {});
    setResetOpen(false);
  }

  async function addAdjustment() {
    await emit("revenue:adjust", { amount: Number(amount), reason });
    setAdjOpen(false);
    setAmount("0"); setReason("");
  }

  async function exportOrdersCSV() {
    setCsvMsg("");
    const resp = await emit("report:exportCSV", dateRange);
    if (!resp.ok) { setCsvMsg(resp.error || "Export failed"); return; }
    downloadCSV(resp.csv, `orders-${new Date().toISOString().split('T')[0]}`);
    setCsvMsg("Orders CSV downloaded.");
  }

  async function exportCustomersCSV() {
    setCsvMsg("");
    const resp = await emit("export:customers", {});
    if (!resp.ok) { setCsvMsg(resp.error || "Export failed"); return; }
    downloadCSV(resp.csv, `customers-${new Date().toISOString().split('T')[0]}`);
    setCsvMsg("Customers CSV downloaded.");
  }

  async function exportStaffPerformanceCSV() {
    setCsvMsg("");
    const resp = await emit("export:staffPerformance", dateRange);
    if (!resp.ok) { setCsvMsg(resp.error || "Export failed"); return; }
    downloadCSV(resp.csv, `staff-performance-${new Date().toISOString().split('T')[0]}`);
    setCsvMsg("Staff Performance CSV downloaded.");
  }

  async function exportPromoUsageCSV() {
    setCsvMsg("");
    const resp = await emit("export:promoUsage", dateRange);
    if (!resp.ok) { setCsvMsg(resp.error || "Export failed"); return; }
    downloadCSV(resp.csv, `promo-usage-${new Date().toISOString().split('T')[0]}`);
    setCsvMsg("Promo Usage CSV downloaded.");
  }

  function downloadCSV(csvContent, filename) {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const doneOrders = orders.filter(o => o.status === "done");
  const avgPrep = reportData?.avgPrepTime || 0;

  // Calculate derived metrics
  const totalOrders = orders.length;
  const totalRevenue = revenue;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const activeCustomers = new Set(orders.map(o => o.customerPhone).filter(Boolean)).size;
  const optInRate = totalOrders > 0 
    ? Math.round((orders.filter(o => o.customerPhone).length / totalOrders) * 100) 
    : 0;

  // Prepare chart data
  const dailyRevenue = Object.entries(reportData?.dailyRevenue || {})
    .slice(-7)
    .map(([date, amount]) => ({ date: date.slice(5), amount }));

  const weeklyRevenue = Object.entries(reportData?.weeklyRevenue || {})
    .slice(-4)
    .map(([week, amount]) => ({ week: `W${week.slice(-2)}`, amount }));

  const monthlyRevenue = Object.entries(reportData?.monthlyRevenue || {})
    .slice(-6)
    .map(([month, amount]) => ({ month: month.slice(5), amount }));

  const paymentData = reportData?.paymentMethods || {};
  const paymentChartData = Object.entries(paymentData).map(([method, amount]) => ({
    label: method.charAt(0).toUpperCase() + method.slice(1),
    value: amount,
    percent: totalRevenue > 0 ? (amount / totalRevenue) * 100 : 0
  }));

  const staffPerfData = reportData?.staffPerformance 
    ? Object.values(reportData.staffPerformance)
    : [];

  // Orders by hour (0-23)
  const ordersByHour = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    count: orders.filter(o => {
      const h = new Date(o.createdAt).getHours();
      return h === i;
    }).length
  }));

  const maxOrdersByHour = Math.max(...ordersByHour.map(o => o.count), 1);

  // Order status breakdown
  const statusData = [
    { label: "New", value: orders.filter(o => o.status === "new").length, color: "bg-yellow-500" },
    { label: "Preparing", value: orders.filter(o => o.status === "preparing").length, color: "bg-blue-500" },
    { label: "Done", value: doneOrders.length, color: "bg-green-500" }
  ];

  // Customer data
  const customerPhones = orders.map(o => o.customerPhone).filter(Boolean);
  const returningCustomers = new Set(customerPhones).size;
  const newCustomers = customerPhones.length - returningCustomers;

  // Promo data
  const promoData = snapshot?.promos || [];
  const activePromos = promoData.filter(p => p.isActive);
  const promoUsageData = promoData
    .filter(p => p.uses > 0)
    .sort((a, b) => b.uses - a.uses)
    .slice(0, 10);

  const tabs = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "revenue", label: "Revenue", icon: "💰" },
    { id: "orders", label: "Orders", icon: "📦" },
    { id: "customers", label: "Customers", icon: "👥" },
    { id: "promos", label: "Promos", icon: "🎟️" }
  ];

  return (
    <div className="space-y-6">
      {/* Date Range Filter */}
      <Card>
        <CardBody>
          <div className="flex flex-wrap items-center gap-4">
            <div className="text-sm text-neutral-300 font-medium">Date Range:</div>
            <Input 
              type="date" 
              value={dateRange.start} 
              onChange={(e) => setDateRange(r => ({ ...r, start: e.target.value }))}
              className="w-40"
            />
            <span className="text-neutral-500">to</span>
            <Input 
              type="date" 
              value={dateRange.end} 
              onChange={(e) => setDateRange(r => ({ ...r, end: e.target.value }))}
              className="w-40"
            />
            <Button 
              variant="ghost" 
              onClick={() => setDateRange({ start: "", end: "" })}
              className="text-sm"
            >
              Clear
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl border transition flex items-center gap-2 ${
              activeTab === tab.id 
                ? "bg-white text-neutral-900 border-white" 
                : "bg-neutral-950 border-neutral-800 text-neutral-200 hover:bg-neutral-900"
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <StatsCard title="Total Revenue" value={fmtAED(totalRevenue)} icon="💰" trend="+12%" />
            <StatsCard title="Total Orders" value={totalOrders} icon="📦" trend="+8%" />
            <StatsCard title="Avg Order Value" value={fmtAED(avgOrderValue)} icon="📊" />
            <StatsCard 
              title="Avg Prep Time" 
              value={avgPrep > 0 ? `${Math.floor(avgPrep / 60)}m ${avgPrep % 60}s` : "—"} 
              icon="⏱️" 
            />
            <StatsCard title="Active Customers" value={activeCustomers} icon="👥" />
            <StatsCard title="Opt-in Rate" value={`${optInRate}%`} icon="📱" />
          </div>

          {/* Quick Charts Row */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader title="Revenue Trend (Last 7 Days)" subtitle="Daily revenue performance" />
              <CardBody>
                {dailyRevenue.length > 0 ? (
                  <div className="space-y-2">
                    {dailyRevenue.map((d, i) => {
                      const max = Math.max(...dailyRevenue.map(x => x.amount), 1);
                      const pct = (d.amount / max) * 100;
                      return (
                        <div key={i} className="flex items-center gap-3 text-sm">
                          <span className="w-12 text-neutral-400">{d.date}</span>
                          <div className="flex-1 h-6 bg-neutral-800 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-emerald-500 rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-20 text-right font-medium">{fmtAED(d.amount)}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-neutral-400">No data available</div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Payment Methods" subtitle="Revenue distribution" />
              <CardBody>
                {paymentChartData.length > 0 ? (
                  <div className="space-y-3">
                    {paymentChartData.map((p, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-300">{p.label}</span>
                          <span className="font-medium">{fmtAED(p.value)} ({Math.round(p.percent)}%)</span>
                        </div>
                        <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              i === 0 ? "bg-emerald-500" : i === 1 ? "bg-blue-500" : "bg-purple-500"
                            }`}
                            style={{ width: `${p.percent}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-neutral-400">No payment data yet.</div>
                )}
              </CardBody>
            </Card>
          </div>

          {/* Staff Performance Preview */}
          <Card>
            <CardHeader title="Top Staff Performance" subtitle="Orders & revenue by staff" />
            <CardBody>
              {staffPerfData.length > 0 ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {staffPerfData.slice(0, 4).map((perf, i) => (
                    <div key={perf.username} className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center text-sm">
                          {perf.username.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium">{perf.username}</span>
                      </div>
                      <div className="text-2xl font-semibold text-emerald-400">{fmtAED(perf.totalRevenue)}</div>
                      <div className="text-sm text-neutral-400">
                        {perf.ordersCreated} orders • Avg {perf.avgPrepTime > 0 ? `${Math.floor(perf.avgPrepTime / 60)}m` : "—"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-neutral-400">No staff data yet.</div>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {/* Revenue Tab */}
      {activeTab === "revenue" && (
        <div className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Revenue by Day */}
            <Card>
              <CardHeader title="Revenue by Day" subtitle="Last 7 days" />
              <CardBody>
                {dailyRevenue.length > 0 ? (
                  <div className="space-y-2">
                    {dailyRevenue.map((d, i) => {
                      const max = Math.max(...dailyRevenue.map(x => x.amount), 1);
                      const pct = (d.amount / max) * 100;
                      return (
                        <div key={i} className="flex items-center gap-3 text-sm">
                          <span className="w-12 text-neutral-400">{d.date}</span>
                          <div className="flex-1 h-6 bg-neutral-800 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-20 text-right font-medium">{fmtAED(d.amount)}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-neutral-400">No data available</div>
                )}
              </CardBody>
            </Card>

            {/* Revenue by Week */}
            <Card>
              <CardHeader title="Revenue by Week" subtitle="Last 4 weeks" />
              <CardBody>
                {weeklyRevenue.length > 0 ? (
                  <div className="space-y-2">
                    {weeklyRevenue.map((w, i) => {
                      const max = Math.max(...weeklyRevenue.map(x => x.amount), 1);
                      const pct = (w.amount / max) * 100;
                      return (
                        <div key={i} className="flex items-center gap-3 text-sm">
                          <span className="w-12 text-neutral-400">{w.week}</span>
                          <div className="flex-1 h-6 bg-neutral-800 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-20 text-right font-medium">{fmtAED(w.amount)}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-neutral-400">No data available</div>
                )}
              </CardBody>
            </Card>

            {/* Revenue by Month */}
            <Card>
              <CardHeader title="Revenue by Month" subtitle="Last 6 months" />
              <CardBody>
                {monthlyRevenue.length > 0 ? (
                  <div className="space-y-2">
                    {monthlyRevenue.map((m, i) => {
                      const max = Math.max(...monthlyRevenue.map(x => x.amount), 1);
                      const pct = (m.amount / max) * 100;
                      return (
                        <div key={i} className="flex items-center gap-3 text-sm">
                          <span className="w-12 text-neutral-400">{m.month}</span>
                          <div className="flex-1 h-6 bg-neutral-800 rounded-full overflow-hidden">
                            <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-20 text-right font-medium">{fmtAED(m.amount)}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-neutral-400">No data available</div>
                )}
              </CardBody>
            </Card>

            {/* Revenue by Staff */}
            <Card>
              <CardHeader title="Revenue by Staff" subtitle="Total revenue per staff member" />
              <CardBody>
                {staffPerfData.length > 0 ? (
                  <div className="space-y-2">
                    {staffPerfData.sort((a, b) => b.totalRevenue - a.totalRevenue).map((perf, i) => {
                      const max = Math.max(...staffPerfData.map(x => x.totalRevenue), 1);
                      const pct = (perf.totalRevenue / max) * 100;
                      return (
                        <div key={perf.username} className="flex items-center gap-3 text-sm">
                          <span className="w-24 text-neutral-400 truncate">{perf.username}</span>
                          <div className="flex-1 h-6 bg-neutral-800 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-20 text-right font-medium">{fmtAED(perf.totalRevenue)}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-neutral-400">No staff data yet.</div>
                )}
              </CardBody>
            </Card>

            {/* Revenue by Category (Pie) */}
            <Card>
              <CardHeader title="Revenue by Category" subtitle="Distribution by menu category" />
              <CardBody>
                {reportData?.categoryRevenue && Object.keys(reportData.categoryRevenue).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(reportData.categoryRevenue)
                      .sort(([, a], [, b]) => b - a)
                      .map(([category, amount], i) => {
                        const total = Object.values(reportData.categoryRevenue).reduce((a, b) => a + b, 0);
                        const pct = (amount / total) * 100;
                        const colors = ["bg-emerald-500", "bg-blue-500", "bg-purple-500", "bg-orange-500", "bg-pink-500"];
                        return (
                          <div key={category} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-neutral-300">{category}</span>
                              <span className="font-medium">{fmtAED(amount)} ({Math.round(pct)}%)</span>
                            </div>
                            <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${colors[i % colors.length]}`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="text-neutral-400">No category data yet.</div>
                )}
              </CardBody>
            </Card>

            {/* Payment Methods (Pie) */}
            <Card>
              <CardHeader title="Payment Methods" subtitle="Revenue by payment type" />
              <CardBody>
                {paymentChartData.length > 0 ? (
                  <div className="space-y-3">
                    {paymentChartData.map((p, i) => (
                      <div key={p.label} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-300 flex items-center gap-2">
                            {p.label === "Cash" ? "💵" : p.label === "Card" ? "💳" : "📝"} {p.label}
                          </span>
                          <span className="font-medium">{fmtAED(p.value)} ({Math.round(p.percent)}%)</span>
                        </div>
                        <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              i === 0 ? "bg-green-500" : i === 1 ? "bg-blue-500" : "bg-yellow-500"
                            }`}
                            style={{ width: `${p.percent}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-neutral-400">No payment data yet.</div>
                )}
              </CardBody>
            </Card>
          </div>

          {/* Hourly Revenue Heatmap */}
          <Card>
            <CardHeader title="Hourly Revenue Distribution" subtitle="Revenue by hour of day" />
            <CardBody>
              <div className="grid grid-cols-12 gap-1">
                {ordersByHour.map(h => {
                  const hourRevenue = orders
                    .filter(o => new Date(o.createdAt).getHours() === h.hour)
                    .reduce((sum, o) => sum + (o.total || 0), 0);
                  const maxRevenue = Math.max(
                    ...ordersByHour.map(h2 => 
                      orders.filter(o => new Date(o.createdAt).getHours() === h2.hour)
                        .reduce((sum, o) => sum + (o.total || 0), 0)
                    ),
                    1
                  );
                  const intensity = maxRevenue > 0 ? hourRevenue / maxRevenue : 0;
                  return (
                    <div 
                      key={h.hour}
                      className="aspect-square rounded flex items-center justify-center text-xs"
                      style={{ 
                        backgroundColor: `rgba(16, 185, 129, ${0.1 + intensity * 0.9})`,
                        color: intensity > 0.5 ? "white" : "#9ca3af"
                      }}
                      title={`${h.hour}:00 - ${fmtAED(hourRevenue)}`}
                    >
                      {h.hour}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 mt-3 text-xs text-neutral-400">
                <span>Less</span>
                <div className="flex gap-1">
                  {[0.1, 0.3, 0.5, 0.7, 0.9].map(i => (
                    <div 
                      key={i}
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: `rgba(16, 185, 129, ${i})` }}
                    />
                  ))}
                </div>
                <span>More</span>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Orders Tab */}
      {activeTab === "orders" && (
        <div className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Orders Per Hour */}
            <Card>
              <CardHeader title="Orders Per Hour" subtitle="Order volume by time of day" />
              <CardBody>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {ordersByHour.filter(h => h.count > 0).length > 0 ? (
                    ordersByHour.map(h => {
                      const pct = (h.count / maxOrdersByHour) * 100;
                      return (
                        <div key={h.hour} className="flex items-center gap-3 text-sm">
                          <span className="w-12 text-neutral-400">{h.hour}:00</span>
                          <div className="flex-1 h-5 bg-neutral-800 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-10 text-right font-medium">{h.count}</span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-neutral-400">No order data yet.</div>
                  )}
                </div>
              </CardBody>
            </Card>

            {/* Order Status Breakdown */}
            <Card>
              <CardHeader title="Order Status Breakdown" subtitle="Distribution by status" />
              <CardBody>
                <div className="space-y-3">
                  {statusData.map((s, i) => {
                    const total = statusData.reduce((a, b) => a + b.value, 0);
                    const pct = total > 0 ? (s.value / total) * 100 : 0;
                    return (
                      <div key={s.label} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-300 flex items-center gap-2">
                            <span className={`w-3 h-3 rounded-full ${s.color}`} />
                            {s.label}
                          </span>
                          <span className="font-medium">{s.value} ({Math.round(pct)}%)</span>
                        </div>
                        <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${s.color}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Peak Hours Heatmap */}
          <Card>
            <CardHeader title="Peak Hours Heatmap" subtitle="Order volume intensity by hour" />
            <CardBody>
              <div className="grid grid-cols-12 gap-2">
                {ordersByHour.map(h => {
                  const intensity = maxOrdersByHour > 0 ? h.count / maxOrdersByHour : 0;
                  return (
                    <div key={h.hour} className="text-center">
                      <div 
                        className="aspect-square rounded-lg flex items-center justify-center text-sm font-medium"
                        style={{ 
                          backgroundColor: `rgba(59, 130, 246, ${0.1 + intensity * 0.9})`,
                          color: intensity > 0.5 ? "white" : "#9ca3af"
                        }}
                        title={`${h.hour}:00 - ${h.count} orders`}
                      >
                        {h.count}
                      </div>
                      <div className="text-xs text-neutral-500 mt-1">{h.hour}:00</div>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>

          {/* Prep Time Stats */}
          <Card>
            <CardHeader title="Preparation Time Statistics" subtitle="Order preparation metrics" />
            <CardBody>
              <div className="grid sm:grid-cols-4 gap-4">
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-4 text-center">
                  <div className="text-xs text-neutral-400 mb-1">Minimum</div>
                  <div className="text-xl font-semibold text-emerald-400">
                    {reportData?.minPrepTime ? `${Math.floor(reportData.minPrepTime / 60)}m` : "—"}
                  </div>
                </div>
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-4 text-center">
                  <div className="text-xs text-neutral-400 mb-1">Maximum</div>
                  <div className="text-xl font-semibold text-red-400">
                    {reportData?.maxPrepTime ? `${Math.floor(reportData.maxPrepTime / 60)}m` : "—"}
                  </div>
                </div>
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-4 text-center">
                  <div className="text-xs text-neutral-400 mb-1">Average</div>
                  <div className="text-xl font-semibold text-blue-400">
                    {avgPrep > 0 ? `${Math.floor(avgPrep / 60)}m ${avgPrep % 60}s` : "—"}
                  </div>
                </div>
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-4 text-center">
                  <div className="text-xs text-neutral-400 mb-1">Completion Rate</div>
                  <div className="text-xl font-semibold text-purple-400">
                    {orders.length > 0 ? Math.round((doneOrders.length / orders.length) * 100) : 0}%
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Customers Tab */}
      {activeTab === "customers" && (
        <div className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* New vs Returning */}
            <Card>
              <CardHeader title="New vs Returning Customers" subtitle="Customer type distribution" />
              <CardBody>
                {customerPhones.length > 0 ? (
                  <div className="space-y-3">
                    {[
                      { label: "Returning Customers", value: returningCustomers, color: "bg-blue-500" },
                      { label: "One-time Customers", value: Math.max(0, newCustomers), color: "bg-neutral-500" }
                    ].map((c, i) => {
                      const total = customerPhones.length;
                      const pct = total > 0 ? (c.value / total) * 100 : 0;
                      return (
                        <div key={c.label} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-neutral-300 flex items-center gap-2">
                              <span className={`w-3 h-3 rounded-full ${c.color}`} />
                              {c.label}
                            </span>
                            <span className="font-medium">{c.value} ({Math.round(pct)}%)</span>
                          </div>
                          <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${c.color}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-neutral-400">No customer data yet.</div>
                )}
              </CardBody>
            </Card>

            {/* Opt-in Rate */}
            <Card>
              <CardHeader title="Customer Opt-in Rate" subtitle="Customers with phone numbers" />
              <CardBody>
                <div className="flex items-center justify-center py-8">
                  <div className="relative w-32 h-32">
                    <svg viewBox="0 0 36 36" className="w-full h-full">
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#262626"
                        strokeWidth="3"
                      />
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="3"
                        strokeDasharray={`${optInRate}, 100`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-bold">{optInRate}%</span>
                    </div>
                  </div>
                </div>
                <div className="text-center text-sm text-neutral-400">
                  {orders.filter(o => o.customerPhone).length} of {totalOrders} orders have customer contact
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Top Customers Table */}
          <Card>
            <CardHeader title="Top Customers" subtitle="By order count and total spent" />
            <CardBody>
              {(() => {
                const customerStats = {};
                orders.forEach(o => {
                  if (o.customerPhone) {
                    if (!customerStats[o.customerPhone]) {
                      customerStats[o.customerPhone] = { phone: o.customerPhone, orders: 0, spent: 0 };
                    }
                    customerStats[o.customerPhone].orders++;
                    customerStats[o.customerPhone].spent += o.total || 0;
                  }
                });
                const sorted = Object.values(customerStats).sort((a, b) => b.orders - a.orders).slice(0, 10);
                
                return sorted.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-neutral-800">
                          <th className="text-left py-2 text-neutral-400 font-medium">Rank</th>
                          <th className="text-left py-2 text-neutral-400 font-medium">Phone</th>
                          <th className="text-right py-2 text-neutral-400 font-medium">Orders</th>
                          <th className="text-right py-2 text-neutral-400 font-medium">Total Spent</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sorted.map((c, i) => (
                          <tr key={c.phone} className="border-b border-neutral-800/50">
                            <td className="py-3 text-neutral-400">#{i + 1}</td>
                            <td className="py-3 font-medium">{c.phone}</td>
                            <td className="py-3 text-right">{c.orders}</td>
                            <td className="py-3 text-right text-emerald-400">{fmtAED(c.spent)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-neutral-400">No customer data yet.</div>
                );
              })()}
            </CardBody>
          </Card>
        </div>
      )}

      {/* Promos Tab */}
      {activeTab === "promos" && (
        <div className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Most Used Promos */}
            <Card>
              <CardHeader title="Most Used Promos" subtitle="Top 10 by usage count" />
              <CardBody>
                {promoUsageData.length > 0 ? (
                  <div className="space-y-2">
                    {promoUsageData.map((p, i) => {
                      const max = Math.max(...promoUsageData.map(x => x.uses), 1);
                      const pct = (p.uses / max) * 100;
                      return (
                        <div key={p.id} className="flex items-center gap-3 text-sm">
                          <span className="w-20 text-neutral-400 truncate">{p.code}</span>
                          <div className="flex-1 h-5 bg-neutral-800 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-12 text-right font-medium">{p.uses}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-neutral-400">No promo usage yet.</div>
                )}
              </CardBody>
            </Card>

            {/* Discount Impact */}
            <Card>
              <CardHeader title="Discount Impact" subtitle="Promo statistics" />
              <CardBody>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-4 text-center">
                    <div className="text-xs text-neutral-400 mb-1">Active Promos</div>
                    <div className="text-2xl font-semibold text-emerald-400">{activePromos.length}</div>
                  </div>
                  <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-4 text-center">
                    <div className="text-xs text-neutral-400 mb-1">Total Promos</div>
                    <div className="text-2xl font-semibold text-blue-400">{promoData.length}</div>
                  </div>
                  <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-4 text-center">
                    <div className="text-xs text-neutral-400 mb-1">Total Uses</div>
                    <div className="text-2xl font-semibold text-purple-400">
                      {promoData.reduce((sum, p) => sum + (p.uses || 0), 0)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-4 text-center">
                    <div className="text-xs text-neutral-400 mb-1">Avg Uses/Promo</div>
                    <div className="text-2xl font-semibold text-orange-400">
                      {promoData.length > 0 
                        ? Math.round(promoData.reduce((sum, p) => sum + (p.uses || 0), 0) / promoData.length) 
                        : 0}
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Promo Effectiveness Table */}
          <Card>
            <CardHeader title="Promo Effectiveness" subtitle="Detailed promo performance" />
            <CardBody>
              {promoData.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-800">
                        <th className="text-left py-2 text-neutral-400 font-medium">Code</th>
                        <th className="text-left py-2 text-neutral-400 font-medium">Type</th>
                        <th className="text-right py-2 text-neutral-400 font-medium">Value</th>
                        <th className="text-right py-2 text-neutral-400 font-medium">Uses</th>
                        <th className="text-right py-2 text-neutral-400 font-medium">Max Uses</th>
                        <th className="text-center py-2 text-neutral-400 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {promoData
                        .sort((a, b) => b.uses - a.uses)
                        .map(p => (
                          <tr key={p.id} className="border-b border-neutral-800/50">
                            <td className="py-3 font-medium">{p.code}</td>
                            <td className="py-3">
                              <Badge variant={p.type === "percentage" ? "blue" : "green"}>
                                {p.type === "percentage" ? "%" : "Fixed"}
                              </Badge>
                            </td>
                            <td className="py-3 text-right">
                              {p.type === "percentage" ? `${p.value}%` : fmtAED(p.value)}
                            </td>
                            <td className="py-3 text-right">{p.uses}</td>
                            <td className="py-3 text-right">{p.maxUses || "∞"}</td>
                            <td className="py-3 text-center">
                              <Badge variant={p.isActive ? "green" : "red"}>
                                {p.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-neutral-400">No promos yet.</div>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {/* Export Section */}
      <Card>
        <CardHeader title="Export Data" subtitle="Download reports as CSV" />
        <CardBody>
          <div className="flex flex-wrap gap-3">
            <Button variant="subtle" onClick={exportOrdersCSV} className="flex items-center gap-2">
              📦 Export Orders CSV
            </Button>
            <Button variant="subtle" onClick={exportCustomersCSV} className="flex items-center gap-2">
              👥 Export Customers CSV
            </Button>
            <Button variant="subtle" onClick={exportStaffPerformanceCSV} className="flex items-center gap-2">
              👨‍💼 Export Staff Performance CSV
            </Button>
            <Button variant="subtle" onClick={exportPromoUsageCSV} className="flex items-center gap-2">
              🎟️ Export Promo Usage CSV
            </Button>
          </div>
          {csvMsg && <div className="text-sm text-emerald-300 mt-3">{csvMsg}</div>}
        </CardBody>
      </Card>

      {/* Revenue Controls */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Revenue Controls" subtitle="Reset or adjust totals." right={<Badge variant="yellow">AED</Badge>} />
          <CardBody className="space-y-3">
            <div className="text-2xl font-semibold">{fmtAED(revenue)}</div>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="danger" onClick={() => setResetOpen(true)}>Reset</Button>
              <Button variant="subtle" onClick={() => setAdjOpen(true)}>Adjust</Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Revenue Summary" subtitle="Time period breakdown" />
          <CardBody className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-400">Today</span>
              <span className="font-medium">{fmtAED(reportData?.today || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">This Week</span>
              <span className="font-medium">{fmtAED(reportData?.thisWeek || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">This Month</span>
              <span className="font-medium">{fmtAED(reportData?.thisMonth || 0)}</span>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Bestsellers */}
      {reportData?.bestsellers && reportData.bestsellers.length > 0 && (
        <Card>
          <CardHeader title="Bestsellers" subtitle="Top selling items" />
          <CardBody>
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {reportData.bestsellers.slice(0, 5).map((item, idx) => (
                <div key={item.itemId} className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-3 text-center">
                  <div className="text-2xl font-bold text-neutral-400">#{idx + 1}</div>
                  <div className="font-medium truncate">{item.name}</div>
                  <div className="text-sm text-neutral-400">{item.count} sold</div>
                  <div className="text-sm text-emerald-400">{fmtAED(item.revenue)}</div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Revenue Adjustments Log */}
      <Card>
        <CardHeader title="Revenue Adjustments Log" subtitle="Every reset/adjustment is recorded." />
        <CardBody className="space-y-2 max-h-64 overflow-y-auto">
          {adjustments.length === 0 ? <div className="text-neutral-400">No adjustments yet.</div> : adjustments.slice(0, 50).map(a => (
            <div key={a.id} className="rounded-xl border border-neutral-800 bg-neutral-900/20 p-3 flex items-center justify-between text-sm">
              <div>
                <div className="font-medium">{a.reason}</div>
                <div className="text-xs text-neutral-500">{new Date(a.ts).toLocaleString()} • By: {a.by || "System"}</div>
              </div>
              <Badge variant={Number(a.amount) < 0 ? "red" : a.amount === 0 ? "neutral" : "green"}>
                {Number(a.amount) === 0 ? "RESET" : (Number(a.amount) > 0 ? "+" : "") + fmtAED(a.amount)}
              </Badge>
            </div>
          ))}
        </CardBody>
      </Card>

      {/* Modals */}
      <Modal
        open={resetOpen}
        title="Reset revenue?"
        onClose={() => setResetOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={resetRevenue}>Reset</Button>
          </div>
        }
      >
        <div className="text-neutral-300">This will reset the stored revenue total to 0. This action is logged.</div>
      </Modal>

      <Modal
        open={adjOpen}
        title="Manual revenue adjustment"
        onClose={() => setAdjOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAdjOpen(false)}>Cancel</Button>
            <Button onClick={addAdjustment}>Apply</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <div className="text-sm text-neutral-300 mb-1">Amount (AED, can be negative)</div>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <div className="text-sm text-neutral-300 mb-1">Reason</div>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Manual correction" />
          </div>
        </div>
      </Modal>
    </div>
  );
}

function StatsCard({ title, value, icon, trend }) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        {trend && <span className="text-xs text-emerald-400">{trend}</span>}
      </div>
      <div className="text-xs text-neutral-400">{title}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function LogsPanel({ logs }) {
  const [filter, setFilter] = useState("");
  
  const filteredLogs = logs.filter(log => {
    if (!filter) return true;
    const searchStr = filter.toLowerCase();
    return (
      log.type.toLowerCase().includes(searchStr) ||
      JSON.stringify(log.payload).toLowerCase().includes(searchStr)
    );
  });

  const getEventBadge = (type) => {
    if (type.includes("auth")) return "blue";
    if (type.includes("order")) return "green";
    if (type.includes("create") || type.includes("update") || type.includes("delete")) return "yellow";
    if (type.includes("revenue")) return "red";
    return "neutral";
  };

  return (
    <Card>
      <CardHeader 
        title="Audit Log" 
        subtitle="All system events"
        right={<Input placeholder="Filter events..." value={filter} onChange={(e) => setFilter(e.target.value)} className="w-48" />}
      />
      <CardBody>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredLogs.length === 0 ? (
            <div className="text-neutral-400">No events found.</div>
          ) : (
            filteredLogs.slice(0, 100).map(log => (
              <div key={log.id} className="rounded-xl border border-neutral-800 bg-neutral-900/20 p-3 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={getEventBadge(log.type)}>{log.type}</Badge>
                      <span className="text-xs text-neutral-500">{new Date(log.ts).toLocaleString()}</span>
                    </div>
                    <div className="text-neutral-300 font-mono text-xs">
                      {JSON.stringify(log.payload, null, 2)}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardBody>
    </Card>
  );
}
