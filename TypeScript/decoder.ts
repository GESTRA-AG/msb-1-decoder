// * Decoder for The Things Network (TTN) & The Things Industries (TTI)
// * https://www.thethingsindustries.com/docs/integrations/payload-formatters/javascript/uplink/

// ! Start of Decoder Setup ----------------------------------------------------

const trapType: TrapType = "BK / BI - Bimetallic";
const softwareVersion: SoftwateVersion = "1.1.0";
const subscription: Subscription = "Bronze";
const filterMaskedData: boolean = true;

// ! End of Decoder Setup ------------------------------------------------------

// * Constants, interfaces and types -------------------------------------------

const trapTypes = [
  "BK / BI - Bimetallic",
  "MK / KAP - Membrane (capsule)",
  "UNA / KU - Ball float",
  "UIB / GLO - Inverted bucket",
  "DK / TH - Thermodynamic",
  "Venturi",
] as const;
type TrapType = (typeof trapTypes)[number];

const subscriptions = ["None", "Bronze", "Silver", "Gold"] as const;
type Subscription = (typeof subscriptions)[number];

const softwareVersions = ["1.0.0", "1.1.0"] as const;
type SoftwateVersion = (typeof softwareVersions)[number];

const maskedDataIndicies = {
  None: [] as number[],
  Bronze: [0, 1, 2, 3, 4, 7, 9, 10], // only state alarms & errors + battery are unmasked
  Silver: [7, 9, 10], // everything except steam loss and counters
  Gold: [9, 10], // everything except counters
};

interface InputData {
  bytes: Uint8Array;
  fport: number;
}

interface OutputData {
  data: Tags;
  warnings: string[];
  errors: string[];
}

interface Tags {
  // LoRa node specific / MAC
  ATZ?: number;
  // data feed tags
  noise_avg?: number;
  noise_min?: number;
  noise_max?: number;
  pt100?: number;
  internal_temp?: number;
  status?: number;
  steam_loss?: number;
  cycles?: number;
  BAT?: number;
  ststatus?: number;
  counter?: number;
  // custom responses to specific downlinks
  ack?: number;
  SWV?: number;
  // additional tags
  rawData?: string;
}

// * Main decoder function -----------------------------------------------------

// init vars
let data: Tags;
let warnings: string[] = [];
let errors: string[] = [];

/**
 * Decode LoRa uplink payload of MSB-1 (Multisense Bolt 1 / Ecobolt 1).
 *
 * @param {InputData} input - Object with 'bytes' as Uint8Array and 'fport' number.
 * @returns {OutputData} - JSON record with 'data', 'warnings' and 'errors'.
 */
function decodeUplink(input: InputData): OutputData {
  const dataView = new DataView(input.bytes.buffer);
  const littleEndian = false; // MSB-1 uses big-endian byte order
  switch (input.fport) {
    case 2: {
      data.noise_avg = dataView.getUint8(0);
      data.noise_min = dataView.getUint8(1);
      data.noise_max = dataView.getUint8(2);
      data.pt100 = dataView.getUint8(3);
      data.internal_temp = dataView.getUint8(4);
      data.status = dataView.getUint16(5, littleEndian);
      data.steam_loss = dataView.getUint8(7);
      trapType == "DK / TH - Thermodynamic"
        ? (data.cycles = dataView.getUint8(8))
        : (data.BAT = dataView.getUint8(8));
      data.ststatus = getSteamTrapStatus(dataView.getUint16(5, littleEndian));
      break;
    }
    case 10: {
      warnings.push("LoRa node rebooted");
      data.ATZ = dataView.getUint16(0, littleEndian);
      break;
    }
    case 134: {
      // * counter thresholds uplink
      data.rawData = uint8ArrayToHex(input.bytes);
      break;
    }
    case 139: {
      // * software version uplink
      data.SWV = Number.parseInt(
        "" + dataView.getUint8(1) + dataView.getUint8(0) + dataView.getUint8(2),
        10
      );
      break;
    }
    case 142: {
      // * sensor calibration values uplink
      data.rawData = uint8ArrayToHex(input.bytes);
      break;
    }
    case 144:
    case 145:
    case 146: {
      // * ack bytes
      data.ack = dataView.getUint8(0);
      break;
    }
    case 148: {
      // * alarm thresholds uplink
      data.rawData = uint8ArrayToHex(input.bytes);
      break;
    }
    case 149: {
      // * DK / TH - Thermodynamic steam trap configuration values uplink
      data.rawData = uint8ArrayToHex(input.bytes);
      break;
    }
    default: {
      errors.push(
        `Received payload on unexpected LoRa function port ${input.fport}`
      );
      data.rawData = uint8ArrayToHex(input.bytes);
      break;
    }
  }
  // post-process data before return
  if (
    filterMaskedData &&
    input.fport === 2 &&
    softwareVersion !== "1.0.0" &&
    subscription !== "None"
  ) {
    const maskedIndicies = maskedDataIndicies[subscription];
    for (const index of maskedIndicies) {
      const key = Object.keys(data)[index];
      delete data[key as keyof Tags];
    }
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
] as const;
type StatusKeys = (typeof steamTrapStatusKeys)[number];
type NumsObj<T extends string> = { [key in T]: number };

/**
 * Determine steam trap status.
 * The bits are sorted as LSB - Least Significant Bit first.
 * Note: Higher output value does not mean higher priority.
 *
 * @param {number} status - Uint16 value with big-endian (21) byteorder.
 * @returns {number} Uint8 value representing steam trap status.
 */
function getSteamTrapStatus(status: number): number {
  const statusBitPos: NumsObj<StatusKeys> = {
    PT100MinError: 0,
    PT100MaxError: 1,
    // AmbientTempError: 2,
    BatteryError: 3,
    // BatteryWarning: 4,
    DefectiveAlarm: 15,
    BankingUpCondensateAlarm: 14,
    ColdSteamTrapAlarm: 13,
  };
  const statusOutVal: NumsObj<StatusKeys> = {
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
    (key) => status & (1 << statusBitPos[key as StatusKeys])
  );
  return matchedStatus ? statusOutVal[matchedStatus as StatusKeys] : 1; // ok
}

/**
 * Convert single number value to hex string representative of the value,
 * padded with zeros to the specified number of digits.
 *
 * @param {number} value - Number value with base 10 to be converted.
 * @param {number} digits - Number of digits to pad the hex string with zeros.
 * @param {boolean} bytereverse - Reverse the byte order of the hex string.
 * @returns {string} Zero padded hex string representative of the number value.
 */
function toHex(
  value: number,
  digits: number,
  bytereverse: boolean = false
): string {
  let hexstr = value.toString(16);
  if (bytereverse) {
    if (hexstr.length % 2 !== 0) {
      hexstr = hexstr.padStart(hexstr.length + 1, "0");
    }
    const hexWords: string[] = [];
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
 * @param {number} array - Uint8Array to be converted to hex string.
 * @returns {string} Hex string representative of the array values.
 */
function uint8ArrayToHex(array: Uint8Array): string {
  let hexstr = "";
  for (let i = 0; i < array.length; i++) {
    hexstr += toHex(array[i], 2);
  }
  return hexstr;
}
