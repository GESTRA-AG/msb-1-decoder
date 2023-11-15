/**
  This script is a decoder for MSB-1 (Ecobolt) payloads parsed through the
  LORIOT.io websocket sample application (live data investigation).
  
  https://{SUBDOMAIN}.loriot.io/application/{APP_NAME}/websocket

  The following variables are available:
  =============================================================================
  data     : hex string of the data
  p        : array of bytes represented as string of 2 hex digits
  v        : array of bytes represented as integers
  msg.EUI  : device EUI
  msg.fcnt : message frame counter
  msg.port : message port field
  msg.ts   : message timestamp as number (epoch)
  =============================================================================

  Last line of your script will be printed to the data payload column!
**/

interface DecodedUplink {
  type: string | null;
  index?: number;
  target?: string;
  data: { [key: string]: number };
  info?: string;
  warning?: string;
  error?: string;
}

/**
 * Decode LoRa uplink message of MSB-1 (Multisense Bolt / Ecobolt).
 *
 * @param {number[]} payload - Array of unsigned 8-bit integer values.
 * @param {number} port - Payload port (LoRa application port).
 * @returns {object} - JSON object with tag names as keys.
 */
function decodeUplinkPayload(payload: number[], port: number): DecodedUplink {
  const dataView = new DataView(new Uint8Array(payload).buffer);
  switch (port) {
    case 2: {
      return {
        type: "data uplink",
        data: {
          noise_avg: dataView.getUint8(0),
          noise_min: dataView.getUint8(1),
          noise_max: dataView.getUint8(2),
          pt100_temp: dataView.getUint8(3),
          ambient_temp: dataView.getUint8(4),
          status: dataView.getUint16(5, false),
          steam_loss: dataView.getUint8(7),
          battery: dataView.getUint8(8),
          ststatus: getSteamTrapStatus(dataView.getUint16(5, false)),
        },
      };
    }
    case 10: {
      return {
        type: "node uplink",
        info: "LoRa node reboot",
        data: {
          atz: dataView.getUint16(0, false),
        },
      };
    }
    case 134: {
      const idx = dataView.getUint8(0);
      switch (idx) {
        case 0:
        case 1:
        case 2:
        case 3:
        default:
          return {
            type: "debug data uplink",
            info: `Received debug data uplink (index: ${idx}) on port ${port}`,
            data: {},
          };
      }
    }
    case 139: {
      return {
        type: "software versions uplink",
        data: {
          MajorSWV: dataView.getUint8(1),
          MinorSWV: dataView.getUint8(0),
          PatchSWV: dataView.getUint8(2),
        },
      };
    }
    case 142: {
      const idx = dataView.getUint8(0);
      switch (idx) {
        case 0:
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
          return {
            type: "calibration uplink",
            target: "Piezo ultrasonic sensor",
            index: idx,
            data: {
              PiezoFacSensor: dataView.getInt8(1),
              PiezoOffSensor: dataView.getInt8(2),
              PiezoFacAmp: dataView.getInt8(3),
              PiezoOffAmp: dataView.getInt8(4),
              PiezoFacMount: dataView.getInt8(5),
              PiezoOffMount: dataView.getInt8(6),
            },
          };
        case 6:
        case 7:
        case 8:
        case 9:
        case 10:
        case 11:
        case 12:
        case 13:
          return {
            type: "calibration uplink",
            target: "PT100 temperature sensor",
            index: idx,
            data: {
              PT100FacSensor: dataView.getInt8(1),
              PT100OffSensor: dataView.getInt8(2),
              PT100FacAmp: dataView.getInt8(3),
              PT100OffAmp: dataView.getInt8(4),
              PT100FacMount: dataView.getInt8(5),
              PT100OffMount: dataView.getInt8(6),
              PT100Cal0DegC: dataView.getUint16(7, false),
              PT100Cal250DegC: dataView.getUint16(9, false),
            },
          };
        default:
          return {
            type: "calibration uplink",
            data: {},
            error: `Invalid calibration type index ${idx}`,
          };
      }
    }
    default:
      return {
        type: null,
        data: {},
        error: `Received payload on unexpected LoRa application port ${port}`,
      };
  }
}

const statusPhrases = [
  "Invalid", // 0
  "Ok", // 1
  "Failed open", // 2
  "Failed closed", // 3
  "Cold", // 4
  "Low battery", // 5
  "Device fault", // 6
  "Device fault", // 7
  "Device fault", // 8
  "Device fault", // 9
];

const statusKeys = [
  "PT100MinError",
  "PT100MaxError",
  "AmbientTempError",
  "BatteryError",
  "BatteryWarning",
  "DefectiveAlarm",
  "BankingUpCondensateAlarm",
  "ColdSteamTrapAlarm",
] as const;

type StatusKeys = (typeof statusKeys)[number];
type NumsObj<T extends string> = { [key in T]: number };

/**
 * Determine steam trap status for simplified status visualisation in Strata.
 * The bits are sorted as LSB - Least Significant Bit first.
 * Note: Higher output value does not mean higher priority.
 *
 * @param {number} status - Uint16 value with big-endian (21) byteorder.
 * @returns {number} Uint8 value representing steam trap status for Strata.
 */
function getSteamTrapStatus(status: number): number {
  const statusBitPos: NumsObj<StatusKeys> = {
    PT100MinError: 0,
    PT100MaxError: 1,
    AmbientTempError: 2,
    BatteryError: 3,
    BatteryWarning: 4,
    DefectiveAlarm: 15,
    BankingUpCondensateAlarm: 14,
    ColdSteamTrapAlarm: 13,
  };
  const statusOutVal: NumsObj<StatusKeys> = {
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
    (key) => status & (1 << statusBitPos[key as StatusKeys])
  );
  return matchedStatus ? statusOutVal[matchedStatus as StatusKeys] : 1; // ok
}

// construct websocket output string
const output = JSON.stringify(decodeUplinkPayload(v, msg.port), null, 2);

// this will be printed out in the websocket application
output;
