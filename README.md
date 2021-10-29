# amqplib-wrapper
![CI](https://github.com/artie-owlet/amqplib-wrapper/actions/workflows/ci.yaml/badge.svg)
![Coverage](https://github.com/artie-owlet/amqplib-wrapper/actions/workflows/coverage.yaml/badge.svg)
![Lint](https://github.com/artie-owlet/amqplib-wrapper/actions/workflows/lint.yaml/badge.svg)

Wrapper around [amqplib](https://www.npmjs.com/package/amqplib) that automatically reconnects and creates channels.

---

## Install

```bash
npm install @artie-owlet/amqplib-wrapper
```

## Usage

```javascript
import { ConnectionWrapper } from '@artie-owlet/amqplib-wrapper';

// create connection wrapper
const connWrap = new ConnectionWrapper({
    reconnectTimeout: 1000,
});

// create channel wrapper
const chanWrap = connWrap.createChannelWrapper();

// get amqplib Channel and immediately use it
const chan = await chanWrap.getChannel();
chan.publish('my-ex', 'rk', Buffer.from('hello'));

// handle "open" event to start/resume consuming
chanWrap.on('open', async (chan) => {
    await chan.assertQueue('my-queue');
    chan.consume('my-queue', (msg) => {
        // ...
    });
});
```

## API

See artie-owlet.github.io/amqplib-wrapper
