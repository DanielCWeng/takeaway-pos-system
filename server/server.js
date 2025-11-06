// server/server.js (Correct ESM Version)

import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer } from 'ws';
import usb from 'usb';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

import * as callerIdService from './services/callerIdService.js';


// ESM setup for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to your customer data file
const CUSTOMERS_DB_PATH = path.join(__dirname, 'data', 'customers.json');
const ARCHIVED_ORDERS_PATH = path.join(__dirname, 'data', 'archived_orders.json');
// ===================================================================
//                        SERVER SETUP
// ===================================================================
const app = express();
app.use(cors());
app.use(express.json());
const PORT = 4000;
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
let activeClients = [];

wss.on('connection', (ws) => {
  console.log('🔌 WebSocket client connected');
  activeClients.push(ws);
  ws.on('close', () => {
    console.log('🔌 WebSocket client disconnected');
    activeClients = activeClients.filter(client => client !== ws);
  });
  ws.on('error', (err) => console.error('WebSocket Error:', err));
});

function broadcast(data) {
  if (activeClients.length === 0) return;
  const jsonData = JSON.stringify(data);
  activeClients.forEach(client => {
    if (client.readyState === client.OPEN) {
        client.send(jsonData);
    }
  });
}

// ===================================================================
//                      PRINTER LOGIC
// ===================================================================
const VENDOR_ID = 0x154f;
const PRODUCT_ID = 0x154f;
// ... (Your existing printReceipt and checkPrinterStatus functions are fine, no changes needed here)
function printReceipt(orderData) {
    const device = usb.findByIds(VENDOR_ID, PRODUCT_ID);
    if (!device) return Promise.reject('Printer not found');
    return new Promise((resolve, reject) => {
        device.open();
        const iface = device.interface(0);
        try { if (iface.isKernelDriverActive()) { iface.detachKernelDriver(); } iface.claim(); } catch (e) { device.close(); return reject('Could not claim printer interface.'); }
        const endpoint = iface.endpoints.find(ep => ep.direction === 'out');
        const LINE_WIDTH = 32;
        const rightAlign = (text, priceStr) => text + ' '.repeat(Math.max(0, LINE_WIDTH - text.length - priceStr.length)) + priceStr + '\n';
        const createSeparator = (char = '-') => char.repeat(LINE_WIDTH) + '\n';
        const formatPrice = (amount) => `£${amount.toFixed(2)}`;
        let receipt = [];
        receipt.push(ESC, 0x40, ESC, 0x61, 0x01, GS, 0x21, 0x11, ...Buffer.from('YOUR RESTAURANT\n'), GS, 0x21, 0x00, ...Buffer.from(`Order #${orderData.id}\n`), ...Buffer.from(`${new Date().toLocaleString()}\n`), ...Buffer.from(createSeparator()));
        receipt.push(ESC, 0x61, 0x00, ESC, 0x45, 0x01, ...Buffer.from(`${orderData.orderType.toUpperCase()}\n`), ESC, 0x45, 0x00);
        if (orderData.customerInfo.name) receipt.push(...Buffer.from(`Name: ${orderData.customerInfo.name}\n`));
        if (orderData.customerInfo.phone) receipt.push(...Buffer.from(`Phone: ${orderData.customerInfo.phone}\n`));
        if (orderData.customerInfo.address) receipt.push(...Buffer.from(`Address: ${orderData.customerInfo.address}\n`));
        receipt.push(...Buffer.from(createSeparator()));
        orderData.items.forEach(item => { receipt.push(...Buffer.from(rightAlign(`${item.quantity}x ${item.displayName}`, formatPrice(item.finalPrice)))); });
        receipt.push(...Buffer.from(createSeparator()));
        receipt.push(...Buffer.from(rightAlign('Subtotal', formatPrice(orderData.subtotal))));
        if (orderData.orderType === 'Delivery') receipt.push(...Buffer.from(rightAlign('Delivery', formatPrice(orderData.deliveryCharge))));
        receipt.push(GS, 0x21, 0x11, ...Buffer.from(rightAlign('Total', formatPrice(orderData.total))), GS, 0x21, 0x00);
        receipt.push(LF, ESC, 0x61, 0x01, ...Buffer.from('Thank you!\n'), LF, LF, LF, LF, LF, GS, 0x56, 0x01);
        endpoint.transfer(Buffer.from(receipt), (error) => {
            iface.release(true, () => { device.close(); if (error) reject('Failed to send data to printer'); else resolve('Print successful'); });
        });
    });
}
function checkPrinterStatus() {
    if(usb.findByIds(VENDOR_ID, PRODUCT_ID)) console.log(`✅ Printer found.`);
    else console.error(`🔴 Printer not found.`);
}


