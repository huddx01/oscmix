## Registers

### Inputs

| Register | Description                | Details                                    |  Notes (x=verified) |
| -------- | -------------------------- | ------------------------------------------ | --------------- |
| 0000     | AN 1 mute                  | 0=off 1=on                                 | x               |
| 0001     | AN 1 fx send               | 1/10 fixed point, -65.0dB-0.0dB            | x               |
| 0002     | AN 1 stereo                | 0=off 1=on                                 | x               |
| 0003     | AN 1 record                | 0=off 1=on                                 | x               |
| 0004     | AN 1 Channel Name?         | All channels set to 0xa                    | x               |
| 0005     | AN 1 play channel          | 0=off 1=1/2 2=2/3 ... 79=79/80             | x               |
| 0006     | AN 1 width                 | 1/100 fixed point, -1.00-1.00              |-1=ff9c,0=0000,+1=0064 x|
| 0007     | AN 1 msproc                | 0=off 1=on                                 | x               |
| 0008     | AN 1 phase invert          | 0=off 1=on                                 | x               |
| 0009     | AN 1 gain                  | 1/10 fixed point, 0.0dB-12.0dB             | x               |
| 000A     | AN 1 reflevel              | 0=+13 dBu 1=+19dBu                         | x               |
| 000D     | AN 1 low cut enabled       | 0=off 1=on                                 | x               |
| 000E     | AN 1 low cut freq          | 20Hz-500Hz                                 | x               |
| 000F     | AN 1 low cut slope         | 0=6dB/oct 1=12dB/oct 2=18dB/oct 3=24dB/oct | x               |
| 0010     | AN 1 eq enabled            | 0=off 1=on                                 | x               |
| 0011     | AN 1 eq band 1 type        | 0=Peak 1=Low Shelf 2=High Pass 3=Low Pass  | x               |
| 0012     | AN 1 eq band 1 gain        | 1/10 fixed point, -20.0dB-20.0dB           | x               |
| 0013     | AN 1 eq band 1 freq        | 20Hz-20000Hz                               | x               |
| 0014     | AN 1 eq band 1 q           | 1/10 fixed point, 0.4-9.9                  | x               |
| 0015     | AN 1 eq band 2 gain        | 1/10 fixed point, -20.0dB-20.0dB           | x               |
| 0016     | AN 1 eq band 2 freq        | 20Hz-20000Hz                               | x               |
| 0017     | AN 1 eq band 2 q           | 1/10 fixed point, 0.4-9.9                  | x               |
| 0018     | AN 1 eq band 3 type        | 0=Peak 1=High Shelf 2=Low Pass 3=High Pass | x               |
| 0019     | AN 1 eq band 3 gain        | 1/10 fixed point, -20.0dB-20.0dB           | x               |
| 001A     | AN 1 eq band 3 freq        | 20Hz-20000Hz                               | x               |
| 001B     | AN 1 eq band 3 q           | 1/10 fixed point, 0.4-9.9                  | x               |
| 001C     | AN 1 dynamics enabled      | 0=off 1=on                                 | x               |
| 001D     | AN 1 dynamics gain         | 1/10 fixed point, -30.0dB-30.0dB           | x               |
| 001E     | AN 1 dynamics attack       | 0-200                                      | x               |
| 001F     | AN 1 dynamics release      | 100-999                                    | x               |
| 0020     | AN 1 dynamics comp. thres. | 1/10 fixed point, -60.0dB-0.0dB            | x               |
| 0021     | AN 1 dynamics comp. ratio  | 1/10 fixed point, 1.0-10.0                 | x               |
| 0022     | AN 1 dynamics exp. thres.  | 1/10 fixed point, -99.0dB--20.0dB          | x               |
| 0023     | AN 1 dynamics exp. ratio   | 1/10 fixed point, 1.0-10.0                 | x               |
| 0024     | AN 1 autolevel enabled     | 0=off 1=on                                 | x               |
| 0025     | AN 1 autolevel max gain    | 1/10 fixed point, 0.0dB-18.0dB             | x               |
| 0026     | AN 1 autolevel headroom    | 1/10 fixed point, 3.0dB-12.0dB             | x               |
| 0027     | AN 1 autolevel rise time   | 1/10 fixed point, 0.1-9.9                  | x               |
| ---      | ---                        |---                                         |                 |
| 0030     | AN 2 mute                  | 0=off 1=on                                 | x               |
| 0031     | AN 2 fx send               | 1/10 fixed point, -65.0dB-0.0dB            | x               |
| 0032     | AN 2 stereo                | 0=off 1=on                                 | x               |
| 0033     | AN 2 record                | 0=off 1=on                                 | x               |
| 0034     | AN 2 Channel Name?         | All chennels set to 0xa                    | x               |
| 0035     | AN 2 play channel          | 0=off 1=1/2 2=2/3 ... 79=79/80             | x               |
| 0036     | AN 2 width                 | 1/100 fixed point, -1.00-1.00              |-=ff9c,0=0000,+1=0064 x|
| 0037     | AN 2 msproc                | 0=off 1=on                                 | x               |
| 0038     | AN 2 phase invert          | 0=off 1=on                                 | x               |
| 0039     | AN 2 gain                  | 1/10 fixed point, 0.0dB-12.0dB             | x               |
| 003A     | AN 2 reflevel              | 0=+13 dBu 1=+19dBu                         | x               |
| 003D     | AN 2 low cut enabled       | 0=off 1=on                                 | x               |
| 003E     | AN 2 low cut freq          | 20Hz-500Hz                                 | x               |
| 003F     | AN 2 low cut slope         | 0=6dB/oct 1=12dB/oct 2=18dB/oct 3=24dB/oct | x               |
| 0040     | AN 2 eq enabled            | 0=off 1=on                                 | x               |
| 0041     | AN 2 eq band 1 type        | 0=Peak 1=Low Shelf 2=High Pass 3=Low Pass  | x               |
| 0042     | AN 2 eq band 1 gain        | 1/10 fixed point, -20.0dB-20.0dB           | x               |
| 0043     | AN 2 eq band 1 freq        | 20Hz-20000Hz                               | x               |
| 0044     | AN 2 eq band 1 q           | 1/10 fixed point, 0.4-9.9                  | x               |
| 0045     | AN 2 eq band 2 gain        | 1/10 fixed point, -20.0dB-20.0dB           | x               |
| 0046     | AN 2 eq band 2 freq        | 20Hz-20000Hz                               | x               |
| 0047     | AN 2 eq band 2 q           | 1/10 fixed point, 0.4-9.9                  | x               |
| 0048     | AN 2 eq band 3 type        | 0=Peak 1=High Shelf 2=Low Pass 3=High Pass | x               |
| 0049     | AN 2 eq band 3 gain        | 1/10 fixed point, -20.0dB-20.0dB           | x               |
| 004A     | AN 2 eq band 3 freq        | 20Hz-20000Hz                               | x               |
| 004B     | AN 2 eq band 3 q           | 1/10 fixed point, 0.4-9.9                  | x               |
| 004C     | AN 2 dynamics enabled      | 0=off 1=on                                 | x               |
| 004D     | AN 2 dynamics gain         | 1/10 fixed point, -30.0dB-30.0dB           | x               |
| 004E     | AN 2 dynamics attack       | 0-200                                      | x               |
| 004F     | AN 2 dynamics release      | 100-999                                    | x               |
| 0050     | AN 2 dynamics comp. thres. | 1/10 fixed point, -60.0dB-0.0dB            | x               |
| 0051     | AN 2 dynamics comp. ratio  | 1/10 fixed point, 1.0-10.0                 | x               |
| 0052     | AN 2 dynamics exp. thres.  | 1/10 fixed point, -99.0dB--20.0dB          | x               |
| 0053     | AN 2 dynamics exp. ratio   | 1/10 fixed point, 1.0-10.0                 | x               |
| 0054     | AN 2 autolevel enabled     | 0=off 1=on                                 | x               |
| 0055     | AN 2 autolevel max gain    | 1/10 fixed point, 0.0dB-18.0dB             | x               |
| 0056     | AN 2 autolevel headroom    | 1/10 fixed point, 3.0dB-12.0dB             | x               |
| 0057     | AN 2 autolevel rise time   | 1/10 fixed point, 0.1-9.9                  | x               |
| ---      | ---                        |---                                         |                 |
| 0060     | AN3 mute                   | 0=off 1=on                                 | x               |
| 0061     | AN3 fx send                | 1/10 fixed point, -65.0dB-0.0dB            | x               |
| 0062     | AN3 stereo                 | 0=off 1=on                                 | x               |
| 0063     | AN3 record                 | 0=off 1=on                                 | x               |
| 0064     | AN3 Channel Name?          | All chennels set to 0xa                    | x               |
| 0065     | AN3 play channel           | 0=off 1=1/2 2=2/3 ... 79=79/80             | x               |
| 0066     | AN3 width                  | 1/100 fixed point, -1.00-1.00              |-1=ff9c,0=0000,+1=0064 |
| 0067     | AN3 msproc                 | 0=off 1=on                                 | x               |
| 0068     | AN3 phase invert           | 0=off 1=on                                 | x               |
| 0069     | AN3 gain                   | 1/10 fixed point, 0.0dB-12.0dB             | x               |
| 006A     | AN3 reflevel               | 0=+13 dBu 1=+19dBu                         | x               |
| 006D     | AN3 low cut enabled        | 0=off 1=on                                 | x               |
| 006E     | AN3 low cut freq           | 20Hz-500Hz                                 | x               |
| 006F     | AN3 low cut slope          | 0=6dB/oct 1=12dB/oct 2=18dB/oct 3=24dB/oct | x               |
| 0070     | AN3 eq enabled             | 0=off 1=on                                 | x               |
| 0071     | AN3 eq band 1 type         | 0=Peak 1=Low Shelf 2=High Pass 3=Low Pass  | x               |
| 0072     | AN3 eq band 1 gain         | 1/10 fixed point, -20.0dB-20.0dB           | x               |
| 0073     | AN3 eq band 1 freq         | 20Hz-20000Hz                               | x               |
| 0074     | AN3 eq band 1 q            | 1/10 fixed point, 0.4-9.9                  | x               |
| 0075     | AN3 eq band 2 gain         | 1/10 fixed point, -20.0dB-20.0dB           | x               |
| 0076     | AN3 eq band 2 freq         | 20Hz-20000Hz                               | x               |
| 0077     | AN3 eq band 2 q            | 1/10 fixed point, 0.4-9.9                  | x               |
| 0078     | AN3 eq band 3 type         | 0=Peak 1=High Shelf 2=Low Pass 3=High Pass | x               |
| 0079     | AN3 eq band 3 gain         | 1/10 fixed point, -20.0dB-20.0dB           | x               |
| 007A     | AN3 eq band 3 freq         | 20Hz-20000Hz                               | x               |
| 007B     | AN3 eq band 3 q            | 1/10 fixed point, 0.4-9.9                  | x               |
| 007C     | AN3 dynamics enabled       | 0=off 1=on                                 | x               |
| 007D     | AN3 dynamics gain          | 1/10 fixed point, -30.0dB-30.0dB           | x               |
| 007E     | AN3 dynamics attack        | 0-200                                      | x               |
| 007F     | AN3 dynamics release       | 100-999                                    | x               |
| 0080     | AN3 dynamics comp. thres.  | 1/10 fixed point, -60.0dB-0.0dB            | x               |
| 0081     | AN3 dynamics comp. ratio   | 1/10 fixed point, 1.0-10.0                 | x               |
| 0082     | AN3 dynamics exp. thres.   | 1/10 fixed point, -99.0dB--20.0dB          | x               |
| 0083     | AN3 dynamics exp. ratio    | 1/10 fixed point, 1.0-10.0                 | x               |
| 0084     | AN3 autolevel enabled      | 0=off 1=on                                 | x               |
| 0085     | AN3 autolevel max gain     | 1/10 fixed point, 0.0dB-18.0dB             | x               |
| 0086     | AN3 autolevel headroom     | 1/10 fixed point, 3.0dB-12.0dB             | x               |
| 0087     | AN3 autolevel rise time    | 1/10 fixed point, 0.1-9.9                  | x               |
| ---      | ---                        |---                                         |                 |
| 0090     | AN 4                       |                                            |                 |
| 00C0     | AN 5                       |                                            |                 |
| 00F0     | AN 6                       |                                            |                 |
| 0120     | AN 7                       |                                            |                 |
| 0150     | AN 8                       |                                            |                 |
| ---      | ---                        |---                                         |                 |
| 0180     | Mic/inst 9 mute            | 0=off 1=on                                 |x                |
| 018A     | Mic 9 48v                  | 0=off 1=on                                 |x|
| 018B     | Mic 9 hi-z                 | 0=off 1=on                                 |x|
| 018C     | Mic 9 autoset              | 0=off 1=on                                 |x|
| ---      | ---                        |---                                         |                 |
| 01B0     | Mic/inst 10 mute           | 0=off 1=on                                 |x                |
| 01BA     | Mic 10 48v                 | 0=off 1=on                                 |x|
| 01BB     | Mic 10 hi-z                | 0=off 1=on                                 |x|
| 01BC     | Mic 10 autoset             | 0=off 1=on                                 |x|
| ---      | ---                        |---                                         |                 |
| 01E0     | Mic/inst 11 mute           | 0=off 1=on                                 |x                |
| 01EA     | Mic 11 48v                 | 0=off 1=on                                 |x|
| 01EB     | Mic 11 hi-z                | 0=off 1=on                                 |x|
| 01EC     | Mic 11 autoset             | 0=off 1=on                                 |x|
| ---      | ---                        |---                                         |                 |
| 0210     | Mic/inst 12 mute           | 0=off 1=on                                 |x                |
| 021A     | Mic 12 48v                 | 0=off 1=on                                 |x|
| 021B     | Mic 12 hi-z                | 0=off 1=on                                 |x|
| 021C     | Mic 12 autoset             | 0=off 1=on                                 |x|
| ---      | ---                        |---                                         |                 |
| 0240     | AES L                      |                                            |                 |
| 0270     | AES R                      |                                            |                 |
| 02A0     | ADAT 1                     |                                            |                 |
| 02D0     | ADAT 2                     |                                            |                 |
| 0300     | ADAT 3                     |                                            |                 |
| 0330     | ADAT 4                     |                                            |                 |
| 0360     | ADAT 5                     |                                            |                 |
| 0390     | ADAT 6                     |                                            |                 |
| 03C0     | ADAT 7                     |                                            |                 |
| 03F0     | ADAT 8                     |                                            |                 |
| 0420     | ADAT 9                     |                                            |                 |
| 0450     | ADAT 10                    |                                            |                 |
| 0480     | ADAT 11                    |                                            |                 |
| 04B0     | ADAT 12                    |                                            |                 |
| 04E0     | ADAT 13                    |                                            |                 |
| 0510     | ADAT 14                    |                                            |                 |
| 0540     | ADAT 15                    |                                            |                 |
| 0570     | ADAT 16                    |                                            |                 |
| 05A0     | MAo 1                      |                                            |                 |
| 05D0     | MAo 2                      |                                            |                 |
| 0600     | MAo 3                      |                                            |                 |
| 0630     | MAo 4                      |                                            |                 |
| 0660     | MAo 5                      |                                            |                 |
| 0690     | MAo 6                      |                                            |                 |
| 06C0     | MAo 7                      |                                            |                 |
| 06F0     | MAo 8                      |                                            |                 |
| 0720     | MAo 9                      |                                            |                 |
| 0750     | MAo 10                     |                                            |                 |
| 0780     | MAo 11                     |                                            |                 |
| 07B0     | MAo 12                     |                                            |                 |
| 07E0     | MAo 13                     |                                            |                 |
| 0810     | MAo 14                     |                                            |                 |
| 0840     | MAo 15                     |                                            |                 |
| 0870     | MAo 16                     |                                            |                 |
| 08A0     | MAo 17                     |                                            |                 |
| 08D0     | MAo 18                     |                                            |                 |
| 0900     | MAo 19                     |                                            |                 |
| 0930     | MAo 20                     |                                            |                 |
| 0960     | MAo 21                     |                                            |                 |
| 0990     | MAo 22                     |                                            |                 |
| 09C0     | MAo 23                     |                                            |                 |
| 09F0     | MAo 24                     |                                            |                 |
| 0A20     | MAo 25                     |                                            |                 |
| 0A50     | MAo 26                     |                                            |                 |
| 0A80     | MAo 27                     |                                            |                 |
| 0AB0     | MAo 28                     |                                            |                 |
| 0AE0     | MAo 29                     |                                            |                 |
| 0B10     | MAo 30                     |                                            |                 |
| 0B40     | MAo 31                     |                                            |                 |
| 0B70     | MAo 32                     |                                            |                 |
| 0BA0     | MAc 1                      |                                            |                 |
| 0BD0     | MAc 2                      |                                            |                 |
| 0C00     | MAc 3                      |                                            |                 |
| 0C30     | MAc 4                      |                                            |                 |
| 0C60     | MAc 5                      |                                            |                 |
| 0C90     | MAc 6                      |                                            |                 |
| 0CC0     | MAc 7                      |                                            |                 |
| 0CF0     | MAc 8                      |                                            |                 |
| 0D20     | MAc 9                      |                                            |                 |
| 0D50     | MAc 10                     |                                            |                 |
| 0D80     | MAc 11                     |                                            |                 |
| 0DB0     | MAc 12                     |                                            |                 |
| 0DE0     | MAc 13                     |                                            |                 |
| 0E10     | MAc 14                     |                                            |                 |
| 0E40     | MAc 15                     |                                            |                 |
| 0E70     | MAc 16                     |                                            |                 |
| 0EA0     | MAc 17                     |                                            |                 |
| 0ED0     | MAc 18                     |                                            |                 |
| 0F00     | MAc 19                     |                                            |                 |
| 0F30     | MAc 20                     |                                            |                 |
| 0F60     | MAc 21                     |                                            |                 |
| 0F90     | MAc 22                     |                                            |                 |
| 0FC0     | MAc 23                     |                                            |                 |
| 0FF0     | MAc 24                     |                                            |                 |
| 1020     | MAc 25                     |                                            |                 |
| 1050     | MAc 26                     |                                            |                 |
| 1080     | MAc 27                     |                                            |                 |
| 10B0     | MAc 28                     |                                            |                 |
| 10E0     | MAc 29                     |                                            |                 |
| 1110     | MAc 30                     |                                            |                 |
| 1140     | MAc 31                     |                                            |                 |
| 1170     | MAc 32                     |                                            |                 |

