import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Topbar from "../components/Topbar.jsx";
import { Card, CardBody, CardHeader } from "../components/Card.jsx";
import Input from "../components/Input.jsx";
import Button from "../components/Button.jsx";
import { adminLogin } from "../lib/api.js";
import { useAuth } from "../state/AuthContext.jsx";

export default function AdminLogin() {
  const nav = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setIsLoading(true);
    
    try {
      const res = await adminLogin(username, password);
      login({ role: "admin", token: res.token, username: res.username || "Admin" });
      nav("/admin");
    } catch (e2) {
      setErr(e2.message || "Login failed. Please check your credentials.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Topbar />
      
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader 
              title="Admin Login" 
              subtitle="System administration access only."
            />
            <CardBody>
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="block text-sm text-neutral-300 mb-1.5">
                    Username
                  </label>
                  <Input 
                    value={username} 
                    onChange={(e) => setUsername(e.target.value)} 
                    autoComplete="username"
                    placeholder="Admin username"
                    disabled={isLoading}
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-neutral-300 mb-1.5">
                    Password
                  </label>
                  <Input 
                    type="password" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    autoComplete="current-password"
                    placeholder="Admin password"
                    disabled={isLoading}
                  />
                </div>

                {err && (
                  <div className="text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">
                    {err}
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="w-full py-3"
                  disabled={isLoading}
                >
                  {isLoading ? "Logging in..." : "Login as Admin"}
                </Button>

                <div className="flex items-center justify-between text-sm">
                  <Link 
                    to="/" 
                    className="text-neutral-400 hover:text-neutral-300 transition"
                  >
                    ← Back to Home
                  </Link>
                  <Link 
                    to="/login/staff" 
                    className="text-neutral-400 hover:text-neutral-300 transition"
                  >
                    Staff Login →
                  </Link>
                </div>
              </form>
            </CardBody>
          </Card>

          {/* Security Notice */}
          <div className="mt-6 text-center">
            <p className="text-xs text-neutral-500">
              This area is restricted to authorized system administrators only.
              All login attempts are logged for security purposes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
