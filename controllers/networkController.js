const { exec } = require('child_process');
const logger = require('../services/loggerService');

const scanNetwork = async (req, res) => {
  try {
    // Get local IP first
    exec("ifconfig 2>/dev/null | grep 'inet ' | grep -v '127.0.0.1' | awk '{print $2}' | head -1", (err, ip) => {
      if (err || !ip.trim()) {
        return res.json({ success: false, message: 'IP detect nahi ho paya', devices: [] });
      }

      const localIp = ip.trim();
      // Network range banao
      const parts = localIp.split('.');
      const range = `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;

      logger.info(`Network scan: ${range}`, 'NETWORK');

      exec(`nmap -sn --host-timeout 3s ${range} 2>/dev/null`, { timeout: 30000 }, (err2, stdout) => {
        const devices = [];
        const lines = stdout?.split('\n') || [];
        let currentDevice = null;

        lines.forEach(line => {
          if (line.includes('Nmap scan report for')) {
            if (currentDevice) devices.push(currentDevice);
            const ipMatch = line.match(/(\d+\.\d+\.\d+\.\d+)/);
            const hostMatch = line.match(/for (.+?) \(/) || line.match(/for (.+)$/);
            currentDevice = {
              ip: ipMatch?.[1] || '',
              hostname: hostMatch?.[1]?.trim() || '',
              status: 'up',
              mac: '',
              vendor: '',
              isLocal: ipMatch?.[1] === localIp,
            };
          }
          if (line.includes('MAC Address:') && currentDevice) {
            const macMatch = line.match(/MAC Address: ([A-F0-9:]+)/);
            const vendorMatch = line.match(/\((.+)\)/);
            currentDevice.mac = macMatch?.[1] || '';
            currentDevice.vendor = vendorMatch?.[1] || 'Unknown';
          }
        });
        if (currentDevice) devices.push(currentDevice);

        res.json({
          success: true,
          devices,
          localIp,
          range,
          scannedAt: new Date().toISOString(),
        });
      });
    });
  } catch (e) {
    logger.error(`Network scan error: ${e.message}`, 'NETWORK_ERROR');
    res.status(500).json({ success: false, message: e.message, devices: [] });
  }
};

module.exports = { scanNetwork };
