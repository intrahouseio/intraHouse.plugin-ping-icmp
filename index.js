require('es6-promise').polyfill();
require('isomorphic-fetch');

const Plugin = require('./lib/plugin');

const wrtc = require('wrtc');
const WebSocket = require('ws');
const Peer = require('./lib/peer');

let peer = null;

const HOST = 'intrahouse.io:49800';

const SESSION_TIMEOUT = 1000 * 10;
const PLUGIN_TIMECHECK = 1000 * 60;


const DATA = {
  status: 0,
  session: null,
  connection: {},
};


const plugin = new Plugin();


function req(route, data = {}) {
  data.id = ID;
  return fetch(`http://${HOST}/${route}`, {
    method: 'post',
    body: JSON.stringify(data),
    headers: new Headers({ 'content-type': 'application/json' }),

  })
  .then(res => res.json());
}

function sendAnswer(data) {
  req('answer', { data })
    .then(res => {
      plugin.debug('has registered');
      DATA.server_session = res.server_session;
      DATA.status = 1;
    })
    .catch(() => {
      DATA.status = 0;
    });
}

function sendRegister() {
  req('register')
    .then(res => {
      if (res.response) {
        res.params.forEach(i => peer.signal(i));
      } else {
        DATA.status = 0;
      }
    })
    .catch(() => {
      DATA.status = 0;
    });
}

function getFile(peer, file) {
  if (file === 'bundle.pm.js') {
   fetch(`http://${IH_SERVER_HOST}/pm/js/bundle.js.gz`)
    .then(res => res.text())
    .then(data => peer.send(JSON.stringify({ type: 'file', name: 'bundle.pm.js', data })));
  }

  if (file === 'bundle.ui.js') {
  fetch(`http://${IH_SERVER_HOST}/js/bundle.js.gz`)
    .then(res => res.text())
    .then(data => peer.send(JSON.stringify({ type: 'file', name: 'bundle.ui.js', data })));
  }
}

function getImg(peer, file) {
  fetch(`http://${IH_SERVER_HOST}/uploadfiles/images/${file}`)
  .then(res => res.buffer())
  .then(buf => peer.send(JSON.stringify({ type: 'img', name: file, data: buf.toString('base64') })));
}

function clentData(id, data) {
  const msg = JSON.parse(data);
  switch (msg.type) {
    case 'file':
        getFile(DATA.connection[id].peer, msg.data)
      break;
    case 'img':
        getImg(DATA.connection[id].peer, msg.data)
      break;
    case 'ws':
        DATA.connection[id].ws.send(msg.data);
      break;
    default:
      break;
  }
}

function serverData(id, msg) {
  DATA.connection[id].peer.send(JSON.stringify({ type: 'ws', data: msg.data }));
}

function setSession(msg) {
  const id = msg.session;
  const clientpeer = new Peer({ wrtc });
  clientpeer.on('data', data => clentData(id, data));
  DATA.connection[id] = {
    peer: clientpeer,
    ws: null,
    ip: msg.ip,
    session: msg.session,
  };
  createWS(id);
}

function setOffer(msg) {
  const temp = [];
  const id = msg.session;
  const clientpeer = DATA.connection[id].peer;
  msg.data.forEach(i => clientpeer.signal(i))

  clientpeer.on('close', () => close(id));
  clientpeer.on('connect', () => connect(id));
  clientpeer.on('signal', data => temp.push(data));
  clientpeer.on('complete', () => {
    peer.send(JSON.stringify({
      id: msg.id,
      type: 'answer',
      session: msg.session,
      data: temp,
    }));
  });
}

function createWS(id) {
  DATA.connection[id].ws = new WebSocket(`ws://${IH_SERVER_HOST}/backend`);
  DATA.connection[id].ws.onmessage = data => serverData(id, data);
}


function createConnection(msg) {
  DATA.session = msg.session;
  setTimeout(() => {
    if (DATA.session) {
      reRegistration();
    }
  }, SESSION_TIMEOUT);

}

function message(msg) {
  switch (msg.type) {
    case 'session':
      setSession(msg);
      createConnection(msg);
      break;
    case 'offer':
      setOffer(msg);
      break;
    default:
      break;
  }
}

function reRegistration() {
  DATA.session = null;
  peer.destroy();
  peer = null;
  start();
  plugin.debug('re-registration');
}

function connect(id) {
  plugin.debug(`client connect ${DATA.connection[id].ip}`);
  reRegistration();
}

function close(id) {
  DATA.connection[id].ws.close();
  DATA.connection[id].peer.destroy();
  plugin.debug(`client close ${DATA.connection[id].ip}`);
  DATA.connection[id].ws = null;
  DATA.connection[id].peer= null;
  DATA.connection[id] = null;
  delete DATA.connection[id];
}

function start() {
  peer = new Peer({ wrtc });
  const temp = [];

  peer.on('signal', data => temp.push(data));
  peer.on('complete', () => sendAnswer(temp));
  // peer.on('close', () => console.log('----close----'));

  peer.on('data', data => {
    try {
      const msg = JSON.parse(data);
      if (msg.id === ID) {
        message(msg);
      }
    } catch (e) {

    }
  })

  sendRegister();
}

function checkplugin() {
  const status = DATA.status;
  const server_session = DATA.server_session;
  plugin.debug('check');
  if (!status) {
    plugin.debug('not registred');
    reRegistration();
    setTimeout(checkplugin, PLUGIN_TIMECHECK);
  } else {
    req('check', { })
      .then(res => {
        if (server_session !== res.server_session) {
          plugin.debug('server session change');
          reRegistration();
        }
        setTimeout(checkplugin, PLUGIN_TIMECHECK);
      })
      .catch(() => {
        DATA.status = 0;
        reRegistration();
        setTimeout(checkplugin, PLUGIN_TIMECHECK)
      });
  }
}

function core() {
  plugin.debug('start');
  plugin.debug(`key:${ID}, host:${IH_SERVER_HOST}`);
  setTimeout(checkplugin, PLUGIN_TIMECHECK)
  start();
}

plugin.on('params', params => {
  ID = params.plugin.lkey || 'xxxx-xxxx-xxxxx-xxxxx';
  IH_SERVER_HOST = `127.0.0.1:${params.system.port || 8088}`;
  core();
});
