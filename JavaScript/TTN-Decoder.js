"use strict";
// * Decoder for The Things Network (TTN) & The Things Industries (TTI)
// * https://www.thethingsindustries.com/docs/integrations/payload-formatters/javascript/uplink/

// init vars
let data;
let warnings = [];
let errors = [];

/**
 * Decode LoRa uplink message of MSB-1 (Multisense Bolt / Ecobolt).
 *
 * @param {InputData} input - Object with bytes as Uint8Array and fport number.
 * @returns {OutputData} - JSON object with data, warnings and errors.
 */
function decodeUplink(input) {
  const dataView = new DataView(input.bytes.buffer);
  switch (input.fport) {
    case 2: {
      data.noise_avg = dataView.getUint8(0);
      data.noise_min = dataView.getUint8(1);
      data.noise_max = dataView.getUint8(2);
      data.pt100_temp = dataView.getUint8(3);
      data.ambient_temp = dataView.getUint8(4);
      data.status = dataView.getUint16(5, false);
      data.steam_loss = dataView.getUint8(7);
      data.battery = dataView.getUint8(8);
      data.ststatus = getSteamTrapStatus(dataView.getUint16(5, false));
      break;
    }
    case 10: {
      warnings.push("LoRa node reboot");
      data.ATZ = dataView.getUint16(0, false);
      break;
    }
    case 134: {
      const idx = input.bytes[0];
      switch (idx) {
        case 0:
        case 1:
        case 2:
        case 3:
        default: {
          warnings.push(
            `Received debug data uplink (index: ${idx}) on port ${input.fport}`
          );
          break;
        }
      }
    }
    case 139: {
      warnings.push("Received software versio info uplink");
      data.MajorSWV = dataView.getUint8(1);
      data.MinorSWV = dataView.getUint8(0);
      data.PatchSWV = dataView.getUint8(2);
      break;
    }
    case 142: {
      warnings.push("Received calibration data uplink");
      const idx = dataView.getUint8(0);
      switch (idx) {
        case 0:
        case 1:
        case 2:
        case 3:
        case 4:
        case 5: {
          data.PiezoFacSensor = dataView.getInt8(1);
          data.PiezoOffSensor = dataView.getInt8(2);
          data.PiezoFacAmp = dataView.getInt8(3);
          data.PiezoOffAmp = dataView.getInt8(4);
          data.PiezoFacMount = dataView.getInt8(5);
          data.PiezoOffMount = dataView.getInt8(6);
          break;
        }
        case 6:
        case 7:
        case 8:
        case 9:
        case 10:
        case 11:
        case 12:
        case 13: {
          data.PT100FacSensor = dataView.getInt8(1);
          data.PT100OffSensor = dataView.getInt8(2);
          data.PT100FacAmp = dataView.getInt8(3);
          data.PT100OffAmp = dataView.getInt8(4);
          data.PT100FacMount = dataView.getInt8(5);
          data.PT100OffMount = dataView.getInt8(6);
          data.PT100Cal0DegC = dataView.getUint16(7, false);
          data.PT100Cal250DegC = dataView.getUint16(9, false);
          break;
        }
        default: {
          errors.push(`Invalid calibration type index ${idx}`);
          break;
        }
      }
    }
    default: {
      errors.push(
        `Received payload on unexpected LoRa application port ${input.fport}`
      );
    }
  }
  return {
    data,
    warnings,
    errors,
  };
}

const statusKeys = [
  "PT100MinError",
  "PT100MaxError",
  "AmbientTempError",
  "BatteryError",
  "BatteryWarning",
  "DefectiveAlarm",
  "BankingUpCondensateAlarm",
  "ColdSteamTrapAlarm",
];

/**
 * Determine steam trap status for simplified status visualisation in Strata.
 * The bits are sorted as LSB - Least Significant Bit first.
 * Note: Higher output value does not mean higher priority.
 *
 * @param {number} status - Uint16 value with big-endian (21) byteorder.
 * @returns {number} Uint8 value representing steam trap status for Strata.
 */
function getSteamTrapStatus(status) {
  const statusBitPos = {
    PT100MinError: 0,
    PT100MaxError: 1,
    AmbientTempError: 2,
    BatteryError: 3,
    BatteryWarning: 4,
    DefectiveAlarm: 15,
    BankingUpCondensateAlarm: 14,
    ColdSteamTrapAlarm: 13,
  };
  const statusOutVal = {
    PT100MinError: 9,
    PT100MaxError: 8,
    AmbientTempError: 7,
    BatteryError: 6,
    BatteryWarning: 5,
    DefectiveAlarm: 2,
    BankingUpCondensateAlarm: 3,
    ColdSteamTrapAlarm: 4,
  };
  if (status < 0 || status > 0xffff) {
    return 0; // undefined
  }
  const matchedStatus = Object.keys(statusBitPos).find(
    (key) => status & (1 << statusBitPos[key])
  );
  return matchedStatus ? statusOutVal[matchedStatus] : 1; // ok
}