### Outputs

| Register | Description                | Details                                    |Notes (x=verified)|
| -------- | -------------------------- | ------------------------------------------ |-----------------|
| 11A0     | AN 1 volume                | 1/10 fixed point, -65.0dB-6.0dB            |x **(fixed)**    |
| 11A1     | AN 1 balance               | -100-100                                   |x **(fixed)**    |
| 11A2     | AN 1 mute                  | 0=off 1=on                                 |x **(fixed)**    |
| 11A3     | AN 1 fx return             | 1/10 fixed point, -65.0dB-0.0dB            |x **(fixed)**    |
| 11A4     | AN 1 stereo                | 0=off 1=on                                 |x **(fixed)**    |
| 11A5     | AN 1 record                | 0=off 1=on                                 |x **(fixed)**    |
| 11A6     | AN 1 Channel Name?         |                                            |                 |
| 11A7     | AN 1 play channel          | 0=off 1=1/2 2=2/3 ... 59=59/60             |x **(fixed)**    |
| 11A8     | AN 1 phase invert          | 0=off 1=invert                             |x **(fixed)**    |
| 11A9     | AN 1 level                 | 0=-10dBV, 1=+4dBu, 2=Hi Gain 3=+24dBu      |x **(fixed)**    |
| 11AA     | AN 1 crossfeed             | 0=off, 1-5                                 |x **(fixed)**    |
| 11AB     | AN 1 volume cal.           | 1/100 fixed point, -24.00dB-3.00dB         |x **(fixed)**    |
| 11AD     | AN 1 low cut enabled       | 0=off 1=on                                 |x **(fixed)**    |
| 11AE     | AN 1 low cut freq          | 20Hz-500Hz                                 |x **(fixed)**    |
| 11AF     | AN 1 low cut slope         | 0=6dB/oct 1=12dB/oct 2=18dB/oct 3=24dB/oct |x **(fixed)**    |
| 11B0     | AN 1 eq enabled            | 0=off 1=on                                 |x **(fixed)**    |
| 11B1     | AN 1 eq band 1 type        | 0=Peak 1=Low Shelf 2=High Pass 3=Low Pass  |x **(fixed)**    |
| 11B2     | AN 1 eq band 1 gain        | 1/10 fixed point, -20.0dB-20.0dB           |x **(fixed)**    |
| 11B3     | AN 1 eq band 1 freq        | 20Hz-20000Hz                               |x **(fixed)**    |
| 11B4     | AN 1 eq band 1 q           | 1/10 fixed point, 0.4-9.9                  |x **(fixed)**    |
| 11B5     | AN 1 eq band 2 gain        | 1/10 fixed point, -20.0dB-20.0dB           |x **(fixed)**    |
| 11B6     | AN 1 eq band 2 freq        | 20Hz-20000Hz                               |x **(fixed)**    |
| 11B7     | AN 1 eq band 2 q           | 1/10 fixed point, 0.4-9.9                  |x **(fixed)**    |
| 11B8     | AN 1 eq band 3 type        | 0=Peak 1=High Shelf 2=Low Pass 3=High Pass |x **(fixed)**    |
| 11B9     | AN 1 eq band 3 gain        | 1/10 fixed point, -20.0dB-20.0dB           |x **(fixed)**    |
| 11BA     | AN 1 eq band 3 freq        | 20Hz-20000Hz                               |x **(fixed)**    |
| 11BB     | AN 1 eq band 3 q           | 1/10 fixed point, 0.4-9.9                  |x **(fixed)**    |
| 11BC     | AN 1 dynamics enabled      | 0=off 1=on                                 |x **(fixed)**    |
| 11BD     | AN 1 dynamics gain         | 1/10 fixed point, -30.0dB-30.0dB           |x **(fixed)**    |
| 11BE     | AN 1 dynamics attack       | 0-200                                      |x **(fixed)**    |
| 11BF     | AN 1 dynamics release      | 100-999                                    |x **(fixed)**    |
| 11C0     | AN 1 dynamics comp. thres. | 1/10 fixed point, -60.0dB-0.0dB            |x **(fixed)**    |
| 11C1     | AN 1 dynamics comp. ratio  | 1/10 fixed point, 1.0-10.0                 |x **(fixed)**    |
| 11C2     | AN 1 dynamics exp. thres.  | 1/10 fixed point, -99.0dB--20.0dB          |x **(fixed)**    |
| 11C3     | AN 1 dynamics exp. ratio   | 1/10 fixed point, 1.0-10.0                 |x **(fixed)**    |
| 11C4     | AN 1 autolevel enabled     | 0=off 1=on                                 |x **(fixed)**    |
| 11C5     | AN 1 autolevel max gain    | 1/10 fixed point, 0.0dB-18.0dB             |x **(fixed)**    |
| 11C6     | AN 1 autolevel headroom    | 1/10 fixed point, 3.0dB-12.0dB             |x **(fixed)**    |
| 11C7     | AN 1 autolevel rise time   | 1/10 fixed point, 0.1-9.9                  |x **(fixed)**    |
| 11D0     | AN 2 volume                | 1/10 fixed point, -65.0-6.0                |x                |
| ...      | ...                        | ...                                        |                 |
| 1200     | AN 3                       |                                            |                 |
| 1230     | AN 4                       |                                            |                 |
| 1260     | AN 5                       |                                            |                 |
| 1290     | AN 6                       |                                            |                 |
| 12C0     | AN 7                       |                                            |                 |
| 12F0     | AN 8                       |                                            |                 |
| 1320     | PH 9                       |                                            |                 |
| 1350     | PH 10                      |                                            |                 |
| 1380     | PH 11                      |                                            |                 |
| 13B0     | PH 12                      |                                            |                 |
| 13E0     | AES L                      |                                            |                 |
| 1410     | AES R                      |                                            |                 |
| 1440     | ADAT 1                     |                                            |                 |
| 1470     | ADAT 2                     |                                            |                 |
| 14A0     | ADAT 3                     |                                            |                 |
| 14D0     | ADAT 4                     |                                            |                 |
| 1500     | ADAT 5                     |                                            |                 |
| 1530     | ADAT 6                     |                                            |                 |
| 1560     | ADAT 7                     |                                            |                 |
| 1590     | ADAT 8                     |                                            |                 |
| 15C0     | ADAT 9                     |                                            |                 |
| 15F0     | ADAT 10                    |                                            |                 |
| 1620     | ADAT 11                    |                                            |                 |
| 1650     | ADAT 12                    |                                            |                 |
| 1680     | ADAT 13                    |                                            |                 |
| 16B0     | ADAT 14                    |                                            |                 |
| 16E0     | ADAT 15                    |                                            |                 |
| 1710     | ADAT 16                    |                                            |                 |
| 1740     | MA 1                       |                                            |                 |
| 1770     | MA 2                       |                                            |                 |
| 17A0     | MA 3                       |                                            |                 |
| 17D0     | MA 4                       |                                            |                 |
| 1800     | MA 5                       |                                            |                 |
| 1830     | MA 6                       |                                            |                 |
| 1860     | MA 7                       |                                            |                 |
| 1890     | MA 8                       |                                            |                 |
| 18C0     | MA 9                       |                                            |                 |
| 18F0     | MA 10                      |                                            |                 |
| 1920     | MA 11                      |                                            |                 |
| 1950     | MA 12                      |                                            |                 |
| 1980     | MA 13                      |                                            |                 |
| 19B0     | MA 14                      |                                            |                 |
| 19E0     | MA 15                      |                                            |                 |
| 1A10     | MA 16                      |                                            |                 |
| 1A40     | MA 17                      |                                            |                 |
| 1A70     | MA 18                      |                                            |                 |
| 1AA0     | MA 19                      |                                            |                 |
| 1AD0     | MA 20                      |                                            |                 |
| 1B00     | MA 21                      |                                            |                 |
| 1B30     | MA 22                      |                                            |                 |
| 1B60     | MA 23                      |                                            |                 |
| 1B90     | MA 24                      |                                            |                 |
| 1BC0     | MA 25                      |                                            |                 |
| 1BF0     | MA 26                      |                                            |                 |
| 1C20     | MA 27                      |                                            |                 |
| 1C50     | MA 28                      |                                            |                 |
| 1C80     | MA 29                      |                                            |                 |
| 1CB0     | MA 30                      |                                            |                 |
| 1CE0     | MA 31                      |                                            |                 |
| 1D10     | MA 32                      |                                            |                 |
| 1D40     | MA 33                      |                                            |                 |
| 1D70     | MA 34                      |                                            |                 |
| 1DA0     | MA 35                      |                                            |                 |
| 1DD0     | MA 36                      |                                            |                 |
| 1E00     | MA 37                      |                                            |                 |
| 1E30     | MA 38                      |                                            |                 |
| 1E60     | MA 39                      |                                            |                 |
| 1E90     | MA 40                      |                                            |                 |
| 1EC0     | MA 41                      |                                            |                 |
| 1EF0     | MA 42                      |                                            |                 |
| 1F20     | MA 43                      |                                            |                 |
| 1F50     | MA 44                      |                                            |                 |
| 1F80     | MA 45                      |                                            |                 |
| 1FB0     | MA 46                      |                                            |                 |
| 1FE0     | MA 47                      |                                            |                 |
| 2010     | MA 48                      |                                            |                 |
| 2040     | MA 49                      |                                            |                 |
| 2070     | MA 50                      |                                            |                 |
| 20A0     | MA 51                      |                                            |                 |
| 20D0     | MA 52                      |                                            |                 |
| 2100     | MA 53                      |                                            |                 |
| 2130     | MA 54                      |                                            |                 |
| 2160     | MA 55                      |                                            |                 |
| 2190     | MA 56                      |                                            |                 |
| 21C0     | MA 57                      |                                            |                 |
| 21F0     | MA 58                      |                                            |                 |
| 2220     | MA 59                      |                                            |                 |
| 2250     | MA 60                      |                                            |                 |
| 2280     | MA 61                      |                                            |                 |
| 22B0     | MA 62                      |                                            |                 |
| 22E0     | MA 63                      |                                            |x **(fixed)**    |
| 2310     | MA 64                      |                                            |x **(fixed)**    |

