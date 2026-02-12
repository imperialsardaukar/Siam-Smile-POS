# Login System Verification Guide

## Quick Verification Checklist

### 1. Landing Page Verification

Navigate to `http://localhost:5173/` (or your deployed URL)

**Expected:**
- [ ] Clean centered layout with 🍜 emoji and "Siam Smile POS" heading
- [ ] Two login cards:
  - 👨‍💼 **Login as Staff** - Large primary button
  - 🔐 **Login as Admin** - Secondary subtle button
- [ ] No "Login to Cashier" or "Login to Kitchen" buttons
- [ ] No demo credentials visible
- [ ] Feature highlights at bottom (Real-time Sync, Analytics, Secure)
- [ ] Responsive design works on mobile/tablet

**Test:**
- Click "Login as Staff" → Should go to `/login/staff`
- Click "Login as Admin" → Should go to `/login/admin`

---

### 2. Staff Login Verification

Navigate to `http://localhost:5173/login/staff`

**Expected:**
- [ ] Title: "Staff Login"
- [ ] Subtitle: "Enter your credentials to access the system."
- [ ] Form fields:
  - Username (text input)
  - Password (password input)
- [ ] No role selection dropdown or buttons
- [ ] "Login" button (not "Login to Cashier" or "Login to Kitchen")
- [ ] Navigation: "← Back to Home" and "Admin Login →"

**Test with Different Roles:**

#### Cashier Staff:
```
Username: cashier_user
Password: [password]
```
- [ ] Redirects to `/cashier`
- [ ] Badge shows "Cashier"
- [ ] **No** "Switch" button in Topbar

#### Kitchen Staff:
```
Username: kitchen_user
Password: [password]
```
- [ ] Redirects to `/kitchen`
- [ ] Badge shows "Kitchen"
- [ ] **No** "Switch" button in Topbar

#### Manager:
```
Username: manager_user
Password: [password]
```
- [ ] Redirects to `/cashier` (default)
- [ ] Badge shows "Manager"
- [ ] **YES** "View: Cashier [Switch]" in Topbar

---

### 3. Manager Switch View Verification

Login as Manager and verify switching:

**Initial State:**
- [ ] Topbar shows: "View: Cashier [Switch] Manager"

**Click Switch:**
- [ ] Navigates to `/kitchen`
- [ ] Topbar updates to: "View: Kitchen [Switch] Manager"
- [ ] Kitchen interface loads correctly

**Switch Back:**
- [ ] Click Switch again
- [ ] Navigates to `/cashier`
- [ ] Topbar updates back to Cashier view

**Socket Connection:**
- [ ] Real-time updates continue working after switch
- [ ] No re-authentication required
- [ ] No page refresh needed

---

### 4. Admin Login Verification

Navigate to `http://localhost:5173/login/admin`

**Expected:**
- [ ] Title: "Admin Login"
- [ ] Subtitle: "System administration access only."
- [ ] Form fields:
  - Username
  - Password
- [ ] "Login as Admin" button
- [ ] Navigation: "← Back to Home" and "Staff Login →"
- [ ] Security notice at bottom

**Test:**
```
Username: Admin
Password: [admin_password]
```
- [ ] Redirects to `/admin`
- [ ] Badge shows "Admin"
- [ ] Can access all admin functions
- [ ] **No** "Switch" button (admin already has full access)

---

### 5. Access Control Verification

Test route guards with different roles:

#### Cashier User:
- [ ] Can access `/cashier` ✅
- [ ] Cannot access `/kitchen` → Redirects to `/`
- [ ] Cannot access `/admin` → Redirects to `/`

#### Kitchen User:
- [ ] Cannot access `/cashier` → Redirects to `/`
- [ ] Can access `/kitchen` ✅
- [ ] Cannot access `/admin` → Redirects to `/`

#### Manager:
- [ ] Can access `/cashier` ✅
- [ ] Can access `/kitchen` ✅
- [ ] Cannot access `/admin` → Redirects to `/`

#### Admin:
- [ ] Can access `/cashier` ✅
- [ ] Can access `/kitchen` ✅
- [ ] Can access `/admin` ✅

---

### 6. URL Parameter Handling

Test old URLs still work:

- [ ] `/login/staff?role=cashier` → Loads staff login (ignores role param)
- [ ] `/login/staff?role=kitchen` → Loads staff login (ignores role param)
- [ ] `/login/staff` → Loads staff login ✅

