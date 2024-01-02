# Introduction - Multisense Bolt 1 / Ecobolt 1 Decoders

This repository contains decoders for different popular IoT platforms:

- LORIOT
- The Things Network (TTN) / The Things Industries (TTI)

## Payload structure

This subsection shows the whole payload structure and differences between different hardware and software versions, as well as different working modes of the sensor.

### Alarm status flags - Byte[5]

The alarm state shows the condition of the steam trap. If no bit is set high, the steam trap is working fine.

| Position | Phrase            | Description                               |
| :------: | :---------------- | :---------------------------------------- |
|  Bit[0]  | TBD/RFU           | _To Be Defined / Reserved for future use_ |
|  Bit[1]  | Cold warning      | Process / steam trap is not in operation  |
|  Bit[2]  | BC warning        | Banking-up of condensate                  |
|  Bit[3]  | Defective warning | Steam loss detected                       |
|  Bit[4]  | TBD/RFU           | _To Be Defined / Reserved for future use_ |
|  Bit[5]  | Cold alarm        | Process / steam trap is not in operation  |
|  Bit[6]  | BC alarm          | Banking-up of condensate                  |
|  Bit[7]  | Defective alarm   | Steam loss detected                       |
|          |                   |                                           |

_Currently the warnings and alarms have been set to same thresholds except for the "Defective warning / alarm". So both flags (status bits) will be set HIGH or LOW at the same time (within the same payload uplink)._

### Error status flags - Byte[6]

The error state shows the condition of the sensor equipment. If none Bit is set (except mode), the sensor is working fine.

| Position | Phrase           | Description                                                    |
| :------: | :--------------- | :------------------------------------------------------------- |
|  Bit[0]  | TBD/RFU          | PT100 defective or pre-amplifier not connected (value < 0°C)   |
|  Bit[1]  | PT100 max. error | PT100 defective or pre-amplifier not connected (value < 250°C) |
|  Bit[2]  | Amb. temp. error | Ambient temperature out of range [-20°C, 50°C]                 |
|  Bit[3]  | Battery error    | Battery capacity < 9 % ($\approx$ 500 uplinks remaining)       |
|  Bit[4]  | Battery warning  | Battery capacity < 46 % ($\approx$ 4500 uplinks remaining)     |
|  Bit[5]  | Mode             | Bit[0] of working mode                                         |
|  Bit[6]  | Mode             | Bit[1] of working mode                                         |
|  Bit[7]  | Mode             | Bit[2] of working mode                                         |
|          |                  |                                                                |

Working modes are refering to the steam trap type / calibration type of the sensor.

| Value | Phrase    | Description         |
| :---: | :-------- | :------------------ |
|   0   | BK / BI   | Bimetallic          |
|   1   | MK / CAP  | Membrane or capsule |
|   2   | UNA / KU  | Ball float          |
|   3   | UIB / GLO | Inverted bucket     |
|   4   | DK / TH   | Thermodynamic       |
|       |           |                     |

_DK / TH is not supported yet, see ["Announcements" section](#announcements)_

### Data frames / payload uplinks

**All payload encodings are big-endian byteorder with LSB arangement (least significant bit first).**

The scaling and offset is beeing applied as $fx = \frac{x - offset}{scale}$

### **bimetallic**, **membrane** / **capsule** and **ball float** steam traps

| Position  |  Byte[0]   |  Byte[1]   |  Byte[2]   |  Byte[3]   |   Byte[4]    |   Byte[5]   |   Byte[6]   |  Byte[7]   | Byte[8] | Byte[9] | Byte[10] |
| :-------- | :--------: | :--------: | :--------: | :--------: | :----------: | :---------: | :---------: | :--------: | :-----: | :-----: | :------: |
| Tag       | Avg. noise | Min. noise | Max. noise | Avg. temp. |  Amb. temp.  | Alarm flags | Error flags | Steam loss | Battery |    X    |    X     |
| Data type |   UInt8    |   UInt8    |   UInt8    |   UInt8    |     Int8     |    UInt8    |    UInt8    |   UInt8    |  UInt8  |    x    |    x     |
| Bitmask   |     -      |     -      |     -      |     -      |      -       |      -      |      -      |     -      |    -    |    x    |    x     |
| Scaling   |    2.55    |    2.55    |    2.55    |     1      |      1       |      -      |      -      |     10     |  2.54   |    x    |    x     |
| Offset    |     0      |     0      |     0      |     0      |      0       |      -      |      -      |     0      |    0    |    x    |    x     |
| Range     |  0 - 100   |  0 - 100   |  0 - 100   |  0 - 250   | (-127) - 127 |      -      |      -      |  0 - 25.5  | 0 - 100 |    x    |    x     |
| Unit      |     %      |     %      |     %      |     °C     |      °C      |      -      |      -      |    kg/h    |    %    |    x    |    x     |
|           |            |            |            |            |              |             |             |            |         |         |          |

_Fields filled with **X** are masked / censored._

### **thermo-dynamic** steam traps

_Not available yet._

## Compability of hardware (amplifier) and software versions

Currently there is only the initial software release v1.0.0 available. An software release update is expected in the first quarter of 2024. See expected new features and improvements in ["Announcements" section](#new-software-release-110-expected-in-february-2024).

| Software | Hardware   |
| :------- | :--------- |
| v1.0.0   | 1.0 \| 1.2 |
| v1.1.0   | 1.0 \| 1.2 |

## Announcements

### New software release 1.1.0 expected in February 2024

The software update will include

- Logic for thermo-dynamic steam traps
- Encryption for distributors
- Dynamic measurement time
- Steam leakage update
- Easier and more robust configuration process through compressed downlinks
