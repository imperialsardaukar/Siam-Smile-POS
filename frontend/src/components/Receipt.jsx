import React from "react";
import { fmtAED } from "../lib/money.js";

// Random closing messages for receipts
const CLOSING_MESSAGES = [
  "Thank you for visiting!",
  "See you again soon!",
  "We appreciate your business!",
  "Have a wonderful day!",
  "Thanks for choosing Siam Smile!",
  "Come back soon!",
  "Your satisfaction is our priority!",
];

function getRandomClosingMessage() {
  const index = Math.floor(Math.random() * CLOSING_MESSAGES.length);
  return CLOSING_MESSAGES[index];
}

/**
 * Reusable Receipt Component
 * Renders a thermal-style receipt for printing
 */
export function Receipt({ order, receipt, settings, message }) {
  const currency = settings?.currency || "AED";
  const closingMsg = message || getRandomClosingMessage();
  
  if (!order) return null;

  const tax = (order.subtotal * (settings?.taxPercent || 0)) / 100;
  const service = (order.subtotal * (settings?.serviceChargePercent || 0)) / 100;

  return (
    <div className="receipt-container">
      {/* Receipt Header */}
      <div className="receipt-header">
        <div className="receipt-title">SIAM SMILE</div>
        <div className="receipt-divider">*******************************</div>
      </div>

      {/* Receipt Info */}
      <div className="receipt-info">
        <div className="receipt-row">
          <span>Order #:</span>
          <span>{order.id?.slice(0, 8).toUpperCase()}</span>
        </div>
        <div className="receipt-row">
          <span>Date:</span>
          <span>{new Date(order.createdAt).toLocaleString()}</span>
        </div>
        <div className="receipt-row">
          <span>Staff:</span>
          <span>{order.createdByUsername || "Staff"}</span>
        </div>
        {order.customerName && (
          <div className="receipt-row">
            <span>Customer:</span>
            <span>{order.customerName}</span>
          </div>
        )}
        {order.tableNumber && (
          <div className="receipt-row">
            <span>Table:</span>
            <span>{order.tableNumber}</span>
          </div>
        )}
      </div>

      <div className="receipt-divider">--------------------------------</div>

      {/* Items */}
      <div className="receipt-items">
        {order.items?.map((item, idx) => (
          <div key={idx} className="receipt-item">
            <div className="receipt-item-name">
              {item.qty} x {item.name}
            </div>
            <div className="receipt-item-price">
              {fmtAED(item.price * item.qty)}
            </div>
          </div>
        ))}
      </div>

      <div className="receipt-divider">--------------------------------</div>

      {/* Totals */}
      <div className="receipt-totals">
        <div className="receipt-row">
          <span>Subtotal:</span>
          <span>{fmtAED(order.subtotal)}</span>
        </div>
        
        {order.discount > 0 && (
          <div className="receipt-row">
            <span>Discount {order.promo?.code ? `(${order.promo.code})` : ""}:</span>
            <span>-{fmtAED(order.discount)}</span>
          </div>
        )}
        
        {tax > 0 && (
          <div className="receipt-row">
            <span>Tax ({settings?.taxPercent}%):</span>
            <span>{fmtAED(tax)}</span>
          </div>
        )}
        
        {service > 0 && (
          <div className="receipt-row">
            <span>Service ({settings?.serviceChargePercent}%):</span>
            <span>{fmtAED(service)}</span>
          </div>
        )}
      </div>

      <div className="receipt-divider">================================</div>

      {/* Total */}
      <div className="receipt-total">
        <span>TOTAL:</span>
        <span>{fmtAED(order.total)} {currency}</span>
      </div>

      <div className="receipt-divider">================================</div>

      {/* Payment Method */}
      {receipt?.paymentMethod && (
        <div className="receipt-payment">
          <div className="receipt-row">
            <span>Payment:</span>
            <span>{receipt.paymentMethod.toUpperCase()}</span>
          </div>
        </div>
      )}

      {/* Closing Message */}
      <div className="receipt-closing">
        {closingMsg}
      </div>

      {/* Spacing for thermal printer cut */}
      <div className="receipt-spacer"></div>
    </div>
  );
}

/**
 * Receipt Print Window
 * Opens a new window with just the receipt for clean printing
 */
