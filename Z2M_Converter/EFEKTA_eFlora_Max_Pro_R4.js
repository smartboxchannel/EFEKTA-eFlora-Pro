const fz = require('zigbee-herdsman-converters/converters/fromZigbee');
const tz = require('zigbee-herdsman-converters/converters/toZigbee');
const exposes = require('zigbee-herdsman-converters/lib/exposes');
const constants = require('zigbee-herdsman-converters/lib/constants');
const reporting = require('zigbee-herdsman-converters/lib/reporting');
const e = exposes.presets;
const ea = exposes.access;



const tzLocal = {
	node_config: {
        key: ['reading_interval', 'invert', 'fastmode', 'tx_radio_power'],
        convertSet: async (entity, key, rawValue, meta) => {
			const endpoint = meta.device.getEndpoint(1);
            const lookup = {'OFF': 0x00, 'ON': 0x01};
            const value = lookup.hasOwnProperty(rawValue) ? lookup[rawValue] : parseInt(rawValue, 10);
            const payloads = {
                reading_interval: ['genPowerCfg', {0x0201: {value, type: 0x21}}],
				invert: ['genPowerCfg', {0xF004: {value, type: 0x20}}],
				fastmode: ['genPowerCfg', {0xF005: {value, type: 0x20}}],
				tx_radio_power: ['genPowerCfg', {0x0236: {value, type: 0x28}}],
            };
            await endpoint.write(payloads[key][0], payloads[key][1]);
            return {
                state: {[key]: rawValue},
            };
        },
    },
	node_debug: {
        key: ['lower_level', 'upper_level', 'mode1', 'mode2'],
        convertSet: async (entity, key, rawValue, meta) => {
			const endpoint3 = meta.device.getEndpoint(3);
            const lookup = {'OFF': 0x00, 'ON': 0x01};
            const value = lookup.hasOwnProperty(rawValue) ? lookup[rawValue] : parseInt(rawValue, 10);
            const payloads = {
                mode1: ['msSoilMoisture', {0x0504: {value, type: 0x10}}],
				mode2: ['msSoilMoisture', {0x0505: {value, type: 0x10}}],
				lower_level: ['msSoilMoisture', {0x0502: {value, type: 0x21}}],
				upper_level: ['msSoilMoisture', {0x0503: {value, type: 0x21}}],
            };
            await endpoint3.write(payloads[key][0], payloads[key][1]);
            return {
                state: {[key]: rawValue},
            };
        },
    },
	illuminance: {
        cluster: 'msIlluminanceMeasurement',
        type: ['attributeReport', 'readResponse'],
        convert: (model, msg, publish, options, meta) => {
            const result = {};
            if (msg.data.hasOwnProperty('measuredValue')) {
                const illuminance_raw = msg.data['measuredValue'];
                const illuminance = illuminance_raw === 0 ? 0 : Math.pow(10, (illuminance_raw - 1) / 10000);
                result.illuminance = illuminance;
                result.illuminance_raw = illuminance_raw;
                }
            return result;
        },
    },
};


