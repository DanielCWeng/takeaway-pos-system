/**
 * hardware/telephonyDevice.js
 *
 * Provider facade for telephony call-state + click-to-dial.
 * Supported providers:
 *   - none
 *   - tapi
 *   - asterisk_ami
 */

import { config } from "../config/index.js";
import { logger } from "../infrastructure/logger.js";
import {
  startListening as startTapiListening,
  stopListening as stopTapiListening,
  dial as dialViaTapi,
  isBridgeConnected as isTapiConnected,
} from "./tapiDevice.js";
import { startBridge, stopBridge } from "./tapiBridgeProcess.js";
import {
  startListening as startAsteriskListening,
  stopListening as stopAsteriskListening,
  dial as dialViaAsterisk,
  isBridgeConnected as isAsteriskConnected,
} from "./asteriskAmiDevice.js";

let activeProvider = "none";

function getConfiguredProvider() {
  return config.telephony.provider;
}

function getEffectiveProvider() {
  const provider = getConfiguredProvider();
  if (provider === "tapi" && config.tapi.bridgePort === 0) return "none";
  return provider;
}

export function getTelephonyProvider() {
  return getEffectiveProvider();
}

export function isDialEnabled() {
  return getEffectiveProvider() !== "none";
}

export async function startListening({ onOffering, onConnected, onDisconnected }) {
  const provider = getEffectiveProvider();
  activeProvider = provider;

  if (provider === "none") {
    logger.info("Telephony provider disabled", {
      hardware: true,
      provider: getConfiguredProvider(),
      reason:
        getConfiguredProvider() === "tapi" && config.tapi.bridgePort === 0
          ? "TAPI_BRIDGE_PORT=0"
          : "TELEPHONY_PROVIDER=none",
    });
    return;
  }

  if (provider === "tapi") {
    startBridge();
    startTapiListening({ onOffering, onConnected, onDisconnected });
    logger.info("Telephony provider started", { hardware: true, provider });
    return;
  }

  if (provider === "asterisk_ami") {
    await startAsteriskListening({ onOffering, onConnected, onDisconnected });
    logger.info("Telephony provider started", { hardware: true, provider });
    return;
  }

  throw new Error(`Unsupported telephony provider: ${provider}`);
}

export function stopListening() {
  const provider = activeProvider;
  activeProvider = "none";

  if (provider === "tapi") {
    try {
      stopTapiListening();
    } finally {
      stopBridge();
    }
    return;
  }

  if (provider === "asterisk_ami") {
    stopAsteriskListening();
  }
}

export function dial(phone) {
  const provider = getEffectiveProvider();
  if (provider === "tapi") return dialViaTapi(phone);
  if (provider === "asterisk_ami") return dialViaAsterisk(phone);
  return false;
}

export function isTelephonyConnected() {
  const provider = getEffectiveProvider();
  if (provider === "tapi") return isTapiConnected();
  if (provider === "asterisk_ami") return isAsteriskConnected();
  return false;
}