// ===================================================================
//                     API ENDPOINTS
// ===================================================================
app.get('/api/test-call', (req, res) => {
    console.log('Received request on /api/test-call');
    
    const newCustomerPayload = { 
        type: 'incoming_call', 
        payload: { 
            phone: '07111222333', 
            timestamp: new Date().toISOString(), 
            postcode: null, 
            address: null,
            houseNumber: null,
            street: null,
            town: null,
            distance: null, 
            availableAddresses: null, 
            callCount: 1, 
            status: 'NEEDS_ADDRESS' 
        } 
    };

    // ==================  THE FIX IS HERE ==================
    // We are adding 'town' and changing 'distance' to be a number.
    const existingCustomerPayload = { 
        type: 'incoming_call', 
        payload: { 
            phone: '07987654321', 
            timestamp: new Date().toISOString(), 
            postcode: 'NG10 1AA', 
            address: '123 High Street, Long Eaton', 
            houseNumber: '123',
            street: 'High Street',
            town: 'Long Eaton',           // <-- ADD THIS LINE
            distance: 2.5,                // <-- MODIFY THIS: Change from an object to a number
            availableAddresses: [ { id: 0, full: '123 High Street, Long Eaton' } ], 
            callCount: 8, 
            status: 'COMPLETE' 
        } 
    };
    // ================== END OF FIX ==================

    if (req.query.type === 'existing') { 
        broadcast(existingCustomerPayload); 
        res.send('Sent test broadcast for an EXISTING customer.'); 
    } else { 
        broadcast(newCustomerPayload); 
        res.send('Sent test broadcast for a NEW customer.'); 
    }
});