const fzLocal = {
	node_config: {
        cluster: 'genPowerCfg',
        type: ['attributeReport', 'readResponse'],
        convert: (model, msg, publish, options, meta) => {
            const result = {};
            if (msg.data.hasOwnProperty(0x0201)) {
                result.reading_interval = msg.data[0x0201];
            }
			if (msg.data.hasOwnProperty(0xF004)) {
                result.invert = msg.data[0xF004];
            }
			if (msg.data.hasOwnProperty(0xF005)) {
                result.fastmode = msg.data[0xF005];
            }
			if (msg.data.hasOwnProperty(0x0236)) {
                result.tx_radio_power = msg.data[0x0236];
            }
            return result;
        },
    },
	node_debug: {
        cluster: 'msSoilMoisture',
        type: ['attributeReport', 'readResponse'],
        convert: (model, msg, publish, options, meta) => {
            const result = {};
			if (msg.data.hasOwnProperty(0x0500)) {
                result.bat_adc = msg.data[0x0500];
            }
            if (msg.data.hasOwnProperty(0x0499)) {
                result.sm_adc_compens = msg.data[0x0499];
            }
			if (msg.data.hasOwnProperty(0x0501)) {
                result.sm_adc = msg.data[0x0501];
            }
			if (msg.data.hasOwnProperty(0x0502)) {
                result.lower_level = msg.data[0x0502];
            }
			if (msg.data.hasOwnProperty(0x0503)) {
                result.upper_level = msg.data[0x0503];
            }
			if (msg.data.hasOwnProperty(0x0504)) {
                result.mode1 = ['OFF', 'ON'][msg.data[0x0504]];
            }
			if (msg.data.hasOwnProperty(0x0505)) {
                result.mode2 = ['OFF', 'ON'][msg.data[0x0505]];
            }
            return result;
        },
    },
	lluminance: {
        cluster: 'msIlluminanceMeasurement',
        type: ['attributeReport', 'readResponse'],
        convert: (model, msg, publish, options, meta) => {
            const result = {};
            if (msg.data.hasOwnProperty('measuredValue')) {
                const illuminance_raw = msg.data['measuredValue'];
                const illuminance = illuminance_raw === 0 ? 0 : Math.pow(10, (illuminance_raw - 1) / 10000);
                result.illuminance = illuminance;
                result.illuminance_raw = illuminance_raw;
                }
            return result;
        },
    },
};


