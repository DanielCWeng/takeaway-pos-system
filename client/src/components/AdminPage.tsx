// --- START OF FILE src/components/AdminPage.tsx (Revamped) ---

import React, { useState, useEffect, useMemo } from 'react';
import { Order } from '../types'; // Make sure Order type is comprehensive

const ADMIN_PASSWORD = 'password123'; // Hardcoded for now

// A new, small component for the Order Details Modal
const OrderDetailsModal: React.FC<{ order: Order; onClose: () => void; onReprint: (order: Order) => void }> = ({ order, onClose, onReprint }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60]">
            <div className="bg-gray-200 text-black rounded-lg shadow-xl w-full max-w-lg flex flex-col">
                <div className="p-4 border-b">
                    <h3 className="text-xl font-bold">Order #{order.id} Details</h3>
                    <p>{new Date(order.archivedAt).toLocaleString()}</p>
                </div>
                <div className="p-4 space-y-2 flex-grow overflow-y-auto max-h-[60vh]">
                    <p><strong>Type:</strong> {order.orderType}</p>
                    <p><strong>Customer:</strong> {order.customerInfo.name || 'N/A'}</p>
                    <p><strong>Phone:</strong> {order.customerInfo.phone || 'N/A'}</p>
                    <p><strong>Address:</strong> {order.customerInfo.address || 'N/A'}</p>
                    <hr className="my-2"/>
                    <h4 className="font-bold">Items:</h4>
                    {order.items.map(item => (
                        <div key={item.id} className="flex justify-between">
                            <span>{item.quantity}x {item.displayName}</span>
                            <span className="font-mono">£{(item.finalPrice * item.quantity).toFixed(2)}</span>
                        </div>
                    ))}
                    <hr className="my-2"/>
                    <div className="flex justify-between font-bold text-lg">
                        <span>Total:</span>
                        <span className="font-mono">£{order.total.toFixed(2)}</span>
                    </div>
                </div>
                <div className="p-4 bg-gray-100 flex justify-end gap-4">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-400 rounded-md hover:bg-gray-500">Close</button>
                    <button onClick={() => onReprint(order)} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">Reprint</button>
                </div>
            </div>
        </div>
    );
};

const AdminPage: React.FC<{ onClose: () => void; }> = ({ onClose }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');

    const [isLoading, setIsLoading] = useState(true);
    const [orders, setOrders] = useState<Order[]>([]);
    const [fetchError, setFetchError] = useState<string | null>(null);

    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().substring(0, 10));
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

    // Fetch orders when the component mounts or when the selected date changes
    useEffect(() => {
        if (!isAuthenticated) return;
        
        const fetchOrders = async () => {
            setIsLoading(true);
            setFetchError(null);
            try {
                // [FIX] Add the full backend URL
                const response = await fetch(`http://localhost:4000/api/archived-orders?date=${selectedDate}`);
                if (!response.ok) throw new Error('Failed to fetch orders.');
                const data: Order[] = await response.json();
                setOrders(data);
            } catch (err) {
                setFetchError(err.message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchOrders();
    }, [isAuthenticated, selectedDate]);

    const handleLogin = () => {
        if (password === ADMIN_PASSWORD) {
            setIsAuthenticated(true);
            setLoginError('');
        } else {
            setLoginError('Incorrect password.');
        }
    };

    // Filter orders based on the search query
    const filteredOrders = useMemo(() => {
        if (!searchQuery) return orders;
        const lowercasedQuery = searchQuery.toLowerCase();
        return orders.filter(order =>
            order.id.toString().includes(lowercasedQuery) ||
            order.customerInfo.name?.toLowerCase().includes(lowercasedQuery) ||
            order.customerInfo.phone?.toLowerCase().includes(lowercasedQuery)
        );
    }, [orders, searchQuery]);

    // Calculate daily total from the real, filtered orders
    const dailyTotal = useMemo(() => {
        return filteredOrders.reduce((total, order) => total + order.total, 0);
    }, [filteredOrders]);

    const handleReprint = async (order: Order) => {
        console.log(`Reprinting order #${order.id}...`);
        try {
            // [FIX] Add the full backend URL
            const response = await fetch('http://localhost:4000/api/print', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(order),
            });
            const result = await response.json();
            alert(result.message); // Give user feedback
        } catch (err) {
            alert('Failed to send reprint request.');
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
                <div className="bg-gray-200 text-black p-8 rounded-lg shadow-xl flex flex-col gap-4 w-80">
                    <h2 className="text-2xl font-bold text-center">Admin Login</h2>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleLogin()} className="p-2 border border-gray-400 rounded-md text-lg" placeholder="Enter password"/>
                    {loginError && <p className="text-red-500 text-center">{loginError}</p>}
                    <div className="flex gap-4">
                        <button onClick={onClose} className="flex-1 p-2 bg-gray-400 text-white rounded-md hover:bg-gray-500">Cancel</button>
                        <button onClick={handleLogin} className="flex-1 p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Login</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="fixed inset-0 bg-gray-800 text-white z-50 p-4 flex flex-col">
                <div className="flex-shrink-0 flex justify-between items-center mb-4">
                    <h1 className="text-3xl font-bold">Admin Dashboard</h1>
                    <button onClick={onClose} className="p-2 bg-red-600 rounded-md hover:bg-red-700">Close Admin</button>
                </div>

                <div className="flex-shrink-0 bg-gray-700 p-4 rounded-md flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
                    <div className="flex items-center gap-4">
                        <div>
                            <label htmlFor="date-selector" className="mr-2">Date:</label>
                            <input type="date" id="date-selector" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="bg-gray-800 p-1 rounded-md" />
                        </div>
                        <input type="text" placeholder="Search by ID, Name, Phone..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="bg-gray-800 p-1 rounded-md w-64"/>
                    </div>
                    <div className="text-2xl text-center">
                        <span>Daily Total: </span>
                        <span className="font-bold font-mono text-green-400">£{dailyTotal.toFixed(2)}</span>
                    </div>
                </div>

                <div className="flex-grow bg-gray-900 rounded-md p-2 overflow-y-auto">
                    {isLoading ? <p>Loading orders...</p> : fetchError ? <p className="text-red-400">{fetchError}</p> : (
                        <table className="w-full text-left">
                            <thead className="sticky top-0 bg-gray-800">
                                <tr>
                                    <th className="p-2">ID</th>
                                    <th className="p-2">Time</th>
                                    <th className="p-2">Type</th>
                                    <th className="p-2">Customer</th>
                                    <th className="p-2 hidden md:table-cell">Details</th>
                                    <th className="p-2 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredOrders.map(order => (
                                    <tr key={order.id} className="border-b border-gray-700 hover:bg-gray-700 cursor-pointer" onClick={() => setSelectedOrder(order)}>
                                        <td className="p-2 font-bold">#{order.id}</td>
                                        <td className="p-2">{new Date(order.archivedAt).toLocaleTimeString()}</td>
                                        <td className="p-2">{order.orderType}</td>
                                        <td className="p-2">{order.customerInfo.name || order.customerInfo.phone || 'N/A'}</td>
                                        <td className="p-2 text-sm text-gray-400 hidden md:table-cell">{order.items.map(i => i.displayName).join(', ')}</td>
                                        <td className="p-2 text-right font-mono font-bold text-lg">£{order.total.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
            {selectedOrder && <OrderDetailsModal order={selectedOrder} onClose={() => setSelectedOrder(null)} onReprint={handleReprint} />}
        </>
    );
};

export default AdminPage;
// --- END OF FILE ---