### Playbacks

| Register | Description                | Details                                    |Notes (x=verified)|
| -------- | -------------------------- | ------------------------------------------ |-----------------|
| 2340     | AN 1 mute                  | 0=off 1=on                                 |x                |
| 2341     | AN 1 fx send               | 1/10 fixed point, -65.0dB-0.0dB            |x                |
| 2342     | AN 1 stereo                | 0=off 1=on                                 |x                |
| 2343     | AN 1 width                 | 1/100 fixed point, -1.00-1.00              |x                |
| 2344     | AN 1 ms proc               | 0=off 1=on                                 |x                |
| 2345     | AN 1 phase invert          | 0=off 1=on                                 |x                |
| 234A     | AN 2                       |                                            |                 |
| 2354     | AN 3                       |                                            |                 |
| 235E     | AN 4                       |                                            |                 |
| 2368     | AN 5                       |                                            |                 |
| 2372     | AN 6                       |                                            |                 |
| 237C     | AN 7                       |                                            |                 |
| 2386     | AN 8                       |                                            |                 |
| 2390     | PH 9                       |                                            |                 |
| 239A     | PH 10                      |                                            |                 |
| 23A4     | PH 11                      |                                            |                 |
| 23AE     | PH 12                      |                                            |                 |
| 23B8     | AES L                      |                                            |                 |
| 23C2     | AES R                      |                                            |                 |
| 23CC     | ADAT 1                     |                                            |                 |
| 23D6     | ADAT 2                     |                                            |                 |
| 23E0     | ADAT 3                     |                                            |                 |
| 23EA     | ADAT 4                     |                                            |                 |
| 23F4     | ADAT 5                     |                                            |                 |
| 23FE     | ADAT 6                     |                                            |                 |
| 2408     | ADAT 7                     |                                            |                 |
| 2412     | ADAT 8                     |                                            |                 |
| 241C     | ADAT 9                     |                                            |                 |
| 2426     | ADAT 10                    |                                            |                 |

