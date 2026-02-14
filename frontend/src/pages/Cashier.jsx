import React, { useMemo, useState, useCallback, useEffect } from "react";
import Topbar from "../components/Topbar.jsx";
import { Card, CardBody, CardHeader } from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import Input from "../components/Input.jsx";
import Select from "../components/Select.jsx";
import Badge from "../components/Badge.jsx";
import Modal from "../components/Modal.jsx";
import { printReceipt } from "../components/Receipt.jsx";

import { useStore } from "../state/StoreContext.jsx";
import { useAuth } from "../state/AuthContext.jsx";
import { fmtAED } from "../lib/money.js";
import { calcSubtotal, calcTax, calcService, calcTotal } from "../lib/calc.js";

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash", icon: "💵" },
  { value: "card", label: "Card", icon: "💳" },
  { value: "other", label: "Other", icon: "📝" },
];

// Expand icon component
function ExpandIcon({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}

export default function Cashier() {
  const { snapshot, emit, connected } = useStore();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("all");
  const [note, setNote] = useState("");
  const [cart, setCart] = useState([]); // {itemId, qty}
  
  // Promo code
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoError, setPromoError] = useState("");
  
  // Customer information
  const [customerName, setCustomerName] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  
  // Modals
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [printPromptOpen, setPrintPromptOpen] = useState(false);
  const [itemDetailOpen, setItemDetailOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [submitErr, setSubmitErr] = useState("");
  const [lastOrder, setLastOrder] = useState(null);
  const [lastReceipt, setLastReceipt] = useState(null);
  
  // Past Orders
  const [showPastOrders, setShowPastOrders] = useState(false);
  const [orderSearch, setOrderSearch] = useState("");
  const [viewingReceipt, setViewingReceipt] = useState(null);
  const [viewingReceiptData, setViewingReceiptData] = useState(null);
  
  // Password protection for Past Orders
  const [passwordPromptOpen, setPasswordPromptOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  const [pastOrdersAuthenticated, setPastOrdersAuthenticated] = useState(false);

  const categories = useMemo(() => {
    const arr = snapshot?.categories || [];
    return arr.slice().sort((a,b) => (a.sortOrder||0)-(b.sortOrder||0));
  }, [snapshot]);

  const menu = useMemo(() => {
    const arr = (snapshot?.menu || []).filter(m => m.isActive);
    const s = search.trim().toLowerCase();
    return arr
      .filter(m => (cat === "all" ? true : m.categoryId === cat))
      .filter(m => (s ? m.name.toLowerCase().includes(s) : true))
      .sort((a,b) => a.name.localeCompare(b.name));
  }, [snapshot, search, cat]);

  const cartLines = useMemo(() => {
    const menuMap = new Map((snapshot?.menu || []).map(m => [m.id, m]));
    return cart.map(line => {
      const m = menuMap.get(line.itemId);
      return {
        itemId: line.itemId,
        qty: line.qty,
        name: m?.name || "Unknown",
        price: m?.price || 0,
        unavailable: m?.unavailable || false,
      };
    });
  }, [cart, snapshot]);

  const subtotal = calcSubtotal(cartLines);
  const tax = calcTax(subtotal, snapshot?.settings?.taxPercent);
  const service = calcService(subtotal, snapshot?.settings?.serviceChargePercent);
  const discount = appliedPromo?.discount || 0;
  const totalBeforeCharges = Math.max(0, subtotal - discount);
  const total = totalBeforeCharges + tax + service;

  // Check if cart contains unavailable items
  const unavailableInCart = cartLines.filter(line => line.unavailable);

  // Dynamic promo recalculation when cart changes
  useEffect(() => {
    if (appliedPromo) {
      recalculatePromo();
    }
  }, [cart, subtotal]);

  function recalculatePromo() {
    if (!appliedPromo) return;
    
    let newDiscount = 0;
    
    if (appliedPromo.type === "percentage") {
      newDiscount = subtotal * (appliedPromo.value / 100);
    } else {
      newDiscount = appliedPromo.value;
    }
    
    // Cap at maxDiscount if set
    if (appliedPromo.maxDiscount && newDiscount > appliedPromo.maxDiscount) {
      newDiscount = appliedPromo.maxDiscount;
    }
    
    // Ensure discount doesn't exceed subtotal
    newDiscount = Math.min(newDiscount, subtotal);
    
    setAppliedPromo({
      ...appliedPromo,
      discount: newDiscount
    });
  }

  function addToCart(itemId) {
    const item = snapshot?.menu?.find(m => m.id === itemId);
    
    // Check if item is unavailable
    if (item?.unavailable) {
      alert("This item is currently unavailable.");
      return;
    }
    
    setCart(prev => {
      const idx = prev.findIndex(x => x.itemId === itemId);
      if (idx >= 0) {
        const copy = prev.slice();
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
        return copy;
      }
      return [...prev, { itemId, qty: 1 }];
    });
  }

  function setQty(itemId, qty) {
    if (qty < 1) {
      removeLine(itemId);
      return;
    }
    setCart(prev => prev.map(x => x.itemId === itemId ? { ...x, qty } : x));
  }

  function removeLine(itemId) {
    setCart(prev => prev.filter(x => x.itemId !== itemId));
  }

  function clearCart() {
    setCart([]);
    setNote("");
    setPromoCode("");
    setAppliedPromo(null);
    setPromoError("");
    setCustomerName("");
    setTableNumber("");
    setCustomerPhone("");
    setCustomerEmail("");
    setMarketingOptIn(false);
    setValidationErrors({});
  }

  function openItemDetail(item, e) {
    e?.stopPropagation();
    setSelectedItem(item);
    setItemDetailOpen(true);
  }

  function closeItemDetail() {
    setItemDetailOpen(false);
    setSelectedItem(null);
  }

  async function applyPromo() {
    setPromoError("");
    if (!promoCode.trim()) return;
    
    const resp = await emit("promo:apply", { 
      code: promoCode.trim(), 
      orderTotal: subtotal 
    });
    
    if (resp.ok) {
      setAppliedPromo({
        code: resp.promo.code,
        type: resp.promo.type,
        value: resp.promo.value,
        maxDiscount: resp.promo.maxDiscount,
        discount: resp.discount
      });
      setPromoCode("");
    } else {
      setPromoError(resp.error || "Invalid promo code");
      setAppliedPromo(null);
    }
  }

  function validateCustomerInfo() {
    const errors = {};
    
    if (!customerName.trim()) {
      errors.customerName = "Customer name is required";
    }
    
    if (!tableNumber.trim()) {
      errors.tableNumber = "Table number is required";
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleConfirmOrder() {
    if (validateCustomerInfo()) {
      createOrder();
    }
  }

  async function createOrder() {
    setSubmitErr("");
    
    // Check for unavailable items
    const unavailableItems = cartLines.filter(line => line.unavailable);
    if (unavailableItems.length > 0) {
      const itemNames = unavailableItems.map(i => i.name).join(", ");
      if (!confirm(`The following items are unavailable: ${itemNames}. Remove them and continue?`)) {
        return;
      }
      // Remove unavailable items
      setCart(prev => prev.filter(x => !unavailableItems.find(u => u.itemId === x.itemId)));
      return;
    }
    
    const items = cart.map(x => ({ itemId: x.itemId, qty: x.qty }));
    const resp = await emit("order:create", { 
      items, 
      note,
      promoCode: appliedPromo?.code,
      customerName,
      tableNumber,
      customerPhone: customerPhone || null,
      customerEmail: customerEmail || null,
      marketingOptIn
    });
    
    if (!resp.ok) {
      setSubmitErr(resp.error || "Failed to create order");
      return;
    }
    
    setLastOrder(resp.order);
    setCart([]);
    setNote("");
    setPromoCode("");
    setAppliedPromo(null);
    setCustomerName("");
    setTableNumber("");
    setCustomerPhone("");
    setCustomerEmail("");
    setMarketingOptIn(false);
    setValidationErrors({});
    setConfirmOpen(false);
    setReceiptOpen(true);
  }

  async function createReceipt(paymentMethod) {
    if (!lastOrder) return;
    
    const resp = await emit("receipt:create", {
      orderId: lastOrder.id,
      paymentMethod,
      note: ""
    });
    
    if (resp.ok) {
      setLastReceipt(resp.receipt);
      setReceiptOpen(false);
      setPrintPromptOpen(true);
    }
  }

  function handlePrint() {
    if (lastOrder) {
      printReceipt(lastOrder, lastReceipt, snapshot?.settings);
    }
    handleSkipPrint();
  }

  function handleSkipPrint() {
    setPrintPromptOpen(false);
    setLastOrder(null);
    setLastReceipt(null);
  }

  // Past Orders functionality with password protection
  async function handlePastOrdersClick() {
    // If already authenticated in this session, show directly
    if (pastOrdersAuthenticated) {
      setShowPastOrders(true);
      return;
    }
    // Otherwise show password prompt
    setPasswordPromptOpen(true);
    setPasswordInput("");
    setPasswordError("");
  }

  async function verifyPasswordAndOpenPastOrders() {
    setIsVerifyingPassword(true);
    setPasswordError("");
    
    const resp = await emit("staff:verifyPassword", { 
      password: passwordInput,
      username: user?.username 
    });
    
    setIsVerifyingPassword(false);
    
    if (resp.ok) {
      setPastOrdersAuthenticated(true);
      setPasswordPromptOpen(false);
      setPasswordInput("");
      setShowPastOrders(true);
    } else {
      setPasswordError("Incorrect password. Access denied.");
      setPasswordInput("");
    }
  }

  function closePasswordPrompt() {
    setPasswordPromptOpen(false);
    setPasswordInput("");
    setPasswordError("");
  }

  function closePastOrders() {
    setShowPastOrders(false);
    setOrderSearch("");
  }

  const pastOrders = useMemo(() => {
    const orders = snapshot?.orders || [];
    const s = orderSearch.trim().toLowerCase();
    return orders
      .filter(o => {
        if (!s) return true;
        const orderNum = o.id.slice(0, 8).toLowerCase();
        const customer = (o.customerName || "").toLowerCase();
        const table = (o.tableNumber || "").toLowerCase();
        return orderNum.includes(s) || customer.includes(s) || table.includes(s);
      })
      .slice(0, 50);
  }, [snapshot, orderSearch]);

  async function viewReceipt(order) {
    const resp = await emit("receipt:preview", { orderId: order.id });
    if (resp.ok) {
      setViewingReceipt(resp.order);
      setViewingReceiptData(resp.receipt);
    }
  }

  function closeReceiptView() {
    setViewingReceipt(null);
    setViewingReceiptData(null);
  }

  function handlePrintViewReceipt() {
    if (viewingReceipt) {
      printReceipt(viewingReceipt, viewingReceiptData, snapshot?.settings);
    }
  }

  const isConfirmDisabled = !customerName.trim() || !tableNumber.trim() || unavailableInCart.length > 0;

  return (
    <div className="min-h-screen">
      {/* CSS for line-clamp utility */}
      <style>{`
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
      
      <Topbar right={null} />
      
      <div className="max-w-7xl mx-auto px-4 py-6 grid lg:grid-cols-[1fr_420px] gap-6">
        <Card>
          <CardHeader
            title="Menu"
            subtitle="Tap items to add to the order. Click expand icon for details."
            right={
              <div className="flex gap-2">
                <Button variant="subtle" onClick={handlePastOrdersClick}>Past Orders</Button>
                <Badge variant="yellow">{snapshot?.settings?.currency || "AED"}</Badge>
              </div>
            }
          />
          <CardBody className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <Input placeholder="Search items…" value={search} onChange={(e) => setSearch(e.target.value)} />
              <Select value={cat} onChange={(e) => setCat(e.target.value)}>
                <option value="all">All categories</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {menu.map(item => (
                <div
                  key={item.id}
                  className={`group rounded-2xl border border-neutral-800 bg-neutral-900/50 hover:bg-neutral-900 transition overflow-hidden text-left flex flex-col relative ${item.unavailable ? 'opacity-50' : ''}`}
                >
                  {/* Expand button - upper left corner */}
                  <button
                    onClick={(e) => openItemDetail(item, e)}
                    className="absolute top-2 left-2 z-10 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition"
                    title="View details"
                  >
                    <ExpandIcon className="w-4 h-4" />
                  </button>
                  
                  {/* Unavailable badge */}
                  {item.unavailable && (
                    <div className="absolute top-2 right-2 z-10 px-2 py-1 rounded-full bg-red-500/80 text-white text-xs font-medium">
                      Unavailable
                    </div>
                  )}
                  
                  <div 
                    className="aspect-[4/3] bg-neutral-950/50 grid place-items-center overflow-hidden cursor-pointer"
                    onClick={() => !item.unavailable && addToCart(item.id)}
                  >
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-[1.02] transition" />
                    ) : (
                      <div className="text-neutral-500 text-sm">No image</div>
                    )}
                  </div>
                  <div 
                    className="p-3 flex-1 flex flex-col cursor-pointer"
                    onClick={() => !item.unavailable && addToCart(item.id)}
                  >
                    <div className="font-semibold">{item.name}</div>
                    {item.description && (
                      <div className="text-xs text-neutral-400 mt-1 line-clamp-2 flex-1">
                        {item.description}
                      </div>
                    )}
                    <div className="text-sm text-neutral-300 mt-2">{fmtAED(item.price)}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Current Order" subtitle="Review before sending to kitchen." right={<Badge variant="blue">{cart.length} items</Badge>} />
          <CardBody className="space-y-3">
            {cartLines.length === 0 ? (
              <div className="text-neutral-400">No items yet. Tap a menu item to add it.</div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {cartLines.map(line => (
                  <div key={line.itemId} className={`flex items-center justify-between gap-2 rounded-xl border p-3 ${line.unavailable ? 'border-red-500/50 bg-red-500/10' : 'border-neutral-800 bg-neutral-900/40'}`}>
                    <div className="min-w-0">
                      <div className="font-medium truncate flex items-center gap-2">
                        {line.name}
                        {line.unavailable && <Badge variant="red">Unavailable</Badge>}
                      </div>
                      <div className="text-xs text-neutral-400">{fmtAED(line.price)} each</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 hover:bg-neutral-800" onClick={() => setQty(line.itemId, line.qty - 1)}>-</button>
                      <div className="w-10 text-center">{line.qty}</div>
                      <button className="px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 hover:bg-neutral-800" onClick={() => setQty(line.itemId, line.qty + 1)}>+</button>
                      <Button variant="ghost" onClick={() => removeLine(line.itemId)}>Remove</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Unavailable items warning */}
            {unavailableInCart.length > 0 && (
              <div className="rounded-xl border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-200">
                <div className="font-medium mb-1">⚠️ Unavailable Items in Cart</div>
                <div>The following items are currently unavailable and cannot be ordered:</div>
                <ul className="list-disc list-inside mt-1">
                  {unavailableInCart.map(item => (
                    <li key={item.itemId}>{item.name}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Kitchen Notes */}
            {cartLines.length > 0 && (
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-3">
                <div className="text-sm font-medium text-neutral-300 mb-2">Kitchen Notes</div>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Special instructions for kitchen..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm min-h-[80px] resize-none"
                />
              </div>
            )}

            {/* Promo Code */}
            {cartLines.length > 0 && (
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-3 space-y-2">
                <div className="text-sm font-medium text-neutral-300">Promo Code</div>
                {appliedPromo ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <Badge variant="green">{appliedPromo.code}</Badge>
                      <div className="text-xs text-neutral-400 mt-1">
                        {appliedPromo.type === "percentage" ? `${appliedPromo.value}% off` : `${fmtAED(appliedPromo.value)} off`}
                      </div>
                    </div>
                    <Button variant="ghost" onClick={() => setAppliedPromo(null)}>Remove</Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Enter code..." 
                      value={promoCode} 
                      onChange={(e) => setPromoCode(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && applyPromo()}
                    />
                    <Button variant="subtle" onClick={applyPromo}>Apply</Button>
                  </div>
                )}
                {promoError && <div className="text-xs text-red-400">{promoError}</div>}
              </div>
            )}

            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-neutral-400">Subtotal</span><span>{fmtAED(subtotal)}</span></div>
              
              {discount > 0 && (
                <div className="flex justify-between text-sm text-emerald-400">
                  <span>Discount {appliedPromo?.code && `(${appliedPromo.code})`}</span>
                  <span>-{fmtAED(discount)}</span>
                </div>
              )}
              
              <div className="flex justify-between text-sm"><span className="text-neutral-400">Tax ({snapshot?.settings?.taxPercent || 0}%)</span><span>{fmtAED(tax)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-neutral-400">Service ({snapshot?.settings?.serviceChargePercent || 0}%)</span><span>{fmtAED(service)}</span></div>
              <div className="flex justify-between font-semibold text-lg pt-2 border-t border-neutral-800"><span>Total</span><span>{fmtAED(total)}</span></div>
            </div>

            {submitErr && <div className="text-sm text-red-300">{submitErr}</div>}

            <div className="grid grid-cols-2 gap-3">
              <Button variant="subtle" onClick={clearCart}>Clear</Button>
              <Button onClick={() => setConfirmOpen(true)} disabled={!connected || cartLines.length === 0 || unavailableInCart.length > 0}>
                Send to Kitchen
              </Button>
            </div>

            {/* Order Summary Modal */}
            <Modal
              open={confirmOpen}
              title="Order Summary"
              onClose={() => setConfirmOpen(false)}
              footer={
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button>
                  <Button onClick={handleConfirmOrder} disabled={isConfirmDisabled}>
                    Confirm Order
                  </Button>
                </div>
              }
            >
              <div className="space-y-6 max-h-[70vh] overflow-y-auto">
                {/* Customer Information Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-neutral-200 uppercase tracking-wide">Customer Information</h3>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-neutral-400 mb-1">
                        Customer Name <span className="text-red-400">*</span>
                      </label>
                      <Input
                        placeholder="Enter customer name"
                        value={customerName}
                        onChange={(e) => {
                          setCustomerName(e.target.value);
                          if (validationErrors.customerName) {
                            setValidationErrors(prev => ({ ...prev, customerName: "" }));
                          }
                        }}
                      />
                      {validationErrors.customerName && (
                        <div className="text-xs text-red-400 mt-1">{validationErrors.customerName}</div>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm text-neutral-400 mb-1">
                        Table Number <span className="text-red-400">*</span>
                      </label>
                      <Input
                        placeholder="Enter table number"
                        value={tableNumber}
                        onChange={(e) => {
                          setTableNumber(e.target.value);
                          if (validationErrors.tableNumber) {
                            setValidationErrors(prev => ({ ...prev, tableNumber: "" }));
                          }
                        }}
                      />
                      {validationErrors.tableNumber && (
                        <div className="text-xs text-red-400 mt-1">{validationErrors.tableNumber}</div>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm text-neutral-400 mb-1">Phone Number</label>
                      <Input
                        placeholder="Enter phone number (optional)"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm text-neutral-400 mb-1">Email</label>
                      <Input
                        type="email"
                        placeholder="Enter email (optional)"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                      />
                    </div>
                    
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={marketingOptIn}
                        onChange={(e) => setMarketingOptIn(e.target.checked)}
                        className="mt-1 rounded border-neutral-600 bg-neutral-800 text-blue-500 focus:ring-blue-500"
                      />
                      <span className="text-sm text-neutral-400">
                        I would like to receive promotional emails and special offers from Siam Smile
                      </span>
                    </label>
                  </div>
                </div>

                <div className="border-t border-neutral-700" />

                {/* Order Summary Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-neutral-200 uppercase tracking-wide">Order Summary</h3>
                  
                  <div className="space-y-2">
                    {cartLines.map(line => (
                      <div key={line.itemId} className="flex justify-between text-sm">
                        <span className="text-neutral-300">
                          {line.qty} × {line.name}
                        </span>
                        <span className="text-neutral-200">{fmtAED(line.price * line.qty)}</span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="border-t border-neutral-700 pt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-400">Subtotal</span>
                      <span className="text-neutral-200">{fmtAED(subtotal)}</span>
                    </div>
                    
                    {discount > 0 && (
                      <div className="flex justify-between text-sm text-emerald-400">
                        <span>Discount {appliedPromo?.code && `(${appliedPromo.code})`}</span>
                        <span>-{fmtAED(discount)}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-400">Tax ({snapshot?.settings?.taxPercent || 0}%)</span>
                      <span className="text-neutral-200">{fmtAED(tax)}</span>
                    </div>
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-400">Service ({snapshot?.settings?.serviceChargePercent || 0}%)</span>
                      <span className="text-neutral-200">{fmtAED(service)}</span>
                    </div>
                    
                    <div className="flex justify-between font-semibold text-lg pt-2 border-t border-neutral-700">
                      <span className="text-neutral-100">Final Total</span>
                      <span className="text-emerald-400">{fmtAED(total)}</span>
                    </div>
                  </div>
                </div>

                {note && (
                  <>
                    <div className="border-t border-neutral-700" />
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-neutral-200 uppercase tracking-wide">Kitchen Notes</h3>
                      <p className="text-sm text-neutral-400 bg-neutral-900/50 p-3 rounded-lg">{note}</p>
                    </div>
                  </>
                )}
              </div>
            </Modal>

            {/* Payment & Receipt Modal */}
            <Modal
              open={receiptOpen}
              title="Payment & Receipt"
              onClose={() => setReceiptOpen(false)}
              footer={
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setReceiptOpen(false)}>Skip for now</Button>
                </div>
              }
            >
              {lastOrder && (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold">{fmtAED(lastOrder.total)}</div>
                    <div className="text-sm text-neutral-400">Order #{lastOrder.id.slice(0, 8).toUpperCase()}</div>
                  </div>
                  
                  {(lastOrder.customerName || lastOrder.tableNumber) && (
                    <div className="border-t border-neutral-800 pt-4">
                      <div className="text-sm font-medium text-neutral-300 mb-2">Customer Information</div>
                      <div className="space-y-1 text-sm">
                        {lastOrder.customerName && (
                          <div className="flex justify-between">
                            <span className="text-neutral-400">Customer</span>
                            <span className="text-neutral-200">{lastOrder.customerName}</span>
                          </div>
                        )}
                        {lastOrder.tableNumber && (
                          <div className="flex justify-between">
                            <span className="text-neutral-400">Table</span>
                            <span className="text-neutral-200">{lastOrder.tableNumber}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="border-t border-neutral-800 pt-4">
                    <div className="text-sm font-medium text-neutral-300 mb-3">Select Payment Method</div>
                    <div className="grid grid-cols-3 gap-2">
                      {PAYMENT_METHODS.map(method => (
                        <button
                          key={method.value}
                          onClick={() => createReceipt(method.value)}
                          className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/50 hover:bg-neutral-800 transition text-center"
                        >
                          <div className="text-2xl mb-1">{method.icon}</div>
                          <div className="text-sm">{method.label}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </Modal>

            {/* Print Receipt Prompt Modal */}
            <Modal
              open={printPromptOpen}
              title="Print receipt?"
              onClose={handleSkipPrint}
              footer={
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={handleSkipPrint}>Not now</Button>
                  <Button onClick={handlePrint}>Print</Button>
                </div>
              }
            >
              <div className="text-neutral-300">
                Would you like to print a receipt for this order?
              </div>
            </Modal>

            {/* Item Detail Modal */}
            <Modal
              open={itemDetailOpen}
              title={selectedItem?.name || "Item Details"}
              onClose={closeItemDetail}
              footer={
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={closeItemDetail}>Cancel</Button>
                  <Button 
                    onClick={() => {
                      if (selectedItem && !selectedItem.unavailable) {
                        addToCart(selectedItem.id);
                        closeItemDetail();
                      }
                    }}
                    disabled={selectedItem?.unavailable}
                  >
                    {selectedItem?.unavailable ? "Unavailable" : "Add to Order"}
                  </Button>
                </div>
              }
            >
              {selectedItem && (
                <div className="space-y-4">
                  <div className="aspect-video bg-neutral-900 rounded-xl overflow-hidden flex items-center justify-center">
                    {selectedItem.imageUrl ? (
                      <img 
                        src={selectedItem.imageUrl} 
                        alt={selectedItem.name} 
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-neutral-500">No image available</div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-semibold">{selectedItem.name}</h3>
                      {selectedItem.unavailable && (
                        <Badge variant="red">Currently Unavailable</Badge>
                      )}
                    </div>
                    
                    <div className="text-2xl font-bold text-emerald-400">
                      {fmtAED(selectedItem.price)}
                    </div>
                    
                    {selectedItem.description ? (
                      <p className="text-neutral-300 leading-relaxed">
                        {selectedItem.description}
                      </p>
                    ) : (
                      <p className="text-neutral-500 italic">No description available</p>
                    )}
                  </div>
                </div>
              )}
            </Modal>

            {/* Password Prompt Modal for Past Orders */}
            <Modal
              open={passwordPromptOpen}
              title="Authentication Required"
              onClose={closePasswordPrompt}
              footer={
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={closePasswordPrompt}>Cancel</Button>
                  <Button onClick={verifyPasswordAndOpenPastOrders} disabled={isVerifyingPassword || !passwordInput.trim()}>
                    {isVerifyingPassword ? "Verifying..." : "Access Past Orders"}
                  </Button>
                </div>
              }
            >
              <div className="space-y-4">
                <p className="text-neutral-300 text-sm">
                  Please enter your password to access Past Orders.
                </p>
                <Input
                  type="password"
                  placeholder="Enter your password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && verifyPasswordAndOpenPastOrders()}
                  autoFocus
                />
                {passwordError && (
                  <div className="text-sm text-red-400">{passwordError}</div>
                )}
              </div>
            </Modal>

            {/* Past Orders Modal */}
            <Modal
              open={showPastOrders}
              title="Past Orders"
              onClose={closePastOrders}
              footer={
                <div className="flex justify-end">
                  <Button variant="ghost" onClick={closePastOrders}>Close</Button>
                </div>
              }
            >
              <div className="space-y-4">
                <Input 
                  placeholder="Search by order #, customer name, or table..." 
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                />
                
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {pastOrders.length === 0 ? (
                    <div className="text-neutral-400">No orders found.</div>
                  ) : (
                    pastOrders.map(order => (
                      <div key={order.id} className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">#{order.id.slice(0, 8).toUpperCase()}</div>
                            <div className="text-xs text-neutral-500">
                              {order.customerName} • Table {order.tableNumber} • {fmtAED(order.total)}
                            </div>
                            <div className="text-xs text-neutral-600">
                              {new Date(order.createdAt).toLocaleString()}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="subtle" onClick={() => viewReceipt(order)}>View Receipt</Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </Modal>

            {/* View Receipt Modal */}
            <Modal
              open={!!viewingReceipt}
              title={`Receipt - Order #${viewingReceipt?.id?.slice(0, 8)?.toUpperCase()}`}
              onClose={closeReceiptView}
              footer={
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={closeReceiptView}>Close</Button>
                  <Button onClick={handlePrintViewReceipt}>Print Receipt</Button>
                </div>
              }
            >
              {viewingReceipt && (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-emerald-400">{fmtAED(viewingReceipt.total)}</div>
                    <div className="text-sm text-neutral-400">
                      {new Date(viewingReceipt.createdAt).toLocaleString()}
                    </div>
                    {viewingReceiptData && (
                      <div className="text-sm text-neutral-400">
                        Payment: {viewingReceiptData.paymentMethod?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  
                  <div className="border-t border-neutral-800 pt-3">
                    <div className="text-sm font-medium text-neutral-300 mb-2">Items</div>
                    <div className="space-y-1">
                      {viewingReceipt.items?.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span>{item.qty} × {item.name}</span>
                          <span>{fmtAED(item.price * item.qty)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="border-t border-neutral-800 pt-3 space-y-1 text-sm">
                    <div className="flex justify-between text-neutral-400">
                      <span>Subtotal</span>
                      <span>{fmtAED(viewingReceipt.subtotal)}</span>
                    </div>
                    {viewingReceipt.discount > 0 && (
                      <div className="flex justify-between text-emerald-400">
                        <span>Discount {viewingReceipt.promo?.code && `(${viewingReceipt.promo.code})`}</span>
                        <span>-{fmtAED(viewingReceipt.discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold text-lg pt-2 border-t border-neutral-800">
                      <span>TOTAL</span>
                      <span className="text-emerald-400">{fmtAED(viewingReceipt.total)}</span>
                    </div>
                  </div>
                  
                  {(viewingReceipt.customerName || viewingReceipt.tableNumber) && (
                    <div className="border-t border-neutral-800 pt-3">
                      <div className="text-sm font-medium text-neutral-300 mb-2">Customer</div>
                      {viewingReceipt.customerName && (
                        <div className="text-sm text-neutral-400">{viewingReceipt.customerName}</div>
                      )}
                      {viewingReceipt.tableNumber && (
                        <div className="text-sm text-neutral-400">Table {viewingReceipt.tableNumber}</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </Modal>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
