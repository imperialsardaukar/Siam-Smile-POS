import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Topbar from "../components/Topbar.jsx";
import { Card, CardBody, CardHeader } from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import Badge from "../components/Badge.jsx";

import { useStore } from "../state/StoreContext.jsx";
import { fmtAED } from "../lib/money.js";
import { calcSubtotal } from "../lib/calc.js";

/**
 * Custom hook for continuous alert sound
 * Handles browser autoplay restrictions by waiting for user interaction
 */
function useKitchenAlert(active, onAudioEnabled) {
  const ctxRef = useRef(null);
  const intervalRef = useRef(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [userInteracted, setUserInteracted] = useState(false);

  // Track user interaction to satisfy browser autoplay policy
  useEffect(() => {
    const handleInteraction = () => {
      if (!userInteracted) {
        setUserInteracted(true);
        // Try to resume audio context if it exists
        if (ctxRef.current && ctxRef.current.state === "suspended") {
          ctxRef.current.resume();
        }
      }
    };

    window.addEventListener("click", handleInteraction);
    window.addEventListener("keydown", handleInteraction);
    window.addEventListener("touchstart", handleInteraction);

    return () => {
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
      window.removeEventListener("touchstart", handleInteraction);
    };
  }, [userInteracted]);

  useEffect(() => {
    if (!active) {
      // Stop all audio
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (ctxRef.current) {
        try { ctxRef.current.close(); } catch {}
        ctxRef.current = null;
      }
      setAudioEnabled(false);
      return;
    }

    // Don't start audio until user has interacted with the page
    if (!userInteracted) {
      return;
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      console.warn("[Kitchen] AudioContext not supported");
      return;
    }

    // Create audio context
    const ctx = new AudioContext();
    ctxRef.current = ctx;

    // Function to play a single beep
    const playBeep = () => {
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
      oscillator.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.2);
    };

    // Play burst pattern (3 beeps)
    const playBurst = () => {
      playBeep();
      setTimeout(playBeep, 200);
      setTimeout(playBeep, 400);
    };

    // Play immediately
    playBurst();
    setAudioEnabled(true);
    if (onAudioEnabled) onAudioEnabled();

    // Continue playing every 2 seconds
    intervalRef.current = setInterval(playBurst, 2000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (ctxRef.current) {
        try { ctxRef.current.close(); } catch {}
        ctxRef.current = null;
      }
    };
  }, [active, userInteracted, onAudioEnabled]);

  return { audioEnabled, userInteracted };
}