### Reverb

| Register | Description                | Details                                    |Notes (x=verified)|
| -------- | -------------------------- | ------------------------------------------ |-----------------|
| 3000     | reverb enabled             | 0=off 1=on                                 |x                |
| 3001     | reverb type                | 0=Small Room 1=Medium Room 2=Large Room 3=Walls 4=Shorty 5=Attack 6=Swagger 7=Old School 8=Echoistic 9=8plus9 10=Grand Wide 11=Thicker 12=Envelope 13=Gated 14=Space |x                |
| 3002     | reverb predelay            | 0-999                                      |x                |
| 3003     | reverb low cut             | 20Hz-500Hz                                 |x                |
| 3004     | reverb room scale          | 1/100 fixed point, 0.50-2.00 (type 0-11 only) |x                |
| 3005     | reverb attack              | 5-400 (envelope only)                      |x                |
| 3006     | reverb hold                | 5-400 (envelope, gated only)               |x                |
| 3007     | reverb release             | 5-500 (envelope, gated only)               |x                |
| 3008     | reverb high cut            | 2000Hz-20000Hz                             |x                |
| 3009     | reverb time                | 1/10 fixed point 0.1-4.9 (classic only)    |x                |
| 300A     | reverb high damp           | 2000Hz-20000Hz (classic only)              |x                |
| 300B     | reverb smooth              | 0-100                                      |x                |
| 300C     | reverb volume              | 1/10 fixed point, -65.0dB-6.0dB            |x                |
| 300D     | reverb width               | 1/100 fixed point, 0.00-1.00               |x                |

### Echo

| Register | Description                | Details                                    |Notes (x=verified)|
| -------- | -------------------------- | ------------------------------------------ |-----------------|
| 3014     | echo enabled               | 0=off 1=on                                 |x                |
| 3015     | echo type                  | 0=Stereo Echo 1=Stereo Cross 2=Pong Echo   |x                |
| 3016     | echo delay time            | 1/100 fixed point, 0.00-2.00               |x                |
| 3017     | echo feedback              | 0-100                                      |x                |
| 3018     | echo high cut              | 0=off 1=16k 2=12k 3=8k 4=4k 5=2k           |x                |
| 3019     | echo volume                | 1/10 fixed point, -65.0dB-6.0dB            |x                |
| 301A     | echo width                 | 1/100 fixed point, 0.00-1.00               |x                |

### Room EQ

| Register | Description                | Details                                    |
| -------- | -------------------------- | ------------------------------------------ |
| 3426     | AN 1 delay                 | 1/100 fixed point, 0.00ms–42.50ms          |
| 3427     | AN 1 room EQ enable        | 0=off 1=on                                 |
| 3428     | AN 1 room EQ band 1 type   | 0=Bell 1=Low Shelf 2=High Pass 3=Low Pass  |
| 3429     | AN 1 room EQ band 1 gain   | 1/10 fixed point, -20.0dB–20.0dB           |
| 342A     | AN 1 room EQ band 1 freq   | 20Hz–20000Hz                               |
| 342B     | AN 1 room EQ band 1 q      | 0.4–9.9                                    |
| 342C     | AN 1 room EQ band 2 gain   | 1/10 fixed point, -20.0dB–20.0dB           |
| 342D     | AN 1 room EQ band 2 freq   | 20Hz–20000Hz                               |
| 342E     | AN 1 room EQ band 2 q      | 0.4–9.9                                    |
| 342F     | AN 1 room EQ band 3 gain   | 1/10 fixed point, -20.0dB–20.0dB           |
| 3430     | AN 1 room EQ band 3 freq   | 20Hz–20000Hz                               |
| 3431     | AN 1 room EQ band 3 q      | 0.4–9.9                                    |
| 3432     | AN 1 room EQ band 4 gain   | 1/10 fixed point, -20.0dB–20.0dB           |
| 3433     | AN 1 room EQ band 4 freq   | 20Hz–20000Hz                               |
| 3434     | AN 1 room EQ band 4 q      | 0.4–9.9                                    |
| 3435     | AN 1 room EQ band 5 gain   | 1/10 fixed point, -20.0dB–20.0dB           |
| 3436     | AN 1 room EQ band 5 freq   | 20Hz–20000Hz                               |
| 3437     | AN 1 room EQ band 5 q      | 0.4–9.9                                    |
| 3438     | AN 1 room EQ band 6 gain   | 1/10 fixed point, -20.0dB–20.0dB           |
| 3439     | AN 1 room EQ band 6 freq   | 20Hz–20000Hz                               |
| 343A     | AN 1 room EQ band 6 q      | 0.4–9.9                                    |
| 343B     | AN 1 room EQ band 7 gain   | 1/10 fixed point, -20.0dB–20.0dB           |
| 343C     | AN 1 room EQ band 7 freq   | 20Hz–20000Hz                               |
| 343D     | AN 1 room EQ band 7 q      | 0.4–9.9                                    |
| 343E     | AN 1 room EQ band 8 type   | 0=Bell 1=High Shelf 2=Low Pass 3=High Pass |
| 343F     | AN 1 room EQ band 8 gain   | 1/10 fixed point, -20.0dB–20.0dB           |
| 3440     | AN 1 room EQ band 8 freq   | 20Hz–20000Hz                               |
| 3441     | AN 1 room EQ band 8 q      | 0.4–9.9                                    |
| 3442     | AN 1 room EQ band 9 type   | 0=Bell 1=High Shelf 2=Low Pass 3=High Pass |
| 3443     | AN 1 room EQ band 9 gain   | 1/10 fixed point, -20.0dB–20.0dB           |
| 3444     | AN 1 room EQ band 9 freq   | 20Hz–20000Hz                               |
| 3445     | AN 1 room EQ band 9 q      | 0.4–9.9                                    |
|...	  | ...                        | ...                                        |
| 3446     | AN 2 delay                 | 1/100 fixed point, 0.00ms–42.50ms          |
| 3447     | AN 2 room EQ enable        | 0=off 1=on                                 |
|...	  | ...                        | ...                                        |
| 3466     | AN 3 delay                 | 1/100 fixed point, 0.00ms–42.50ms          |
| 3467     | AN 3 room EQ enable        | 0=off 1=on                                 |
|...	  | ...                        | ...                                        |
| 3486     | AN 4 delay                 | 1/100 fixed point, 0.00ms–42.50ms          |
| 3487     | AN 4 room EQ enable        | 0=off 1=on                                 |
|...	  | ...                        | ...                                        |
| 34A6     | AN 5 delay                 | 1/100 fixed point, 0.00ms–42.50ms          |
| 34A7     | AN 5 room EQ enable        | 0=off 1=on                                 |
|...	  | ...                        | ...                                        |
| 34C6     | AN 6 delay                 | 1/100 fixed point, 0.00ms–42.50ms          |
| 34C7     | AN 6 room EQ enable        | 0=off 1=on                                 |
|...	  | ...                        | ...                                        |
| 34E6     | AN 7 delay                 | 1/100 fixed point, 0.00ms–42.50ms          |
| 34E7     | AN 7 room EQ enable        | 0=off 1=on                                 |
|...	  | ...                        | ...                                        |
| 3506     | AN 8 delay                 | 1/100 fixed point, 0.00ms–42.50ms          |
| 3507     | AN 8 room EQ enable        | 0=off 1=on                                 |
| ...      | ...                        | ...                                        |
| 3526     | PH 9 delay                 | 1/100 fixed point, 0.00ms–42.50ms          |
| 3527     | PH 9 room EQ enable        | 0=off 1=on                                 |
| ...      | ...                        | ...                                        |
| 3546     | PH 10 delay                | 1/100 fixed point, 0.00ms–42.50ms          |
| 3547     | PH 10 room EQ enable       | 0=off 1=on                                 |
| ...      | ...                        | ...                                        |
| 3566     | PH 11 delay                | 1/100 fixed point, 0.00ms–42.50ms          |
| 3567     | PH 11 room EQ enable       | 0=off 1=on                                 |
| ...      | ...                        | ...                                        |
| 3586     | PH 12 delay                | 1/100 fixed point, 0.00ms–42.50ms          |
| 3587     | PH 12 room EQ enable       | 0=off 1=on                                 |
| ...      | ...                        | ...                                        |
| 35A6     | AES L delay                | 1/100 fixed point, 0.00ms–42.50ms          |
| 35A7     | AES L room EQ enable       | 0=off 1=on                                 |
| ...      | ...                        | ...                                        |
| 35C6     | AES R delay                | 1/100 fixed point, 0.00ms–42.50ms          |
| 35C7     | AES R room EQ enable       | 0=off 1=on                                 |
| ...      | ...                        | ...                                        |
| 35E6     | ADAT 1 delay               | 1/100 fixed point, 0.00ms–42.50ms          |
| 35E7     | ADAT 1 room EQ enable      | 0=off 1=on                                 |
| ...      | ...                        | ...                                        |
| 3606     | ADAT 2 delay               | 1/100 fixed point, 0.00ms–42.50ms          |
| 3607     | ADAT 2 room EQ enable      | 0=off 1=on                                 |
| ...      | ...                        | ...                                        |
| 3626     | ADAT 3 delay               | 1/100 fixed point, 0.00ms–42.50ms          |
| 3627     | ADAT 3 room EQ enable      | 0=off 1=on                                 |
| ...      | ...                        | ...                                        |
| 3646     | ADAT 4 delay               | 1/100 fixed point, 0.00ms–42.50ms          |
| 3647     | ADAT 4 room EQ enable      | 0=off 1=on                                 |
| ...      | ...                        | ...                                        |
| 3666     | ADAT 5 delay               | 1/100 fixed point, 0.00ms–42.50ms          |
| 3667     | ADAT 5 room EQ enable      | 0=off 1=on                                 |
| ...      | ...                        | ...                                        |
| 3686     | ADAT 6 delay               | 1/100 fixed point, 0.00ms–42.50ms          |
| 3687     | ADAT 6 room EQ enable      | 0=off 1=on                                 |
| ...      | ...                        | ...                                        |
| 36A6     | ADAT 7 delay               | 1/100 fixed point, 0.00ms–42.50ms          |
| 36A7     | ADAT 7 room EQ enable      | 0=off 1=on                                 |
| ...      | ...                        | ...                                        |
| 36C6     | ADAT 8 delay               | 1/100 fixed point, 0.00ms–42.50ms          |
| 36C7     | ADAT 8 room EQ enable      | 0=off 1=on                                 |
| ...      | ...                        | ...                                        |
| 36E6     | ADAT 9 delay               | 1/100 fixed point, 0.00ms–42.50ms          |
| 36E7     | ADAT 9 room EQ enable      | 0=off 1=on                                 |
| ...      | ...                        | ...                                        |
| 3706     | ADAT 10 delay              | 1/100 fixed point, 0.00ms–42.50ms          |
| 3707     | ADAT 10 room EQ enable     | 0=off 1=on                                 |
| ...      | ...                        | ...                                        |
| 3726     | ADAT 11 delay              | 1/100 fixed point, 0.00ms–42.50ms          |
| 3727     | ADAT 11 room EQ enable     | 0=off 1=on                                 |
| ...      | ...                        | ...                                        |
| 3746     | ADAT 12 delay              | 1/100 fixed point, 0.00ms–42.50ms          |
| 3747     | ADAT 12 room EQ enable     | 0=off 1=on                                 |
| ...      | ...                        | ...                                        |
| 3766     | ADAT 13 delay              | 1/100 fixed point, 0.00ms–42.50ms          |
| 3767     | ADAT 13 room EQ enable     | 0=off 1=on                                 |
| ...      | ...                        | ...                                        |
| 3786     | ADAT 14 delay              | 1/100 fixed point, 0.00ms–42.50ms          |
| 3787     | ADAT 14 room EQ enable     | 0=off 1=on                                 |
| ...      | ...                        | ...                                        |
| 37A6     | ADAT 15 delay              | 1/100 fixed point, 0.00ms–42.50ms          |
| 37A7     | ADAT 15 room EQ enable     | 0=off 1=on                                 |
| ...      | ...                        | ...                                        |
| 37C6     | ADAT 16 delay              | 1/100 fixed point, 0.00ms–42.50ms          |
| 37C7     | ADAT 16 room EQ enable     | 0=off 1=on                                 |
| ...      | ...                        | ...                                        |
| 37E6     | MA 1 delay                 | 1/100 fixed point, 0.00ms–42.50ms          |
| 37E7     | MA 1 room EQ enable        | 0=off 1=on                                 |
| ...      | ...                        | ...                                        |
| 3806     | MA 2 delay                 | 1/100 fixed point, 0.00ms–42.50ms          |
| 3807     | MA 2 room EQ enable        | 0=off 1=on                                 |
| ...      | ...                        | ...                                        |
| ...      | ... (MA 3 ... MA 63)       | ...                                        |
| 3FC6     | MA 64 delay                | 1/100 fixed point, 0.00ms–42.50ms          |
| 3FC7     | MA 64 room EQ enable       | 0=off 1=on                                 |
| ...      | ...                        | ...                                        |

