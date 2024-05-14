"use strict";
// * Decoder for The Things Network (TTN) & The Things Industries (TTI)
// * https://www.thethingsindustries.com/docs/integrations/payload-formatters/javascript/uplink/
// ! Start of Decoder Setup ----------------------------------------------------
const trapType = "BK / BI - Bimetallic";
const softwareVersion = "1.1.0";
const subscription = "Bronze";
const filterMaskedData = true;
const warnOnCustomPorts = true;
// ! End of Decoder Setup ------------------------------------------------------
// * Constants, interfaces and types -------------------------------------------
const trapTypes = [
  "BK / BI - Bimetallic",
  "MK / KAP - Membrane (capsule)",
  "UNA / KU - Ball float",
  "UIB / GLO - Inverted bucket",
  "DK / TH - Thermodynamic",
  "Venturi",
];
const subscriptions = ["None", "Bronze", "Silver", "Gold"];
const softwareVersions = ["1.0.0", "1.1.0"];
const maskedDataTags = {
  None: [],
  Bronze: [
    "noise_avg",
    "noise_min",
    "noise_max",
    "pt100",
    "internal_temp",
    // ... status + ststatus
    "steam_loss",
    // ... cycles / BAT
    "cntByte1",
    "cntByte2",
  ], // only state alarms & errors + battery are unmasked
  Silver: ["steam_loss", "cntByte1", "cntByte2"], // everything except steam loss and counters
  Gold: ["cntByte1", "cntByte2"], // everything except counters
};
// * Main decoder function -----------------------------------------------------
// init vars
const data = {};
const warnings = [];
const errors = [];
/**
 * Decode LoRa uplink payload of MSB-1 (Multisense Bolt 1 / Ecobolt 1).
 *
 * @param {{bytes: number[], fPort: number}} input - Object with 'bytes' as number[] and 'fPort' as number.
 * @returns {{data: {[key: string]: number}, warnings: string[], errors: string[]}} - JSON object.
 */
function decodeUplink(input) {
  const bytes = new Uint8Array(input.bytes);
  const dataView = new DataView(bytes.buffer);
  const littleEndian = false; // MSB-1 uses big-endian byte order
  switch (input.fPort) {
    case 2: {
      // * Telemetry data uplinks
      data.noise_avg = dataView.getUint8(0);
      data.noise_min = dataView.getUint8(1);
      data.noise_max = dataView.getUint8(2);
      data.pt100 = dataView.getUint8(3);
      data.internal_temp = dataView.getUint8(4);
      data.status = dataView.getUint16(5, littleEndian);
      data.ststatus = getSteamTrapStatus(dataView.getUint16(5, littleEndian));
      data.steam_loss = dataView.getUint8(7);
      trapType == "DK / TH - Thermodynamic"
        ? (data.cycles = dataView.getUint8(8))
        : (data.BAT = dataView.getUint8(8));
      data.cntByte1 = dataView.getUint8(9);
      data.cntByte2 = dataView.getUint8(10);
      break;
    }
    case 3: {
      // * Daily metadata uplinks (SWV >= 1.1.0)
      data.SWV = dataView.getUint8(0);
      data.BAT = dataView.getUint8(1);
      data.rawData = uint8ArrayToHex(bytes);
    }
    case 10: {
      // * Dragino specific uplinks
      if (warnOnCustomPorts) {
        warnings.push("LoRa node rebooted");
      }
      data.ATZ = dataView.getUint16(0, littleEndian);
      break;
    }
    case 134: {
      // * Counter thresholds uplinks
      if (warnOnCustomPorts) {
        warnings.push(`Received config thresholds uplink`);
      }
      data.rawData = uint8ArrayToHex(bytes);
      break;
    }
    case 139: {
      // * Software version uplinks
      if (warnOnCustomPorts) {
        warnings.push("Received software version uplink");
      }
      data.SWV = Number.parseInt(
        "" +
          dataView.getUint8(1) +
          dataView.getUint8(0) +
          dataView.getUint8(2),
        10,
      );
      break;
    }
    case 142: {
      // * Sensor calibration values uplinks
      if (warnOnCustomPorts) {
        warnings.push("Received sensor calibration values uplink");
      }
      data.rawData = uint8ArrayToHex(bytes);
      break;
    }
    case 144:
    case 145:
    case 146: {
      // * Ack bytes
      data.ack = dataView.getUint8(0);
      break;
    }
    case 148: {
      // * Alarm thresholds uplinks
      if (warnOnCustomPorts) {
        warnings.push("Received alarm thresholds uplink");
      }
      data.rawData = uint8ArrayToHex(bytes);
      break;
    }
    case 149: {
      // * DK / TH - Thermodynamic steam trap configuration values uplinks
      if (warnOnCustomPorts) {
        warnings.push("Received DK/TH steam trap type specific uplink");
      }
      data.rawData = uint8ArrayToHex(bytes);
      break;
    }
    case 152: {
      // * Configuration bit flags uplinks
      if (warnOnCustomPorts) {
        warnings.push("Received flags of config thresholds uplink");
      }
      data.rawData = uint8ArrayToHex(bytes);
    }
    default: {
      errors.push(
        `Received payload on unexpected LoRa function port ${input.fPort}`,
      );
      data.rawData = uint8ArrayToHex(bytes);
      break;
    }
  }
  // post-process data before return
  if (
    filterMaskedData &&
    input.fPort === 2 &&
    softwareVersion !== "1.0.0" &&
    subscription !== "None"
  ) {
    const maskedTags = maskedDataTags[subscription];
    maskedTags.forEach((tag) => {
      delete data[tag];
    });
  }
  // return data
  return {
    data,
    warnings,
    errors,
  };
}
// * Ulitity functions ---------------------------------------------------------
// - bypassed "AmbientTempError" and "BatteryWarning" in steam trap status
const steamTrapStatusKeys = [
  "PT100MinError",
  "PT100MaxError",
  // "AmbientTempError",
  "BatteryError",
  // "BatteryWarning",
  "DefectiveAlarm",
  "BankingUpCondensateAlarm",
  "ColdSteamTrapAlarm",
];
/**
 * Determine steam trap status.
 * The bits are sorted as LSB - Least Significant Bit first.
 * Note: Higher output value does not mean higher priority.
 *
 * @param {number} status - Uint16 value with big-endian (21) byteorder.
 * @returns {number} Uint8 value representing steam trap status.
 */
