// find-device.js
const { HID } = require('node-hid');

console.log("Searching for HID devices...");
const devices = HID.devices();

if (devices.length === 0) {
    console.log("No HID devices found. Make sure the Caller ID box is plugged in.");
} else {
    console.log("Found the following devices:");
    console.log("========================================");
    devices.forEach((device, index) => {
        console.log(`Device #${index + 1}:`);
        console.log(`  Product:      ${device.product}`);
        console.log(`  Manufacturer: ${device.manufacturer}`);
        console.log(`  VendorID:     ${device.vendorId}`);
        console.log(`  ProductID:    ${device.productId}`);
        console.log(`  Path:         ${device.path}`); // <-- THIS IS THE VALUE WE NEED
        console.log("----------------------------------------");
    });
}