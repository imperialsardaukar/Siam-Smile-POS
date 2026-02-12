import { API_BASE_URL } from "../state/StoreContext.jsx";

async function post(path, body) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  
  const json = await res.json().catch(() => ({}));
  
  if (!res.ok) {
    const error = new Error(json?.error || `Request failed: ${res.status}`);
    error.status = res.status;
    error.data = json;
    throw error;
  }
  
  return json;
}

export async function adminLogin(username, password) {
  return post("/auth/admin", { username, password });
}

export async function staffLogin(username, password) {
  return post("/auth/staff", { username, password });
}