function getSteamTrapStatus(status) {
  const statusBitPos = {
    PT100MinError: 0,
    PT100MaxError: 1,
    // AmbientTempError: 2,
    BatteryError: 3,
    // BatteryWarning: 4,
    DefectiveAlarm: 15,
    BankingUpCondensateAlarm: 14,
    ColdSteamTrapAlarm: 13,
  };
  const statusOutVal = {
    PT100MinError: 9,
    PT100MaxError: 8,
    // AmbientTempError: 7,
    BatteryError: 6,
    // BatteryWarning: 5,
    DefectiveAlarm: 2,
    BankingUpCondensateAlarm: 3,
    ColdSteamTrapAlarm: 4,
  };
  if (status < 0 || status > 0xffff) {
    return 0; // undefined
  }
  const matchedStatus = Object.keys(statusBitPos).find(
    (key) => status & (1 << statusBitPos[key]),
  );
  return matchedStatus ? statusOutVal[matchedStatus] : 1; // ok
}
/**
 * Convert single number value to hex string representative of the value,
 * padded with zeros to the specified number of digits.
 *
 * @param {number} value - Number value with base 10 to be converted.
 * @param {number} digits - Number of digits to pad the hex string with zeros.
 * @param {boolean} bytereverse - Reverse the byte order of the hex string.
 *
 * @returns {string} Zero padded hex string representative of the number value.
 */
function toHex(value, digits, bytereverse = false) {
  let hexstr = value.toString(16);
  if (bytereverse) {
    if (hexstr.length % 2 !== 0) {
      hexstr = hexstr.padStart(hexstr.length + 1, "0");
    }
    const hexWords = [];
    for (let i = 0; i < hexstr.length; i += 2) {
      hexWords.push(hexstr.substring(i, i + 2));
    }
    hexstr = hexWords.reverse().join("");
  }
  return hexstr.padStart(digits, "0");
}
/**
 * Convert whole Uint8Array to hex string representative of the array values.
 *
 * @param {number[]} array - Uint8Array to be converted to hex string.
 * @returns {string} Hex string representative of the array values.
 */
function uint8ArrayToHex(array) {
  let hexstr = "";
  for (let i = 0; i < array.length; i++) {
    hexstr += toHex(array[i], 2);
  }
  return hexstr;
}