---

### 7. Responsive Design Verification

**Mobile (320px - 768px):**
- [ ] Landing page cards stack vertically
- [ ] Login forms are full width
- [ ] Text remains readable
- [ ] Buttons are touch-friendly size

**Tablet (768px - 1024px):**
- [ ] Layout adapts to medium screens
- [ ] Side-by-side elements where appropriate
- [ ] Comfortable spacing

**Desktop (1024px+):**
- [ ] Centered layout
- [ ] Max-width constraints
- [ ] Feature highlights visible

---

### 8. Error Handling Verification

**Invalid Credentials:**
- [ ] Enter wrong username/password
- [ ] Error message displays in red box
- [ ] Form remains populated
- [ ] Can retry immediately

**Network Error:**
- [ ] Disconnect network
- [ ] Try to login
- [ ] Appropriate error message
- [ ] Retry works when network restored

**Session Expiry:**
- [ ] Clear localStorage
- [ ] Try to access protected route
- [ ] Redirected to landing page
- [ ] No console errors

---

### 9. Console Verification

Open browser DevTools → Console

**Expected (No Errors):**
- [ ] No "404" errors for routes
- [ ] No "undefined" role errors
- [ ] No prop type warnings
- [ ] No React key warnings

**Expected Warnings (Acceptable):**
- Socket.io connection warnings if server offline
- Development mode warnings

---

### 10. Real-Time Functionality

**With Manager Account:**
1. Login as Manager
2. Open Kitchen view
3. Create order from different device/browser
4. [ ] Order appears in Kitchen view
5. Switch Manager to Cashier view
6. [ ] Still connected, can create orders
7. Switch back to Kitchen
8. [ ] Order updates still coming through

---

## Backend Verification

### API Response Format

```bash
# Test staff login endpoint
curl -X POST http://localhost:3001/auth/staff \
  -H "Content-Type: application/json" \
  -d '{"username":"manager_user","password":"password"}'
```

**Expected Response:**
```json
{
  "ok": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "role": "staff",
  "staff": {
    "id": "...",
    "username": "manager_user",
    "status": "active",
    "role": "manager"
  }
}
```

**Verify Role Values:**
- [ ] Response contains `staff.role` (not `staffRole` in nested object)
- [ ] Role is one of: `"cashier"`, `"kitchen"`, `"manager"`
- [ ] No `"both"` role returned

---

## Troubleshooting

### Issue: "Cannot read property 'role' of undefined"
**Solution:** Check that backend returns `staff.role` in auth response

### Issue: Manager doesn't see Switch button
**Check:**
1. Is `staffRole` set to `"manager"` in auth response?
2. Is `currentMode` set in AuthContext?
3. Check `canSwitchMode` calculation in AuthContext

### Issue: Switching causes logout
**Check:**
1. Is `switchMode` function properly updating state?
2. Is localStorage being cleared unintentionally?
3. Check for full page reload on navigation

### Issue: Redirect loop
**Check:**
1. Verify Guard component logic in App.jsx
2. Check that `isReady` is true before redirecting
3. Ensure `user` object has correct structure

---

## Success Criteria

✅ **All checks passed = Login system refactor successful**

The system is ready for production when:
1. All verification items above are checked
2. No console errors
3. All roles can access their designated areas
4. Managers can switch views seamlessly
5. Responsive design works on target devices

---

## Rollback Plan

If issues are found:

1. **Revert to previous commit:**
   ```bash
   git checkout [previous-commit-hash] -- frontend/src/pages/Landing.jsx
   git checkout [previous-commit-hash] -- frontend/src/pages/StaffLogin.jsx
   git checkout [previous-commit-hash] -- frontend/src/pages/AdminLogin.jsx
   git checkout [previous-commit-hash] -- frontend/src/App.jsx
   ```

2. **Rebuild frontend:**
   ```bash
   cd frontend && npm run build
   ```

3. **Restart server:**
   ```bash
   pm2 restart siam-smile-pos
   ```

---

## Support

For issues or questions:
1. Check `LOGIN_REFACTOR_SUMMARY.md` for architecture details
2. Review browser console for error messages
3. Verify backend auth endpoint returns correct role format
4. Check AuthContext state with React DevTools
