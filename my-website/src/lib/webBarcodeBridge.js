/**
 * جسر Web Serial / Web Bluetooth لقارئات الباركود التي ترسل نصاً عبر UART
 * (Chrome/Edge على HTTPS أو localhost — لا يعمل على Safari/iOS).
 */

function normalizeBarcode(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  return s.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
}

export function supportsWebSerial() {
  return typeof navigator !== 'undefined' && 'serial' in navigator && typeof navigator.serial?.requestPort === 'function';
}

export function supportsWebBluetooth() {
  return (
    typeof navigator !== 'undefined' &&
    'bluetooth' in navigator &&
    typeof navigator.bluetooth?.requestDevice === 'function'
  );
}

/** Nordic UART Service (شائع في وحدات BLE UART) */
const NUS_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const NUS_RX_NOTIFY = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

/** HM-10 / بعض وحدات BLE التسلسلية */
const HM10_SERVICE = '0000ffe0-0000-1000-8000-00805f9b34fb';
const HM10_CHAR = '0000ffe1-0000-1000-8000-00805f9b34fb';

function parseBufferLines(bufferRef, chunk, onLine) {
  if (!bufferRef) return;
  bufferRef.current += new TextDecoder().decode(chunk, { stream: true });
  let buf = bufferRef.current;

  while (true) {
    const m = buf.match(/^([\s\S]*?)(\r\n|\r|\n)/);
    if (!m) break;
    const line = m[1].trim();
    buf = buf.slice(m[0].length);
    if (line) onLine(normalizeBarcode(line) || line);
  }
  bufferRef.current = buf;
  if (buf.length > 2048) bufferRef.current = buf.slice(-1024);
}

/** إن لم يُرسل الجهاز سطراً جديداً، نُفرغ الـ buffer بعد هدوء قصير (بعض القارئات بدون \r) */
function scheduleIdleFlush(bufferRef, onBarcode, timersRef) {
  if (timersRef.current) clearTimeout(timersRef.current);
  timersRef.current = setTimeout(() => {
    timersRef.current = null;
    const rest = String(bufferRef.current || '').trim();
    if (rest.length < 4) return;
    if (/[\r\n]/.test(rest)) return;
    if (/^[\dA-Za-z\-]+$/.test(rest)) {
      onBarcode(normalizeBarcode(rest) || rest);
      bufferRef.current = '';
    }
  }, 130);
}

/**
 * @param {{ baudRate?: number, onBarcode: (code: string) => void, onError?: (e: Error) => void }} opts
 */
export async function connectWebSerialScanner(opts) {
  const { baudRate = 9600, onBarcode, onError } = opts;
  const port = await navigator.serial.requestPort();
  await port.open({ baudRate });
  const reader = port.readable.getReader();
  const bufferRef = { current: '' };
  const idleTimersRef = { current: null };
  let cancelled = false;

  const pump = async () => {
    try {
      while (!cancelled) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value && value.byteLength) {
          parseBufferLines(bufferRef, value, onBarcode);
          const left = bufferRef.current.trim();
          if (left && !/[\r\n]/.test(bufferRef.current)) {
            scheduleIdleFlush(bufferRef, onBarcode, idleTimersRef);
          }
        }
      }
    } catch (e) {
      if (!cancelled) onError?.(e);
    }
  };
  pump();

  return {
    port,
    async disconnect() {
      cancelled = true;
      if (idleTimersRef.current) clearTimeout(idleTimersRef.current);
      try {
        await reader.cancel();
      } catch {
        /* ignore */
      }
      try {
        await port.close();
      } catch {
        /* ignore */
      }
    },
  };
}

async function subscribeNordicUart(server, onBarcode) {
  const bufferRef = { current: '' };
  const idleTimersRef = { current: null };
  const service = await server.getPrimaryService(NUS_UUID);
  const rx = await service.getCharacteristic(NUS_RX_NOTIFY);
  const handler = (event) => {
    const v = event.target?.value;
    if (!v || v.byteLength === 0) return;
    const copy = new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
    parseBufferLines(bufferRef, copy, onBarcode);
    const left = bufferRef.current.trim();
    if (left && !/[\r\n]/.test(bufferRef.current)) {
      scheduleIdleFlush(bufferRef, onBarcode, idleTimersRef);
    }
  };
  rx.addEventListener('characteristicvaluechanged', handler);
  await rx.startNotifications();
  return async () => {
    if (idleTimersRef.current) clearTimeout(idleTimersRef.current);
    try {
      rx.removeEventListener('characteristicvaluechanged', handler);
      await rx.stopNotifications();
    } catch {
      /* ignore */
    }
  };
}

async function subscribeHm10(server, onBarcode) {
  const bufferRef = { current: '' };
  const idleTimersRef = { current: null };
  const service = await server.getPrimaryService(HM10_SERVICE);
  const ch = await service.getCharacteristic(HM10_CHAR);
  const handler = (event) => {
    const v = event.target?.value;
    if (!v || v.byteLength === 0) return;
    const copy = new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
    parseBufferLines(bufferRef, copy, onBarcode);
    const left = bufferRef.current.trim();
    if (left && !/[\r\n]/.test(bufferRef.current)) {
      scheduleIdleFlush(bufferRef, onBarcode, idleTimersRef);
    }
  };
  ch.addEventListener('characteristicvaluechanged', handler);
  await ch.startNotifications();
  return async () => {
    if (idleTimersRef.current) clearTimeout(idleTimersRef.current);
    try {
      ch.removeEventListener('characteristicvaluechanged', handler);
      await ch.stopNotifications();
    } catch {
      /* ignore */
    }
  };
}

/**
 * @param {{ onBarcode: (code: string) => void, onError?: (e: Error) => void }} opts
 */
export async function connectWebBluetoothUartScanner(opts) {
  const { onBarcode, onError } = opts;
  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [NUS_UUID, HM10_SERVICE],
  });

  const server = await device.gatt.connect();
  let unsubscribe = async () => {};

  try {
    unsubscribe = await subscribeNordicUart(server, onBarcode);
  } catch {
    try {
      unsubscribe = await subscribeHm10(server, onBarcode);
    } catch (e2) {
      try {
        server.disconnect();
      } catch {
        /* ignore */
      }
      onError?.(e2);
      throw e2;
    }
  }

  return {
    device,
    async disconnect() {
      try {
        await unsubscribe();
      } catch {
        /* ignore */
      }
      try {
        server.disconnect();
      } catch {
        /* ignore */
      }
    },
  };
}