export default function Kitchen() {
  const { snapshot, socket, emit } = useStore();
  const orders = snapshot?.orders || [];
  const [alertOrderId, setAlertOrderId] = useState(null);
  const [sortBy, setSortBy] = useState("time"); // "time" | "table"
  const [audioAlertActive, setAudioAlertActive] = useState(false);

  // Start alert when server broadcasts new order
  useEffect(() => {
    if (!socket) return;
    const onNew = ({ orderId }) => {
      setAlertOrderId(orderId);
      setAudioAlertActive(true);
    };
    socket.on("kitchen:newOrder", onNew);
    return () => socket.off("kitchen:newOrder", onNew);
  }, [socket]);

  // Use the alert hook
  const { audioEnabled, userInteracted } = useKitchenAlert(
    audioAlertActive && !!alertOrderId,
    () => console.log("[Kitchen] Audio alert enabled")
  );

  const hasAlert = !!alertOrderId;

  const sortOrders = (orderList) => {
    if (sortBy === "time") {
      // Oldest first (priority)
      return [...orderList].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }
    if (sortBy === "table") {
      // Sort by table number, orders without table number go last
      return [...orderList].sort((a, b) => {
        const tableA = a.tableNumber ? parseInt(a.tableNumber) : Infinity;
        const tableB = b.tableNumber ? parseInt(b.tableNumber) : Infinity;
        return tableA - tableB;
      });
    }
    return orderList;
  };

  const grouped = useMemo(() => {
    const by = { new: [], preparing: [], done: [] };
    for (const o of orders) by[o.status]?.push(o);
    // Apply sorting to each group
    by.new = sortOrders(by.new);
    by.preparing = sortOrders(by.preparing);
    by.done = sortOrders(by.done);
    return by;
  }, [orders, sortBy]);

  async function acknowledge(orderId) {
    // Stop audio alert
    setAudioAlertActive(false);
    setAlertOrderId(null);
    await emit("order:setStatus", { id: orderId, status: "preparing" });
  }

  async function markDone(orderId) {
    await emit("order:setStatus", { id: orderId, status: "done" });
  }

  function OrderCard({ o }) {
    const subtotal = calcSubtotal(o.items || []);
    return (
      <div className="rounded-2xl border border-neutral-700 bg-neutral-900/50 p-5 space-y-4 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="font-semibold text-lg">Order #{o.id.slice(0, 6).toUpperCase()}</div>
          <Badge variant={o.status === "new" ? "yellow" : o.status === "preparing" ? "blue" : "green"}>
            {o.status.toUpperCase()}
          </Badge>
        </div>

        {/* Customer Info */}
        {(o.customerName || o.tableNumber) && (
          <div className="rounded-xl border border-neutral-600 bg-neutral-800/70 p-3">
            <div className="text-xs text-neutral-400 mb-1">Customer</div>
            <div className="flex items-center gap-2 flex-wrap">
              {o.customerName && (
                <span className="font-medium text-neutral-200">{o.customerName}</span>
              )}
              {o.tableNumber && (
                <Badge variant="blue">Table {o.tableNumber}</Badge>
              )}
            </div>
          </div>
        )}

        {/* Timestamp */}
        <div className="text-xs text-neutral-400">
          Created: {new Date(o.createdAt).toLocaleString()} • By: {o.createdByUsername || "Staff"}
        </div>

        {/* Kitchen Notes */}
        {o.note ? (
          <div className="rounded-xl border border-amber-600/50 bg-amber-950/40 p-4">
            <div className="text-xs text-amber-400 mb-1 uppercase tracking-wide font-medium">📝 Kitchen Notes</div>
            <div className="text-base text-amber-100">{o.note}</div>
          </div>
        ) : null}

        {/* Items */}
        <div className="space-y-2">
          <div className="text-xs text-neutral-500 uppercase tracking-wide">Items</div>
          {(o.items || []).map((it, idx) => (
            <div key={idx} className="flex justify-between text-sm py-1 border-b border-neutral-800/50 last:border-0">
              <div className="text-neutral-200">{it.qty}× {it.name}</div>
              <div className="text-neutral-400">{fmtAED(it.price * it.qty)}</div>
            </div>
          ))}
        </div>

        {/* Subtotal */}
        <div className="flex items-center justify-between pt-2 border-t border-neutral-700">
          <div className="text-sm text-neutral-400">Subtotal</div>
          <div className="font-semibold">{fmtAED(subtotal)}</div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {o.status === "new" && (
            <Button onClick={() => acknowledge(o.id)} className="w-full py-3">
              Start Prep (Stop Alert)
            </Button>
          )}
          {o.status === "preparing" && (
            <Button onClick={() => markDone(o.id)} className="w-full py-3">
              Mark Done
            </Button>
          )}
          {o.status === "done" && (
            <div className="w-full text-center py-3 text-neutral-500 text-sm">
              Order completed
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Topbar 
        right={
          <div className="flex items-center gap-4">
            {/* Sort Controls */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-400 hidden sm:inline">Sort by:</span>
              <div className="flex rounded-lg border border-neutral-700 overflow-hidden">
                <button
                  onClick={() => setSortBy("time")}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    sortBy === "time" 
                      ? "bg-neutral-700 text-white" 
                      : "bg-neutral-800 text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  Time
                </button>
                <button
                  onClick={() => setSortBy("table")}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    sortBy === "table" 
                      ? "bg-neutral-700 text-white" 
                      : "bg-neutral-800 text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  Table
                </button>
              </div>
            </div>
            
          </div>
        } 
      />
      
      {/* Audio Alert Status Banner */}
      {hasAlert && !userInteracted && (
        <div className="sticky top-[64px] z-30">
          <div className="mx-auto max-w-7xl px-4">
            <div className="mt-4 rounded-2xl border border-yellow-600/60 bg-yellow-900/30 p-4 flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-yellow-200">🔔 Click anywhere to enable audio alerts</div>
                <div className="text-sm text-yellow-200/80">Browser requires user interaction before playing sounds.</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alert Banner */}
      {hasAlert && (
        <div className="sticky top-[64px] z-30">
          <div className="mx-auto max-w-7xl px-4">
            <div className="mt-4 rounded-2xl border border-red-700/60 bg-red-900/20 p-4 flex items-center justify-between gap-3 animate-pulse">
              <div>
                <div className="font-semibold text-red-200">🔔 New order received!</div>
                <div className="text-sm text-red-200/80">
                  {audioEnabled 
                    ? "Audio alert is playing. Tap 'Start Prep' to stop."
                    : "Click anywhere on the page to enable audio alerts."
                  }
                </div>
              </div>
              <Badge variant="red">ALERT</Badge>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6 grid lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader title="New" subtitle="Needs acknowledgement" right={<Badge variant="yellow">{grouped.new.length}</Badge>} />
          <CardBody className="space-y-4">
            {grouped.new.length === 0 ? <div className="text-neutral-400 text-center py-8">No new orders.</div> : grouped.new.map(o => <OrderCard key={o.id} o={o} />)}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Preparing" subtitle="In progress" right={<Badge variant="blue">{grouped.preparing.length}</Badge>} />
          <CardBody className="space-y-4">
            {grouped.preparing.length === 0 ? <div className="text-neutral-400 text-center py-8">No orders preparing.</div> : grouped.preparing.map(o => <OrderCard key={o.id} o={o} />)}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Done" subtitle="Completed" right={<Badge variant="green">{grouped.done.length}</Badge>} />
          <CardBody className="space-y-4">
            {grouped.done.length === 0 ? <div className="text-neutral-400 text-center py-8">No completed orders.</div> : grouped.done.map(o => <OrderCard key={o.id} o={o} />)}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
