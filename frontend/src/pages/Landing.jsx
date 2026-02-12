import React from "react";
import { Link } from "react-router-dom";
import Topbar from "../components/Topbar.jsx";
import Button from "../components/Button.jsx";
import { Card, CardBody } from "../components/Card.jsx";

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col">
      <Topbar right={null} />
      
      {/* Main Content - Centered */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        {/* Brand Header */}
        <div className="text-center mb-12">
          <div className="text-5xl mb-4">🍜</div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Siam Smile POS</h1>
          <p className="text-lg text-neutral-400 max-w-md mx-auto">
            Modern point-of-sale system for restaurants and cafes
          </p>
        </div>

        {/* Login Options - Two Clear Choices */}
        <div className="w-full max-w-md space-y-4">
          {/* Staff Login */}
          <Card className="border-neutral-700">
            <CardBody className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <span className="text-xl">👨‍💼</span>
                </div>
                <div>
                  <div className="text-lg font-semibold">Staff Login</div>
                  <div className="text-sm text-neutral-400">Cashier, Kitchen, or Manager</div>
                </div>
              </div>
              <p className="text-sm text-neutral-500 mb-4">
                For staff members processing orders and managing the kitchen.
              </p>
              <Link to="/login/staff">
                <Button className="w-full py-3 text-lg">Login as Staff</Button>
              </Link>
            </CardBody>
          </Card>

          {/* Admin Login */}
          <Card className="border-neutral-700">
            <CardBody className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                  <span className="text-xl">🔐</span>
                </div>
                <div>
                  <div className="text-lg font-semibold">Admin Login</div>
                  <div className="text-sm text-neutral-400">System Administration</div>
                </div>
              </div>
              <p className="text-sm text-neutral-500 mb-4">
                For system administrators managing settings, staff, and reports.
              </p>
              <Link to="/login/admin">
                <Button variant="subtle" className="w-full py-3 text-lg">Login as Admin</Button>
              </Link>
            </CardBody>
          </Card>
        </div>

        {/* Help Text */}
        <div className="mt-8 text-center">
          <p className="text-sm text-neutral-500">
            Contact your system administrator if you need access credentials.
          </p>
        </div>
      </div>

      {/* Feature Highlights - Bottom Section */}
      <div className="border-t border-neutral-800 bg-neutral-950/50">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="grid md:grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-2xl mb-2">⚡</div>
              <div className="font-medium text-neutral-300">Real-time Sync</div>
              <div className="text-sm text-neutral-500">Orders sync instantly across all devices</div>
            </div>
            <div>
              <div className="text-2xl mb-2">📊</div>
              <div className="font-medium text-neutral-300">Live Analytics</div>
              <div className="text-sm text-neutral-500">Track sales and performance metrics</div>
            </div>
            <div>
              <div className="text-2xl mb-2">🔒</div>
              <div className="font-medium text-neutral-300">Secure Access</div>
              <div className="text-sm text-neutral-500">Role-based authentication</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
