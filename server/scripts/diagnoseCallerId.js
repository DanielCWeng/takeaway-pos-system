import HIDModule from "node-hid";

const HID = HIDModule.default ?? HIDModule;
const EXPECTED_VENDOR_ID = 0x0483;
const EXPECTED_PRODUCT_ID = 0x5750;

function isSupported(device) {
  return (
    String(device.product ?? "")
      .toUpperCase()
      .includes("JD-2000S") ||
    String(device.manufacturer ?? "")
      .toUpperCase()
      .includes("KOSEN") ||
    (device.vendorId === EXPECTED_VENDOR_ID && device.productId === EXPECTED_PRODUCT_ID)
  );
}

function extractPhone(data) {
  let digits = "";
  for (const byte of data) {
    if (byte >= 48 && byte <= 57) digits += String.fromCharCode(byte);
  }
  return digits.match(/0\d{10}/)?.[0] ?? null;
}

const devices = HID.devices();
const supported = devices.filter(isSupported);

console.log(`HID devices found: ${devices.length}`);
for (const device of devices) {
  console.log(
    `${isSupported(device) ? "[SUPPORTED]" : "[other]"} ` +
      `${device.manufacturer ?? "Unknown"} ${device.product ?? "Unknown"} ` +
      `(VID ${device.vendorId?.toString(16).padStart(4, "0") ?? "----"}, ` +
      `PID ${device.productId?.toString(16).padStart(4, "0") ?? "----"})`,
  );
}

if (supported.length === 0) {
  console.error("\nNo supported JD-2000S/KOSEN caller-ID device was detected.");
  process.exitCode = 1;
} else {
  console.log(`\nSupported caller-ID device(s): ${supported.length}`);
}

if (process.argv.includes("--listen") && supported[0]?.path) {
  const device = new HID.HID(supported[0].path);
  console.log("Listening for caller-ID data. Make a test call or press Ctrl+C to stop.");

  device.on("data", (data) => {
    const phone = extractPhone(data);
    if (phone) console.log(`Caller ID detected: ${phone}`);
    else console.log(`Data received (${data.length} bytes), but no UK phone number was found.`);
  });

  device.on("error", (error) => {
    console.error(`Caller-ID device error: ${error.message}`);
    process.exitCode = 1;
  });

  const close = () => {
    try {
      device.close();
    } finally {
      process.exit();
    }
  };
  process.on("SIGINT", close);
  process.on("SIGTERM", close);
}