### Control Room

| Register | Description                | Details                                    |Notes (x=verified)|
| -------- | -------------------------- | ------------------------------------------ |-----------------|
| 3050     | main out                   | 0=off 1=AN 1/2 2=AN 3/4 ... 46=MA 63/64    |x **(fixed)**    |
| 3051     | mute mono                  | 0=off 1=on                                 |x **(fixed)**    |
| 3052     | mute enable                | 0=off 1=on                                 |x **(fixed)**    |
| 3053     | main out dim               | 1/10 fixed point, -65.0dB-0.0dB            |x **(fixed)**    |
| 3054     | dim                        | 0=off 1=on                                 |x **(fixed)**    |
| 3055     | recall volume              | 1/10 fixed point, -65.0dB-0.0dB            |x **(fixed)**    |

### Clock

| Register | Description                | Details                                    |Notes (x=verified)|
| -------- | -------------------------- | ------------------------------------------ |-----------------|
| 3064     | clock source               | 0=Internal 1=Word Clock 2=AES 3=OPT 1 4=OPT 2 5=MADI O 6=MADI C |x **(fixed)**    |
| 3065     | sample rate                | 0=32000 1=44100 2=48000 3=64000 4=88200 5=96000 6=128000 7=176400 8=192000 |x **(fixed)**    |
| 3066     | word clock single speed    | 0=off 1=on                                 |x **(fixed)**    |
| 3067     | word clock term            | 0=off 1=on                                 |x **(fixed)**    |

### Clock - Available Sample Rates (on MacOS in CC-Mode)

| Value | Sample Rate | 94ch      | 54ch      | 34ch      |
|-------|-------------|-----------|-----------|-----------|
| 0000  | 32000       | no        | no        | no        |
| 0001  | 44100       | yes       | yes       | yes       |
| 0002  | 48000       | yes       | yes       | yes       |
| 0003  | 64000       | no        | no        | no        |
| 0004  | 88200       | no        | yes       | yes       |
| 0005  | 96000       | no        | yes       | yes       |
| 0006  | 128000      | no        | no        | no        |
| 0007  | 176400      | no        | no        | yes       |
| 0008  | 192000      | no        | no        | yes       |

Note: The Mixable 94/54/34 channel format (24 Bit Signed Integer) modes can be selected in AMS App individually for Inputs and Outputs.

### Hardware

| Register | Description                | Details                                    |Notes (x=verified)|
| -------- | -------------------------- | ------------------------------------------ |-----------------|
| 3078     | AES input                  | 0=XLR 1=Optical 2                          |x **(fixed)**    |
| 3079     | Optical Out 1              | 0=ADAT 1=SPDIF                             |x **(fixed)**    |
| 307A     | Optical Out 2              | 0=ADAT 1=SPDIF 2=AES                       |x **(fixed)**    |
| 307B     | AES channel status         | 0=Consumer 1=Professional                  |x **(fixed)**    |
| 307C     | Interface Mode             | 0=Auto 1=USB2 2=USB3 3=CC                  |x **(fixed)**    |
| 307D     | CC Routing                 | 0=All Ch. 1=Phones                         |x **(fixed)**    |
| 307E     | Standalone MIDI            | 0=off 1=MIDI 1 2=MIDI 2 3=MADI O 4=MADI C  |x **(fixed)**    |
| 307F     | Standalone ARC             | 0=volume 1=1s op 2=normal                  |x **(fixed)**    |
| 3080     | Lock Keys                  | 0=off 1=Keys 2=All                         |x **(fixed)**    |
| 3081     | Remap Keys                 | 0=off 1=on                                 |x **(fixed)**    |
| 3082     | MIC / GAIN                 | 0=Default 1=Setup ... 0x0021=TotalMix      |x **(fixed)**    |
| 3083     | REC / PLAY                 | 0=Default 1=Setup ... 0x0021=TotalMix      |x **(fixed)**    |
| 3084     | CHAN / MIX                 | 0=Default 1=Setup ... 0x0021=TotalMix      |x **(fixed)**    |
| 3085     | SETUP / R.                 | 0=Default 1=Setup ... 0x0021=TotalMix      |x **(fixed)**    |
| 3086     | LCD Contrast               | FFEC=-20% ... FFFF=-1% 0=0% ... 0014=20%   |x **(fixed)**    |
| 3087     | Test Results               | 0=? ... 5=MSD?                             |x **(fixed)**    |
| 3088?    | SW Version?                | Change on Panel does not show any Reg/Val  |x **(fixed)**    |
| ...     |                     |         |   |
| 308C     | MADI input                 | 0=Optical 1=Coaxial 2=Auto 3=Split         |x                |
| 308D     | MADI output                | 0=Optical 1=Mirror 2=Split                 |x                |
| 308E     | MADI frames                | 0=96k 1=48k                                |x **(fixed)**    |
| 308F     | MADI format                | 0=56 channels 1=64 channels                |x **(fixed)**    |
| 3200     | DSP version/load           | [0:7]=DSP load [8:15]=DSP version          |x                |
| 3201     | DSP function available     |                                            |x                |
| 3202     | DSP function overload      | [8:15]=channel                             |x                |
| 3203?     | ARC encoder delta          |                                           |x                |
| 3D43?    | standalone MIDI            |                                            |x                |
| 3D44?    | CC-mode                    | 0=off 1=on                                 |x                |
| 3D45?    | standalone ARC             |                                            |x                |

### State