app.post('/api/verify-address', async (req, res) => {
  // [CHANGE] Destructure all the new fields
  const { phone, address, postcode, houseNumber, street, town } = req.body;

  if (!phone || !address || !postcode) { // Basic validation remains the same
    return res.status(400).json({ error: 'Phone, address, and postcode are required.' });
  }

  try {
    const data = await fs.readFile(CUSTOMERS_DB_PATH, 'utf8');
    const customers = JSON.parse(data);
    let customer = customers.find(c => c.phone === phone);

    if (customer) {
      // [CHANGE] Update all the fields
      customer.address = address;
      customer.postcode = postcode; 
      customer.houseNumber = houseNumber;
      customer.street = street;
      console.log(`[CRM] Updated full address for ${phone}`);
    } else {
      // [CHANGE] Create the new customer with all fields
      const newCustomer = { phone, name: "", address, postcode, houseNumber, street, town };
      customers.push(newCustomer);
      console.log(`[CRM] Created new customer profile for ${phone}`);
    }

    await fs.writeFile(CUSTOMERS_DB_PATH, JSON.stringify(customers, null, 2));
    res.status(200).json({ success: true, message: 'Customer data saved.' });

  } catch (error) {
    if (error.code === 'ENOENT') {
        const newCustomer = { phone, name: "", address, postcode, houseNumber, street };
        await fs.writeFile(CUSTOMERS_DB_PATH, JSON.stringify([newCustomer], null, 2));
        return res.status(200).json({ success: true, message: 'Customer data saved.' });
    }
    console.error('[CRM] Error saving customer data:', error);
    res.status(500).json({ error: 'Failed to save customer data.' });
  }
});
app.post('/api/lookup-postcode', async (req, res) => {
  const { postcode } = req.body;
  if (!postcode) return res.status(400).json({ error: 'Postcode is required' });
  try {
    const addressData = await callerIdService.lookupAddresses(postcode);
    if (addressData) res.json(addressData);
    else res.status(404).json({ error: 'Postcode not found' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/print', async (req, res) => {
    const orderDataFromFrontend = req.body;
    let newOrderId; // Define here so we can access it in all blocks

    try {
        // --- Part 1: CRITICAL - SAVE THE ORDER ---
        let archivedOrders = [];
        try {
            const data = await fs.readFile(ARCHIVED_ORDERS_PATH, 'utf8');
            archivedOrders = JSON.parse(data);
        } catch (readError) {
            if (readError.code !== 'ENOENT') throw readError;
        }

        const maxId = Math.max(0, ...archivedOrders.map(o => o.id));
        newOrderId = maxId + 1;
        
        const orderToArchive = {
            ...orderDataFromFrontend,
            id: newOrderId,
            archivedAt: new Date().toISOString(),
        };

        archivedOrders.push(orderToArchive);
        await fs.writeFile(ARCHIVED_ORDERS_PATH, JSON.stringify(archivedOrders, null, 2));
        console.log(`[Archive] Order #${newOrderId} saved successfully.`);

        // --- Part 2: NON-CRITICAL - TRY TO PRINT ---
        try {
            await printReceipt(orderToArchive);
            console.log(`[Print] Receipt for Order #${newOrderId} printed successfully.`);
            
            // If we get here, BOTH saving and printing were successful.
            res.status(200).json({ 
                success: true, 
                printed: true,
                message: `Order #${newOrderId} saved and printed.` 
            });

        } catch (printError) {
            console.error(`[Print ERROR] Order #${newOrderId} was SAVED, but printing failed:`, printError);
            
            // If we get here, SAVING WORKED but printing FAILED.
            // We still send a SUCCESS (200) response, but with a different message.
            res.status(200).json({
                success: true,
                printed: false,
                message: `Order #${newOrderId} SAVED, but failed to print. Please check printer.`
            });
        }

    } catch (saveError) {
        // This block only runs if the CRITICAL "save" operation fails.
        console.error(`[Archive CRITICAL ERROR] Failed to save order:`, saveError);
        res.status(500).json({ 
            success: false,
            printed: false,
            message: 'CRITICAL: Failed to save the order to the archive.' 
        });
    }
});



app.get('/api/customer/:phone', async (req, res) => {
    const { phone } = req.params;
    console.log(`[API] Received request for customer with phone: ${phone}`);

    try {
        const data = await fs.readFile(CUSTOMERS_DB_PATH, 'utf8');
        const customers = JSON.parse(data);
        const customer = customers.find(c => c.phone === phone);

        if (customer) {
            console.log(`[API] Found customer:`, customer.name || customer.phone);
            res.json(customer);
        } else {
            console.log(`[API] Customer with phone ${phone} not found.`);
            res.status(404).json({ message: 'Customer not found' });
        }
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log(`[API] customers.json not found. Cannot look up customer.`);
            return res.status(404).json({ message: 'Customer file not found' });
        }
        console.error('[API] Server error looking up customer:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/archived-orders', async (req, res) => {
    const { date } = req.query; // e.g., ?date=2023-11-03

    try {
        const data = await fs.readFile(ARCHIVED_ORDERS_PATH, 'utf8');
        let orders = JSON.parse(data);

        // If a date is provided, filter the orders
        if (date) {
            orders = orders.filter(order => {
                // Slices the 'YYYY-MM-DD' part from the ISO string '2023-11-03T10:30:00.000Z'
                return order.archivedAt.startsWith(date);
            });
        }
        
        res.json(orders);
    } catch (error) {
        if (error.code === 'ENOENT') {
            // If the file doesn't exist, return an empty array, which is not an error
            return res.json([]);
        }
        console.error('[API] Error fetching archived orders:', error);
        res.status(500).json({ message: 'Server error' });
    }
});


app.delete('/api/archived-orders', async (req, res) => {
    const { date } = req.query; // e.g., ?date=2023-11-03

    if (!date) {
        return res.status(400).json({ message: 'A date query parameter is required.' });
    }
    console.log(`[Archive] Received request to DELETE all orders for date: ${date}`);

    try {
        let allOrders = [];
        try {
            const data = await fs.readFile(ARCHIVED_ORDERS_PATH, 'utf8');
            allOrders = JSON.parse(data);
        } catch (readError) {
            // If the file doesn't exist, there's nothing to delete.
            if (readError.code === 'ENOENT') {
                console.log('[Archive] No orders file found. Nothing to delete.');
                return res.status(200).json({ success: true, message: 'No orders to delete.' });
            }
            throw readError; // Re-throw other errors
        }

        const initialCount = allOrders.length;
        // Keep only the orders that DO NOT start with the specified date
        const ordersToKeep = allOrders.filter(order => !order.archivedAt.startsWith(date));

        if (ordersToKeep.length === initialCount) {
             console.log(`[Archive] No orders found for ${date}. No changes made.`);
             return res.status(200).json({ success: true, message: `No orders found for ${date} to delete.` });
        }

        // Overwrite the file with the filtered list
        await fs.writeFile(ARCHIVED_ORDERS_PATH, JSON.stringify(ordersToKeep, null, 2));

        const deletedCount = initialCount - ordersToKeep.length;
        console.log(`[Archive] Successfully deleted ${deletedCount} orders for ${date}.`);
        res.status(200).json({ success: true, message: `Successfully deleted ${deletedCount} orders.` });

    } catch (error) {
        console.error('[API] CRITICAL Error deleting archived orders:', error);
        res.status(500).json({ message: 'Server error during deletion.' });
    }
});

// ===================================================================
//                          STARTUP
// ===================================================================
server.listen(PORT, () => {
  console.log(`🚀 API & WebSocket Server listening on http://localhost:${PORT}`);
  checkPrinterStatus();
  console.log('⚡ Initializing Caller ID Service...');

  const onCallDetected = async (cust, addrData, dist) => {
    // ===================================================================
    // VITAL DEBUGGING LOG #1: What data are we receiving from the service?
    // ===================================================================
    console.log('[onCallDetected] Received customer profile from callerIdService:', cust);

    const data = {
      type: 'incoming_call',
      payload: { 
        phone: cust.phone, 
        timestamp: new Date().toISOString(), 
        postcode: cust.postcode, 
        address: cust.address,
        houseNumber: cust.houseNumber, // Attempting to read this
        street: cust.street,           // Attempting to read this
        distance: dist, 
        town: cust.town,
        availableAddresses: addrData?.addresses || null, 
        callCount: cust.callCount, 
        status: cust.address ? "COMPLETE" : "NEEDS_ADDRESS" 
      }
    };
    
    // ===================================================================
    // VITAL DEBUGGING LOG #2: What payload are we about to send?
    // ===================================================================
    console.log('[onCallDetected] Broadcasting payload to frontend:', data.payload);

    broadcast(data);
  };
  
  callerIdService.startCallerIdService(onCallDetected).catch(error => {
    console.error('🔴 FATAL: Caller ID Service failed to start.', error);
  });
});