export function printReceipt(order, receipt, settings, message) {
  const printWindow = window.open("", "_blank", "width=400,height=600");
  
  if (!printWindow) {
    alert("Please allow popups to print receipts");
    return;
  }

  const currency = settings?.currency || "AED";
  const closingMsg = message || getRandomClosingMessage();
  const tax = (order.subtotal * (settings?.taxPercent || 0)) / 100;
  const service = (order.subtotal * (settings?.serviceChargePercent || 0)) / 100;

  const receiptHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Receipt - Order #${order.id?.slice(0, 8).toUpperCase()}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Courier New', monospace;
          font-size: 14px;
          line-height: 1.4;
          color: #000;
          background: #fff;
          padding: 10px;
          max-width: 80mm;
          margin: 0 auto;
        }
        
        .receipt-header {
          text-align: center;
          margin-bottom: 10px;
        }
        
        .receipt-title {
          font-size: 20px;
          font-weight: bold;
          margin-bottom: 5px;
        }
        
        .receipt-divider {
          text-align: center;
          font-size: 12px;
          margin: 8px 0;
          letter-spacing: -1px;
        }
        
        .receipt-info {
          margin-bottom: 10px;
        }
        
        .receipt-row {
          display: flex;
          justify-content: space-between;
          margin: 3px 0;
        }
        
        .receipt-items {
          margin: 10px 0;
        }
        
        .receipt-item {
          display: flex;
          justify-content: space-between;
          margin: 5px 0;
          flex-wrap: wrap;
        }
        
        .receipt-item-name {
          flex: 1;
          text-align: left;
        }
        
        .receipt-item-price {
          text-align: right;
          min-width: 80px;
        }
        
        .receipt-totals {
          margin: 10px 0;
        }
        
        .receipt-total {
          display: flex;
          justify-content: space-between;
          font-size: 16px;
          font-weight: bold;
          margin: 10px 0;
        }
        
        .receipt-payment {
          margin: 10px 0;
          text-align: center;
        }
        
        .receipt-closing {
          text-align: center;
          margin-top: 20px;
          font-style: italic;
        }
        
        .receipt-spacer {
          height: 50px;
        }
        
        @media print {
          body {
            padding: 0;
          }
          
          @page {
            margin: 0;
            size: 80mm auto;
          }
        }
      </style>
    </head>
    <body>
      <div class="receipt-header">
        <div class="receipt-title">SIAM SMILE</div>
        <div class="receipt-divider">*******************************</div>
      </div>

      <div class="receipt-info">
        <div class="receipt-row">
          <span>Order #:</span>
          <span>${order.id?.slice(0, 8).toUpperCase()}</span>
        </div>
        <div class="receipt-row">
          <span>Date:</span>
          <span>${new Date(order.createdAt).toLocaleString()}</span>
        </div>
        <div class="receipt-row">
          <span>Staff:</span>
          <span>${order.createdByUsername || "Staff"}</span>
        </div>
        ${order.customerName ? `
        <div class="receipt-row">
          <span>Customer:</span>
          <span>${order.customerName}</span>
        </div>
        ` : ""}
        ${order.tableNumber ? `
        <div class="receipt-row">
          <span>Table:</span>
          <span>${order.tableNumber}</span>
        </div>
        ` : ""}
      </div>

      <div class="receipt-divider">--------------------------------</div>

      <div class="receipt-items">
        ${order.items?.map(item => `
          <div class="receipt-item">
            <div class="receipt-item-name">${item.qty} x ${item.name}</div>
            <div class="receipt-item-price">${fmtAED(item.price * item.qty)}</div>
          </div>
        `).join("")}
      </div>

      <div class="receipt-divider">--------------------------------</div>

      <div class="receipt-totals">
        <div class="receipt-row">
          <span>Subtotal:</span>
          <span>${fmtAED(order.subtotal)}</span>
        </div>
        ${order.discount > 0 ? `
        <div class="receipt-row">
          <span>Discount ${order.promo?.code ? `(${order.promo.code})` : ""}:</span>
          <span>-${fmtAED(order.discount)}</span>
        </div>
        ` : ""}
        ${tax > 0 ? `
        <div class="receipt-row">
          <span>Tax (${settings?.taxPercent || 0}%):</span>
          <span>${fmtAED(tax)}</span>
        </div>
        ` : ""}
        ${service > 0 ? `
        <div class="receipt-row">
          <span>Service (${settings?.serviceChargePercent || 0}%):</span>
          <span>${fmtAED(service)}</span>
        </div>
        ` : ""}
      </div>

      <div class="receipt-divider">================================</div>

      <div class="receipt-total">
        <span>TOTAL:</span>
        <span>${fmtAED(order.total)} ${currency}</span>
      </div>

      <div class="receipt-divider">================================</div>

      ${receipt?.paymentMethod ? `
      <div class="receipt-payment">
        <div class="receipt-row">
          <span>Payment:</span>
          <span>${receipt.paymentMethod.toUpperCase()}</span>
        </div>
      </div>
      ` : ""}

      <div class="receipt-closing">
        ${closingMsg}
      </div>

      <div class="receipt-spacer"></div>

      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
            setTimeout(function() {
              window.close();
            }, 1000);
          }, 250);
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(receiptHTML);
  printWindow.document.close();
}

export default Receipt;