| Register | Description                | Details                                    |Notes (x=verified)|
| -------- | -------------------------- | ------------------------------------------ |-----------------|
| 3E00     | cue                        | FFFF=no cue, [0:7]=cue to [8:15]=cue from  |x                |
| 3E02     | ARC USB LEDs               |                                            |x                |
| 3E03   | dump registers?              | 234A  (seems to be wrong, don't remember why I took it from UFX+)        |x|
| **3E04** | **dump registers**         | **67CD**           |x|
| 3E06     | store state                | 0910=slot 1 0911=slot 2 0912=slot 3 0913=slot 4 0914=slot 5 0915=slot 6 |x                |
| 3E07     | ?                          | set to 3 by totalmix on startup            |x                |
| 3E08     | time                       | [0:7]=minute [8:15]=hour                   |x                |
| 3E09     | date                       | [0:4]=day [5:8]=month [9:13]=year - 2000   |x                |



### DUREC [W]

| Register | Description       | Details                                                                                                                                  |
|----------|-------------------|------------------------------------------------------------------------------------------------------------------------------------------|
| 3E9A     | Play Control       | 0x8120=STOP RECORD, 0x8121=STOP, 0x8122=RECORD, 0x8123=PLAY/PAUSE                                                                       |
| 3E9B     | Delete             | INT, INDEX WITH HIGH BIT SET                                                                                                            |
| 3E9C     | Track Select       | INT                                                                                                                                      |
| 3E9D     | Seek               | INT, SECONDS                                                                                                                            |
| 3E9E     | Track Next/Prev    | 0=PREVIOUS, 1=NEXT                                                                                                                      |
| 3E9F     | Next Track         | 0xFFFF=STOP, 0x8000=TRACK 1, 0x8001=TRACK 2, ...                                                                                        |
| 3EA0     | Play Mode          | 0x8000=SINGLE, 0x8001=UFX SINGLE, 0x8002=CONTINUOUS, 0x8003=SINGLE NEXT, 0x8004=REPEAT SINGLE, 0x8005=REPEAT ALL                        |

### DUREC STATUS [R]

| Register | Description              | Details                                                                                                                                         |
|----------|--------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------|
| 3580     | System State             | [0:3] 0=NO MEDIA, 2=INITIALIZING, 3=DELETING?, 5=STOPPED, 6=RECORDING, A=PLAYING  <br> [4:7] ?  <br> [8:15] PROGRESS BAR, 00=0%, 41=100%         |
| 3581     | Playback/Record Position | —                                                                                                                                               |
| 3582     | Unknown                  | —                                                                                                                                               |
| 3583     | USB Load/Errors          | [0:7] ERRORS  <br> [8:15] LOAD %                                                                                                                |
| 3584     | Total Space              | GB * 16                                                                                                                                         |
| 3585     | Free Space               | GB * 16                                                                                                                                         |
| 3586     | Total Tracks             | —                                                                                                                                               |
| 3587     | Selected Track           | —                                                                                                                                               |
| 3588     | Next Track / Play Mode   | [0:11] NEXT TRACK (FFF=NONE)  <br> [12:15] PLAY MODE: 0=SINGLE, 1=UFX SINGLE, 2=CONTINUOUS, 3=SINGLE NEXT, 4=REPEAT SINGLE, 5=REPEAT ALL         |
| 3589     | Remaining Record Time    | —                                                                                                                                               |
| 358A     | Track Info               | 0xFFFF=NAME OF LAST PLAYED TRACK AND PENDING RECORD TRACKS / SAMPLE RATE                                                                       |
| 358B     | Filename [0:1]           | —                                                                                                                                               |
| 358C     | Filename [2:3]           | —                                                                                                                                               |
| 358D     | Filename [4:5]           | —                                                                                                                                               |
| 358E     | Filename [6:7]           | —                                                                                                                                               |
| 358F     | Sample Rate / Channels   | [0:7]=SAMPLE RATE ENUM, [8:15]=CHANNELS                                                                                                         |
| 3590     | Track Length             | —                                                                                                                                               |

---

### Mixer 

#### Mixer Inputs

| Register | Description                | Details see [Mixer value format](#mixer-value-format) |
| -------- | -------------------------- | ------------------------------------------ |
| 4000     | IN AN 1 → AN 1/2           |                                            |
| 4001     | IN AN 1 → AN 3/4           |                                            |
| 4002     | IN AN 1 → AN 5/6           |                                            |
| 4003     | IN AN 1 → AN 7/8           |                                            |
| 4004     | IN AN 1 → PH 9/10          |                                            |
| 4005     | IN AN 1 → PH 11/12         |                                            |
| 4006     | IN AN 1 → AES L/R          |                                            |
| 4007     | IN AN 1 → ADAT 1/2         |                                            |
| 4008     | IN AN 1 → ADAT 3/4         |                                            |
| 4009     | IN AN 1 → ADAT 5/6         |                                            |
| 400A     | IN AN 1 → ADAT 7/8         |                                            |
| 400B     | IN AN 1 → ADAT 9/10        |                                            |
| 400C     | IN AN 1 → ADAT 11/12       |                                            |
| 400D     | IN AN 1 → ADAT 13/14       |                                            |
| 400E     | IN AN 1 → ADAT 15/16       |                                            |
| 400F     | IN AN 1 → MA 1/2           |                                            |
| 4010     | IN AN 1 → MA 3/4           |                                            |
| 4011     | IN AN 1 → MA 5/6           |                                            |
| 4012     | IN AN 1 → MA 7/8           |                                            |
| 4013     | IN AN 1 → MA 9/10          |                                            |
| 4014     | IN AN 1 → MA 11/12         |                                            |
| 4015     | IN AN 1 → MA 13/14         |                                            |
| 4016     | IN AN 1 → MA 15/16         |                                            |
| 4017     | IN AN 1 → MA 17/18         |                                            |
| 4018     | IN AN 1 → MA 19/20         |                                            |
| 4019     | IN AN 1 → MA 21/22         |                                            |
| 401A     | IN AN 1 → MA 23/24         |                                            |
| 401B     | IN AN 1 → MA 25/26         |                                            |
| 401C     | IN AN 1 → MA 27/28         |                                            |
| 401D     | IN AN 1 → MA 29/30         |                                            |
| 401E     | IN AN 1 → MA 31/32         |                                            |
| 401F     | IN AN 1 → MA 33/34         |                                            |
| 4020     | IN AN 1 → MA 35/36         |                                            |
| 4021     | IN AN 1 → MA 37/38         |                                            |
| 4022     | IN AN 1 → MA 39/40         |                                            |
| 4023     | IN AN 1 → MA 41/42         |                                            |
| 4024     | IN AN 1 → MA 43/44         |                                            |
| 4025     | IN AN 1 → MA 45/46         |                                            |
| 4026     | IN AN 1 → MA 47/48         |                                            |
| 4027     | IN AN 1 → MA 49/50         |                                            |
| 4028     | IN AN 1 → MA 51/52         |                                            |
| 4029     | IN AN 1 → MA 53/54         |                                            |
| 402A     | IN AN 1 → MA 55/56         |                                            |
| 402B     | IN AN 1 → MA 57/58         |                                            |
| 402C     | IN AN 1 → MA 59/60         |                                            |
| 402D     | IN AN 1 → MA 61/62         |                                            |
| 402E     | IN AN 1 → MA 63/64         |                                            |
| 4040     | IN AN 2 → AN 1/2           |                                            |
| ...      | ...                        | ...                                        |
| 4080     | IN AN 3 → AN 1/2           |                                            |
| ...      | ...                        | ...                                        |
| 40C0     | IN AN 4 → AN 1/2           |                                            |
| ...      | ...                        | ...                                        |
| 4100     | IN AN 5 → AN 1/2           |                                            |
| ...      | ...                        | ...                                        |
| 4140     | IN AN 6 → AN 1/2           |                                            |
| ...      | ...                        | ...                                        |
| 4180     | IN AN 7 → AN 1/2           |                                            |
| ...      | ...                        | ...                                        |
| 41C0     | IN AN 8 → AN 1/2           |                                            |
| ...      | ...                        | ...                                        |
| 4200     | IN Mic 9 → AN 1/2          |                                            |
| ...      | ...                        | ...                                        |
| 4240     | IN Mic 10 → AN 1/2         |                                            |
| ...      | ...                        | ...                                        |
| 4280     | IN Mic 11 → AN 1/2         |                                            |
| ...      | ...                        | ...                                        |
| 42C0     | IN Mic 12 → AN 1/2         |                                            |
| ...      | ...                        | ...                                        |
| 4300     | IN AES L → AN 1/2          |                                            |
| ...      | ...                        | ...                                        |
| 4340     | IN AES R → AN 1/2          |                                            |
| ...      | ...                        | ...                                        |
| 4380     | IN ADAT 1 → AN 1/2         |                                            |
| 43C0     | IN ADAT 2 → AN 1/2         |                                            |
| 4400     | IN ADAT 3 → AN 1/2         |                                            |
| 4440     | IN ADAT 4 → AN 1/2         |                                            |
| 4480     | IN ADAT 5 → AN 1/2         |                                            |
| 44C0     | IN ADAT 6 → AN 1/2         |                                            |
| 4500     | IN ADAT 7 → AN 1/2         |                                            |
| 4540     | IN ADAT 8 → AN 1/2         |                                            |
| 4580     | IN ADAT 9 → AN 1/2         |                                            |
| 45C0     | IN ADAT 10 → AN 1/2        |                                            |
| 4600     | IN ADAT 11 → AN 1/2        |                                            |
| 4640     | IN ADAT 12 → AN 1/2        |                                            |
| 4680     | IN ADAT 13 → AN 1/2        |                                            |
| 46C0     | IN ADAT 14 → AN 1/2        |                                            |
| 4700     | IN ADAT 15 → AN 1/2        |                                            |
| 4740     | IN ADAT 16 → AN 1/2        |                                            |
| 4780     | IN MA 1 → AN 1/2           |                                            |
| 47C0     | IN MA 2 → AN 1/2           |                                            |
| 4800     | IN MA 3 → AN 1/2           |                                            |
| 4840     | IN MA 4 → AN 1/2           |                                            |
| 4880     | IN MA 5 → AN 1/2           |                                            |
| 48C0     | IN MA 6 → AN 1/2           |                                            |
| 4900     | IN MA 7 → AN 1/2           |                                            |
| 4940     | IN MA 8 → AN 1/2           |                                            |
| 4980     | IN MA 9 → AN 1/2           |                                            |
| 49C0     | IN MA 10 → AN 1/2          |                                            |
| 4A00     | IN MA 11 → AN 1/2          |                                            |
| 4A40     | IN MA 12 → AN 1/2          |                                            |
| 4A80     | IN MA 13 → AN 1/2          |                                            |
| 4AC0     | IN MA 14 → AN 1/2          |                                            |
| 4B00     | IN MA 15 → AN 1/2          |                                            |
| 4B40     | IN MA 16 → AN 1/2          |                                            |
| 4B80     | IN MA 17 → AN 1/2          |                                            |
| 4BC0     | IN MA 18 → AN 1/2          |                                            |
| 4C00     | IN MA 19 → AN 1/2          |                                            |
| 4C40     | IN MA 20 → AN 1/2          |                                            |
| 4C80     | IN MA 21 → AN 1/2          |                                            |
| 4CC0     | IN MA 22 → AN 1/2          |                                            |
| 4D00     | IN MA 23 → AN 1/2          |                                            |
| 4D40     | IN MA 24 → AN 1/2          |                                            |
| 4D80     | IN MA 25 → AN 1/2          |                                            |
| 4DC0     | IN MA 26 → AN 1/2          |                                            |
| 4E00     | IN MA 27 → AN 1/2          |                                            |
| 4E40     | IN MA 28 → AN 1/2          |                                            |
| 4E80     | IN MA 29 → AN 1/2          |                                            |
| 4EC0     | IN MA 30 → AN 1/2          |                                            |
| 4F00     | IN MA 31 → AN 1/2          |                                            |
| 4F40     | IN MA 32 → AN 1/2          |                                            |
| 4F80     | IN MA 33 → AN 1/2          |                                            |
| 4FC0     | IN MA 34 → AN 1/2          |                                            |
| 5000     | IN MA 35 → AN 1/2          |                                            |
| 5040     | IN MA 36 → AN 1/2          |                                            |
| 5080     | IN MA 37 → AN 1/2          |                                            |
| 50C0     | IN MA 38 → AN 1/2          |                                            |
| 5100     | IN MA 39 → AN 1/2          |                                            |
| 5140     | IN MA 40 → AN 1/2          |                                            |
| 5180     | IN MA 41 → AN 1/2          |                                            |
| 51C0     | IN MA 42 → AN 1/2          |                                            |
| 5200     | IN MA 43 → AN 1/2          |                                            |
| 5240     | IN MA 44 → AN 1/2          |                                            |
| 5280     | IN MA 45 → AN 1/2          |                                            |
| 52C0     | IN MA 46 → AN 1/2          |                                            |
| 5300     | IN MA 47 → AN 1/2          |                                            |
| 5340     | IN MA 48 → AN 1/2          |                                            |
| 5380     | IN MA 49 → AN 1/2          |                                            |
| 53C0     | IN MA 50 → AN 1/2          |                                            |
| 5400     | IN MA 51 → AN 1/2          |                                            |
| 5440     | IN MA 52 → AN 1/2          |                                            |
| 5480     | IN MA 53 → AN 1/2          |                                            |
| 54C0     | IN MA 54 → AN 1/2          |                                            |
| 5500     | IN MA 55 → AN 1/2          |                                            |
| 5540     | IN MA 56 → AN 1/2          |                                            |
| 5580     | IN MA 57 → AN 1/2          |                                            |
| 55C0     | IN MA 58 → AN 1/2          |                                            |
| 5600     | IN MA 59 → AN 1/2          |                                            |
| 5640     | IN MA 60 → AN 1/2          |                                            |
| 5680     | IN MA 61 → AN 1/2          |                                            |
| 56C0     | IN MA 62 → AN 1/2          |                                            |
| 5700     | IN MA 63 → AN 1/2          |                                            |
| 5740     | IN MA 64 → AN 1/2          |                                            |
| ----     | ------                     | -----------------------------------------  |

#### Mixer Playbacks

| Register | Description                | Details see [Mixer value format](#mixer-value-format) |
| -------- | -------------------------- | ------------------------------------------ |
| 5780     | PB AN 1 → AN 1/2           |                                            |
| 57C0     | PB AN 2 → AN 1/2           |                                            |
| 5800     | PB AN 3 → AN 1/2           |                                            |
| 5840     | PB AN 4 → AN 1/2           |                                            |
| 5880     | PB AN 5 → AN 1/2           |                                            |
| 58C0     | PB AN 6 → AN 1/2           |                                            |
| 5900     | PB AN 7 → AN 1/2           |                                            |
| 5940     | PB AN 8 → AN 1/2           |                                            |
| 5980     | PB Mic 9 → AN 1/2          |                                            |
| 59C0     | PB Mic 10 → AN 1/2         |                                            |
| 5A00     | PB Mic 11 → AN 1/2         |                                            |
| 5A40     | PB Mic 12 → AN 1/2         |                                            |
| 5A80     | PB AES L → AN 1/2          |                                            |
| 5AC0     | PB AES R → AN 1/2          |                                            |
| 5B00     | PB ADAT 1 → AN 1/2         |                                            |
| 5B40     | PB ADAT 2 → AN 1/2         |                                            |
| 5B80     | PB ADAT 3 → AN 1/2         |                                            |
| 5BC0     | PB ADAT 4 → AN 1/2         |                                            |
| 5C00     | PB ADAT 5 → AN 1/2         |                                            |
| 5C40     | PB ADAT 6 → AN 1/2         |                                            |
| 5C80     | PB ADAT 7 → AN 1/2         |                                            |
| 5CC0     | PB ADAT 8 → AN 1/2         |                                            |
| 5D00     | PB ADAT 9 → AN 1/2         |                                            |
| 5D40     | PB ADAT 10 → AN 1/2        |                                            |
| 5D80     | PB ADAT 11 → AN 1/2        |                                            |
| 5DC0     | PB ADAT 12 → AN 1/2        |                                            |
| 5E00     | PB ADAT 13 → AN 1/2        |                                            |
| 5E40     | PB ADAT 14 → AN 1/2        |                                            |
| 5E80     | PB ADAT 15 → AN 1/2        |                                            |
| 5EC0     | PB ADAT 16 → AN 1/2        |                                            |
| 5F00     | PB MA 1 → AN 1/2           |                                            |
| 5F40     | PB MA 2 → AN 1/2           |                                            |
| 5F80     | PB MA 3 → AN 1/2           |                                            |
| 5FC0     | PB MA 4 → AN 1/2           |                                            |
| 6000     | PB MA 5 → AN 1/2           |                                            |
| 6040     | PB MA 6 → AN 1/2           |                                            |
| 6080     | PB MA 7 → AN 1/2           |                                            |
| 60C0     | PB MA 8 → AN 1/2           |                                            |
| 6100     | PB MA 9 → AN 1/2           |                                            |
| 6140     | PB MA 10 → AN 1/2          |                                            |
| 6180     | PB MA 11 → AN 1/2          |                                            |
| 61C0     | PB MA 12 → AN 1/2          |                                            |
| 6200     | PB MA 13 → AN 1/2          |                                            |
| 6240     | PB MA 14 → AN 1/2          |                                            |
| 6280     | PB MA 15 → AN 1/2          |                                            |
| 62C0     | PB MA 16 → AN 1/2          |                                            |
| 6300     | PB MA 17 → AN 1/2          |                                            |
| 6340     | PB MA 18 → AN 1/2          |                                            |
| 6380     | PB MA 19 → AN 1/2          |                                            |
| 63C0     | PB MA 20 → AN 1/2          |                                            |
| 6400     | PB MA 21 → AN 1/2          |                                            |
| 6440     | PB MA 22 → AN 1/2          |                                            |
| 6480     | PB MA 23 → AN 1/2          |                                            |
| 64C0     | PB MA 24 → AN 1/2          |                                            |
| 6500     | PB MA 25 → AN 1/2          |                                            |
| 6540     | PB MA 26 → AN 1/2          |                                            |
| 6580     | PB MA 27 → AN 1/2          |                                            |
| 65C0     | PB MA 28 → AN 1/2          |                                            |
| 6600     | PB MA 29 → AN 1/2          |                                            |
| 6640     | PB MA 30 → AN 1/2          |                                            |
| 6680     | PB MA 31 → AN 1/2          |                                            |
| 66C0     | PB MA 32 → AN 1/2          |                                            |
| 6700     | PB MA 33 → AN 1/2          |                                            |
| 6740     | PB MA 34 → AN 1/2          |                                            |
| 6780     | PB MA 35 → AN 1/2          |                                            |
| 67C0     | PB MA 36 → AN 1/2          |                                            |
| 6800     | PB MA 37 → AN 1/2          |                                            |
| 6840     | PB MA 38 → AN 1/2          |                                            |
| 6880     | PB MA 39 → AN 1/2          |                                            |
| 68C0     | PB MA 40 → AN 1/2          |                                            |
| 6900     | PB MA 41 → AN 1/2          |                                            |
| 6940     | PB MA 42 → AN 1/2          |                                            |
| 6980     | PB MA 43 → AN 1/2          |                                            |
| 69C0     | PB MA 44 → AN 1/2          |                                            |
| 6A00     | PB MA 45 → AN 1/2          |                                            |
| 6A40     | PB MA 46 → AN 1/2          |                                            |
| 6A80     | PB MA 47 → AN 1/2          |                                            |
| 6AC0     | PB MA 48 → AN 1/2          |                                            |
| 6B00     | PB MA 49 → AN 1/2          |                                            |
| 6B40     | PB MA 50 → AN 1/2          |                                            |
| 6B80     | PB MA 51 → AN 1/2          |                                            |
| 6BC0     | PB MA 52 → AN 1/2          |                                            |
| 6C00     | PB MA 53 → AN 1/2          |                                            |
| 6C40     | PB MA 54 → AN 1/2          |                                            |
| 6C80     | PB MA 55 → AN 1/2          |                                            |
| 6CC0     | PB MA 56 → AN 1/2          |                                            |
| 6D00     | PB MA 57 → AN 1/2          |                                            |
| 6D40     | PB MA 58 → AN 1/2          |                                            |
| 6D80     | PB MA 59 → AN 1/2          |                                            |
| 6DC0     | PB MA 60 → AN 1/2          |                                            |
| 6E00     | PB MA 61 → AN 1/2          |                                            |
| 6E40     | PB MA 62 → AN 1/2          |                                            |
| 6E80     | PB MA 63 → AN 1/2          |                                            |
| 6EC0     | PB MA 64 → AN 1/2          |                                            |


#### Mixer value format

	[0-13]	vol: 1/10 fixed point, -300.0 for -inf; pan: -100-100
	[14]	0=vol 1=pan
	[15]	channel 2

#### Mixer Value Examples

| Register | Description                                     | Value  |
|----------|-------------------------------------------------|--------|
|          | INPUTS                                          |        |
|----------|-------------------------------------------------|--------|
| 4000     | IN AN 1 → OUT AN 1 - Volume min (-300 dB)       | 0x3448 |
| 4000     | IN AN 1 → OUT AN 1 - Volume max (0 dB)          | 0x0000 |
| 4000     | IN AN 1 → OUT AN 1 - Pan Left (-100)            | 0x4090 |
| 4000     | IN AN 1 → OUT AN 1 - Pan Center (0 dB)          | 0x4000 |
| 4000     | IN AN 1 → OUT AN 1 - Pan Right (+100)           | 0x4064 |
|----------|-------------------------------------------------|--------|
| 4000     | IN AN 1 → OUT AN 2 - Volume min (-300 dB)       | 0xB448 |
| 4000     | IN AN 1 → OUT AN 2 - Volume max (0 dB)          | 0x8000 |
| 4000     | IN AN 1 → OUT AN 2 - Pan Left (-100)            | 0xC090 |
| 4000     | IN AN 1 → OUT AN 2 - Pan Center (0 dB)          | 0xC000 |
| 4000     | IN AN 1 → OUT AN 2 - Pan Right (+100)           | 0xC064 |
|----------|-------------------------------------------------|--------|
|----------|-------------------------------------------------|--------|
| 4001     | IN AN 1 → OUT AN 3 - Volume min (-300 dB)       | 0x3448 |
| 4001     | IN AN 1 → OUT AN 3 - Volume max (0 dB)          | 0x0000 |
| 4001     | IN AN 1 → OUT AN 3 - Pan Left (-100)            | 0x4090 |
| 4001     | IN AN 1 → OUT AN 3 - Pan Center (0 dB)          | 0x4000 |
| 4001     | IN AN 1 → OUT AN 3 - Pan Right (+100)           | 0x4064 |
|----------|-------------------------------------------------|--------|
| 4001     | IN AN 1 → OUT AN 4 - Volume min (-300 dB)       | 0xB448 |
| 4001     | IN AN 1 → OUT AN 4 - Volume max (0 dB)          | 0x8000 |
| 4001     | IN AN 1 → OUT AN 4 - Pan Left (-100)            | 0xC090 |
| 4001     | IN AN 1 → OUT AN 4 - Pan Center (0 dB)          | 0xC000 |
| 4001     | IN AN 1 → OUT AN 4 - Pan Right (+100)           | 0xC064 |
|----------|-------------------------------------------------|--------|
|----------|-------------------------------------------------|--------|
| ...      | ...                                             | ...    |
|----------|-------------------------------------------------|--------|
| 402E     | IN AN 1 → OUT MA 63 - Volume min (-300 dB)      | 0x3448 |
| 402E     | IN AN 1 → OUT MA 63 - Volume max (0 dB)         | 0x0000 |
| ...      | ...                                             | ...    |
|----------|-------------------------------------------------|--------|
| 402E     | IN AN 1 → OUT MA 64 - Volume min (-300 dB)      | 0xB448 |
| 402E     | IN AN 1 → OUT MA 64 - Volume max (0 dB)         | 0x8000 |
| ...      | ...                                             | ...    |
|----------|-------------------------------------------------|--------|
| ...      | ...                                             | ...    |
|----------|-------------------------------------------------|--------|
| 5740     | IN MA 64 → OUT AN 1                             |        |
| ...      | ...                                             | ...    |
|----------|-------------------------------------------------|--------|
| 576E     | IN MA 64 → OUT MA 63  - Volume min (-300 dB)    | 0x3448 |
| 576E     | IN MA 64 → OUT MA 63  - Volume max (0 dB)       | 0x0000 |
| 576E     | IN MA 64 → OUT MA 63  - Pan Left (-100)         | 0x4090 |
| 576E     | IN MA 64 → OUT MA 63  - Pan Center (0 dB)       | 0x4000 |
| 576E     | IN MA 64 → OUT MA 63  - Pan Right (+100)        | 0x4064 |
|----------|-------------------------------------------------|--------|
| 576E     | IN MA 64 → OUT MA 64  - Volume min (-300 dB)    | 0xB448 |
| 576E     | IN MA 64 → OUT MA 64  - Volume max (0 dB)       | 0x8000 |
| 576E     | IN MA 64 → OUT MA 64  - Pan Left (-100)         | 0xC090 |
| 576E     | IN MA 64 → OUT MA 64  - Pan Center (0 dB)       | 0xC000 |
| 576E     | IN MA 64 → OUT MA 64  - Pan Right (+100)        | 0xC064 |
|----------|-------------------------------------------------|--------|
|----------|-------------------------------------------------|--------|
|          | PLAYBACKS                                       |        |
|----------|-------------------------------------------------|--------|
| 5780     | PB AN 1 → OUT AN 1 - Volume min (-300 dB)       | 0x3448 |
| 5780     | PB AN 1 → OUT AN 1 - Volume max (0 dB)          | 0x0000 |
| 5780     | PB AN 1 → OUT AN 1 - Pan Left (-100)            | 0x4090 |
| 5780     | PB AN 1 → OUT AN 1 - Pan Center (0 dB)          | 0x4000 |
| 5780     | PB AN 1 → OUT AN 1 - Pan Right (+100)           | 0x4064 |
|----------|-------------------------------------------------|--------|
| 5780     | PB AN 1 → OUT AN 2 - Volume min (-300 dB)       | 0xB448 |
| 5780     | PB AN 1 → OUT AN 2 - Volume max (0 dB)          | 0x8000 |
| 5780     | PB AN 1 → OUT AN 2 - Pan Left (-100)            | 0xC090 |
| 5780     | PB AN 1 → OUT AN 2 - Pan Center (0 dB)          | 0xC000 |
| 5780     | PB AN 1 → OUT AN 2 - Pan Right (+100)           | 0xC064 |
|----------|-------------------------------------------------|--------|
|----------|-------------------------------------------------|--------|
| 5781     | PB AN 1 → OUT AN 3 - Volume min (-300 dB)       | 0x3448 |
| 5781     | PB AN 1 → OUT AN 3 - Volume max (0 dB)          | 0x0000 |
| 5781     | PB AN 1 → OUT AN 3 - Pan Left (-100)            | 0x4090 |
| 5781     | PB AN 1 → OUT AN 3 - Pan Center (0 dB)          | 0x4000 |
| 5781     | PB AN 1 → OUT AN 3 - Pan Right (+100)           | 0x4064 |
|----------|-------------------------------------------------|--------|
| 5781     | PB AN 1 → OUT AN 4 - Volume min (-300 dB)       | 0xB448 |
| 5781     | PB AN 1 → OUT AN 4 - Volume max (0 dB)          | 0x8000 |
| 5781     | PB AN 1 → OUT AN 4 - Pan Left (-100)            | 0xC090 |
| 5781     | PB AN 1 → OUT AN 4 - Pan Center (0 dB)          | 0xC000 |
| 5781     | PB AN 1 → OUT AN 4 - Pan Right (+100)           | 0xC064 |
|----------|-------------------------------------------------|--------|
| ...      | ...                                             | ...    |
|----------|-------------------------------------------------|--------|
|----------|-------------------------------------------------|--------|
| 57C0     | PB AN 2 → OUT AN 1 - Volume min (-300 dB)       | 0x3448 |
| 57C0     | PB AN 2 → OUT AN 1 - Volume max (0 dB)          | 0x0000 |
| 57C0     | PB AN 2 → OUT AN 1 - Pan Left (-100)            | 0x4090 |
| 57C0     | PB AN 2 → OUT AN 1 - Pan Center (0 dB)          | 0x4000 |
| 57C0     | PB AN 2 → OUT AN 1 - Pan Right (+100)           | 0x4064 |
|----------|-------------------------------------------------|--------|
| 57C0     | PB AN 2 → OUT AN 2 - Volume min (-300 dB)       | 0xB448 |
| 57C0     | PB AN 2 → OUT AN 2 - Volume max (0 dB)          | 0x8000 |
| 57C0     | PB AN 2 → OUT AN 2 - Pan Left (-100)            | 0xC090 |
| 57C0     | PB AN 2 → OUT AN 2 - Pan Center (0 dB)          | 0xC000 |
| 57C0     | PB AN 2 → OUT AN 2 - Pan Right (+100)           | 0xC064 |
|----------|-------------------------------------------------|--------|
|----------|-------------------------------------------------|--------|
| ...      | ...                                             | ...    |
| ...      | ...                                             | ...    |
| ...      | ...                                             | ...    |
|----------|-------------------------------------------------|--------|
|----------|-------------------------------------------------|--------|
| 6EC0     | PB MA 64 → OUT AN 1 - Volume min (-300 dB)      | 0x3448 |
| 6EC0     | PB MA 64 → OUT AN 1 - Volume max (0 dB)         | 0x0000 |
| 6EC0     | PB MA 64 → OUT AN 1 - Pan Left (-100)           | 0x4090 |
| 6EC0     | PB MA 64 → OUT AN 1 - Pan Center (0 dB)         | 0x4000 |
| 6EC0     | PB MA 64 → OUT AN 1 - Pan Right (+100)          | 0x4064 |
|----------|-------------------------------------------------|--------|
| 6EC0     | PB MA 64 → OUT AN 2 - Volume min (-300 dB)      | 0xB448 |
| 6EC0     | PB MA 64 → OUT AN 2 - Volume max (0 dB)         | 0x8000 |
| 6EC0     | PB MA 64 → OUT AN 2 - Pan Left (-100)           | 0xC090 |
| 6EC0     | PB MA 64 → OUT AN 2 - Pan Center (0 dB)         | 0xC000 |
| 6EC0     | PB MA 64 → OUT AN 2 - Pan Right (+100)          | 0xC064 |
|----------|-------------------------------------------------|--------|
| ...      | ...                                             | ...    |
|----------|-------------------------------------------------|--------|
| 6EEE     | PB MA 64 → OUT MA 63 - Volume min (-300 dB)     | 0x3448 |
| 6EEE     | PB MA 64 → OUT MA 63 - Volume max (0 dB)        | 0x0000 |
| 6EEE     | PB MA 64 → OUT MA 63 - Pan Left (-100)          | 0x4090 |
| 6EEE     | PB MA 64 → OUT MA 63 - Pan Center (0 dB)        | 0x4000 |
| 6EEE     | PB MA 64 → OUT MA 63 - Pan Right (+100)         | 0x4064 |
|----------|-------------------------------------------------|--------|
| 6EEE     | PB MA 64 → OUT MA 64 - Volume min (-300 dB)     | 0xB448 |
| 6EEE     | PB MA 64 → OUT MA 64 - Volume max (0 dB)        | 0x8000 |
| 6EEE     | PB MA 64 → OUT MA 64 - Pan Left (-100)          | 0xC090 |
| 6EEE     | PB MA 64 → OUT MA 64 - Pan Center (0 dB)        | 0xC000 |
| 6EEE     | PB MA 64 → OUT MA 64 - Pan Right (+100)         | 0xC064 |
|----------|-------------------------------------------------|--------|
