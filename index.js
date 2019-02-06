const ping = require ("net-ping");
const dns = require ("dns");

const Plugin = require('./lib/plugin');

const plugin = new Plugin();
const session = ping.createSession();

const DATA = {};

let debug = false;


plugin.on('params', params => {

});

plugin.on('channels', channels => {
  getIPtoHost(channels)
  .then(start)
});

plugin.on('debug', mode => {
  debug = mode
});

function getIP(channel) {
  return new Promise(resolve => {
    dns.resolve4(channel.ip, (err, ip) => {
      if (err || ip.length === 0) {
        resolve(channel)
      } else {
        channel.ip = ip[0];
        resolve(channel)
      }
    })
  });
}


function getIPtoHost(channels) {
  return Promise.all(channels.map(getIP));
}

function check(ip, id) {
  if (DATA[ip].error > DATA[ip].lost) {
    debug && plugin.debug(`${id} ${ip}: offline`);
    plugin.setChannelsData([{ id, value: 0, ext: {} }]);

    DATA[ip].error = 0;
  } else {
    if (DATA[ip].error === 0) {
      debug && plugin.debug(`${id} ${ip}: online `);
      plugin.setChannelsData([{ id, value: 1, ext: {} }]);

      DATA[ip].error = 0;
    }
  }
}

function response(error, ip, id) {
  if (error) {
    DATA[ip].error = DATA[ip].error + 1;
  } else {
    DATA[ip].error = 0;
  }
  check(ip, id);
}

function createPinger(id, ip, interval, lost) {
  DATA[ip] = { error: 0, lost };
  setInterval(() => session.pingHost(ip, (err, ip) => response(err, ip, id)), interval * 1000)
  session.pingHost(ip, (err, ip) => response(err, ip, id));
}


function start(items) {
  plugin.debug("version: 0.0.5");
  plugin.debug("start");
  plugin.debug("hosts: " + items.length);
  items.forEach(item => {
    createPinger(item.id, item.ip, item.interval, item.lost);
  });
}
