const Plugin = require('./lib/plugin');
const ping = require ("net-ping");

const plugin = new Plugin();
const session = ping.createSession();

const DATA = {};

let debug = false;


plugin.on('params', params => {

});

plugin.on('channels', channels => {
  start(channels);
});

plugin.on('debug', mode => {
  debug = mode;
});

function check(ip) {
  if (DATA[ip].error > DATA[ip].lost) {
    plugin.debug(`ping_${ip} -> offline!`);
    plugin.setChannelsData([{ id: `ping_${ip}`, value: 0, ext: {} }]);

    DATA[ip].error = 0;
  } else {
    if (DATA[ip].error === 0) {
      plugin.debug(`ping_${ip} -> online!`);
      plugin.setChannelsData([{ id: `ping_${ip}`, value: 1, ext: {} }]);
      
      DATA[ip].error = 0;
    }
  }
}

function response(error, ip) {
  if (error) {
    DATA[ip].error = DATA[ip].error + 1;
  } else {
    DATA[ip].error = 0;
  }
  check(ip);
}

function createPinger(ip, interval, lost) {
  DATA[ip] = { error: 0, lost };
  setInterval(() => session.pingHost(ip, response), interval * 1000)
  session.pingHost(ip, response);
}


function start(items) {
  items.forEach(item => {
    createPinger(item.ip, item.interval, item.lost);
  });
}


/* --------------------------

  plugin.setChannelsData([{ id: 'DI_1', value: 1, ext: {} }]);

*/
