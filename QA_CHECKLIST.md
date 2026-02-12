# QA Checklist (Run this after any changes)

## Multi-device real-time sync (mandatory)
Open Device A + Device B simultaneously.

### Menu
- [ ] Add item on A -> appears on B instantly
- [ ] Edit item on A -> updates on B instantly
- [ ] Delete item on A -> removed on B instantly
- [ ] Add/edit/delete category -> reflected on B instantly

### Staff
- [ ] Create staff -> visible on B instantly
- [ ] Activate/pause staff -> status badge updates on A+B instantly
- [ ] Deleted staff cannot log in

### Settings
- [ ] Change tax % -> cashier totals update instantly on A+B
- [ ] Change service charge (if enabled) -> totals update

### Orders
- [ ] Create order on Cashier -> appears on Kitchen instantly with loud alert
- [ ] Kitchen acknowledge -> alert stops, order moves to Preparing on all devices
- [ ] Mark Done -> moves to Done on all devices
- [ ] Edit/Delete mistaken order -> reflected everywhere correctly

## Correct pricing
- [ ] Subtotal is sum(items * qty)
- [ ] Tax calculated from subtotal
- [ ] Totals show AED currency
- [ ] Rounding consistent (2 decimals)

## Metrics & logs (Admin)
- [ ] Order log shows each order and prep time (created->done)
- [ ] Revenue totals correct
- [ ] Revenue per staff correct
- [ ] Reset revenue works (with confirm)
- [ ] Manual adjustment works (+/-) with reason
- [ ] Export CSV downloads correctly

## Responsiveness
- [ ] Phone portrait: usable navigation, no overflow
- [ ] Tablet landscape: cashier grid + cart usable
- [ ] Kitchen screen: columns readable, big buttons
- [ ] Desktop: admin tables readable

## Stability
- [ ] If backend down: frontend shows clear error banner (no infinite spinner)
- [ ] Refresh does not lose data
- [ ] Reconnect resyncs state
