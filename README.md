# Multisense Bolt 1 / Ecobolt 1 Decoder

The _ecoBolt_ is acontinuous steam trap monitor and this repository contains payload decoder for the _The Things Network (TTN)_ / _The Things Industries (TTI)_ industrial internet of things (IIoT) platform.
The official decoder format documentation can be reviewed at [thethingsindustries.com](https://www.thethingsindustries.com/docs/integrations/payload-formatters/javascript/uplink/).

## Get started

Please adjust the **_Decoder Setup_** block at the beginning of the _decoder.js_ file before integration.

```JavaScript
// ! Start of Decoder Setup ----------------------------------------------------

const trapType = "BK / BI - Bimetallic";
const softwareVersion = "1.1.0";
const subscription = "Bronze";
const filterMaskedData = true;
const warnOnCustomPorts = true;

// ! End of Decoder Setup ------------------------------------------------------
```

Code 1: Default decoder setup

The decoder needs to know the **trap type**, **software version** and **subscription** plan.

- The trap type is used to determine whenever the steam trap is a _DK / TH - Thermodynamic_ steam trap with a slightly different [payload structure](#payload-structure) (Byte[8] tag is _'cycles'_ clicks counter instead of _'BAT'_ battery, see [data uplink](#data-uplink-on-lora-function-port-2) subsection below).
- Devices received before 1st of April 2024 should have the software version 1.0.0. For software versions < 1.1.0 the subscription is _'None'_ and will therefore be ignored if set to something else.
- Masked data will be filtered out by default, for more details see [subscriptions subsection](#subscriptions). If filtering is not desired, set the _filterMaskedData_ constant from _true_ to _false_.

## Payload structure

This subsection shows the whole payload structure and differences between different hardware and software versions, as well as different working modes of the sensor.

**All payload encodings are big-endian byteorder with LSB arangement (least significant bit first).**

**The scaling and offset is beeing applied as** $fx = \frac{x - offset}{scale}$

### Data uplink on LoRa function port 2

_Fields filled with **✘** are masked._

| Position  |  Byte[0]   |  Byte[1]   |  Byte[2]   |  Byte[3]   |   Byte[4]    |   Byte[5]   |   Byte[6]   |  Byte[7]   | Byte[8] | Byte[9] | Byte[10] |
| :-------- | :--------: | :--------: | :--------: | :--------: | :----------: | :---------: | :---------: | :--------: | :-----: | :-----: | :------: |
| Tag       | Avg. noise | Min. noise | Max. noise | Avg. temp. |  Amb. temp.  | Alarm flags | Error flags | Steam loss | Battery |    ✘    |    ✘     |
| Data type |   UInt8    |   UInt8    |   UInt8    |   UInt8    |     Int8     |    UInt8    |    UInt8    |   UInt8    |  UInt8  |    ✗    |    ✗     |
| Bitmask   |     -      |     -      |     -      |     -      |      -       |      -      |      -      |     -      |    -    |    ✗    |    ✗     |
| Scaling   |    2.55    |    2.55    |    2.55    |     1      |      1       |      -      |      -      |     1      |  2.54   |    ✗    |    ✗     |
| Offset    |     0      |     0      |     0      |     0      |      0       |      -      |      -      |     0      |    0    |    ✗    |    ✗     |
| Range     |  0 - 100   |  0 - 100   |  0 - 100   |  0 - 250   | (-127) - 127 |      -      |      -      |  0 - 25.5  | 0 - 100 |    ✗    |    ✗     |
| Unit      |     %      |     %      |     %      |     °C     |      °C      |      -      |      -      |    kg/h    |    %    |    ✗    |    ✗     |
|           |            |            |            |            |              |             |             |            |         |         |          |

Tab. 1: Payload structure for _BK / BI - Bimetallic_, _MK / KAP - Membrane (capsule)_, _UNA / KU - Ball float_, _UIB / GLO - Inverted bucket_ and _Venturi_ steam traps

For _DK / TH - Thermodynamic_ steam traps the payload structure is sligthly different. At byte position 8 (_Byte[8]_) a cycle counter value is beeing transmitted instead of a battery value.

| Position  |  Byte[0]   |  Byte[1]   |  Byte[2]   |  Byte[3]   |   Byte[4]    |   Byte[5]   |   Byte[6]   |  Byte[7]   | Byte[8] | Byte[9] | Byte[10] |
| :-------- | :--------: | :--------: | :--------: | :--------: | :----------: | :---------: | :---------: | :--------: | :-----: | :-----: | :------: |
| Tag       | Avg. noise | Min. noise | Max. noise | Avg. temp. |  Amb. temp.  | Alarm flags | Error flags | Steam loss | Cycles  |    ✘    |    ✘     |
| Data type |   UInt8    |   UInt8    |   UInt8    |   UInt8    |     Int8     |    UInt8    |    UInt8    |   UInt8    |  UInt8  |    ✗    |    ✗     |
| Bitmask   |     -      |     -      |     -      |     -      |      -       |      -      |      -      |     -      |    -    |    ✗    |    ✗     |
| Scaling   |    2.55    |    2.55    |    2.55    |     1      |      1       |      -      |      -      |     1      |    1    |    ✗    |    ✗     |
| Offset    |     0      |     0      |     0      |     0      |      0       |      -      |      -      |     0      |    0    |    ✗    |    ✗     |
| Range     |  0 - 100   |  0 - 100   |  0 - 100   |  0 - 250   | (-127) - 127 |      -      |      -      |  0 - 255   | 0 - 255 |    ✗    |    ✗     |
| Unit      |     %      |     %      |     %      |     °C     |      °C      |      -      |      -      |    kg/h    |    -    |    ✗    |    ✗     |
|           |            |            |            |            |              |             |             |            |         |         |          |

Tab. 2: Payload structure for _DK / TH - Thermodynamic_ steam traps

### Alarm status flags - Byte[5]

The alarm state shows the condition of the steam trap. If no bit is set to 1, the steam trap is working fine and no alarms are active.

| Position | Phrase               | Description                               |
| :------: | :------------------- | :---------------------------------------- |
|  Bit[0]  | Unconfigured warning | Device unconfigured, if bit is set to 1   |
|  Bit[1]  | Cold warning         | Process / steam trap is not in operation  |
|  Bit[2]  | BC warning           | Failed open / banking-up of condensate    |
|  Bit[3]  | Defective warning    | Failed close / steam loss detected        |
|  Bit[4]  | TBD/RFU              | _To Be Defined / Reserved for future use_ |
|  Bit[5]  | Cold alarm           | Process / steam trap is not in operation  |
|  Bit[6]  | BC alarm             | Failed open / banking-up of condensate    |
|  Bit[7]  | Defective alarm      | Failed close / steam loss detected        |
|          |                      |                                           |

Tab. 3: List of alarm status flag bits packed in Byte[5]

### Error status flags - Byte[6]

The error state shows the condition of the sensor equipment. If no bit is set to 1 (except _mode_ bits), the sensor is working fine.

| Position | Phrase           | Description                                                    |
| :------: | :--------------- | :------------------------------------------------------------- |
|  Bit[0]  | PT100 min. error | PT100 defective or pre-amplifier not connected (value < 0°C)   |
|  Bit[1]  | PT100 max. error | PT100 defective or pre-amplifier not connected (value > 250°C) |
|  Bit[2]  | Amb. temp. error | Ambient temperature out of range [-20°C, 50°C]                 |
|  Bit[3]  | Battery error    | Battery capacity < 9 % ($\approx$ 500 uplinks remaining)       |
|  Bit[4]  | Battery warning  | Battery capacity < 46 % ($\approx$ 4500 uplinks remaining)     |
|  Bit[5]  | Mode             | Bit[0] of working mode (trap type index)                       |
|  Bit[6]  | Mode             | Bit[1] of working mode (trap type index)                       |
|  Bit[7]  | Mode             | Bit[2] of working mode (trap type index)                       |
|          |                  |                                                                |

Tab. 4: List of error status flag bits packed in Byte[6]

### Daily metadata uplinks on LoRa function port 3

| Position  | Byte[0] | Byte[1] | Byte[2] | Byte[3] | Byte[4]  | Byte[5]  | Byte[6] | Byte[7] | Byte[8] | Byte[9] |   Byte[10]    |
| :-------- | :-----: | :-----: | :-----: | :-----: | :------: | :------: | :-----: | :-----: | :-----: | :-----: | :-----------: |
| Tag       |   SWV   |   BAT   | ThCold  |  ThBC   | ThDefMin | ThDefAvg |  SLTh0  | SLVal0  |  SLTh2  | SLVal2  | TV_minmin_Val |
| Data type |  Uint8  |  Uint8  |  Uint8  |  Uint8  |  Uint8   |  Uint8   |  Uint8  |  Uint8  |  Uint8  |  Uint8  |     Uint8     |
| Bitmask   |    -    |    -    |    -    |    -    |    -     |    -     |    -    |    -    |    -    |    -    |       -       |
| Scaling   |    1    |  2.54   |    1    |    1    |    1     |    1     |    1    |    1    |    1    |    1    |       1       |
| Offset    |    0    |    0    |    0    |    0    |    0     |    0     |    0    |    0    |    0    |    0    |       0       |
| Range     | 0 - 255 | 0 - 100 | 0 - 255 | 0 - 255 | 0 - 255  | 0 - 255  | 0 - 255 | 0 - 255 | 0 - 255 | 0 - 255 |    0 - 255    |
| Unit      |    -    |    %    |    -    |    -    |    -     |    -     |    -    |    -    |    -    |    -    |       -       |
|           |         |         |         |         |          |          |         |         |         |         |               |

Tab. 5: Daily metadata uplinks on LoRa function port 3 (only for SWV >= 1.1.0)

## Additional information

### Working modes / steam trap types

**Working modes 0-2 are supported by all software versions**  
**Working modes 2-5 and the daily metadata uplink on port 3 is only available in SWV >= 1.1.0**

| Value | Phrase    | Description         |
| :---: | :-------- | :------------------ |
|   0   | BK / BI   | Bimetallic          |
|   1   | MK / CAP  | Membrane or capsule |
|   2   | UNA / KU  | Ball float          |
|   3   | UIB / GLO | Inverted bucket     |
|   4   | DK / TH   | Thermodynamic       |
|   5   | Venturi   | Venturi             |

Tab. 6: List of supported steam trap types

### Mounting options

| Value | Phrase | Description                                           |
| :---: | :----- | :---------------------------------------------------- |
|   0   | PBS    | PBS - vertical pressure bearing screw                 |
|   1   | ADP    | ADP - horizontal pressure bearing screw (90° adapter) |
|   2   | RFC    | RFC - retro fit clamp                                 |

Tab. 7: List of supported mounting options

### Subscriptions

Lower table shows data tag availability for different subscription plans.

| Position | Masked / Total |  Byte[0]   |  Byte[1]   |  Byte[2]   |  Byte[3]   |  Byte[4]   |   Byte[5]   |   Byte[6]   |  Byte[7]   | Byte[8] | Byte[9] | Byte[10] |
| :------- | :------------: | :--------: | :--------: | :--------: | :--------: | :--------: | :---------: | :---------: | :--------: | :-----: | :-----: | :------: |
| Tag      |                | Avg. noise | Min. noise | Max. noise | Avg. temp. | Amb. temp. | Alarm flags | Error flags | Steam loss | Cycles  |    ✘    |    ✘     |
| Bronze   |     8 / 11     |     ❌     |     ❌     |     ❌     |     ❌     |     ❌     |     ✔️      |     ✔️      |     ❌     |   ✔️    |   ❌    |    ❌    |
| Silver   |     3 / 11     |     ✔️     |     ✔️     |     ✔️     |     ✔️     |     ✔️     |     ✔️      |     ✔️      |     ❌     |   ✔️    |   ❌    |    ❌    |
| Gold     |     2 / 11     |     ✔️     |     ✔️     |     ✔️     |     ✔️     |     ✔️     |     ✔️      |     ✔️      |     ✔️     |   ✔️    |   ❌    |    ❌    |

Tab. 8: Subscription data tag availability