const definition = {
        zigbeeModel: ['EFEKTA_eFlora_Max_Pro'],
        model: 'EFEKTA_eFlora_Max_Pro',
        vendor: 'EFEKTA',
        description: '[Plant Wattering Sensor with e-ink display 2.13 with a signal amplifier](https://efektalab.com/eFlowerPro)',
        fromZigbee: [fz.temperature, fz.humidity, fzLocal.illuminance, fz.soil_moisture, fz.battery, fzLocal.node_config, fzLocal.node_debug],
        toZigbee: [tz.factory_reset, tzLocal.node_config, tzLocal.node_debug],
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
			const endpoint2 = device.getEndpoint(2);
			const endpoint3 = device.getEndpoint(3);
			await reporting.bind(endpoint, coordinatorEndpoint, ['genPowerCfg', 'genTime']);
		    await reporting.bind(endpoint2, coordinatorEndpoint, ['msTemperatureMeasurement', 'msRelativeHumidity', 'msIlluminanceMeasurement']);
			await reporting.bind(endpoint3, coordinatorEndpoint, ['msSoilMoisture']);
			const overrides1 = {min: 3600, max: 43200, change: 1};
			const overrides2 = {min: 300, max: 3600, change: 25};
			const overrides3 = {min: 300, max: 3600, change: 50};
			const overrides4 = {min: 600, max: 3600, change: 50};
			const overrides5 = {min: 600, max: 21600, change: 100};
            await reporting.batteryVoltage(endpoint, overrides1);
            await reporting.batteryPercentageRemaining(endpoint, overrides1);
			await reporting.batteryAlarmState(endpoint, overrides1);
            await reporting.temperature(endpoint2, overrides2);
            await reporting.humidity(endpoint2, overrides3);
            await reporting.illuminance(endpoint2, overrides4);
            await reporting.soil_moisture(endpoint3, overrides5);
        },
        icon: 'data:image/jpeg;base64,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dWJAb+AAAAAAAAAAAABCcmRUVW50RiNSbHQAAAAAAAAAAAAAAABCbGQgVW50RiNSbHQAAAAAAAAAAAAAAABSc2x0VW50RiNQeGxAUgAAAAAAAAAAAAp2ZWN0b3JEYXRhYm9vbAEAAAAAUGdQc2VudW0AAAAAUGdQcwAAAABQZ1BDAAAAAExlZnRVbnRGI1JsdAAAAAAAAAAAAAAAAFRvcCBVbnRGI1JsdAAAAAAAAAAAAAAAAFNjbCBVbnRGI1ByY0BZAAAAAAAAAAAAEGNyb3BXaGVuUHJpbnRpbmdib29sAAAAAA5jcm9wUmVjdEJvdHRvbWxvbmcAAAAAAAAADGNyb3BSZWN0TGVmdGxvbmcAAAAAAAAADWNyb3BSZWN0UmlnaHRsb25nAAAAAAAAAAtjcm9wUmVjdFRvcGxvbmcAAAAAADhCSU0D7QAAAAAAEABIAAAAAQABAEgAAAABAAE4QklNBCYAAAAAAA4AAAAAAAAAAAAAP4AAADhCSU0EDQAAAAAABAAAAB44QklNBBkAAAAAAAQAAAAeOEJJTQPzAAAAAAAJAAAAAAAAAAABADhCSU0nEAAAAAAACgABAAAAAAAAAAE4QklNA/UAAAAAAEgAL2ZmAAEAbGZmAAYAAAAAAAEAL2ZmAAEAoZmaAAYAAAAAAAEAMgAAAAEAWgAAAAYAAAAAAAEANQAAAAEALQAAAAYAAAAAAAE4QklNA/gAAAAAAHAAAP////////////////////////////8D6AAAAAD/////////////////////////////A+gAAAAA/////////////////////////////wPoAAAAAP////////////////////////////8D6AAAOEJJTQQAAAAAAAACAAA4QklNBAIAAAAAAAIAADhCSU0EMAAAAAAAAQEAOEJJTQQtAAAAAAAGAAEAAAACOEJJTQQIAAAAAAAQAAAAAQAAAkAAAAJAAAAAADhCSU0EHgAAAAAABAAAAAA4QklNBBoAAAAAA0kAAAAGAAAAAAAAAAAAAACCAAAAggAAAAoAZQBGAGwAbwByAGEAXwBQAHIAbwAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAggAAAIIAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAQAAAAAAAG51bGwAAAACAAAABmJvdW5kc09iamMAAAABAAAAAAAAUmN0MQAAAAQAAAAAVG9wIGxvbmcAAAAAAAAAAExlZnRsb25nAAAAAAAAAABCdG9tbG9uZwAAAIIAAAAAUmdodGxvbmcAAACCAAAABnNsaWNlc1ZsTHMAAAABT2JqYwAAAAEAAAAAAAVzbGljZQAAABIAAAAHc2xpY2VJRGxvbmcAAAAAAAAAB2dyb3VwSURsb25nAAAAAAAAAAZvcmlnaW5lbnVtAAAADEVTbGljZU9yaWdpbgAAAA1hdXRvR2VuZXJhdGVkAAAAAFR5cGVlbnVtAAAACkVTbGljZVR5cGUAAAAASW1nIAAAAAZib3VuZHNPYmpjAAAAAQAAAAAAAFJjdDEAAAAEAAAAAFRvcCBsb25nAAAAAAAAAABMZWZ0bG9uZwAAAAAAAAAAQnRvbWxvbmcAAACCAAAAAFJnaHRsb25nAAAAggAAAAN1cmxURVhUAAAAAQAAAAAAAG51bGxURVhUAAAAAQAAAAAAAE1zZ2VURVhUAAAAAQAAAAAABmFsdFRhZ1RFWFQAAAABAAAAAAAOY2VsbFRleHRJc0hUTUxib29sAQAAAAhjZWxsVGV4dFRFWFQAAAABAAAAAAAJaG9yekFsaWduZW51bQAAAA9FU2xpY2VIb3J6QWxpZ24AAAAHZGVmYXVsdAAAAAl2ZXJ0QWxpZ25lbnVtAAAAD0VTbGljZVZlcnRBbGlnbgAAAAdkZWZhdWx0AAAAC2JnQ29sb3JUeXBlZW51bQAAABFFU2xpY2VCR0NvbG9yVHlwZQAAAABOb25lAAAACXRvcE91dHNldGxvbmcAAAAAAAAACmxlZnRPdXRzZXRsb25nAAAAAAAAAAxib3R0b21PdXRzZXRsb25nAAAAAAAAAAtyaWdodE91dHNldGxvbmcAAAAAADhCSU0EKAAAAAAADAAAAAI/8AAAAAAAADhCSU0EFAAAAAAABAAAAAM4QklNBAwAAAAACrMAAAABAAAAggAAAIIAAAGIAADHEAAACpcAGAAB/9j/7QAMQWRvYmVfQ00AAf/uAA5BZG9iZQBkgAAAAAH/2wCEAAwICAgJCAwJCQwRCwoLERUPDAwPFRgTExUTExgRDAwMDAwMEQwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwBDQsLDQ4NEA4OEBQODg4UFA4ODg4UEQwMDAwMEREMDAwMDAwRDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDP/AABEIAIIAggMBIgACEQEDEQH/3QAEAAn/xAE/AAABBQEBAQEBAQAAAAAAAAADAAECBAUGBwgJCgsBAAEFAQEBAQEBAAAAAAAAAAEAAgMEBQYHCAkKCxAAAQQBAwIEAgUHBggFAwwzAQACEQMEIRIxBUFRYRMicYEyBhSRobFCIyQVUsFiMzRygtFDByWSU/Dh8WNzNRaisoMmRJNUZEXCo3Q2F9JV4mXys4TD03Xj80YnlKSFtJXE1OT0pbXF1eX1VmZ2hpamtsbW5vY3R1dnd4eXp7fH1+f3EQACAgECBAQDBAUGBwcGBTUBAAIRAyExEgRBUWFxIhMFMoGRFKGxQiPBUtHwMyRi4XKCkkNTFWNzNPElBhaisoMHJjXC0kSTVKMXZEVVNnRl4vKzhMPTdePzRpSkhbSVxNTk9KW1xdXl9VZmdoaWprbG1ub2JzdHV2d3h5ent8f/2gAMAwEAAhEDEQA/APVUkkklKSSQsp9leNbZUN1jGOcxvi4AloSU53WPrV0Dor/S6jlsquLd7aRLrCOPbWwOcsG//GHbd/yX0q+5pGlmR+gHx2u3vXJ9OsqsN2deDkZ2XdY6646vbY1xb6ZLv8HU0bditW9f6XjvdXflNsvjWuoGx0/1a9yeIDS2MzOtBJ1P60/4w8vMZ07plVXr2sNo9Abixo091lh2f9BZVeB1arq9mP8AWq9+VkmkXhtF3uqM8W7Btrc5Xamde6q1j+kdKy2vmGZ1r/szW+Y/wjmKxX9Tvrb07Fysl+biuyXA3240OsfeGibG2Zdnv3bfoJUAVWSHovqH1u++3N6Jk3HJODtfjXOHvND/AKLLnfn2VP8AZvXYLyv6n9UcPrL03Jaz0qOpUvx9fFo9drXf1dm1eqJshRXQNhSSSSC5SSSSSlJJJJKUkkkkp//Q9VSSSSUpMnSSU+QdYxhgdS+sHTGl1TQ8ZlD287Lg11zW/wBv1F2/1e6a3HbiW9Lw8TH6c+lrhY1s3vkcus/rLF+vuP8AZPrL0/P0bVn02YVsjQuE2Vz96L0bPuZ9SW0B7mDCv+y5d1ermUz77Wf2XKSOoH+Kxy0J+17RznGTulomTOgjxWXV1roeVltxxaXvfNdTy0hlh+i5tNp9lizbcfpozacHo2Vud1DHeLqWvNjCwD25L9XbHfmoGXm5eRjdO6Fb0x2Jlm5lfq6elWK/d9oxnt/fa1IR/lstMv5fNZeKJf0x2TSAWN6J1L1vd9IVGzftH8l1K9optbdTXc36NjQ8fBw3Ly/67dPZX9b7mvMU9WwtwHZ1lX6Jdr9R86zN+rOFZaQbammmyPGsmr/vibLYH6L46Ej6u8kkkmr1JJJJKUkkkkpSSSSSn//R9VSSSSUpJJJJTyP+M7C9f6tOy2t3W9PuryGeQa4C3/wPcsn/ABeZ9T+p9SwT9HJrryW1uGhn22rueq4Tc/pmVhPEjIqfX/nNLV5F9UM1/TuvdMc5xO2x+BkTp7iTX/1TU6OxC2XQvpuJ0irG6pfn1srrZZW2qllbdpaB/Ob/AOsj204jsurMsO6+hhrqMyAHfS9v7yWRZjUWBmRafVfJrr7uA52hV29QBDX00hrHCddX/wCajqdVug0ec/xlVMOB0/q7WFxwckMsdwfTtGz/AKvap/4sM1hPVOmtP8xa21jfBtg/N/thy2vrLgv6r9V+o4bhtsfS57B4OZ+lb/1C4H/F51IVfWTDM7W51DqrSfzntHqN/wCkl0I7JG9vsCSSSYvUkkkkpSSSSSlJJJJKf//S9VSSSSUpJJJJSl4p9asV/TfrJ1OqsbS21mdjR4O2l7h/1xti9rXmP+Nbp5q6v07qTZ25Vb8OyPEfpa/+qcjE0USFh7nGyKc7DxOoNYLTbU19bokjcPdCL7x7tjKo5c6OFyP1Mz8u76sUhr3FuDYcRlbBL9wPtst/4Nq6TD6fYG20ZIddjPBl1p9xLvp/9bTqWX4Jq8vG3VtfaLBkSxhH0T2dqvGbLD0brlrCDUzpnUd7Rw70y/fH/bS9VyHdD6e0ty86uitoDW0NIO1rdRDWy7evL/rvm4PVev5HUOn+6i+ttZnQuewbfV2oqt9yqsFtTLG8PaHD4ESprB+o/UT1L6rdPyHEOsFQrsj95n6P/vq3lGyKSSSSUpJJJJSkkkklP//T9VSSSSUpJJJJSlyf+M7AdlfVS+6sfpcJzMlp8Aw/pP8AwNdYq+fiV5uFfh2ia8it1bx5OG0pKfFejfWbqvQhkfs5zWjM2ueHDdtIH86yfzkPN+svXc5xGTn3PY791xYP8xntWY6h9Fjse2RZQ51JB7bCWpe7g6A6AKXxYqSEkvO8l7u5B1UCwyXzGh3DuEUGtrS1wk6bj/coubLzt0aY9hOoSUH0P/E/mtd0/O6dJ/V7vUaD+7YP/JscvQl5/wD4osFteD1DO73X+mD/ACWNaf8AqnuXoCjO7JHYKSSSQSpJJJJSkkkklP8A/9T1VJJJJSkkkklKSSSSU+Yf4x/qjZj5Fn1gwGOsxrTu6hS3UtIEfamD/wA+rg/tFDW7n2NDBq3uSvopzWuBa4AtOhB1C8Z/xw9DowerYnUMesV15rHMe1ohofXGun77XpwkRotMQdXlXdUwm7iA55PEKueqWF0tZsbPudyYVZjA5hLJ9RpkjtCa/eXkP5jhIyKhEP0d9WOmYXTOh4mNgg+iaxZuPLnPG9z3fynblqrl/wDFt1L9o/VDCe52+ygGiwnmWGB/0Ni6hNXKSSSSUpJJJJSkkkklP//V9VSSSSUpJJJJSkkkklKXFf42elOzvqq++tu6zCsbcPHb9B8f567VVOrYTM/pmVh2atvqcw/MJKfBqPqJ9Yfs5y8z0el4+k2ZlrajtP52z3P/AOii/sj6lYFw/afWbOpaT6XT6oE/uuyLvb/0Fz+YzIblW1Zj3WX1ONbi8lxlp2/nIRG1ocIg+CKH1v8AxQ9Sw7LurYGCx9OGyxl+PTa7c8B49N25/wD1pekrwv8AxT9QOL9b6qi7bXmVPqcD3IHqM/6he6IJUkkkkpSSSSSlJJJJKf/W9VSSSSUpJJJJSkkkklKSSSSU+A/4yelfs362ZQaIryoyGntL/p/9JcuNWuHhqvWP8dXSt+Ng9VaP5pxosPk/3Nn/ADF5Q0kO4kHSEQgt76u5v7P690/NJhtGRW5x/k7gH/8AQX0qx4exr28OAI+BXy0dF9J/VfP/AGj9XsDNmTdS0n4gbT+RApdRJJJJSkkkklKSSSSU/wD/1/VUl8qpJKfqpJfKqSSn6qSXyqkkp+qkl8qpJKfe/wDGn/4kMn6H0m/T+P5n8teJjkfzCoJIhBb1n0z/ADC9z/xZ/wDiOwfg7/qjwvn5JIqD9VJL5VSQS/VSS+VUklP1UkvlVJJT/9kAOEJJTQQhAAAAAABdAAAAAQEAAAAPAEEAZABvAGIAZQAgAFAAaABvAHQAbwBzAGgAbwBwAAAAFwBBAGQAbwBiAGUAIABQAGgAbwB0AG8AcwBoAG8AcAAgAEMAQwAgADIAMAAxADgAAAABADhCSU0EBgAAAAAABwAEAAAAAQEA/+ES32h0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8APD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNS42LWMxNDIgNzkuMTYwOTI0LCAyMDE3LzA3LzEzLTAxOjA2OjM5ICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtbG5zOnhtcE1NPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvbW0vIiB4bWxuczpzdEV2dD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL3NUeXBlL1Jlc291cmNlRXZlbnQjIiB4bWxuczpzdFJlZj0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL3NUeXBlL1Jlc291cmNlUmVmIyIgeG1sbnM6cGhvdG9zaG9wPSJodHRwOi8vbnMuYWRvYmUuY29tL3Bob3Rvc2hvcC8xLjAvIiB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENDIDIwMTggKFdpbmRvd3MpIiB4bXA6Q3JlYXRlRGF0ZT0iMjAyMy0wMS0xNlQxNDoxNDozNyswMzowMCIgeG1wOk1ldGFkYXRhRGF0ZT0iMjAyMy0xMi0yNFQxNjoxOToxNiswMzowMCIgeG1wOk1vZGlmeURhdGU9IjIwMjMtMTItMjRUMTY6MTk6MTYrMDM6MDAiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6M2YxYTVhZWQtZmIyMy1lNzQ1LWIyMmYtYjI4ODczYTVhZjhiIiB4bXBNTTpEb2N1bWVudElEPSJhZG9iZTpkb2NpZDpwaG90b3Nob3A6N2YxODIwZDItZmQ2NS00OTRkLWIwMjctZTcxODM1ZmQ1ZTk5IiB4bXBNTTpPcmlnaW5hbERvY3VtZW50SUQ9InhtcC5kaWQ6NTFkNmRjN2QtODgxYi1kODQ1LTllODItYTM5YzgzODVkODUyIiBwaG90b3Nob3A6Q29sb3JNb2RlPSIzIiBwaG90b3Nob3A6SUNDUHJvZmlsZT0iQWRvYmUgUkdCICgxOTk4KSIgZGM6Zm9ybWF0PSJpbWFnZS9qcGVnIj4gPHhtcE1NOkhpc3Rvcnk+IDxyZGY6U2VxPiA8cmRmOmxpIHN0RXZ0OmFjdGlvbj0iY3JlYXRlZCIgc3RFdnQ6aW5zdGFuY2VJRD0ieG1wLmlpZDo1MWQ2ZGM3ZC04ODFiLWQ4NDUtOWU4Mi1hMzljODM4NWQ4NTIiIHN0RXZ0OndoZW49IjIwMjMtMDEtMTZUMTQ6MTQ6MzcrMDM6MDAiIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkFkb2JlIFBob3Rvc2hvcCBDQyAyMDE4IChXaW5kb3dzKSIvPiA8cmRmOmxpIHN0RXZ0OmFjdGlvbj0ic2F2ZWQiIHN0RXZ0Omluc3RhbmNlSUQ9InhtcC5paWQ6YWNhZTRiNWQtZWY4OC01NTRmLTkwZWEtM2YyYWY0ZDU3MzAwIiBzdEV2dDp3aGVuPSIyMDIzLTAxLTE2VDE0OjE0OjM3KzAzOjAwIiBzdEV2dDpzb2Z0d2FyZUFnZW50PSJBZG9iZSBQaG90b3Nob3AgQ0MgMjAxOCAoV2luZG93cykiIHN0RXZ0OmNoYW5nZWQ9Ii8iLz4gPHJkZjpsaSBzdEV2dDphY3Rpb249InNhdmVkIiBzdEV2dDppbnN0YW5jZUlEPSJ4bXAuaWlkOmQwY2NhNThkLWRkYzItOTE0YS1hMDQ5LTA2MzNhMzkxMDAxZSIgc3RFdnQ6d2hlbj0iMjAyMy0xMi0yNFQxNjoxOToxNiswMzowMCIgc3RFdnQ6c29mdHdhcmVBZ2VudD0iQWRvYmUgUGhvdG9zaG9wIENDIDIwMTggKFdpbmRvd3MpIiBzdEV2dDpjaGFuZ2VkPSIvIi8+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJjb252ZXJ0ZWQiIHN0RXZ0OnBhcmFtZXRlcnM9ImZyb20gaW1hZ2UvcG5nIHRvIGltYWdlL2pwZWciLz4gPHJkZjpsaSBzdEV2dDphY3Rpb249ImRlcml2ZWQiIHN0RXZ0OnBhcmFtZXRlcnM9ImNvbnZlcnRlZCBmcm9tIGltYWdlL3BuZyB0byBpbWFnZS9qcGVnIi8+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJzYXZlZCIgc3RFdnQ6aW5zdGFuY2VJRD0ieG1wLmlpZDozZjFhNWFlZC1mYjIzLWU3NDUtYjIyZi1iMjg4NzNhNWFmOGIiIHN0RXZ0OndoZW49IjIwMjMtMTItMjRUMTY6MTk6MTYrMDM6MDAiIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkFkb2JlIFBob3Rvc2hvcCBDQyAyMDE4IChXaW5kb3dzKSIgc3RFdnQ6Y2hhbmdlZD0iLyIvPiA8L3JkZjpTZXE+IDwveG1wTU06SGlzdG9yeT4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5paWQ6ZDBjY2E1OGQtZGRjMi05MTRhLWEwNDktMDYzM2EzOTEwMDFlIiBzdFJlZjpkb2N1bWVudElEPSJhZG9iZTpkb2NpZDpwaG90b3Nob3A6ZmQyZTJmYjAtY2Q2ZC1lMjQ4LWEwODgtZTMzM2ZiMDk4MzU1IiBzdFJlZjpvcmlnaW5hbERvY3VtZW50SUQ9InhtcC5kaWQ6NTFkNmRjN2QtODgxYi1kODQ1LTllODItYTM5YzgzODVkODUyIi8+IDxwaG90b3Nob3A6RG9jdW1lbnRBbmNlc3RvcnM+IDxyZGY6QmFnPiA8cmRmOmxpPjAxQTQyQzA1N0UxQTBFQjVBNURGMjk3MEVFNTE3RDNEPC9yZGY6bGk+IDxyZGY6bGk+ODQ1ODM4MjNFQjk0ODY2RjJDRjhDOUIwNTg1Q0YwOEI8L3JkZjpsaT4gPHJkZjpsaT45OTk4RUY1MTQzQ0ZFQjBDRDBDRTNBMkZCOTI1OTVBNDwvcmRmOmxpPiA8cmRmOmxpPkEwMDg1Rjk5NEUxMTUyRjE0MjFERUZEOTBEODVCQjUyPC9yZGY6bGk+IDxyZGY6bGk+YWRvYmU6ZG9jaWQ6cGhvdG9zaG9wOmYzNGZjNzQyLWNlYzUtNzQ0Ni04ZTcxLTk0MGE0M2ZhM2RmODwvcmRmOmxpPiA8L3JkZjpCYWc+IDwvcGhvdG9zaG9wOkRvY3VtZW50QW5jZXN0b3JzPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8P3hwYWNrZXQgZW5kPSJ3Ij8+/+ICQElDQ19QUk9GSUxFAAEBAAACMEFEQkUCEAAAbW50clJHQiBYWVogB88ABgADAAAAAAAAYWNzcEFQUEwAAAAAbm9uZQAAAAAAAAAAAAAAAAAAAAAAAPbWAAEAAAAA0y1BREJFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKY3BydAAAAPwAAAAyZGVzYwAAATAAAABrd3RwdAAAAZwAAAAUYmtwdAAAAbAAAAAUclRSQwAAAcQAAAAOZ1RSQwAAAdQAAAAOYlRSQwAAAeQAAAAOclhZWgAAAfQAAAAUZ1hZWgAAAggAAAAUYlhZWgAAAhwAAAAUdGV4dAAAAABDb3B5cmlnaHQgMTk5OSBBZG9iZSBTeXN0ZW1zIEluY29ycG9yYXRlZAAAAGRlc2MAAAAAAAAAEUFkb2JlIFJHQiAoMTk5OCkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFhZWiAAAAAAAADzUQABAAAAARbMWFlaIAAAAAAAAAAAAAAAAAAAAABjdXJ2AAAAAAAAAAECMwAAY3VydgAAAAAAAAABAjMAAGN1cnYAAAAAAAAAAQIzAABYWVogAAAAAAAA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',
        exposes: [e.soil_moisture(), e.battery(), e.battery_low(),
		    e.battery_voltage(), e.temperature(), e.humidity(), e.illuminance(),
			exposes.enum('tx_radio_power', ea.STATE_SET, [0, 4, 10, 19]).withDescription('Set TX Radio Power, dbm)'),
			exposes.enum('invert', ea.STATE_SET, [0, 1]).withDescription('Invert display color'),
		    exposes.enum('fastmode', ea.STATE_SET, [0, 1]).withDescription('FM or UFM'),
			exposes.numeric('reading_interval', ea.STATE_SET).withUnit('Minutes').withDescription('Setting the sensor reading interval Setting the time in minutes, by default 5 minutes')
                .withValueMin(1).withValueMax(360),
			exposes.numeric('lower_level', ea.STATE_SET).withUnit('%').withDescription('The lower level of soil moisture 0% is:')
                .withValueMin(0).withValueMax(99),
			exposes.numeric('upper_level', ea.STATE_SET).withUnit('%').withDescription('The upper level of soil moisture 100% is:')
                .withValueMin(1).withValueMax(100),
			exposes.binary('invert', ea.STATE_SET, 'ON', 'OFF').withDescription('Invert display color'),
			exposes.binary('mode1', ea.STATE_SET, 'ON', 'OFF').withDescription('Measurement method'),
			exposes.binary('mode2', ea.STATE_SET, 'ON', 'OFF').withDescription('Temperature compensation')],
};

module.exports = definition;
